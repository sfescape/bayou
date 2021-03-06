// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

// This file is what should be included from an HTML page which wishes to
// become/embed a Bayou editor. It assumes that the `window` object (that is,
// the global context) contains the following bindings:
//
// * `BAYOU_KEY` -- The JSON-encoded form of an instance of `SplitKey`, to be
//   used to authenticate access to a particular documemt.
// * `BAYOU_NODE` -- The DOM node into which the editor should be embedded.
// * `BAYOU_RECOVER` (optional) -- Function to use when attempting to recover
//   from connection trouble.
//
// See `TopControl` for more details about these parameters.

// Disable Eslint, because this file is delivered as-is and has to be fairly
// conservative.
/* eslint-disable */

// We wrap everything in an immediately-executed function so as to avoid
// polluting the global namespace.
(function () {
  if (!(window.BAYOU_KEY && window.BAYOU_NODE)) {
    // **Note:** This code is run too early to be able to use
    // `@bayou/util-common`'s error facilities.
    throw new Error('Missing configuration.');
  }

  // Grab the base URL out of the encoded key. This is kinda gross, but when
  // we're here we haven't yet loaded the API code, and in order to load that
  // code we need to know the base URL, whee! So we just do the minimal bit of
  // parsing needed to get the URL and then head on our merry way. See
  // {@link @bayou/api-common/SplitKey}, the encoded form in particular, if you
  // want to understand what's going on.
  var key = JSON.parse(window.BAYOU_KEY);
  var url = key.SplitKey[0];
  var baseUrl = ((url === '*') ? window.location : new URL(url)).origin;

  // Add the main JavaScript bundle to the page. Once loaded, this continues
  // the boot process. You can find its main entrypoint in
  // {@link @bayou/main-client} listed as the `main` in that module's manifest.
  var elem = document.createElement('script');
  elem.src = baseUrl + '/static/js/main.bundle.js';
  document.head.appendChild(elem);
}());
