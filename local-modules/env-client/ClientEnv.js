// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Logger } from 'see-all';
import { TObject } from 'typecheck';
import { UtilityClass } from 'util-common';

/** {Logger} Logger for this module. */
const log = new Logger('env-client');

/**
 * Miscellaneous client-side utilities.
 *
 * **Note:** This class is intended as the primary way for code to access the
 * usual browser globals, including especially `window`. The point is to make it
 * easy to wrangle these uses, including especially for the purposes of testing
 * in isolation.
 */
export default class ClientEnv extends UtilityClass {
  /**
   * Initializes this module.
   *
   * @param {Window} window Browser window that the application is running in.
   */
  static init(window) {
    TObject.check(window, Window);

    if (ClientEnv._window) {
      throw new Error('Already initialized.');
    }

    this._window = window;
    log.detail('Initialized.');
  }

  /** {Window} The browser window in which this application is running. */
  static get window() {
    const result = this._window;

    if (!result) {
      throw new Error('Not initialized.');
    }

    return result;
  }

  /**
   * Returns an indication of whether this client is running on macOS. This is
   * particularly useful to drive tweaks to conform to the native platform's
   * standard UI (e.g., the semantics of various keys).
   *
   * @returns {boolean} `true` if we seem to be running on macOS, or `false` if
   *   not.
   */
  static isMac() {
    const window = ClientEnv.window;
    const userAgentString = window.navigator.userAgent;

    return /Mac/i.test(userAgentString);
  }
}