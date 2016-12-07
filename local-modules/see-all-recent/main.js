// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import util from 'util';

import ansiHtml from 'ansi-html';
import chalk from 'chalk';

import SeeAll from 'see-all';

/**
 * Implementation of the `SeeAll` logger protocol which collects a rolling
 * compendium of recently logged items.
 */
export default class SeeAllRecent {
  /**
   * Registers an instance of this class as a logger with the main `see-all`
   * module.
   */
  static init() {
    SeeAll.add(new SeeAllServer());
  }

  /**
   * Constructs an instance. This will cause the instance to be registered with
   * the main `see-all` module.
   *
   * @param maxAgeMsec The maximum age of logged items before they age out of
   *   the list.
   */
  constructor(maxAgeMsec) {
    /** Maximum age. */
    this._maxAgeMsec = maxAgeMsec;

    /** The log contents. */
    this._log = [];

    SeeAll.add(this);
  }

  /**
   * Logs a message at the given severity level.
   *
   * @param level Severity level.
   * @param message Message to log.
   */
  log(nowMsec, level, tag, ...message) {
    const details = {
      nowMsec: nowMsec,
      level:   level,
      tag:     tag,
      message: message
    };

    this._log.push(details);
  }

  /**
   * Logs the indicated time value as "punctuation" on the log. This class
   * also uses this call to trigger cleanup of old items.
   *
   * @param nowMsec The time.
   */
  time(nowMsec, utcString, localString) {
    const details = {
      nowMsec:     nowMsec,
      tag:         'time',
      utcString:   utcString,
      localString: localString
    };

    this._log.push(details);

    // Trim the log.

    const oldestMsec = nowMsec - this._maxAgeMsec;

    let i;
    for (i = 0; i < this._log.length; i++) {
      if (this._log[i].nowMsec >= oldestMsec) {
        break;
      }
    }

    if (i !== 0) {
      this._log = this._log.slice(i);
    }
  }

  /**
   * Gets the saved contents of this log.
   */
  get contents() {
    return this._log;
  }

  /**
   * Gets the saved contents as HTML.
   */
  get htmlContents() {
    const result = [];

    result.push('<table>');

    for (let l of this._log) {
      result.push(SeeAllRecent._htmlLine(l));
    }

    result.push('</table>');
    return result.join('\n');
  }

  /**
   * Converts the given log line to HTML.
   */
  static _htmlLine(log) {
    let tag, body;

    if (log.tag === 'time') {
      const utcString = chalk.blue.bold(log.utcString);
      const localString = chalk.blue.dim.bold(log.localString);
      tag = '[time]';
      body = `${utcString} ${chalk.dim.bold('/')} ${localString}`;
    } else {
      tag = `[${log.tag} ${log.level}]`;
      body = log.message.map((x) => {
        return (typeof x === 'string') ? x : util.inspect(x);
      }).join(' ');
    }

    // Color the prefix according to level.
    switch (log.level) {
      case 'error': { tag = chalk.red.bold(tag);    break; }
      case 'warn':  { tag = chalk.yellow.bold(tag); break; }
      default:      { tag = chalk.dim.bold(tag);    break; }
    }

    const tagHtml = ansiHtml(tag);
    const bodyHtml = ansiHtml(body);

    return `<tr><td>${tagHtml}</td><td>${bodyHtml}</td>`;
  }
}