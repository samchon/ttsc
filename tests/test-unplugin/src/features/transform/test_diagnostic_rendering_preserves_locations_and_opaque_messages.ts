import assert from "node:assert/strict";

import { formatDiagnostics } from "../../../../../packages/unplugin/src/core/transform/diagnostics/formatDiagnostics";
import { formatUnknownError } from "../../../../../packages/unplugin/src/core/transform/diagnostics/formatUnknownError";
import { stripTerminalEscapes } from "../../../../../packages/unplugin/src/core/transform/diagnostics/stripTerminalEscapes";

/**
 * Verifies diagnostic rendering preserves authored positions and plain text
 * while removing supported CSI controls from structured and opaque failures.
 *
 * The helpers own presentation after decoding. These expectations do not
 * require a compiler process or a bundler's error transport.
 *
 * 1. Compare plain, CSI, incomplete CSI and unsupported OSC text with literals.
 * 2. Render an ordered structured list, missing-column fallback and an empty
 *    failure, checking the exact resulting strings.
 * 3. Render Error, message-bearing and other thrown values without mutating their
 *    inputs, then repeat CSI removal to distinguish retained scan state.
 *
 * @evidence contracts/testing.md#behavioral-verification Direct calls to the three actual diagnostic helpers preserve locations, list order and opaque message conversion while removing CSI control sequences and providing the empty-failure fallback.
 * @evidence contracts/testing.md#independent-expectations Handwritten output strings and original object fields define every expectation; no product formatter or escape-removal helper constructs an oracle for another helper.
 * @evidence contracts/testing.md#distinguishing-cases Plain text, repeated CSI calls, incomplete CSI and deliberately unsupported OSC contrast with structured/global/default-column/empty diagnostics and Error/object/string/number/null thrown values.
 * @evidence contracts/testing.md#execution-ownership The unit runner calls authored synchronous formatter owners directly. No compiler, plugin producer, native watcher or host error channel runs; OSC preservation documents the helper's explicit grammar limit.
 */
export function test_diagnostic_rendering_preserves_locations_and_opaque_messages(): void {
  const escape = String.fromCharCode(27);
  const coloured = `${escape}[31mred${escape}[0m`;
  const osc = `${escape}]8;;https://example.invalid${escape}\\link${escape}]8;;${escape}\\`;
  assert.equal(
    stripTerminalEscapes("plain: 3:4: message"),
    "plain: 3:4: message",
  );
  assert.equal(stripTerminalEscapes(coloured), "red");
  assert.equal(stripTerminalEscapes(`${escape}[2J${escape}[?25lkept`), "kept");
  assert.equal(stripTerminalEscapes(`${escape}[31`), `${escape}[31`);
  assert.equal(stripTerminalEscapes(osc), osc);
  assert.equal(stripTerminalEscapes(coloured), "red");

  assert.equal(formatDiagnostics([]), "ttsc transform failed");
  assert.equal(
    formatDiagnostics([
      {
        file: "first.ts",
        line: 7,
        character: 3,
        category: "error",
        code: 1,
        messageText: `${escape}[31mfirst${escape}[0m`,
      },
      {
        file: null,
        category: "warning",
        code: "GLOBAL",
        messageText: "global",
      },
      {
        file: "last.ts",
        line: 2,
        category: "error",
        code: 2,
        messageText: "last",
      },
      { file: "empty.ts", category: "message", code: 3, messageText: "" },
    ]),
    "first.ts: 7:3: first\nttsc: global\nlast.ts: 2:1: last\nempty.ts",
  );

  const message = {
    message: `${escape}[32mobject${escape}[0m`,
    detail: "unchanged",
  };
  assert.equal(formatUnknownError(new Error(coloured)), "red");
  assert.equal(formatUnknownError(message), "object");
  assert.deepEqual(message, {
    message: `${escape}[32mobject${escape}[0m`,
    detail: "unchanged",
  });
  assert.equal(formatUnknownError(coloured), "red");
  assert.equal(formatUnknownError(17), "17");
  assert.equal(formatUnknownError(null), "null");
  assert.equal(formatUnknownError({ toString: () => "opaque" }), "opaque");
  assert.equal(formatUnknownError(osc), osc);
}
