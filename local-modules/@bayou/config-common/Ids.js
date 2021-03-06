// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { use } from '@bayou/injecty';
import { UtilityClass } from '@bayou/util-common';

/**
 * Utility functionality regarding ID strings.
 */
export default class Ids extends UtilityClass {
  /**
   * Checks whether the given value is syntactically valid as an author ID.
   * This method is only ever called with a non-empty string.
   *
   * @param {string} id The (alleged) author ID to check.
   * @returns {boolean} `true` iff `id` is syntactically valid.
   */
  static isAuthorId(id) {
    return use.Ids.isAuthorId(id);
  }

  /**
   * Checks whether the given value is syntactically valid as a document ID.
   * This method is only ever called with a non-empty string.
   *
   * The default implementation of this method requires that document IDs have
   * no more than 32 characters and only use ASCII alphanumerics plus dash (`-`)
   * and underscore (`_`).
   *
   * @param {string} id The (alleged) document ID to check.
   * @returns {boolean} `true` iff `id` is syntactically valid.
   */
  static isDocumentId(id) {
    return use.Ids.isDocumentId(id);
  }
}
