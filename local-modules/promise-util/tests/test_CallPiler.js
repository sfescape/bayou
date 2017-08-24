// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { CallPiler } from 'promise-util';

describe('promise-util/CallPiler', () => {
  describe('constructor()', () => {
    it('fails if not given a function', () => {
      assert.throws(() => { new CallPiler(); });
      assert.throws(() => { new CallPiler('non-function'); });
      assert.throws(() => { new CallPiler([]); });
    });

    it('accepts a function and arbitrary additional arguments', () => {
      function func() { /* empty */ }
      assert.doesNotThrow(() => { new CallPiler(func); });
      assert.doesNotThrow(() => { new CallPiler(func, 1); });
      assert.doesNotThrow(() => { new CallPiler(func, [], {}); });
      assert.doesNotThrow(() => { new CallPiler(func, 'foo', true, false); });
    });
  });

  describe('call()', () => {
    it('calls the function with the args as specified in the constructor', async () => {
      async function test(...args) {
        let gotArgs = null;
        function func(...passedArgs) {
          gotArgs = passedArgs;
        }

        const piler = new CallPiler(func, ...args);
        await piler.call();
        assert.deepEqual(gotArgs, args);
      }

      await test();
      await test(1);
      await test([1, 2, 3], { x: 10, y: 20 }, 'blort', true);
    });

    it('returns the result from the underlying function call', async () => {
      function func() {
        return 914;
      }

      const piler = new CallPiler(func);
      const result = await piler.call();
      assert.strictEqual(result, 914);
    });

    it('does indeed pile concurrent calls', async () => {
      let callCount = 0;
      function func() {
        callCount++;
        return callCount;
      }

      const piler = new CallPiler(func);

      const call1a = piler.call();
      const call1b = piler.call();
      assert.strictEqual(await call1a, 1);
      assert.strictEqual(callCount, 1);
      assert.strictEqual(await call1b, 1);
      assert.strictEqual(callCount, 1);

      const call2a = piler.call();
      const call2b = piler.call();
      const call2c = piler.call();
      const call2d = piler.call();
      const call2e = piler.call();
      assert.strictEqual(await call2a, 2);
      assert.strictEqual(callCount, 2);
      assert.strictEqual(await call2b, 2);
      assert.strictEqual(await call2c, 2);
      assert.strictEqual(await call2d, 2);
      assert.strictEqual(await call2e, 2);
      assert.strictEqual(callCount, 2);
    });
  });
});
