// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import express from 'express';
import util from 'util';

import { Encoder } from 'api-common';
import { AuthorId, DocumentId } from 'doc-common';
import { SeeAll } from 'see-all';
import { SeeAllRecent } from 'see-all-server';

/** Logger for this module. */
const log = new SeeAll('app-debug');

/** How long a log to maintain, in msec. */
const LOG_LENGTH_MSEC = 1000 * 60 * 60; // One hour.

/**
 * Introspection to help with debugging. Includes a request handler for hookup
 * to Express.
 */
export default class DebugTools {
  /**
   * Constructs an instance.
   *
   * @param {RootAccess} rootAccess The root access manager.
   * @param {DocControl} doc The `DocControl` object managed by this process.
   */
  constructor(rootAccess, doc) {
    /** {RootAccess} The root access manager. */
    this._rootAccess = rootAccess;

    /** {DocControl} The document object. */
    this._doc = doc;

    /** {SeeAll} A rolling log for the `/log` endpoint. */
    this._logger = new SeeAllRecent(LOG_LENGTH_MSEC);
  }

  /**
   * The request handler function, suitable for use with Express. Usable as-is
   * (without `.bind()`).
   */
  get requestHandler() {
    const router = new express.Router();

    router.param('authorId',   this._check_authorId.bind(this));
    router.param('documentId', this._check_documentId.bind(this));
    router.param('verNum',     this._check_verNum.bind(this));

    router.get('/change/:verNum',             this._handle_change.bind(this));
    router.get('/edit/:documentId',           this._handle_edit.bind(this));
    router.get('/edit/:documentId/:authorId', this._handle_edit.bind(this));
    router.get('/log',                        this._handle_log.bind(this));
    router.get('/snapshot',                   this._handle_snapshotLatest.bind(this));
    router.get('/snapshot/:verNum',           this._handle_snapshot.bind(this));

    router.use(this._error.bind(this));

    return router;
  }

  /**
   * Validates an author ID as a request parameter.
   *
   * @param {object} req_unused HTTP request.
   * @param {object} res_unused HTTP response.
   * @param {Function} next Next handler to call.
   * @param {string} value Request parameter value.
   * @param {string} name_unused Request parameter name.
   */
  _check_authorId(req_unused, res_unused, next, value, name_unused) {
    try {
      AuthorId.check(value);
    } catch (error) {
      // Augment error and rethrow.
      error.debugMsg = 'Bad value for `authorId`.';
      throw error;
    }

    next();
  }

  /**
   * Validates a document ID as a request parameter.
   *
   * @param {object} req_unused HTTP request.
   * @param {object} res_unused HTTP response.
   * @param {Function} next Next handler to call.
   * @param {string} value Request parameter value.
   * @param {string} name_unused Request parameter name.
   */
  _check_documentId(req_unused, res_unused, next, value, name_unused) {
    try {
      DocumentId.check(value);
    } catch (error) {
      // Augment error and rethrow.
      error.debugMsg = 'Bad value for `documentId`.';
      throw error;
    }

    next();
  }

  /**
   * Validates a version number as a request parameter. If valid, replaces the
   * parameter in the request object with the parsed form.
   *
   * @param {object} req HTTP request.
   * @param {object} res_unused HTTP response.
   * @param {Function} next Next handler to call.
   * @param {string} value Request parameter value.
   * @param {string} name_unused Request parameter name.
   */
  _check_verNum(req, res_unused, next, value, name_unused) {
    if (!value.match(/^[0-9]+$/)) {
      const error = new Error();
      error.debugMsg = 'Bad value for `verNum`.';
      throw error;
    }

    // Replace the string parameter with the actual parsed value.
    req.params.verNum = Number.parseInt(value);

    next();
  }

  /**
   * Gets a particular change to the document.
   *
   * @param {object} req HTTP request.
   * @param {object} res HTTP response handler.
   */
  _handle_change(req, res) {
    const change = this._doc.change(req.params.verNum);
    const result = Encoder.encodeJson(change, true);

    this._textResponse(res, result);
  }

  /**
   * Produces an auth for editing a document, and responds with HTML which uses
   * it. The result is an HTML page that includes the editor.
   *
   * @param {object} req HTTP request.
   * @param {object} res HTTP response handler.
   */
  _handle_edit(req, res) {
    const authorId = req.params.authorId || 'some-author';
    const documentId = req.params.documentId;
    const key = this._rootAccess.makeAccessKey(authorId, documentId);

    // The key gets encoded as a string, and then we JSON-encode _that_ string,
    // so as to make it proper JS source within the <script> block below.
    const quotedKey = JSON.stringify(Encoder.encodeJson(key));

    // TODO: Probably want to use a real template.
    const head = '<title>Editor</title>\n';
    const body =
      '<h1>Editor</h1>\n' +
      '<div id="editor"><p>Loading&hellip;</p></div>\n' +
      '<script>\n' +
      '  BAYOU_KEY  = ' + quotedKey + ';\n' +
      '  BAYOU_NODE = "#editor";\n' +
      '</script>\n' +
      '<script src="/boot-from-key.js"></script>\n';

    this._htmlResponse(res, head, body);
  }

  /**
   * Gets the log.
   *
   * @param {object} req_unused HTTP request.
   * @param {object} res HTTP response handler.
   */
  _handle_log(req_unused, res) {
    // TODO: Format it nicely.
    const result = this._logger.htmlContents;

    this._htmlResponse(res, null, result);
  }

  /**
   * Gets a particular snapshot of the document.
   *
   * @param {object} req HTTP request.
   * @param {object} res HTTP response handler.
   */
  _handle_snapshot(req, res) {
    const snapshot = this._doc.snapshot(req.params.verNum);
    const result = Encoder.encodeJson(snapshot, true);

    this._textResponse(res, result);
  }

  /**
   * Gets the latest snapshot of the document.
   *
   * @param {object} req_unused HTTP request.
   * @param {object} res HTTP response handler.
   */
  _handle_snapshotLatest(req_unused, res) {
    const snapshot = this._doc.snapshot();
    const result = Encoder.encodeJson(snapshot, true);

    this._textResponse(res, result);
  }

  /**
   * Error handler.
   *
   * **Note:** Express "knows" this is an error handler _explicitly_ because it
   * is defined to take four arguments. (Yeah, kinda precarious.)
   *
   * @param {Error} error Error that got thrown during request handling.
   * @param {object} req_unused HTTP request.
   * @param {object} res HTTP response.
   * @param {Function} next_unused Next handler to call.
   */
  _error(error, req_unused, res, next_unused) {
    let text = 'Error while handling debug URL:\n\n';

    if (error.debugMsg) {
      // We added our own message. Use that instead of just dumping a stack
      // trace.
      text += `    ${error.debugMsg}\n`;
    } else {
      // If there was no error message, then this isn't just (something like)
      // a user input error, so report the whole stack trace back.
      //
      // **Note:** It is reasonably safe to spew a stack trace back over the
      // connection because we should only be running code in this file at all
      // if the product is running in a dev (not production) configuration.
      log.error(error);
      text += util.inspect(error);
    }

    res
      .status(500)
      .type('text/plain')
      .send(text);
  }

  /**
   * Responds with a `text/plain` result.
   *
   * @param {object} res HTTP response.
   * @param {string} text Text to respond with.
   */
  _textResponse(res, text) {
    res
      .status(200)
      .type('text/plain')
      .send(text);
  }

  /**
   * Responds with a `text/html` result. The given string is used as the
   * HTML body.
   *
   * @param {object} res HTTP response.
   * @param {string|null} head HTML head text, if any.
   * @param {string} body HTML body text.
   */
  _htmlResponse(res, head, body) {
    head = (head === null)
      ? ''
      : `<head>\n\n${head}\n</head>\n\n`;
    body = `<body>\n\n${body}\n</body>\n`;

    const html = `<!doctype html>\n<html>\n${head}${body}</html>\n`;

    res
      .status(200)
      .type('text/html')
      .send(html);
  }
}
