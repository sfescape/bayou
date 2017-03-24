// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { ApiClient } from 'api-client';
import { Decoder, SplitKey } from 'api-common';
import { DocClient } from 'doc-client';
import { Hooks } from 'hooks-client';
import { QuillMaker } from 'quill-util';
import { SeeAll } from 'see-all';
import { TFunction, TString } from 'typecheck';

/** {SeeAll} Logger for this module. */
const log = new SeeAll('top');

/**
 * Top-level control for an editor. This is responsible for setting up the
 * browser environment and for keeping things going.
 */
export default class TopControl {
  /**
   * Constructs an instance.
   *
   * @param {Window} window The browser window in which we are operating.
   */
  constructor(window) {
    /** {Window} The browser window in which we are operating. */
    this._window = window;

    // Pull the incoming parameters from `window.*` globals into instance
    // variables. Validate that they're present before doing anything further.

    /**
     * {string} Key that authorizes access and update to a particular document as
     * a specific author. This is expected to be a `SplitKey` in JSON-encoded form.
     */
    this._key = SplitKey.check(Decoder.decodeJson(window.BAYOU_KEY));

    /**
     * {string} DOM Selector string that indicates which node in the DOM should
     * become the editor.
     */
    this._node = TString.nonempty(window.BAYOU_NODE);

    /**
     * {function} Function to call when the editor finds itself in an unrecoverable
     * (to it) situation. If it returns at all, it is expected to return a new key
     * to use (instead of `BAYOU_KEY`); if it does not return a string that can
     * be decoded into a `SplitKey`, the system will simply halt.
     *
     * If not supplied, this variable defaults to a no-op function.
    */
    this._recover =
      TFunction.check(window.BAYOU_RECOVER || (() => { /* empty */ }));

    /** {QuillProm|null} Editor instance. Becomes non-null in `start()`. */
    this._quill = null;

    /**
     * {ApiClient|null} API client instance (client-to-server hookup). Becomes
     * non-null in `_makeApiClient()`.
     */
    this._apiClient = null;

    /**
     * {DocClient|null} Client instance (API-to-editor hookup). Becomes non-null
     * in `_makeDocClient()`.
     */
    this._docClient = null;
  }

  /**
   * Start things up.
   */
  start() {
    // Initialize the API connection. We do this in parallel with the rest of
    // the page loading, so as to minimize time-to-interactive.
    this._makeApiClient();

    // Arrange for the rest of initialization to happen once the initial page
    // contents are fully loaded.
    this._window.addEventListener('load', (event_unused) => {
      log.detail('Initial page load complete.');

      const baseUrl = this._apiClient.baseUrl;

      // Do our basic page setup. Specifically, we add the CSS we need to the page.
      const elem = document.createElement('link');
      elem.href = `${baseUrl}/static/quill/quill.bubble.css`;
      elem.rel = 'stylesheet';
      document.head.appendChild(elem);

      // Validate `_node`.
      if (document.querySelector(this._node) === null) {
        // If we land here, no further init can possibly be done, so we just
        // `throw` out of it.
        const extra = (this._node[0] === '#') ? '' : ' (maybe need a `#` prefix?)';
        throw new Error(`No such selector${extra}: \`${this._node}\``);
      }

      // Give the overlay a chance to do any initialization.
      Hooks.run(this._window, baseUrl);
      log.detail('Ran `run()` hook.');

      // Make the editor instance.
      this._quill = QuillMaker.make(this._node);
      log.detail('Made editor instance.');

      // Hook the API up to the editor instance.
      this._makeDocClient(this._apiClient);

      log.detail('Async operations now in progress...');
    });
  }

  /**
   * Gets the URL to use when attaching to a server. We use the info from the
   * `_key` if but default to the document URL if not.
   *
   * **Note:** We don't just _always_ use the document's URL because it is
   * possible (and common even) to embed an editor on a page that has a
   * different origin than the server.
   *
   * **Note:** Under normal circumstances, the key we receive comes with a
   * real URL. However, when using the debugging routes, it's possible that we
   * end up with the catchall "URL" `*`. If so, that's when we fall back to
   * using the document's URL. client.
   *
   * @returns {string} The server URL.
   */
  _getUrl() {
    return (this._key.url !== '*')
      ? this._key.url
      : this._window.document.URL;
  }

  /**
   * Constructs and connects an `ApiClient` instance.
   */
  _makeApiClient() {
    log.detail('Opening API client...');

    this._apiClient = new ApiClient(this._getUrl());
    this._apiClient.open().then(() => {
      log.detail('API client open.');
    });
  }

  /**
   * Constructs and hooks up a `DocClient` instance.
   */
  _makeDocClient() {
    this._docClient = new DocClient(this._quill, this._apiClient, this._key);
    this._docClient.start();
    this._docClient.when_idle().then(() => {
      log.detail('Document client hooked up.');
      log.info('Initialization complete!');
    });
    this._docClient.when_unrecoverableError().then(
      this._recoverIfPossible.bind(this));
  }

  /**
   * This gets called when the editor gives up from getting too many errors. If
   * the `_recover` function returns something useful, this attempts to restart
   * the client.
   */
  _recoverIfPossible() {
    log.error('Editor gave up!');

    const newKey = this._recover();
    if (typeof newKey !== 'string') {
      log.info('Nothing more to do. :\'(');
      return;
    }

    log.info('Attempting recovery with new key...');
    this._key = SplitKey.check(Decoder.decodeJson(newKey));
    this._makeApiClient();
    this._makeDocClient();
  }
}