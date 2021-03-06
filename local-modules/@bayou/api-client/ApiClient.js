// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseKey, CodableError, ConnectionError, Message, Response } from '@bayou/api-common';
import { Codec } from '@bayou/codec';
import { Logger } from '@bayou/see-all';
import { TString } from '@bayou/typecheck';
import { CommonBase, WebsocketCodes } from '@bayou/util-common';

import TargetMap from './TargetMap';

/** Logger. */
const log = new Logger('api');

/** Value used for an unknown connection ID. */
const UNKNOWN_CONNECTION_ID = 'id_unknown';

/**
 * Connection with the server, via a websocket.
 */
export default class ApiClient extends CommonBase {
  /**
   * Constructs an instance. This instance will connect to a websocket at the
   * same domain at the path `/api`. Once this constructor returns, it is safe
   * to call any API methods on the instance's associated `target`. If the
   * socket isn't yet ready for traffic, the messages will get enqueued and then
   * replayed in order once the socket becomes ready.
   *
   * @param {string} url The server origin, as an `http` or `https` URL.
   * @param {Codec} codec Codec instance to use. In order to function properly,
   *   its registry must include all of the encodable classes defined in
   *   `@bayou/api-common` classes. See
   *   {@link @bayou/api-common.TheModule.registerCodecs}.
   */
  constructor(url, codec) {
    super();

    /** {string} Base URL for the server. */
    this._baseUrl = ApiClient._getBaseUrl(url);

    /** {Codec} Codec instance to use. */
    this._codec = Codec.check(codec);

    /**
     * {string|null} Connection ID conveyed to us by the server. Reset in
     * `_resetConnection()`.
     */
    this._connectionId = null;

    /**
     * {Logger} Logger which prefixes everything with the connection ID (if
     * available). Set in {@link #_updateLogger}, which is called whenever
     * {@link #_connectionId} is updated.
     */
    this._log = log;

    /**
     * {WebSocket} Actual websocket instance. Set by `open()`. Reset in
     * `_resetConnection()`.
     */
    this._ws = null;

    /**
     * {Int} Next message ID to use when sending a message. Initialized and
     * reset in `_resetConnection()`.
     */
    this._nextId = 0;

    /**
     * {object<Int,{resolve, reject}>} Map from message IDs to response
     * callbacks. Each callback is an object that maps `resolve` and `reject` to
     * functions that obey the usual promise contract for functions of those
     * names. Initialized and reset in `_resetConnection()`.
     */
    this._callbacks = null;

    /**
     * {array<string>} List of pending messages (to be sent to the far side of
     * the connection). Only used when connection is in the middle of being
     * established. Initialized and reset in `_resetConnection()`.
     */
    this._pendingMessages = null;

    /**
     * {TargetMap} Map of names to target proxies. See {@link
     * TargetMap#constructor} for details about the argument.
     */
    this._targets = new TargetMap(this._send.bind(this));

    /**
     * {Map<string, Promise<Proxy>>} Map from target IDs to promises of their
     * proxy, for each ID currently in the middle of being authorized. Used to
     * avoid re-issuing authorization requests.
     */
    this._pendingAuths = new Map();

    // Initialize the active connection fields (described above).
    this._resetConnection();

    Object.seal(this);
  }

  /** {string} Base URL for the remote endpoint this client gets attached to. */
  get baseUrl() {
    return this._baseUrl;
  }

  /**
   * {string} The connection ID if known, or a reasonably suggestive string if
   * not. This class automatically sets the ID when connections get made, so
   * that clients don't generally have to make an API call to get this info.
   */
  get connectionId() {
    return this._connectionId;
  }

  /**
   * {Logger} The client-specific logger.
   */
  get log() {
    return this._log;
  }

  /**
   * {Proxy} The object upon which meta-API calls can be made.
   */
  get meta() {
    return this._targets.get('meta');
  }

  /**
   * Performs a challenge-response authorization for a given key. When the
   * returned promise resolves successfully, that means that the corresponding
   * target (that is, `this.getTarget(key)`) can be accessed without further
   * authorization.
   *
   * If `key.id` is already mapped as a target, it is returned directly, without
   * further authorization. If it is in the middle of being authorized, the
   * existing pending promise for the target is returned. (That is, this method
   * is idempotent.)
   *
   * @param {BaseKey} key Key to authorize with.
   * @returns {Promise<Proxy>} Promise which resolves to the proxy that
   *   represents the foreign target which is controlled by `key`, once
   *   authorization is complete.
   */
  authorizeTarget(key) {
    BaseKey.check(key);

    const id   = key.id;
    const meta = this.meta;
    let result;

    result = this._targets.getOrNull(id);
    if (result !== null) {
      // The target is already authorized and bound. Return it.
      return result;
    }

    result = this._pendingAuths.get(id);
    if (result) {
      // We have already initiated authorization on this target. Return the
      // promise from the original initiation.
      this._log.info('Already authing:', id);
      return result;
    }

    // It's not yet bound as a target, and authorization isn't currently in
    // progress.

    result = (async () => {
      try {
        const challenge = await meta.makeChallenge(id);
        const response  = key.challengeResponseFor(challenge);

        this._log.event.gotChallenge(id, challenge);
        await meta.authWithChallengeResponse(challenge, response);

        // Successful auth.
        this._log.event.authed(id);
        this._pendingAuths.delete(id); // It's no longer pending.
        return this._targets.add(id);
      } catch (error) {
        // Trouble along the way. Clean out the pending auth, and propagate the
        // error.
        this._log.event.authFailed(id);
        this._pendingAuths.delete(id);
        throw error;
      }
    })();

    this._pendingAuths.set(id, result); // It's now pending.
    return result;
  }

  /**
   * Gets a proxy for the target with the given ID or which is controlled by the
   * given key (or which was so controlled prior to authorizing it away). The
   * target must already have been authorized for this method to work (otherwise
   * it is an error); use `authorizeTarget()` to perform authorization.
   *
   * @param {string|BaseKey} idOrKey ID or key for the target.
   * @returns {Proxy} Proxy which locally represents the so-identified
   *   server-side target.
   */
  getTarget(idOrKey) {
    const id = (idOrKey instanceof BaseKey)
      ? idOrKey.id
      : TString.check(idOrKey);

    return this._targets.get(id);
  }

  /**
   * Opens the websocket. Once open, any pending messages will get sent to the
   * server side. If the socket is already open (or in the process of opening),
   * this does not re-open (that is, the existing open is allowed to continue).
   *
   * @returns {boolean} `true` once the connection is open.
   * @throws {ConnectionError} Indication of why the connection attempt failed.
   */
  async open() {
    // If `_ws` is `null` that means that the connection is not already open or
    // in the process of opening.

    if (this._connectionId !== UNKNOWN_CONNECTION_ID) {
      // Already open.
      return true;
    } else if (this._ws !== null) {
      // In the middle of getting opened. Arguably this should do something a
      // bit more efficient (instead of issuing a separate API call), but also
      // this shouldn't ever happen, so it's not that big a deal.
      this._log.info('open() called while in the middle of opening.');
      await this.meta.ping();
      return true;
    }

    this._ws = new WebSocket(this._websocketUrl);
    this._ws.onclose   = this._handleClose.bind(this);
    this._ws.onerror   = this._handleError.bind(this);
    this._ws.onmessage = this._handleMessage.bind(this);
    this._ws.onopen    = this._handleOpen.bind(this);

    this._updateLogger();
    this._log.event.opening();

    const id = await this.meta.connectionId();

    this._connectionId = id;
    this._updateLogger();
    this._log.event.open();

    return true;
  }

  /** {string} The websocket URL for this instance. */
  get _websocketUrl() {
    const url = new URL(this._baseUrl);

    // Convert the URL scheme to either `ws` or `wss`, corresponding to `http`
    // or `https`.
    url.protocol = url.protocol.replace(/^http/, 'ws');

    // Drop the original path, and replace it with just `/api`.
    url.pathname = '/api';

    return url.href;
  }

  /**
   * Handles a `close` event coming from a websocket. This logs the closure and
   * terminates all active messages by rejecting their promises.
   *
   * @param {object} event Event that caused this callback.
   */
  _handleClose(event) {
    this._log.info('Closed:', event);

    const code = WebsocketCodes.close(event.code);
    const desc = event.reason ? `${code}: ${event.reason}` : code;
    const error = ConnectionError.connection_closed(this._connectionId, desc);

    this._handleTermination(event, error);
  }

  /**
   * Handles an `error` event coming from a websocket. This behaves similarly
   * to the `close` event.
   *
   * **Note:** Because errors in this case are typically due to transient
   * connection issues (e.g. network went away) and not due to fundamental
   * system issues, this is logged as `info` and not `error` (or `warn`).
   *
   * @param {object} event Event that caused this callback.
   */
  _handleError(event) {
    this._log.info('Error:', event);

    // **Note:** The error event does not have any particularly useful extra
    // info, so -- alas -- there is nothing to get out of it for the
    // `ConnectionError` description.
    const error = ConnectionError.connection_error(this._connectionId);
    this._handleTermination(event, error);
  }

  /**
   * Handles a `message` event coming from a websocket. In this case, messages
   * are expected to be the responses from previously-sent messages (e.g.
   * method calls), encoded as JSON. The `id` of the response is used to look up
   * the callback function in `this._callbacks`. That callback is then called in
   * a separate turn.
   *
   * @param {object} event Event that caused this callback.
   */
  _handleMessage(event) {
    this._log.detail('Received raw data:', event.data);

    const response = this._codec.decodeJson(event.data);

    if (!(response instanceof Response)) {
      throw ConnectionError.connection_nonsense(this._connectionId, 'Got strange response.');
    }

    const { id, result, error } = response;

    const callback = this._callbacks[id];
    if (callback) {
      delete this._callbacks[id];
      if (error) {
        // **Note:** `error` is always an instance of `CodableError`.
        this._log.detail(`Reject ${id}:`, error);
        // What's going on here is that we use the information from the original
        // error as the outer error payload, and include a `cause` that
        // unambiguously indicates that the origin is remote. This arrangement
        // means that clients can handle well-defined errors fairly
        // transparently and straightforwardly (e.g. and notably, they don't
        // have to "unwrap" the errors in the usual case), while still being
        // able to ascertain the foreign origin of the errors when warranted.
        const remoteCause = new CodableError('remote_error', this.connectionId);
        const rejectReason = new CodableError(remoteCause, error.info);
        callback.reject(rejectReason);
      } else {
        this._log.detail(`Resolve ${id}:`, result);
        callback.resolve(result);
      }
    } else {
      // See above about `server_bug`.
      throw ConnectionError.connection_nonsense(this._connectionId, `Orphan call for ID ${id}.`);
    }
  }

  /**
   * Handles an `open` event coming from a websocket. In this case, it sends
   * any pending messages (that were enqueued while the socket was still in the
   * process of opening).
   *
   * @param {object} event_unused Event that caused this callback.
   */
  _handleOpen(event_unused) {
    for (const msgJson of this._pendingMessages) {
      this._log.detail('Sent from queue:', msgJson);
      this._ws.send(msgJson);
    }
    this._pendingMessages = [];
  }

  /**
   * Common code to handle both `error` and `close` events.
   *
   * @param {object} event_unused Event that caused this callback.
   * @param {ConnectionError} error Reason for termination. "Error" is a bit of
   *   a misnomer, as in many cases termination is a-okay.
   */
  _handleTermination(event_unused, error) {
    // Reject the promises of any currently-pending messages.
    for (const id in this._callbacks) {
      this._callbacks[id].reject(error);
    }

    // Clear the state related to the websocket. It is safe to re-open the
    // connection after this.
    this._resetConnection();
  }

  /**
   * Init or reset the state having to do with an active connection. See the
   * constructor for documentation about these fields.
   */
  _resetConnection() {
    this._ws              = null;
    this._connectionId    = UNKNOWN_CONNECTION_ID;
    this._nextId          = 0;
    this._callbacks       = {};
    this._pendingMessages = [];
    this._targets.clear();
    this._targets.add('meta'); // The one guaranteed target.

    this._updateLogger();
  }

  /**
   * Sends the given call to the server.
   *
   * **Note:** This method is called via a `TargetHandler` instance, which is
   * in turn called by a proxy object representing an object on the far side of
   * the connection.
   *
   * @param {string} target Name of the target object.
   * @param {Functor} payload The name of the method to call and the arguments
   *   to call it with.
   * @returns {Promise} Promise for the result (or error) of the call. In the
   *   case of an error, the rejection reason will always be an instance of
   *   `ConnectionError` (see which for details).
   */
  _send(target, payload) {
    const wsState = (this._ws === null)
      ? WebSocket.CLOSED
      : this._ws.readyState;

    // Handle the cases where socket shutdown is imminent or has already
    // happened. We don't just `throw` directly here, so that clients can
    // consistently handle errors via one of the promise chaining mechanisms.
    switch (wsState) {
      case WebSocket.CLOSED: {
        // The detail string here differentiates this case from cases where the
        // API message was already queued up or sent before the websocket became
        // closed.
        return Promise.reject(ConnectionError.connection_closed(this._connectionId, 'Already closed.'));
      }
      case WebSocket.CLOSING: {
        return Promise.reject(this.connection_closing(this._connectionId));
      }
    }

    const id = this._nextId;
    this._nextId++;

    const msg     = new Message(id, target, payload);
    const msgJson = this._codec.encodeJson(msg);

    switch (wsState) {
      case WebSocket.CONNECTING: {
        // Not yet open. Need to queue it up.
        this._log.detail('Queued:', msg);
        this._pendingMessages.push(msgJson);
        break;
      }
      case WebSocket.OPEN: {
        this._log.detail('Sent:', msg);
        this._ws.send(msgJson);
        break;
      }
      default: {
        // Whatever this state is, it's not documented as part of the websocket
        // spec!
        this._log.wtf('Weird state:', wsState);
      }
    }

    return new Promise((resolve, reject) => {
      this._callbacks[id] = { resolve, reject };
    });
  }

  /**
   * Updates {@link #_log} based on {@link #_connectionId}.
   */
  _updateLogger() {
    let id = this._connectionId;

    if ((id === null) || (id === UNKNOWN_CONNECTION_ID)) {
      id = (this._ws === null) ? 'unconnected' : 'connecting';
    }

    this._log = log.withAddedContext(id);
  }

  /**
   * Gets the base URL for the given original URL.
   *
   * @param {string} origUrl The original URL.
   * @returns {string} The corresponding base URL.
   */
  static _getBaseUrl(origUrl) {
    return new URL(origUrl).origin;
  }
}
