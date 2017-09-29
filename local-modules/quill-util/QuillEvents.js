// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Delta from 'quill-delta';

import { BodyDelta } from 'doc-common';
import { EventSource } from 'promise-util';
import { TString } from 'typecheck';
import { Errors, Functor, ObjectUtil, UtilityClass } from 'util-common';

/**
 * Utility class for wrangling the events generated by Quill.
 */
export default class QuillEvents extends UtilityClass {
  /** {String} Event source for the API. */
  static get API() {
    return 'api';
  }

  /** {String} Event name for editor change events. */
  static get EDITOR_CHANGE() {
    return 'editor-change';
  }

  /**
   * {Functor} Event payload representing an empty text change caused by the
   * `api` source.
   */
  static get EMPTY_TEXT_CHANGE_PAYLOAD() {
    return new Functor(
      QuillEvents.TEXT_CHANGE, BodyDelta.EMPTY, BodyDelta.EMPTY, QuillEvents.API);
  }

  /** {String} Event name for selection change events. */
  static get SELECTION_CHANGE() {
    return 'selection-change';
  }

  /** {String} Event name for text change events. */
  static get TEXT_CHANGE() {
    return 'text-change';
  }

  /**
   * Emits a `ChainableEvent` on the given `EventSource`, based on the payload
   * of a Quill event callback. This "fixes" the payload (via
   * {@link #fixPayload}) so that the various values adhere to the `doc-client`
   * contract.
   *
   * @param {EventSource} source Source to emit from.
   * @param {Functor} payload Original Quill event payload, where the functor
   *   name is the name of the original event, and the functor arguments are the
   *   arguments as originally passed to the event handler callback.
   * @returns {ChainableEvent} The emitted event.
   */
  static emitQuillPayload(source, payload) {
    EventSource.check(source);

    return source.emit(QuillEvents.fixPayload(payload));
  }

  /**
   * "Fixes" and validates the given event payload. The fixing takes into
   * account the fact that Quill will produce events with non-immutable data.
   *
   * @param {Functor} payload Event payload in question.
   * @returns {Functor} Fixed payload.
   */
  static fixPayload(payload) {
    Functor.check(payload);
    const name = payload.name;

    switch (name) {
      case QuillEvents.TEXT_CHANGE: {
        const [delta, oldContents, source] = payload.args;

        if (!(delta instanceof Delta)) {
          // The version of `Delta` used by Quill is different than the one we
          // specified in our `package.json`. Even though it will often happen
          // to work if we just let it slide (e.g. by snarfing `ops` out of the
          // object and running with it), we don't want to end up shipping two
          // versions of `Delta` to the client; so, instead of just blithely
          // accepting this possibility, we reject it here and report an error
          // which makes it easy to figure out what happened. Should you find
          // yourself looking at this error, the right thing to do is look at
          // Quill's `package.json` and update the `quill-delta` dependency in
          // the `doc-common` module to what you find there.
          throw Errors.bad_use('Divergent versions of `quill-delta` package.');
        }

        return new Functor(name,
          new BodyDelta(delta.ops),
          new BodyDelta(oldContents.ops),
          TString.check(source));
      }

      case QuillEvents.SELECTION_CHANGE: {
        const [range, oldRange, source] = payload.args;
        return new Functor(name,
          QuillEvents._checkAndFreezeRange(range),
          QuillEvents._checkAndFreezeRange(oldRange),
          TString.check(source));
      }

      default: {
        throw Errors.bad_value(payload, 'Quill event payload');
      }
    }
  }

  /**
   * Gets the payload of the given event or event payload as an object with
   * named properties.
   *
   * @param {ChainableEvent|Functor} eventOrPayload Event or event payload in
   *   question.
   * @returns {object} The properties of `event`'s payload, in convenient named
   *   form.
   */
  static propsOf(eventOrPayload) {
    const payload = (eventOrPayload instanceof Functor)
      ? eventOrPayload
      : eventOrPayload.payload;
    const name = payload.name;

    switch (name) {
      case QuillEvents.TEXT_CHANGE: {
        const [delta, oldContents, source] = payload.args;
        return { name, delta, oldContents, source };
      }

      case QuillEvents.SELECTION_CHANGE: {
        const [range, oldRange, source] = payload.args;
        return { name, range, oldRange, source };
      }

      default: {
        throw Errors.bad_value(payload, 'Quill event payload');
      }
    }
  }

  /**
   * Validates a "range" object as provided by Quill. This accepts `null` as
   * a valid value. If the range is valid and non-`null`, freezes it.
   *
   * @param {*} range The (alleged) range.
   * @returns {object} The validated frozen range.
   */
  static _checkAndFreezeRange(range) {
    return (range === null)
      ? null
      : ObjectUtil.extract(range, ['index', 'length']);
  }
}
