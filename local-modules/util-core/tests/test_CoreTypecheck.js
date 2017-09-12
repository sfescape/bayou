// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { CoreTypecheck, InfoError } from 'util-core';

/** {array<string>} Strings to use as test cases. */
const STRING_CASES = [
  '',
  'a',
  'blort'
];

/** {array<*>} Non-string values to use as test cases. */
const NON_STRING_CASES = [
  undefined,
  null,
  false,
  true,
  37,
  Symbol('florp'),
  ['like'],
  { a: 10 }
];

/**
 * Like `assert.throws()`, but specifically to check the details of an
 * expected `InfoError`.
 *
 * @param {function} func Function to call, expected to throw.
 * @param {string} name Expected error name.
 * @param {array|null} args Expected error arguments, or `null` if there are no
 *   expectations.
 */
function assertThrowsInfo(func, name, args = null) {
  try {
    func();
    assert.fail('Did not throw.');
  } catch (e) {
    assert.instanceOf(e, InfoError);
    assert.strictEqual(e.name, name);
    if (args !== null) {
      assert.deepEqual(e.args, args);
    }
  }
}

describe('util-core/CoreTypecheck', () => {
  describe('checkIdentifier(value)', () => {
    it('accepts identifier strings', () => {
      function test(value) {
        assert.strictEqual(CoreTypecheck.checkIdentifier(value), value);
      }

      test('a');
      test('A');
      test('_');
      test('blort');
      test('florp_like');
      test('x9');
      test('_0123456789_');
      test('abcdefghijklmnopqrstuvwxyz');
      test('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    });

    it('rejects non-identifier strings', () => {
      function test(value) {
        assertThrowsInfo(
          () => { CoreTypecheck.checkIdentifier(value); },
          'bad_value',
          [inspect(value), 'String', 'identifier syntax']);
      }

      // Needs at least one character.
      test('');

      // Can't start with a digit.
      test('0a');
      test('1a');
      test('2a');
      test('3a');
      test('4a');
      test('5a');
      test('6a');
      test('7a');
      test('8a');
      test('9a');

      // Has invalid character.
      test('a-1');
      test('a/1');
      test('a!@#$%^&*');
    });

    it('rejects non-strings', () => {
      function test(value) {
        assertThrowsInfo(
          () => { CoreTypecheck.checkIdentifier(value); },
          'bad_value',
          [inspect(value), 'String', 'identifier syntax']);
      }

      for (const v of NON_STRING_CASES) {
        test(v);
      }
    });
  });

  describe('checkString(value)', () => {
    it('accepts strings', () => {
      function test(value) {
        assert.strictEqual(CoreTypecheck.checkString(value), value);
      }

      for (const v of STRING_CASES) {
        test(v);
      }
    });

    it('rejects non-strings', () => {
      function test(value) {
        assertThrowsInfo(
          () => { CoreTypecheck.checkString(value); },
          'bad_value',
          [inspect(value), 'String']);
      }

      for (const v of NON_STRING_CASES) {
        test(v);
      }
    });
  });

  describe('checkString(value, regex)', () => {
    it('accepts strings that match the regex', () => {
      function test(value, regex) {
        assert.strictEqual(CoreTypecheck.checkString(value, regex), value);
      }

      test('blort', /o/);
      test('florp', /^f/);
    });

    it('rejects strings that do not match the regex', () => {
      function test(value, regex) {
        assertThrowsInfo(
          () => { CoreTypecheck.checkString(value, regex); },
          'bad_value',
          [inspect(value), 'String', regex.toString()]);
      }

      test('blort', /X/);
      test('florp', /like/);
    });

    it('rejects non-strings', () => {
      function test(value) {
        assertThrowsInfo(
          () => { CoreTypecheck.checkString(value, /./); },
          'bad_value',
          [inspect(value), 'String', '/./']);
      }

      for (const v of NON_STRING_CASES) {
        test(v);
      }
    });

    it('rejects a non-`RegExp` second argument', () => {
      const notRegex = 'not-a-regex';

      assertThrowsInfo(
        () => { CoreTypecheck.checkString('x', notRegex); },
        'bad_value',
        [inspect(notRegex), 'RegExp']);
    });
  });

  describe('checkStringOrNull()', () => {
    it('accepts strings', () => {
      function test(value) {
        assert.strictEqual(CoreTypecheck.checkStringOrNull(value), value);
      }

      for (const v of STRING_CASES) {
        test(v);
      }
    });

    it('accepts `null`', () => {
      assert.isNull(CoreTypecheck.checkStringOrNull(null));
    });

    it('rejects non-strings that are not `null`', () => {
      function test(value) {
        if (value === null) {
          return;
        }

        assert.throws(() => { CoreTypecheck.checkString(value); });
      }

      for (const v of NON_STRING_CASES) {
        test(v);
      }
    });
  });
});
