// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from 'typecheck';

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
export default class BaseKey {
  /**
   * Constructs an instance with the indicated parts. Subclasses should override
   * methods as described in the documentation.
   *
   * @param {string} url URL at which the resource may be accessed. This is
   *   expected to be an API endpoint. Alternatively, if this instance will only
   *   ever be used in a context where the URL is implied or superfluous, this
   *   can be passed as `*` (a literal asterisk).
   * @param {string} id Key / resource identifier. This must be a string of at
   *   least 8 characters.
   */
  constructor(url, id) {
    if (url !== '*') {
      TString.urlAbsolute(url);
    }

    /** {string} URL at which the resource may be accessed, or `*`. */
    this._url = url;

    /** {string} Key / resource identifier. */
    this._id = TString.minLen(id, 8);
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
   * Gets the printable form of the ID. This defaults to the same as `.id`,
   * but subclasses can override this if they want to produce something
   * different.
   *
   * @returns {string} The printable form of the ID.
   */
  _impl_printableId() {
    return this.id;
  }

  /**
   * Gets the redacted form of this instance.
   *
   * @returns {string} The redacted form.
   */
  toString() {
    const name = this.constructor.API_NAME || this.constructor.name;
    return `{${name} ${this._url} ${this._impl_printableId()}}`;
  }

  /**
   * Helper function which always throws. Using this both documents the intent
   * in code and keeps the linter from complaining about the documentation
   * (`@param`, `@returns`, etc.).
   *
   * @param {...*} args_unused Anything you want, to keep the linter happy.
   */
  _mustOverride(...args_unused) {
    throw new Error('Must override.');
  }
}
