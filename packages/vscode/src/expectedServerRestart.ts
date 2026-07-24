import type {
  CloseHandlerResult,
  ErrorHandler,
} from "vscode-languageclient/node";

export type ExpectedServerRestartHandler = {
  errorHandler: ErrorHandler;
  expectRestart(): void;
};

/**
 * Separate server-requested lifecycle transitions from transport crashes.
 *
 * `vscode-languageclient` keeps a three-minute crash budget in its default
 * handler. A ttscserver plugin-selection notification is an expected close, so
 * consuming it here prevents normal configuration edits from spending that
 * budget while every unannounced close still follows the default policy.
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
