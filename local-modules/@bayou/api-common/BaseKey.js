// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { inspect } from 'util';

import { TString } from '@bayou/typecheck';
import { CommonBase, Errors, URL } from '@bayou/util-common';

import TargetId from './TargetId';

/**
 * Base class for access keys. An access key consists of information for
 * accessing a network-accessible resource, along with functionality for
 * performing authentication. In general, a given instance of this class
 * represents access to a particular resource, but that same resource might also
 * be available via different instances of the class too, and even using
 * different IDs. (That is, it can be a many-to-one relationship.)
 *
 * Instances of this (base) class hold two pieces of information:
 *
 * * A URL at which the resource is available.
 * * The ID of the resource.
 *
 * In addition, subclasses can include additional information.
 *
 * **Note:** The resource ID is _not_ meant to require secrecy in order for
 * the system to be secure. That is, IDs are not required to be unguessable.
 */
export default class BaseKey extends CommonBase {
  /**
   * Constructs an instance with the indicated parts. Subclasses should override
   * methods as described in the documentation.
   *
   * @param {string} url Absolute URL at which the resource may be accessed.
   *   This is expected to be an API endpoint. Alternatively, if this instance
   *   will only ever be used in a context where the URL is implied or
   *   superfluous, this can be passed as `*` (a literal asterisk). This is
   *   _not_ allowed to have URL-level "auth" info (e.g.,
   *   `http://user:pass@example.com/`).
   * @param {string} id Key / resource identifier. This must be a `TargetId` of
   *   at least 8 characters.
   */
  constructor(url, id) {
    super();

    if (url !== '*') {
      TString.urlAbsolute(url);
    }

    /** {string} URL at which the resource may be accessed, or `*`. */
    this._url = url;

    /** {string} Key / resource identifier. */
    this._id = TargetId.minLen(id, 8);
  }

  /**
   * {string} Base of `url` (that is, the origin without any path). This throws
   * an error if `url` is `*`.
   */
  get baseUrl() {
    if (this._url === '*') {
      throw Errors.badUse('Cannot get base of wildcard URL.');
    }

    return new URL(this._url).origin;
  }

  /** {string} URL at which the resource may be accessed, or `*`. */
  get url() {
    return this._url;
  }

  /** {string} Key / resource identifier. */
  get id() {
    return this._id;
  }

  /**
   * Gets a challenge response. This is used as a tactic for two sides of a
   * connection to authenticate each other without ever having to provide a
   * shared secret directly over a connection.
   *
   * @param {string} challenge The challenge. This must be a string which was
   *   previously returned as the `challenge` binding from a call to
   *   `makeChallenge()` (either in this process or any other).
   * @returns {string} The challenge response. It is guaranteed to be at least
   *   16 characters long.
   */
  challengeResponseFor(challenge) {
    TString.minLen(challenge, 16);
    const response = this._impl_challengeResponseFor(challenge);
    return TString.minLen(response, 16);
  }

  /**
   * Main implementation of `challengeResponseFor()`. By default this throws
   * an error ("not implemented"). Subclasses wishing to support challenges
   * must override this to do something else.
   *
   * @param {string} challenge The challenge. It is guaranteed to be a string of
   *   at least 16 characters.
   * @returns {string} The challenge response.
   */
  _impl_challengeResponseFor(challenge) {
    return this._mustOverride(challenge);
  }

  /**
   * Custom inspector function, as called by `util.inspect()`. This
   * implementation redacts the contents so as to prevent inadvertent logging of
   * the secret values.
   *
   * @param {Int} depth_unused Current inspection depth.
   * @param {object} opts Inspection options.
   * @returns {string} The inspection string form of this instance.
   */
  [inspect.custom](depth_unused, opts) {
    const name = this.constructor.name;

    return (opts.depth < 0)
      ? `${name} {...}`
      : `${name} { ${this._url} ${this._impl_printableId()} }`;
  }

  /**
   * Creates a random challenge, to be used for authenticating a peer, and
   * provides both it and the expected response.
   *
   * @returns {object} An object which maps `challenge` to a random challenge
   *   string and `response` to the expected response.
   */
  makeChallengePair() {
    const challenge = this._impl_randomChallengeString();
    const response  = this.challengeResponseFor(challenge);

    TString.minLen(challenge, 16);
    return { challenge, response };
  }

  /**
   * Creates and returns a random challenge string. The returned string must be
   * at least 16 characters long but may be longer. By default this throws an
   * error ("not implemented"). Subclasses wishing to support challenges must
   * override this to do something else.
   *
   * @returns {string} A random challenge string.
   */
  _impl_randomChallengeString() {
    return this._mustOverride();
  }

  /**
   * Gets the printable form of the ID. This defaults to the same as `.id`,
   * but subclasses can override this if they want to produce something
   * different.
   *
   * @returns {string} The printable form of the ID.
   */
  _impl_printableId() {
    return this.id;
  }
}
