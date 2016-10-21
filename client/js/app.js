// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/*
 * Editor initialization
 *
 * This file is directly loaded from pages that include an editor. It expects
 * there to be a DOM node tagged with id `editor`.
 */

import ApiClient from './ApiClient';
import DocumentPlumbing from './DocumentPlumbing';
import QuillMaker from './QuillMaker';

// Make the instance.
const quill = QuillMaker.make('#editor');

// Initialize the API connection, and hook it up to the Quill instance.
const api = new ApiClient(document.URL);
api.open();
new DocumentPlumbing(quill, api);
