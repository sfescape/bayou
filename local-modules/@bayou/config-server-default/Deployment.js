// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import path from 'path';

import { Assets } from '@bayou/assets-client';
import { UtilityClass } from '@bayou/util-common';

/**
 * Utility functionality regarding the deployment configuration of a server.
 */
export default class Deployment extends UtilityClass {
  /**
   * {array<string>} Implementation of standard configuration point.
   *
   * This implementation defers to the module {@link @bayou/assets-client}.
   */
  static get ASSET_DIRS() {
    return Assets.DIRS;
  }

  /**
   * Implementation of standard configuration point.
   *
   * This implementation returns the base product directory (the argument), with
   * `/var` appended.
   *
   * @param {string} baseDir The base product directory. This is the root
   *   directory under which the code for the product lives.
   * @returns {string} Absolute filesystem path to the "var" directory to use.
   */
  static findVarDirectory(baseDir) {
    return path.join(baseDir, 'var');
  }

  /**
   * Implementation of standard configuration point.
   *
   * This implementation always returns `true`.
   *
   * @returns {boolean} `true`, always.
   */
  static isRunningInDevelopment() {
    return true;
  }

  /**
   * Implementation of standard configuration point.
   *
   * This implementation is a no-op.
   *
   * @param {@bayou/top-server/Action} action_unused The action that is about to
   *   be run.
   */
  static aboutToRun(action_unused) {
    // This space intentionally left blank.
  }
}
