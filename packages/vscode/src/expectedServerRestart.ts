import type {
  CloseHandlerResult,
  ErrorHandler,
} from "vscode-languageclient/node";

/**
 * A language-client error handler with an operation that marks the next close
 * as expected.
 *
 * A server-requested plugin transition must not consume the default
 * transport-crash budget.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The supported ErrorHandler and a separate marking method expose the
 *   transport policy without exposing its private one-shot boolean.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Callbacks and the marking operation form one controller interface; callers
 *   cannot rewrite the state or replace the fallback implementation.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The representation follows the documented consumer contract; its fields do
 *   not introduce fixture-selected variants.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Type and member JSDoc distinguish the supported ErrorHandler from its
 *   one-shot expected-close marker and explain the crash-budget reason.
 *   Purpose, conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 *
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   ExpectedServerRestartHandler only describes values and opens no file, path
 *   or process.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   ExpectedServerRestartHandler is a type definition with no computation to
 *   cost.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   ExpectedServerRestartHandler is a type definition and coordinates no work
 *   across requests.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   ExpectedServerRestartHandler is a type definition and owns no state,
 *   handle or task.
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
   * @evidence contracts/common.md#principled-implementation
   *   This signature exposes the owned one-shot lifecycle transition.
   *
   * @evidence contracts/common.md#clear-and-simple-design
   *   A parameterless marker expresses exactly the next-close transition;
   *   callers do not need access to the transport callbacks or boolean state.
   *
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   It declares no implementation or foreign mutation;
   *   createExpectedServerRestartHandler owns the flag through the supported
   *   language-client handler boundary.
   *
   * @evidence contracts/common.md#meaningful-documentation
   *   Method JSDoc states that the next close consumes one marker and that
   *   later unannounced closes return to the fallback crash policy. Purpose,
   *   conditions and reasons use separate native paragraphs under the
   *   documentation skill; member comments remain beside their fields.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   It sets one in-memory flag and touches no path or process.
   *
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   It performs one constant-time assignment.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   It computes nothing that another request could share.
   *
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   The flag it sets is owned by the handler closure and holds no handle.
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
 * @evidence contracts/common.md#principled-implementation
 *   A closure implements the supported ErrorHandler extension rather than
 *   replacing LanguageClient internals. Rest-argument forwarding preserves
 *   error callback arguments and one-shot state separates announced
 *   transitions from genuine crashes.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One closure owns the boolean and returns the handler and marker together.
 *   Unmarked closes and all errors delegate to the supplied fallback.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The explicit server notification is the supported reason for bypassing
 *   one crash-budget decision. Later closes use the original handler; no
 *   LanguageClient method or global transport is replaced.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc separates forwarded errors, one marked close and subsequent
 *   fallback closes, explaining the controller lifetime and crash-budget
 *   reason. Purpose, conditions and reasons use separate native paragraphs
 *   under the documentation skill; member comments remain beside their
 *   fields.
 *
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   It forwards language-client callbacks and touches no path or process.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   Each callback does constant work.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Each close decision depends on the one-shot flag, so no result is
 *   shareable.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   The closure owns one boolean per language client and is reclaimed with
 *   that client's error handler; it holds no handle, timer or task.
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
