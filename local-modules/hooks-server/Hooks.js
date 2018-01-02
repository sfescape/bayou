// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { LocalFileStore } from 'file-store-local';
import { Hooks as hooksCommon_Hooks } from 'hooks-common';
import { Errors, Singleton } from 'util-common';

import BearerTokens from './BearerTokens';

/**
 * Hooks into various server operations. This is meant to make it easy for
 * complete products to customize Bayou without overlaying the original
 * source...except for this file (and other similar ones).
 */
export default class Hooks extends Singleton {
  /**
   * Called during regular system startup (e.g. and in particular _not_ when
   * just building a client bundle offline). This is called after the very
   * basic initialization but before any document-handling code has been
   * initialized or run.
   */
  run() {
    // This space intentionally left blank.
  }

  /**
   * Given an HTTP request, returns the "public" base URL of that request.
   * By default this is just the `host` as indicated in the headers, prefixed
   * by `http://`. However, when deployed behind a reverse proxy, the
   * public-facing base URL could turn out to be different, hence this hook.
   *
   * @param {object} req HTTP request object.
   * @returns {string} The base URL.
   */
  baseUrlFromRequest(req) {
    const host = req.headers.host;
    if (host) {
      return `http://${host}`;
    }

    throw Errors.badData('Missing `host` header on request.');
  }

  /**
   * {BearerTokens} The object which validates and authorizes bearer tokens.
   * See that (base / default) class for details.
   */
  get bearerTokens() {
    return BearerTokens.theOne;
  }

  /**
   * {BaseFileStore} The object which provides access to file storage (roughly
   * speaking, the filesystem to store the "files" this system deals with). This
   * is an instance of a subclass of `BaseFileStore`, as defined by the
   * `file-store` module.
   */
  get fileStore() {
    return LocalFileStore.theOne;
  }

  /**
   * Checks whether the given value is syntactically valid as a file ID.
   * This method is only ever called with a non-empty string.
   *
   * The default implementation of this method is to defer to the hook
   * `hooks-common.Hooks.theOne.isDocumentId()`.
   *
   * @param {string} id The (alleged) file ID to check.
   * @returns {boolen} `true` iff `id` is syntactically valid.
   */
  isFileId(id) {
    return hooksCommon_Hooks.theOne.isDocumentId(id);
  }

  /**
   * {Int} The local port to listen for connections on by default. This
   * typically but does not _necessarily_ match the values returned by
   * {@link #baseUrlFromRequest}. It won't match in cases where this server runs
   * behind a reverse proxy, for example. It also won't match when the system
   * is brought up in `test` mode, as that mode will pick an arbitrary port to
   * listen on.
   *
   * This (default) implementation of the property always returns `8080`.
   */
  get listenPort() {
    return 8080;
  }
}
