// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/*
 * Top-level entry point for client tests.
 */

import { injectAll } from '@bayou/config-common-default';
import { ClientEnv } from '@bayou/env-client';
import { Logger } from '@bayou/see-all';
import { ClientSink } from '@bayou/see-all-client';
import { Tests } from '@bayou/testing-client';

// Inject all the system configs. **TODO:** See comment on similar call in
// `../index.js`.
injectAll();

// Init logging.
ClientSink.init();
const log = new Logger('page-init');
log.info('Starting up testing environment...');

// Init the environment utilities.
ClientEnv.init(window);

const elem = document.createElement('p');
elem.innerHTML = 'Running&hellip;';
document.body.appendChild(elem);

(async () => {
  const failures = await Tests.runAll();

  let msg;
  switch (failures) {
    case 0:  { msg = 'All good! Yay!';                         break; }
    case 1:  { msg = 'Alas, there was one failure.';           break; }
    default: { msg = `Alas, there were ${failures} failures.`; break; }
  }

  elem.innerHTML = msg;
})();
