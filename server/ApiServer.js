// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import util from 'util';

import log from './log';

export default class ApiServer {
  /**
   * Constructs an instance. Each instance corresponds to a separate client
   * connection. As a side effect, the contructor attaches the constructed
   * instance to the websocket.
   *
   * @param ws A websocket instance corresponding to that connection.
   * @param doc The document to interact with.
   */
  constructor(ws, doc) {
    this.ws = ws;
    this.doc = doc;
    ws.on('message', this._handleMessage.bind(this));
    ws.on('close', this._handleClose.bind(this));
    ws.on('error', this._handleError.bind(this));
  }

  /**
   * Handles a `message` event coming from the underlying websocket. For valid
   * methods, this calls the method implementation and handles both the case
   * where the result is a simple value or a promise.
   */
  _handleMessage(msg) {
    log('Websocket message:');
    msg = JSON.parse(msg);
    log(msg);

    const method = msg.method;
    let impl;
    if (method === undefined) {
      impl = this.error_missing_method;
    } else if (typeof method !== 'string') {
      impl = this.error_bad_method;
    } else {
      impl = this[`method_${method}`];
      if (!impl) {
        impl = this.error_unknown_method;
      }
    }

    // Function to send a response. Arrow syntax so that `this` is usable.
    const respond = (result, error) => {
      let response = { id: msg.id };
      if (error) {
        response.ok = false;
        response.error = error.message;
      } else {
        response.ok = true;
        response.result = result;
      }

      log('Websocket response:');
      log(response);
      if (error) {
        log(error);
      }
      this.ws.send(JSON.stringify(response));
    }

    try {
      // Note: If the method implementation returns a non-promise, then the
      // `resolve()` call operates promptly.
      Promise.resolve(impl.call(this, msg.args)).then(
        (result) => { respond(result, null); },
        (error) => { respond(null, error); });
    } catch (error) {
      respond(null, error);
    }
  }

  /**
   * Handles a `close` event coming from the underlying websocket.
   */
  _handleClose(code, msg) {
    log('Websocket close:');
    log(code);
    log(msg);
  }

  /**
   * Handles an `error` event coming from the underlying websocket.
   */
  _handleError(err) {
    log('Websocket error:');
    log(err);
  }

  /**
   * API error: Bad value for `method` in call payload (not a string).
   */
  error_bad_method(args) {
    throw new Error('bad_method');
  }

  /**
   * API error: Missing `method` in call payload.
   */
  error_missing_method(args) {
    throw new Error('missing_method');
  }

  /**
   * API error: Unknown (undefined) method.
   */
  error_unknown_method(args) {
    throw new Error('unknown_method');
  }

  /**
   * API method `test`: Returns the same arguments as it was passed.
   */
  method_test(args) {
    return args;
  }

  /**
   * API method `snapshot`: Returns an instantaneous snapshot of the document
   * contents. Result is an object that maps `data` to the snapshot data and
   * `version` to the version number.
   */
  method_snapshot(args) {
    return this.doc.snapshot();
  }

  /**
   * API method `applyDelta`: Takes a base version number and delta therefrom,
   * and applies the delta, including merging of any intermediate versions.
   * Result is an object consisting of a new version number, and a
   * delta which can be applied to version `baseVersion` to get the new
   * document.
   */
  method_applyDelta(args) {
    return this.doc.applyDelta(args.baseVersion, args.delta);
  }

  /**
   * API method `deltaAfter`: Returns a promise for a snapshot of any version
   * after the given `baseVersion`, and relative to that version. Result is an
   * object consisting of a new version number, and a delta which can be applied
   * to version `baseVersion` to get the new document. If called when
   * `baseVersion` is the current version, this will not fulfill the result
   * promise until at least one change has been made.
   */
  method_deltaAfter(args) {
    return this.doc.deltaAfter(args.baseVersion);
  }
}
