// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { UtilityClass } from '@bayou/util-core';

describe('@bayou/util-core/UtilityClass', () => {
  describe('constructor()', () => {
    it('should always throw an error', () => {
      assert.throws(() => { new UtilityClass(); });
    });

    it('should always throw an error when called via `super`', () => {
      class Subclass extends UtilityClass {
        constructor() {
          super();
        }
      }

      assert.throws(() => { new Subclass(); });
    });
  });
});
