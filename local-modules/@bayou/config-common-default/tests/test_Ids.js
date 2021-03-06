// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Ids } from '@bayou/config-common-default';

describe('@bayou/config-common-default/Ids', () => {
  describe('isAuthorId()', () => {
    it('should accept 32-character alphanum ASCII strings', () => {
      assert.isTrue(Ids.isAuthorId('123abc7890ABC456789012'));
    });

    it('should allow underscores and hyphens', () => {
      assert.isTrue(Ids.isAuthorId('123456789_123456789-12'));
    });

    it('should not allow non-ASCII characters', () => {
      assert.isFalse(Ids.isAuthorId('123456789•123456789•12'));
    });

    it('should not allow non-alphanum characters', () => {
      assert.isFalse(Ids.isAuthorId('123456789\t123456789+12'));
    });
  });

  describe('isDocumentId()', () => {
    it('should accept 32-character alphanum ASCII strings', () => {
      assert.isTrue(Ids.isDocumentId('123abc7890ABC456789012'));
    });

    it('should allow underscores and hyphens', () => {
      assert.isTrue(Ids.isDocumentId('123456789_123456789-12'));
    });

    it('should not allow non-ASCII characters', () => {
      assert.isFalse(Ids.isDocumentId('123456789•123456789•12'));
    });

    it('should not allow non-alphanum characters', () => {
      assert.isFalse(Ids.isDocumentId('123456789\t123456789+12'));
    });
  });
});
