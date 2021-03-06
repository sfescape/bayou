// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { TransactionOp, TransactionSpec } from '@bayou/file-store-ot';
import { FrozenBuffer } from '@bayou/util-common';

import TransactionOpMaker from './TransactionOpMaker';

describe('@bayou/file-store-ot/TransactionSpec', () => {
  // The call to `TransactionOpMaker.testCases()` provides outer `describe()`s
  // for each value to test with.
  TransactionOpMaker.testCases((ops) => {
    describe('constructor()', () => {
      it('should accept any number of valid arguments', () => {
        assert.doesNotThrow(() => new TransactionSpec(...ops));
      });

      // This test doesn't make sense for length 0.
      if (ops.length !== 0) {
        it('should reject an invalid argument in any position', () => {
          const badValues = [undefined, null, false, 'hello', ['blort'], { x: 914 }, new Map()];
          let   badAt     = 0;

          for (let i = 0; i < ops.length; i += 9) {
            const useOps = ops.slice();
            useOps[i] = badValues[badAt];
            assert.throws(() => new TransactionSpec(...useOps), /badValue/);
            badAt = (badAt + 1) % badValues.length;
          }
        });
      }
    });

    describe('.ops', () => {
      it('should be a frozen array', () => {
        const result = new TransactionSpec(...ops);
        assert.isArray(result.ops);
        assert.isFrozen(result.ops);
      });

      it('should contain all the originally-passed args though not necessarily in the same order', () => {
        const result = new TransactionSpec(...ops);
        assert.sameMembers(result.ops, ops);
      });
    });
  });

  describe('constructor()', () => {
    it('should reject arguments with both a pull and a push', () => {
      const ops = [
        TransactionOp.op_readPath('/x/y'),
        TransactionOp.op_writeBlob(new FrozenBuffer('florp'))
      ];

      assert.throws(() => { new TransactionSpec(...ops); }, /badUse/);
    });

    it('should reject arguments with both a wait and a pull', () => {
      const ops = [
        TransactionOp.op_whenPathNot('/blort', new FrozenBuffer('florp')),
        TransactionOp.op_readPath('/x/y')
      ];

      assert.throws(() => { new TransactionSpec(...ops); }, /badUse/);
    });

    it('should reject arguments with both a wait and a push', () => {
      const ops = [
        TransactionOp.op_whenPathNot('/blort', new FrozenBuffer('florp')),
        TransactionOp.op_writeBlob(new FrozenBuffer('florp'))
      ];

      assert.throws(() => { new TransactionSpec(...ops); }, /badUse/);
    });

    it('should reject arguments with two (or more) wait operations', () => {
      const ops = [
        TransactionOp.op_whenPathNot('/blort', new FrozenBuffer('florp')),
        TransactionOp.op_whenPathNot('/florp', new FrozenBuffer('blort'))
      ];

      assert.throws(() => { new TransactionSpec(...ops); }, /badUse/);
    });
  });

  describe('concat()', () => {
    it('should concatenate a proper argument', () => {
      function test(ops1, ops2) {
        const t1      = new TransactionSpec(...ops1);
        const t2      = new TransactionSpec(...ops2);
        const result1 = t1.concat(t2);
        const result2 = t2.concat(t1);
        const resOps1 = result1.ops;
        const resOps2 = result2.ops;

        assert.instanceOf(result1, TransactionSpec);
        assert.instanceOf(result2, TransactionSpec);

        const expectOps = [...ops1, ...ops2];

        assert.strictEqual(resOps1.length, expectOps.length);
        assert.strictEqual(resOps2.length, expectOps.length);

        assert.sameMembers(resOps1, expectOps);
        assert.sameMembers(resOps2, expectOps);
      }

      const op1 = TransactionOp.op_timeout(123);
      const op2 = TransactionOp.op_checkPathPresent('/foo');
      const op3 = TransactionOp.op_checkPathPresent('/bar');
      const op4 = TransactionOp.op_checkPathAbsent('/florp');

      test([],              []);
      test([op1],           []);
      test([op1, op2],      []);
      test([op1, op2, op3], []);
      test([],              [op4]);
      test([op1],           [op4]);
      test([op1, op2],      [op4]);
      test([op1, op2, op3], [op4]);
      test([],              [op3, op4]);
      test([op1],           [op3, op4]);
      test([op1, op2],      [op3, op4]);
    });

    it('should reject a bad argument', () => {
      const trans = new TransactionSpec(TransactionOp.op_timeout(123456));

      function test(value) {
        assert.throws(() => trans.concat(value));
      }

      test(null);
      test(undefined);
      test([1, 2, 3]);
      test(new Map());
    });

    it('should fail if the concatenated result would violate the category constraints', () => {
      // E.g., this tests that you can't mix push and pull ops.
      const trans1 = new TransactionSpec(TransactionOp.op_readPath('/x/y'));
      const trans2 = new TransactionSpec(TransactionOp.op_writeBlob(new FrozenBuffer('florp')));

      assert.throws(() => trans1.concat(trans2), /badUse/);
    });
  });
});
