// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BaseFileStore } from 'file-store';
import { BearerTokens, Hooks } from 'hooks-server';
import { Mocks } from 'testing-server';

describe('hooks-server/Hooks', () => {
  describe('baseUrlFromRequest(request)', () => {
    it('should return a new URL referencing just the host with no path, query args, or anchors', () => {
      const request = Mocks.nodeRequest();
      const uri = Hooks.theOne.baseUrlFromRequest(request);

      assert.strictEqual(uri, 'http://example.com');
    });
  });

  describe('.bearerTokens', () => {
    it('should return an instance of `BearerTokens`', () => {
      assert.instanceOf(Hooks.theOne.bearerTokens, BearerTokens);
    });
  });

  describe('.contentStore', () => {
    it('should return an instance of BaseFileStore', () => {
      assert.instanceOf(Hooks.theOne.contentStore, BaseFileStore);
    });
  });

  describe('isFileId(id)', () => {
    it('should accept 32-character alphanum ASCII strings', () => {
      assert.isTrue(Hooks.theOne.isFileId('123abc7890ABC456789012'));
    });

    it('should allow underscores and hyphens', () => {
      assert.isTrue(Hooks.theOne.isFileId('123456789_123456789-12'));
    });

    it('should not allow non-ASCII characters', () => {
      assert.isFalse(Hooks.theOne.isFileId('123456789•123456789•12'));
    });

    it('should not allow non-alphanum characters', () => {
      assert.isFalse(Hooks.theOne.isFileId('123456789\t123456789+12'));
    });
  });

  describe('.listenPort', () => {
    it('should return the documented value', () => {
      assert.strictEqual(Hooks.theOne.listenPort, 8080);
    });
  });
});
