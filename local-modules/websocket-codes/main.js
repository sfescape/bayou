// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/**
 * Map of close codes to nominally official constant names. See
 * <https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent>.
 */
const CLOSE_CODES = {
  1000: 'close_normal',
  1001: 'close_going_away',
  1002: 'close_protocol_error',
  1003: 'close_unsupported',
  1005: 'close_no_status',
  1006: 'close_abnormal',
  1007: 'close_unsupported_data',
  1008: 'close_policy_violation',
  1009: 'close_too_large',
  1010: 'close_missing_extension',
  1011: 'close_internal_error',
  1012: 'close_service_restart',
  1013: 'close_try_again_later',
  1015: 'close_tls_handshake'
};

/**
 * Translator of Websocket status codes to human-oriented strings.
 *
 * **Note:** This class is not intended to be instantiated.
 */
export default class WebsocketCodes {
  /**
   * Get a friendly string for the given close reason code. This will always
   * include the number and will also include the name if known.
   *
   * @param code (default `null`) The code. If `null`, the result indicates
   *   a close with an unknown cause.
   * @return The corresponding friendly string.
   */
  static close(code = null) {
    if (code === null) {
      return 'close_?';
    }

    const s = CLOSE_CODES[code];
    return s ? `${s} (${code})` : `close_${code}`;
  }
}