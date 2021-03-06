// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseSnapshot } from '@bayou/ot-common';

import MockChange from './MockChange';
import MockOp from './MockOp';

/**
 * Mock subclass of `BaseSnapshot` for testing.
 */
export default class MockSnapshot extends BaseSnapshot {
  constructor(revNum, contents) {
    super(revNum, contents);
    Object.freeze(this);
  }

  _impl_diffAsDelta(newerSnapshot) {
    return [new MockOp('diff_delta'), newerSnapshot.contents.ops[0]];
  }

  static get _impl_changeClass() {
    return MockChange;
  }
}
