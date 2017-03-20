// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/*
 * Editor initialization
 *
 * This file is directly loaded from pages that include an editor. It expects
 * there to be a DOM node tagged with id `editor`.
 */

import { ApiClient } from 'api-client';
import { Decoder } from 'api-common';
import { DocClient } from 'doc-client';
import { Hooks } from 'hooks-client';
import { QuillMaker } from 'quill-util';
import { SeeAll } from 'see-all';
import { SeeAllBrowser } from 'see-all-browser';

// Pull the incoming parameters from `window.` globals into locals, to prevent
// them from getting trampled by other init code. Validate that they're present
// before doing anything further.

const BAYOU_KEY = window.BAYOU_KEY;
const BAYOU_NODE = window.BAYOU_NODE;

if (!(BAYOU_KEY && BAYOU_NODE)) {
  throw new Error('Missing configuration.');
}

// Init logging.
SeeAllBrowser.init();
const log = new SeeAll('page-init');

// Figure out the URL of our server. We use the `BAYOU_KEY` global specified by
// the enclosing HTML. We don't just _always_ use the document's URL because it
// is possible (and common even) to embed an editor on a page that has a
// different origin than the server.
//
// **Note:** Under normal circumstances, the key we receive comes with a real
// URL. However, when using the debugging routes, it's possible that we end up
// with the catchall "URL" `*`. If so, we detect that here and fall back to
// using the document's URL.
const key = Decoder.decodeJson(BAYOU_KEY);
const url = (key.url !== '*') ? key.url : document.URL;

// Cut off after the host name. Putting the main expression in a `?` group
// guarantees that the regex will match at least the empty string, which makes
// the subsequent logic a little nicer.
const baseUrl = url.match(/^([a-z]+:\/\/[^\/]+)?/)[0];
if (baseUrl.length === 0) {
  throw new Error(`Could not determine base URL of: ${url}`);
}

// Arrange for the rest of initialization to happen once the initial page
// contents are fully loaded.
window.addEventListener('load', (event_unused) => {
  log.info('Initial page load complete.');

  // Figure out what node we're attaching the editor to. We use the `BAYOU_NODE`
  // global specified by the enclosing HTML.
  if (document.querySelector(BAYOU_NODE) === null) {
    // If we land here, no further init can possibly be done, so we just
    // `return` out of it.
    const extra = (BAYOU_NODE[0] === '#') ? '' : ' (maybe need a `#` prefix?)';
    log.error(`No such selector${extra}: \`${BAYOU_NODE}\``);
    return;
  }

  // Give the overlay a chance to do any initialization.
  log.detail('Running `run()` hook...');
  Hooks.run(window, baseUrl);

  // Make the editor instance.
  log.detail('Making editor instance...');
  const quill = QuillMaker.make(BAYOU_NODE);

  // Initialize the API connection, and hook it up to the Quill instance. Similar
  // to the node identification (immediately above), we use the URL inside the
  // `BAYOU_KEY`, if that's passed, falling back on the document URL for the
  // soon-to-be legacy case. TODO: Should probably insist on `BAYOU_KEY` being
  // defined.

  log.detail('Opening API client...');
  const apiClient = new ApiClient(baseUrl);
  apiClient.open().then(() => {
    log.detail('API client open.');
  });

  log.detail('Hooking up document client...');
  const docClient = new DocClient(quill, apiClient);
  docClient.start();

  log.detail('Done(ish). Async operations now in progress...');
});
