// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Delay } from 'promise-util';
import { LogStream } from 'see-all';

import MockLogger from './MockLogger';

describe('see-all/LogStream', () => {
  describe('write(string)', () => {
    it('should call through to the underlying logger', () => {
      const logger = new MockLogger();
      const ls = new LogStream(logger, 'info');

      ls.write('florp');
      ls.write('plorple\n');
      assert.deepEqual(logger.record, [['info', 'florp'], ['info', 'plorple\n']]);
    });
  });

  describe('write(string, encoding)', () => {
    it('should not pay attention to the `encoding` argument', () => {
      const logger = new MockLogger();
      const ls = new LogStream(logger, 'debug');

      ls.write('florp', 'not-actually-a-valid-encoding');
      assert.deepEqual(logger.record, [['debug', 'florp']]);
    });
  });

  describe('write(string, encoding, callback)', () => {
    it('should call the callback', async () => {
      const logger = new MockLogger();
      const ls = new LogStream(logger, 'info');
      let gotCallback = false;

      ls.write('florp', null, () => { gotCallback = true; });

      // We expect the callback to be called asynchronously, so we have to wait
      // a moment.
      await Delay.resolve(10);
      assert.isTrue(gotCallback);
    });
  });

  describe('write(buffer)', () => {
    it('should call through to the underlying logger', () => {
      const logger = new MockLogger();
      const ls = new LogStream(logger, 'error');

      ls.write(Buffer.from('😅', 'utf8'));
      assert.deepEqual(logger.record, [['error', '😅']]);
    });
  });

  describe('write(buffer, encoding)', () => {
    it('should not pay attention to the `encoding` argument', () => {
      const logger = new MockLogger();
      const ls = new LogStream(logger, 'warn');

      ls.write(Buffer.from('😅', 'utf8'), 'ascii');
      assert.deepEqual(logger.record, [['warn', '😅']]);
    });
  });

  describe('end(string)', () => {
    it('should call through to the underlying logger', () => {
      const logger = new MockLogger();
      const ls = new LogStream(logger, 'info');

      ls.end('zorch');
      assert.deepEqual(logger.record, [['info', 'zorch']]);
    });
  });

  describe('end(string, encoding)', () => {
    it('should not pay attention to the `encoding` argument', () => {
      const logger = new MockLogger();
      const ls = new LogStream(logger, 'debug');

      ls.end('splat', 'not-actually-a-valid-encoding');
      assert.deepEqual(logger.record, [['debug', 'splat']]);
    });
  });

  describe('end(string, encoding, callback)', () => {
    it('should *not* call the callback', async () => {
      const logger = new MockLogger();
      const ls = new LogStream(logger, 'info');
      let gotCallback = false;

      ls.end('foo', null, () => { gotCallback = true; });

      // If the callback is going to be called, it won't be immediately. So
      // wait a moment.
      await Delay.resolve(100);
      assert.isFalse(gotCallback);
    });
  });
});
