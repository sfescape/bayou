// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import PromCondition from 'prom-condition';
import SeeAll from 'see-all';

/**
 * Lightweight state machine framework. This allows a subclass to define
 * handlers for any number of (state, event) pairs, along with default handlers
 * for wildcards on either event or state (or both). Events can be queued up
 * at will and get dispatched asynchronously (in a separate turn) with respect
 * to the act of enqueueing, in the same order they were enqueued.
 *
 * The state machine is defined by a set of instance methods defined by
 * subclasses, with particular schematic names:
 *
 * * A method of the form `_check_<name>` is taken to be a validator for the
 *   event with the given name. It is called with the would-be event arguments,
 *   and it should return regularly if the arguments are valid, or throw an
 *   exception if the arguments are somehow invalid. The set of validators in
 *   effect defines the set of valid event names for the instance.
 *
 * * A method of the form `_handle_<stateName>_<eventName>` is taken to be the
 *   handler for the named event in the named state. It gets called with the
 *   same arguments as passed to the event queue function for the given event
 *   name. The set of states named in these methods defines the set of valid
 *   states for the instance.
 *
 *   As a special case, `any` may be used for either a state name or an event
 *   name (or both) in a handler, which causes the method to be used if there is
 *   no more specific handler. In the case of an `any` event name, the event
 *   name itself is prepended to the event arguments. **Note:** If there are
 *   matching handlers for for both (state, any-event) and (event, any-state),
 *   then the former "wins."
 *
 * Constructing an instance will cause the instance to have a method added per
 * named event, `q_<name>`, each of which takes any number of arguments and
 * queues up a new event (and does nothing else; e.g. doesn't cause synchronous
 * dispatch of events).
 *
 * Similarly, a method is added for each state, `s_<name>`, each of which takes
 * no arguments and causes the machine to switch into the so-named state.
 */
export default class StateMachine {
  /**
   * Constructs an instance.
   *
   * @param {string} initialState The initial state.
   * @param {SeeAll} [logger = null] Logger to use.
   */
  constructor(initialState, logger = null) {
    /** Logger to use. */
    this._log = logger || new SeeAll('state-machine');

    /** The current state. Set below. */
    this._state = null;

    /** Queue of events in need of dispatch. */
    this._eventQueue = [];

    /**
     * Condition which is set to `true` whenever the event queue has events in
     * it.
     */
    this._anyEventPending = new PromCondition(false);

    /** Count of events handled. Used for logging. */
    this._eventCount = 0;

    /** Map of event names to their validator methods. */
    this._eventValidators = this._makeValidatorMap();

    /** Two-level map from (state, event) pairs to their respective handlers. */
    this._handlers = this._makeHandlerMap();

    this._addEnqueueMethods();
    this._addStateMethods();

    // We use a state-setting method to set the state, because (a) it implicitly
    // validates that the named state is valid, and (b) it will log (if not
    // squelched).
    this[`s_${initialState}`]();

    this._serviceEventQueue(); // Set up the queue servicer; it self-perpetuates.
  }

  /**
   * Adds to this instance one method per event name, named `q_<name>`, each of
   * which takes any number of arguments and enqueues an event with the
   * associated name and the given arguments.
   */
  _addEnqueueMethods() {
    const events = Object.keys(this._eventValidators);
    for (const name of events) {
      const validator = this._eventValidators[name];
      this[`q_${name}`] = (...args) => {
        validator.apply(this, args);
        this._log.detail('Enqueued:', name, args);
        this._eventQueue.push({name, args});
        this._anyEventPending.value = true;
      };
    }
  }

  /**
   * Adds to this instance one method per state name, named `s_<name>`, as
   * described in the class header docs.
   */
  _addStateMethods() {
    const states = Object.keys(this._handlers);
    for (const name of states) {
      this[`s_${name}`] = () => {
        if (this._state !== name) {
          this._log.detail('New state:', name);
          this._state = name;
        }
      };
    }
  }

  /**
   * Constructs a map from each valid event names to its respective event
   * validator method.
   *
   * @returns {object} The event validator map.
   */
  _makeValidatorMap() {
    const result = {}; // Built-up result.

    let obj = this;
    while (obj && (obj !== Object.prototype)) {
      const names = Object.getOwnPropertyNames(obj);
      for (const name of names) {
        const match = name.match(/^_check_([a-zA-Z0-9]+)$/);
        if (!match) {
          // Not the right name format.
          continue;
        }

        // Inspect the property descriptor.
        const desc = Object.getOwnPropertyDescriptor(obj, name);
        if (desc.get || desc.set) {
          // It's a synthetic member, not a method.
          continue;
        } else if (typeof desc.value !== 'function') {
          // Not a function, thus not a method.
          continue;
        }

        const eventName = match[1];
        result[eventName] = desc.value;
      }

      obj = Object.getPrototypeOf(obj);
    }

    return result;
  }

  /**
   * Constructs a two-level map from state-event pairs to the methods which
   * handle those pairs.
   *
   * @returns {object} The handler map.
   */
  _makeHandlerMap() {
    const result = {};       // Built-up result.
    const stateNameMap = {}; // Map with state name keys (not including `any`).

    // First pass: Find all methods with the right name form, including those
    // with `any` (wildcard) names.
    let obj = this;
    while (obj && (obj !== Object.prototype)) {
      const names = Object.getOwnPropertyNames(obj);
      for (const name of names) {
        const match = name.match(/^_handle_([a-zA-Z0-9]+)_([a-zA-Z0-9]+)$/);
        if (!match) {
          // Not the right name format.
          continue;
        }

        // Inspect the property descriptor.
        const desc = Object.getOwnPropertyDescriptor(obj, name);
        if (desc.get || desc.set) {
          // It's a synthetic member, not a method.
          continue;
        } else if (typeof desc.value !== 'function') {
          // Not a function, thus not a method.
          continue;
        }

        const stateName = match[1];
        const eventName = match[2];

        if ((eventName !== 'any') && !this._eventValidators[eventName]) {
          // No associated validator.
          throw new Error(`Unknown event name in method: ${name}`);
        }

        if (!result[stateName]) {
          result[stateName] = {};
        }

        result[stateName][eventName] = desc.value;

        if (stateName !== 'any') {
          stateNameMap[stateName] = true;
        }
      }

      obj = Object.getPrototypeOf(obj);
    }

    // These _don't_ include `any`.
    const states = Object.keys(stateNameMap);          // List of state names.
    const events = Object.keys(this._eventValidators); // List of event names.

    // In the second layer, find `any` bindings, and use them to fill out their
    // state. **Note:** For the outer loop, we want to process the `any` state
    // handler map and do so first so that its results are available during
    // subsequent iterations. Also note, because this class defines an `any_any`
    // handler, we know we'll have a top-level `any` entry.
    for (const state of ['any', ...states]) {
      const eventHandlers = result[state];
      const anyHandler = result[state].any;
      for (const event of events) {
        if (result[state][event]) {
          // The handler for the (state, event) pair is defined directly.
          continue;
        } else if (anyHandler) {
          // There is a default handler for the state. Bind a function that
          // calls through to it with an extra first arg for the event name.
          result[state][event] = (...args) => {
            anyHandler.call(this, event, ...args);
          };
        } else {
          // Use the default handler for the event. By construction, this will
          // end up using the (any, any) handler where there is no more specific
          // default.
          result[state][event] = result.any[event];
        }
      }

      delete eventHandlers.any; // Don't represent `any` in the final result.
    }

    delete result.any; // Don't represent `any` in the final result.

    return result;
  }

  /**
   * Services the event queue. This waits for the queue to be non-empty (via a
   * promise), dispatches all events, and then recursively iterates.
   */
  _serviceEventQueue() {
    this._anyEventPending.whenTrue().then((res_unused) => {
      this._dispatchAll();
      this._serviceEventQueue();
    });
  }

  /**
   * Dispatches all events on the queue, including any new events that get
   * enqueued during dispatch.
   */
  _dispatchAll() {
    while (this._eventQueue.length !== 0) {
      // Grab the queue locally, and then reset it for further event collection.
      const queue = this._eventQueue;
      this._eventQueue = [];
      this._anyEventPending.value = false;

      // Dispatch each event that had been queued on entry to this (outer) loop.
      for (const event of queue) {
        this._dispatchEvent(event);
      }
    }
  }

  /**
   * Default handler for any event in any state. This may be overridden by
   * subclasses.
   *
   * @param {string} name The event name.
   * @param {...*} args_unused Arguments to the event.
   */
  _handle_any_any(name, ...args_unused) {
    throw new Error(`Cannot handle event \`${name}\` in state \`${this._state}\`.`);
  }

  /**
   * Dispatches the given event.
   *
   * @param {object} event The event.
   */
  _dispatchEvent(event) {
    const {name, args} = event;
    const state = this._state;
    const log = this._log;

    // Log the state name and event details (if not squelched), and occasional
    // count of how many events have been handled so far.

    log.detail(`In state: ${state}`);
    log.detail('Dispatching:', name, args);

    // Dispatch the event.
    this._handlers[state][name].apply(this, args);

    // Log the outcome (if not squelched).
    log.detail(`Done.`);

    this._eventCount++;
    if ((this._eventCount % 25) === 0) {
      log.info(`Handled ${this._eventCount} events.`);
    }
  }
}
