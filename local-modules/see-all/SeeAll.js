// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import util from 'util';

import BaseLogger from './BaseLogger';

/**
 * Maximum amount of time, in msec, between successive logs that inidicate an
 * active spate of logging, and thus _should not_ be a cause for emitting a
 * `logger.time()` call.
 */
const LULL_MSEC = 60 * 1000; // One minute.

/**
 * Maximum amount of time, in msec, between `logger.time()` calls, even when
 * there is logging activity which is frequent enough not to run afoul of
 * `LULL_MSEC`. That is, if logging is chatty, there will still be calls to
 * `logger.time()` at about this frequency.
 */
const MAX_GAP_MSEC = 5 * 60 * 1000; // Five minutes.

/**
 * The actual loggers to user. These get added via `SeeAll.add()`.
 */
const theLoggers = [];

/**
 * The timestamp of the most recently logged line.
 */
let lastNow = 0;

/**
 * Logger which associates a tag (typically a subsystem or module name) and a
 * severity level (`info`, `error`, etc.) with all activity. Stack traces are
 * included for any message logged at a level that indicates any sort of
 * problem. One severity level, `detail`, is squelchable and is in fact
 * squelched by default. The rest are not squelchable.
 *
 * Full rundown of severity levels:
 *
 * * `debug` -- Severity level indicating temporary stuff for debugging. Code
 *   that uses this level should not in general get checked into the repo.
 *
 * * `error` -- Severity level indicating a dire error. Logs at this level
 *   should indicate something that went horribly awry, as opposed to just being
 *   a more innocuous errory thing that normally happens from time to time, such
 *   as, for example, a network connection that dropped unexpectedly.
 *
 * * `warn` -- Severity level indicating a warning. Trouble, but not dire. Logs
 *   at this level should indicate something that is out-of-the-ordinary but not
 *   unrecoverably so.
 *
 * * `info` -- Severity level indicating general info. No problem, but maybe you
 *   care. Logs at this level should come at a reasonably stately pace (maybe a
 *   couple times a minute or so) and give a general sense of the healthy
 *   operation of the system.
 *
 * * `detail` -- Severity level indicating detailed operation. These might be
 *   used multiple times per second, to provide a nuanced view into the
 *   operation of a component. These logs are squelched by default, as they
 *   typically distract from the big picture of the system. They are meant to be
 *   turned on selectively during development and debugging.
 */
export default class SeeAll extends BaseLogger {
  /**
   * Adds an underlying logger to the system. May be called more than once.
   * Each logger added via this method gets called as `logger.log(nowMsec,
   * level, tag, ...message)` and `logger.time(nowMsec, utcString,
   * localString)`. The latter are done as occasional "punctuation" on logs,
   * for loggers that don't want to record the exact timestamp of every message.
   *
   * @param {object} logger The underlying logger to use.
   */
  static add(logger) {
    theLoggers.push(logger);
  }

  /**
   * Constructs an instance.
   *
   * @param {string} tag Component tag to associate with messages logged by this
   *   instance.
   * @param {boolean} [enableDetail = false] Whether or not to produce logs at
   *   the `detail` level.
   */
  constructor(tag, enableDetail = false) {
    super();

    /** The module / subsystem tag. */
    this._tag = tag;

    /** Whether logging is enabled for the `detail` level. */
    this._enableDetail = enableDetail;
  }

  /**
   * Actual logging implementation, as specified by the superclass.
   *
   * @param {string} level Severity level. Guaranteed to be a valid level.
   * @param {array} message Array of arguments to log.
   */
  _logImpl(level, message) {
    if ((level === 'detail') && !this._enableDetail) {
      // This tag isn't listed as one to log at the `detail` level. (That is,
      // it's being squelched.)
      return;
    }

    const logArgs = [SeeAll._now(), level, this._tag, ...message];

    if (theLoggers.length === 0) {
      // Bad news! No underlying loggers have been added. Indicates trouble
      // during init. Instead of silently succeeding (or at best succeeding
      // while logging to `console`, we die with an error here so that it is
      // reasonably blatant that something needs to be fixed during application
      // bootstrap.
      const details = util.inspect(logArgs);
      throw new Error(`Overly early log call: ${details}`);
    }

    for (const l of theLoggers) {
      l.log(...logArgs);
    }
  }

  /**
   * Gets a msec timestamp representing the current time, suitable for passing
   * to loggers. This will also generate `logger.time()` calls at appropriate
   * junctures to "punctuate" gaps.
   *
   * @returns {number} The timestamp.
   */
  static _now() {
    const now = Date.now();

    if (now >= (lastNow + LULL_MSEC)) {
      // There was a lull between the last log and this one.
      SeeAll._callTime(now);
    } else {
      // Figure out where to "punctuate" longer spates of logging, such that the
      // timestamps come out even multiples of the maximum gap.
      const nextGapMarker = lastNow - (lastNow % MAX_GAP_MSEC) + MAX_GAP_MSEC;

      if (now >= nextGapMarker) {
        SeeAll._callTime(nextGapMarker);
      }
    }

    lastNow = now;
    return now;
  }

  /**
   * Calls `logger.time()` on all of the loggers.
   *
   * @param {number} now The time to pass.
   */
  static _callTime(now) {
    // Note: We don't check to see if there are any loggers here. That check
    // gets done more productively in `log()`, above.

    const date = new Date(now);
    const utcString = SeeAll._utcTimeString(date);
    const localString = SeeAll._localTimeString(date);

    for (const l of theLoggers) {
      l.time(now, utcString, localString);
    }
  }

  /**
   * Returns a string representing the given time in UTC.
   *
   * @param {Date} date The time, as a `Date` object.
   * @returns {string} The corresponding UTC time string.
   */
  static _utcTimeString(date) {
    // We start with the ISO string and tweak it to be a little more
    // human-friendly.
    const isoString = date.toISOString();
    return isoString.replace(/T/, ' ').replace(/Z/, ' UTC');
  }

  /**
   * Returns a string representing the given time in the local timezone.
   *
   * @param {Date} date The time, as a `Date` object.
   * @returns {string} The corresponding local time string.
   */
  static _localTimeString(date) {
    // We start with the local time string and cut off all everything after the
    // actual time (timezone spew).
    const localString = date.toTimeString();
    return localString.replace(/ [^0-9].*$/, ' local');
  }
}