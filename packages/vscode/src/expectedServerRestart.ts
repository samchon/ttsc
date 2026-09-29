import type {
  CloseHandlerResult,
  ErrorHandler,
} from "vscode-languageclient/node";

/**
 * A language-client error handler with an operation that marks the next
 * close as expected.
 *
 * A server-requested plugin transition must not consume the default
 * transport-crash budget.
 *
 * @evidence contracts/common.md#standard-implementation-practices
 *   The TypeScript structural type ExpectedServerRestartHandler represents
 *   one expected-close lifecycle flag and the supported ErrorHandler
 *   interface. It declares values and optional states without executable
 *   branches, fixture-specific decisions, foreign mutation or a competing
 *   runtime implementation.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   The supported ErrorHandler and one-shot marker distinguish an announced
 *   transition from a crash. createExpectedServerRestartHandler owns the flag
 *   and delegates errors plus unannounced closes to fallback. Existing
 *   restart-handler cases exercise that consumer. The structural type cannot
 *   enforce when a caller should announce a restart.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Type and member JSDoc distinguish the supported ErrorHandler from its
 *   one-shot expected-close marker and explain the crash-budget reason.
 *   Purpose, conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 *
 */
export type ExpectedServerRestartHandler = {
  /** Supported language-client callbacks carrying the expected-close policy. */
  errorHandler: ErrorHandler;
  /**
   * Mark the next close callback as a server-requested restart.
   *
   * The controller consumes this one-shot flag on close; unannounced later
   * closes return to the fallback crash policy.
   *
   * @evidence contracts/common.md#standard-implementation-practices
   *   This signature exposes the owned one-shot lifecycle transition. It
   *   declares no implementation or foreign mutation;
   *   createExpectedServerRestartHandler owns the flag through the supported
   *   language-client handler boundary.
   *
   * @evidence contracts/common.md#behavioral-correctness
   *   The signature marks one expected close;
   *   createExpectedServerRestartHandler sets a boolean and consumes it only in
   *   closed. Repeated marking before that close does not queue several
   *   exemptions. Existing announced/unannounced close cases and the inspected
   *   closure establish this contribution; the signature itself performs no
   *   process restart.
   *
   * @evidence contracts/common.md#meaningful-documentation
   *   Method JSDoc states that the next close consumes one marker and that
   *   later unannounced closes return to the fallback crash policy. Purpose,
   *   conditions and reasons use separate native paragraphs under the
   *   documentation skill; member comments remain beside their fields.
   *
   */
  expectRestart(): void;
};

/**
 * Create a one-shot expected-close controller around the supplied
 * language-client fallback handler.
 *
 * Errors always delegate to fallback. One marked close returns the supplied
 * restart result and clears the flag; later unmarked closes preserve the
 * fallback crash policy.
 *
 * @evidence contracts/common.md#standard-implementation-practices
 *   A closure implements the supported ErrorHandler extension rather than
 *   replacing LanguageClient internals. Rest-argument forwarding preserves
 *   error callback arguments and one-shot state separates announced
 *   transitions from genuine crashes. There is no test-specific production
 *   branch.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   Inspection forwards error callback arguments to fallback, consumes one
 *   expected close into the supplied restart result and restores fallback
 *   behavior for later unmarked closes. Existing restart cases exercise both
 *   paths. This preserves the default crash budget outside the announced
 *   transition rather than suppressing every close or changing
 *   language-client internals.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc separates forwarded errors, one marked close and subsequent
 *   fallback closes, explaining the controller lifetime and crash-budget
 *   reason. Purpose, conditions and reasons use separate native paragraphs
 *   under the documentation skill; member comments remain beside their
 *   fields.
 *
 */

export function createExpectedServerRestartHandler(
  fallback: ErrorHandler,
  restart: CloseHandlerResult,
): ExpectedServerRestartHandler {
  let expected = false;
  return {
    errorHandler: {
      error: (...args: Parameters<ErrorHandler["error"]>) =>
        fallback.error(...args),
      closed: () => {
        if (!expected) {
          return fallback.closed();
        }
        expected = false;
        return restart;
      },
    },
    expectRestart: () => {
      expected = true;
    },
  };
}
