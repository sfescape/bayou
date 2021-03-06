// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BearerTokens } from '@bayou/app-setup';
import { UtilityClass } from '@bayou/util-common';

/**
 * Utility functionality regarding the network configuration of a server.
 */
export default class Network extends UtilityClass {
  /**
   * {string} Implementation of standard configuration point.
   *
   * This implementation defines this as `http://localhost:N` where `N` is the
   * value of {@link #listenPort}.
   */
  static get baseUrl() {
    return `http://localhost:${this.listenPort}`;
  }

  /**
   * {BearerTokens} Implementation of standard configuration point.
   */
  static get bearerTokens() {
    if (!this._bearerTokens) {
      this._bearerTokens = new BearerTokens();
    }

    return this._bearerTokens;
  }

  /**
   * {Int} Implementation of standard configuration point. This implementation
   * defines it as `8080`.
   */
  static get listenPort() {
    return 8080;
  }

  /**
   * {Int|null} Implementation of standard configuration point. This
   * implementation defines it as `8888`.
   */
  static get monitorPort() {
    return 8888;
  }
}
