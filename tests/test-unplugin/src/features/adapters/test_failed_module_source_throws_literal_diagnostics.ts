import assert from "node:assert/strict";

import { failedModuleSource } from "../../../../../packages/unplugin/src/core/turbopack/failedModuleSource";

/**
 * Verifies the failed-module representation throws the diagnostic itself when
 * evaluated, including text that resembles executable source.
 *
 * This portable source operation does not prove that Turbopack retains a worker
 * or receives a native compiler verdict; those connections remain E2E-owned.
 *
 * 1. Evaluate the actual generated module for ordinary and empty diagnostics.
 * 2. Preserve quotes, backslashes, newlines and source-shaped diagnostic text.
 *
 * @evidence contracts/testing.md#behavioral-verification Evaluates actual failedModuleSource output through Function and requires an Error whose message exactly equals each supplied diagnostic; malformed encoding, a returned value or a different throw cannot satisfy the assertion.
 * @evidence contracts/testing.md#independent-expectations Literal diagnostic messages are the contract oracle. No expected generated source is copied from the encoder, and matching Error.message distinguishes an encoded diagnostic from syntax failure or diagnostic text escaping into code.
 * @evidence contracts/testing.md#distinguishing-cases Ordinary and empty messages both throw; quotes, a backslash, a newline, Unicode line separators and source-shaped text preserve their exact message rather than altering evaluation. Native verdict delivery and actual Turbopack worker lifetime are complementary E2E obligations.
 * @evidence contracts/testing.md#execution-ownership One discoverable adapters unit directly calls the owning source encoder and evaluates its returned JavaScript in-process. No native compiler, installed artifact, worker, process or host loader starts; existing E2E originals remain untouched.
 */
export function test_failed_module_source_throws_literal_diagnostics(): void {
  for (const message of [
    "literal compile failure",
    "",
    'quoted "diagnostic" and \\ path\nnext line',
    '"; throw new Error("escaped"); //\n\u2028\u2029',
  ]) {
    assert.throws(
      () => new Function(failedModuleSource(new Error(message)))(),
      (failure: unknown) => failure instanceof Error && failure.message === message,
      `evaluation must throw the exact diagnostic ${JSON.stringify(message)}`,
    );
  }
}
