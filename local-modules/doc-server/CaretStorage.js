// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Caret } from 'doc-common';
import { TransactionSpec } from 'file-store';
import { CommonBase, PromDelay } from 'util-common';

import FileComplex from './FileComplex';
import Paths from './Paths';

/**
 * {Int} How long to wait (in msec) after sessions are updated before an attempt
 * is made to write session info to file storage. This keeps the system from
 * storing too many ephemeral session updates, with the downside that caret
 * sharing across servers has this much more latency than sharing between
 * sessions that reside on the same machine.
 */
const WRITE_DELAY_MSEC = 5 * 1000; // 5 seconds.

/** {Int} How long (in msec) to wait between write retries. */
const WRITE_RETRY_DELAY_MSEC = 10 * 1000; // Ten seconds.

/** {Int} How many times to retry writes. */
const MAX_WRITE_RETRIES = 10;

/**
 * Helper class for `CaretControl` which handles the underlying file storage of
 * caret information. Every caret that gets updated or removed via the public
 * methods on this class is considered to be "locally controlled," and so such
 * caret updates are pushed to the file storage.
 *
 * **TODO:** This class currently only ever _writes_ carets to storage but
 * doesn't ever read carets that might have been written by other servers. It
 * should in fact also try reading other carets, providing a way for the
 * caret controller to see them and get them updated in a timely fashion.
 */
export default class CaretStorage extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {FileComplex} fileComplex File complex that this instance is part
   *   of.
   */
  constructor(fileComplex) {
    super();

    /** {FileComplex} File complex that this instance is part of. */
    this._fileComplex = FileComplex.check(fileComplex);

    /** {FileCodec} File-codec wrapper to use. */
    this._fileCodec = fileComplex.fileCodec;

    /** {Logger} Logger specific to this document's ID. */
    this._log = fileComplex.log;

    /**
     * {Set<string>} Set of session IDs, indicating all of the editing sessions
     * which are being managed directly by this instance (and by extension, this
     * server).
     */
    this._localSessions = new Set();

    /**
     * {Map<string,Caret>} Map from session IDs to carets, for all
     * currently-known carets, both from local sessions and from file storage.
     */
    this._carets = new Map();

    /**
     * {Map<string,Caret>} Map from session IDs to carets, for carets that are
     * believed to be currently represented in file storage. The differences
     * between this and `_carets` are what get written to file storage.
     */
    this._storedCarets = new Map();

    /**
     * {Promise|null} Promise for the result of a pending storage write, or
     * `null` if no storage write is currently pending.
     */
    this._writeResultProm = null;

    Object.seal(this);
  }

  /**
   * Deletes a locally-controlled session. This update will eventually get
   * written to file storage (unless superseded by another change to the same
   * session in the meantime).
   *
   * @param {Caret} caret Caret for the session to be deleted. Only the
   *   `sessionId` of the caret is actually used.
   */
  delete(caret) {
    Caret.check(caret);
    const sessionId = caret.sessionId;

    // Indicate that the local server is asserting authority over this session.
    // This means that, when it comes time to write out caret info, this session
    // will be removed from file storage.
    this._localSessions.add(sessionId);

    this._carets.delete(sessionId);
    this._needsWrite();
  }

  /**
   * Updates a caret for a locally-controlled session. This update will
   * eventually get written to file storage (unless superseded by another change
   * to the same session in the meantime).
   *
   * @param {Caret} caret Caret information to update.
   */
  update(caret) {
    Caret.check(caret);
    const sessionId = caret.sessionId;

    // Indicate that the local server is asserting authority over this session.
    // This means that, when it comes time to write out caret info, this session
    // will be written to file storage.
    this._localSessions.add(sessionId);

    this._carets.set(sessionId, caret);
    this._needsWrite();
  }

  /**
   * Indicates that there is local session data that needs to be written to
   * file storage. This will ultimately cause such writing to be done.
   *
   * **Note:** This method only returns after the writing is done, which to
   * reiterate only happens after a delay. If you want to make a bunch of writes
   * that all end up written (approximately) together, do _not_ `await` the
   * result of this call.
   */
  async _needsWrite() {
    if (this._writeResultProm === null) {
      this._writeResultProm = this._waitThenWrite();
    }

    // Note the current promise, so as to prevent us from messing with the
    // next round of writing.
    const currentProm = this._writeResultProm;

    try {
      await currentProm;
    } finally {
      if (this._writeResultProm === currentProm) {
        // This round of writing is done, but the promise hasn't yet been reset
        // (either to `null` or to a new promise). `null` it out, so that the
        // next call to `_needsWrite()` will in fact kick off a new round of
        // writing.
        this._writeResultProm = null;
      }
    }
  }

  /**
   * Waits a moment, and then writes all locally-controlled carets to file
   * storage.
   *
   * **Note:** This method swallows errors (just reporting them via the log),
   * because ultimately caret sharing is done on a "best effort" basis. We'd
   * rather offer degraded service (i.e. not sharing carets even while other
   * things are working) than hard failure.
   */
  async _waitThenWrite() {
    await PromDelay.resolve(WRITE_DELAY_MSEC);

    // Build up a transaction spec to perform all the caret updates, and extract
    // a set of changes to make to instance variables should the transaction
    // succeed. (We have to do this latter part before we `await` the
    // transaction, since otherwise we could be looking at stale state.)

    const fc            = this._fileCodec;
    const ops           = [];
    const updatedCarets = new Map();

    for (const s of this._localSessions) {
      const caret       = this._carets.get(s) || null;
      const storedCaret = this._storedCarets.get(s) || null;
      const path        = Paths.forCaret(s);

      if (   (caret === storedCaret)
          || (caret && storedCaret && caret.equals(storedCaret))) {
        // The file already stores this caret info (or properly doesn't-store
        // a caret for a terminated session).
        continue;
      }

      if (caret) {
        ops.push(fc.op_writePath(path, caret));
      } else {
        ops.push(fc.op_deletePath(path));
      }

      updatedCarets.set(path, caret);
    }

    // Run the transaction, retrying a few times on failure.

    const spec = new TransactionSpec(...ops);

    for (let i = 0; i < MAX_WRITE_RETRIES; i++) {
      if (i !== 0) {
        this._log.info(`Caret write attempt #${i+1}.`);
      }

      try {
        await fc.transact(spec);
        break;
      } catch (e) {
        this._log.warn('Failed to write carets.', e);
      }

      await PromDelay.resolve(WRITE_RETRY_DELAY_MSEC);
    }

    // Update instance variables to reflect the new state of affairs.

    for (const [s, caret] of updatedCarets) {
      if (caret) {
        this._storedCarets.set(s, caret);
      } else {
        // The session has ended. In addition to deleting the caret from the
        // file storage model, this removes the session from the set of
        // locally-controlled sessions. This is done because we only ever have
        // to delete a given session from file storage once.
        this._storedCarets.delete(s);
        this._localSessions.delete(s);
      }
    }
  }
}