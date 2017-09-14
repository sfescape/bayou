// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { inspect } from 'util';

import CoreTypecheck from './CoreTypecheck';
import InfoError from './InfoError';
import UtilityClass from './UtilityClass';

/**
 * Utility class for constructing commonly-used errors, which are applicable to
 * a wide variety of code.
 *
 * **Note:** The names of the methods match the error functor names, and because
 * the convention for those is `lowercase_underscore`, that is what's used.
 */
export default class Errors extends UtilityClass {
  /**
   * Constructs an instance which indicates the unrecoverable termination of an
   * ongoing activity (of some sort), in any way other than clean shutdown.
   *
   * This error is typically used to report a problem which is caused by
   * an external factor in one way or another, and which, while it is _not_
   * recoverable from the local perspective of the throwing code, might
   * reasonably be possible to recover from at a higher layer of the system.
   *
   * @param {Error} [cause] Error which caused this problem. **Note:** It is
   *   optional. If the first argument isn't an `Error`, then it is taken to be
   *   the `message`.
   * @param {string} message Description of the problem.
   * @returns {InfoError} An appropriately-constructed error.
   */
  static aborted(cause, message) {
    return Errors._make('aborted', cause, message);
  }

  /**
   * Constructs an instance which indicates that a function, class, or module
   * has received invalid data of some sort. The error includes a human-oriented
   * description of the problem.
   *
   * This error is typically used to report a problem that crosses a line of
   * responsibility. For example, this can be used to report that a file being
   * read turns out to be syntactically invalid.
   *
   * @param {Error} [cause] Error which caused this problem. **Note:** It is
   *   optional. If the first argument isn't an `Error`, then it is taken to be
   *   the `message`.
   * @param {string} message Description of the problem.
   * @returns {InfoError} An appropriately-constructed error.
   */
  static bad_data(cause, message) {
    return Errors._make('bad_data', cause, message);
  }

  /**
   * Constructs an instance which indicates that a function, class, or module is
   * somehow being misused. The error includes a human-oriented description of
   * the problem.
   *
   * This error is typically used to report a problem that crosses a line of
   * responsibility. For example, this can be used to report that a subclass has
   * failed to implement itself in compliance with its superclass's contract, or
   * to report that a class's user has made an inappropriate method call (even
   * if the call is correct with regards to the types of arguments).
   *
   * @param {Error} [cause] Error which caused this problem. **Note:** It is
   *   optional. If the first argument isn't an `Error`, then it is taken to be
   *   the `message`.
   * @param {string} message Description of the problem.
   * @returns {InfoError} An appropriately-constructed error.
   */
  static bad_use(cause, message) {
    return Errors._make('bad_use', cause, message);
  }

  /**
   * Constructs an instance which indicates that an improper value was passed
   * as an argument to a function, class, or module. The error includes a
   * description (typically pseudocode-ish) of the expected type of value.
   *
   * This error is typically used to report a problem that crosses a line of
   * responsibility, e.g. to report that a user of a class is breaking the
   * contract by passing an out-of-spec value.
   *
   * @param {*} value The bad value.
   * @param {string|function} expectedType Name of the expected type or a
   *   function (presumably a constructor/class) whose name is the expected
   *   type.
   * @param {string|null} [extra = null] Extra information about the expected
   *   value.
   * @returns {InfoError} An appropriately-constructed error.
   */
  static bad_value(value, expectedType, extra = null) {
    if (typeof expectedType === 'string') {
      // All good. No extra checks.
    } else if (   (typeof expectedType === 'function')
               && (typeof expectedType.name === 'string')) {
      expectedType = expectedType.name;
    } else {
      // Hail mary, to try to get something useful out of `expectedType` (even
      // though it wasn't passed as a valid value per the docs).
      expectedType = inspect(expectedType);
    }

    CoreTypecheck.checkStringOrNull(extra);

    return new InfoError(
      'bad_value',
      inspect(value),
      expectedType,
      ...((extra === null) ? [] : [extra]));
  }

  /**
   * Constructs an instance which is meant to indicate that the program
   * exhibited unexpected behavior. This should be used as an indication of a
   * likely bug in the program.
   *
   * This error is typically used to report a problem that _does not_ cross a
   * line of responsibility. That is, it is intended to convey that the code at
   * the point of failure "believed" it was being used properly and yet still
   * ran into unexpected trouble. In other systems, you might see something like
   * `throw new Error("Shouldn't happen.")` in this sort of situation.
   *
   * To be clear, this is _not_ an appropriate error to use to report "possible
   * but still unusual and noteworthy" problems such as network failure.
   *
   * @param {Error} [cause] Error which caused this problem. **Note:** It is
   *   optional. If the first argument isn't an `Error`, then it is taken to be
   *   the `message`.
   * @param {string} message Description of the problem.
   * @returns {InfoError} An appropriately-constructed error.
   */
  static wtf(cause, message) {
    return Errors._make('wtf', cause, message);
  }

  /**
   * Helper which constructs an error given either `(message)` or `(cause,
   * message)`.
   *
   * @param {string} name Error name.
   * @param {...*} args Originally-passed arguments.
   * @returns {InfoError} An appropriately-constructed error.
   */
  static _make(name, ...args) {
    if (args[0] instanceof Error) {
      const [cause, message] = args;
      CoreTypecheck.checkString(message);
      return new InfoError(cause, name, message);
    } else {
      const [message] = args;
      CoreTypecheck.checkString(message);
      return new InfoError(name, message);
    }
  }
}
