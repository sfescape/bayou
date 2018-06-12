// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BaseFileStore } from '@bayou/file-store';
import { Hooks } from '@bayou/hooks-server';

describe('@bayou/hooks-server/Hooks', () => {
  describe('.fileStore', () => {
    it('should return an instance of BaseFileStore', () => {
      assert.instanceOf(Hooks.theOne.fileStore, BaseFileStore);
    });
  });
});
