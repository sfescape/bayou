// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CaretSnapshot } from '@bayou/doc-common';
import { Delay } from '@bayou/promise-util';

/**
 * {object} Starting state for the caret redux store.
 */
const INITIAL_STATE = CaretSnapshot.EMPTY;

/**
 * {string} Redux action to dispatch when we receive a new caret snapshot.
 */
const CARET_SNAPSHOT_UPDATED = 'caret_getSnapshot_updated';

/**
 * {Int} Amount of time (in msec) to wait after receiving a caret update from
 * the server before requesting another one. This is to prevent the client from
 * inundating the server with requests when there is some particularly active
 * editing going on.
 */
const REQUEST_DELAY_MSEC = 250;

/**
 * {Int} Amount of time (in msec) to wait after a failure to communicate with
 * the server, before trying to reconnect.
 */
const ERROR_DELAY_MSEC = 5000;

/**
 * Tracker of the state of carets for all sessions editing a given document.
 * It watches for changes observed from the session proxy and dispatches
 * actions to a redux data store to update the client caret model.
 *
 * Other entities interested in caret changes (notably {@link CaretOverlay})
 * should look at the `carets` entry in {@link EditorComplex}'s store.
 */
export default class CaretState {
  /**
   * Redux selector for the caret snapshot.
   *
   * @param {object} state The redux state to query.
   * @returns {CaretSnapshot} The caret snapshot.
   */
  static caretSnapshot(state) {
    return state.carets;
  }

  /**
   * Redux root reducer function that transforms our actions into
   * state changes.
   * @see http://redux.js.org/docs/basics/Reducers.html
   *
   * @returns {function} The reducer function.
   */
  static get reducer() {
    return (state = INITIAL_STATE, action) => {
      let newState;

      switch (action.type) {
        case CARET_SNAPSHOT_UPDATED:
          newState = action.snapshot;
          break;

        default:
          // If we get an action we don't recognize we shouldn't be mutating
          // the state so just maintain the current state.
          newState = state;
          break;
      }

      return newState;
    };
  }

  /**
   * Constructs an instance of this class.
   *
   * @param {EditorComplex} editorComplex The editor environment in which this
   *   instance will operate.
   */
  constructor(editorComplex) {
    this._store = editorComplex.clientStore;
    this._watchCarets(editorComplex);
  }

  /**
   * Watches for selection-related activity.
   *
   * @param {EditorComplex} editorComplex The editor environment to
   *   monitor for caret changes.
   */
  async _watchCarets(editorComplex) {
    await editorComplex.whenReady();

    let docSession = null;
    let snapshot   = null;
    let sessionProxy;

    for (;;) {
      if (docSession === null) {
        // Init the session variables (on the first iteration), or re-init them
        // if we got a failure during a previous iteration.
        docSession   = editorComplex.docSession;
        sessionProxy = await docSession.getSessionProxy();
      }

      try {
        if (snapshot !== null) {
          // We have a snapshot which we can presumably get a change with
          // respect to, so try to do that.
          const change = await sessionProxy.caret_getChangeAfter(snapshot.revNum);
          snapshot = snapshot.compose(change);
          docSession.log.detail(`Got caret change. ${snapshot.size} caret(s).`);
        }
      } catch (e) {
        // Assume that the error isn't truly fatal. Most likely, it's because
        // the session got restarted or because the snapshot we have is too old
        // to get a change from. We just `null` out the snapshot and let the
        // next clause try to get it afresh.
        docSession.log.warn('Trouble with `caret_getChangeAfter`:', e);
        snapshot = null;
      }

      try {
        if (snapshot === null) {
          // We don't yet have a snapshot to base deltas off of, so get one!
          // This can happen either because we've just started a new session or
          // because the attempt to get a change failed for some reason. (The
          // latter is why this section isn't just part of an `else` block to
          // the previous `if`).
          snapshot = await sessionProxy.caret_getSnapshot();
          docSession.log.detail(`Got ${snapshot.size} new caret(s)!`);
        }
      } catch (e) {
        // Assume that the error is transient and most likely due to the session
        // getting terminated / restarted. Null out the session variables, wait
        // a moment, and try again.
        docSession.log.warn('Trouble with `caret_getSnapshot`:', e);
        docSession   = null;
        sessionProxy = null;
        await Delay.resolve(ERROR_DELAY_MSEC);
        continue;
      }

      this._store.dispatch({
        type: CARET_SNAPSHOT_UPDATED,
        snapshot
      });

      await Delay.resolve(REQUEST_DELAY_MSEC);
    }
  }
}
