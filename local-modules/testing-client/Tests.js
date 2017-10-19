// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { UtilityClass } from 'util-common';

// **Note:** This is really the local module `mocha-client-shim`. See that
// module and {@link client-bundle.ClientBundle} for more details.
import { mocha } from 'mocha';

// This file is dynamically-generated when loaded. See comments in the file for
// more info.
import { registerTests } from './client-tests';

// One-time setup to hook `chai-as-promised` into the main `chai` module.
chai.use(chaiAsPromised);

/**
 * Client-side helper for setting up and running test code.
 */
export default class Tests extends UtilityClass {
  /**
   * Runs all of the tests.
   *
   * @returns {Promise<string>} Promise for the results of running the tests.
   */
  static runAll() {
    // Adds the BDD methods to the runtime (`describe`, `it`, `before`, etc.)
    mocha.setup('bdd');

    // Find all of our test files and load them into the runtime. The
    // process of loading the modules also registers all of the tests with
    // mocha.
    registerTests();

    mocha.run();

    return Promise.resolve('Test run completed');
  }
}
