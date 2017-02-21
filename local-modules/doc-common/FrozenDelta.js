// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Delta from 'quill-delta';

import { DataUtil } from 'util-common';

/**
 * {FrozenDelta|null} Empty `Delta` instance. Initialized in the `EMPTY`
 * property accessor.
 */
let emptyDelta = null;

/**
 * Always-frozen `Delta`.
 */
export default class FrozenDelta extends Delta {
  /** Frozen (immutable) empty `Delta` instance. */
  static get EMPTY() {
    if (emptyDelta === null) {
      emptyDelta = new FrozenDelta([]);
    }

    return emptyDelta;
  }

  /**
   * Returns `true` iff the given delta or delta-like value is empty. This
   * accepts the same set of values as `coerce()`, see which. Anything else is
   * considered to be an error. This is a static method exactly because it
   * accepts things other than instances of `FrozenDelta` per se.
   *
   * @param {object|array|null|undefined} delta The delta or delta-like value.
   * @returns {boolean} `true` if `delta` is empty or `false` if not.
   */
  static isEmpty(delta) {
    if (delta instanceof Delta) {
      return (delta.ops.length === 0);
    } else if ((delta === null) || (delta === undefined)) {
      return true;
    } else if (Array.isArray(delta)) {
      return delta.length === 0;
    } else if ((typeof delta === 'object') && Array.isArray(delta.ops)) {
      return delta.ops.length === 0;
    }

    throw new Error('Invalid value.');
  }

  /**
   * Constructs an instance.
   *
   * @param {Array} ops The transformation operations of this instance. If not
   *   deeply frozen, the actual stored `ops` will be a deep-frozen clone of the
   *   given value.
   */
  constructor(ops) {
    if (!Array.isArray(ops)) {
      throw new Error('Bad value for `ops`.');
    }

    super(DataUtil.deepFreeze(ops));
    Object.freeze(this);
  }

  /** Name of this class in the API. */
  static get API_NAME() {
    return 'Delta';
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    return [this.ops];
  }

  /**
   * Constructs an instance from API arguments.
   *
   * @param {array} ops Same as with the regular constructor.
   * @returns {FrozenDelta} The constructed instance.
   */
  static fromApi(ops) {
    return new FrozenDelta(ops);
  }

  /**
   * Returns `true` iff this instance is empty (that is, it has an empty list
   * of ops).
   *
   * @returns {boolean} `true` if this instance is empty or `false` if not.
   */
  isEmpty() {
    return this.ops.length === 0;
  }
}
