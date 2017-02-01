// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import DeltaUtil from 'delta-util';

/**
 * Event wrapper for a Quill Delta, including reference to the document source,
 * the old contents, and the chain of subsequent events.
 */
export default class DeltaEvent {
  /**
   * Constructs an instance.
   *
   * @param {object} accessKey Key which protects ability to resolve the next
   *   event.
   * @param {Delta|array|object} delta The change, per se. Can be anything that
   *   is coerceable to a `FrozenDelta`.
   * @param {Delta|array|object} oldContents The document contents just prior to
   *   the change. Can be anything that is coerceable to a `FrozenDelta`.
   * @param {Quill} source The `Quill` instance that emitted this event.
   */
  constructor(accessKey, delta, oldContents, source) {
    this.delta = DeltaUtil.coerce(delta);
    this.oldContents = DeltaUtil.coerce(oldContents);
    this.source = source;

    // **Note:** `accessKey` is _not_ exposed as a property. Doing so would
    // cause the security problem that its existence is meant to prevent. That
    // is, this arrangement means that we know client code won't be able to
    // mess with the promise chain.

    // The resolver function for the `next` promise. Used in `_gotChange()`
    // below.
    let resolveNext;

    // The resolved value for `next`. Used in `_gotChange` and `nextNow` below.
    let nextNow = null;

    this.next = Object.freeze(
      new Promise((res, rej_unused) => { resolveNext = res; }));

    // This method is defined inside the constructor so that we can use the
    // lexical context for (what amount to) private instance variables.
    this._gotChange = Object.freeze((key, ...args) => {
      if (key !== accessKey) {
        // See note toward the top of this function.
        throw new Error('Invalid access.');
      }

      nextNow = new DeltaEvent(key, ...args);
      resolveNext(nextNow);
      return nextNow;
    });

    // Likewise, this is how we can provide a read-only yet changeable `nextNow`
    // on a frozen object.
    Object.defineProperty(this, 'nextNow', { get: () => { return nextNow; }});

    Object.freeze(this);
  }
}