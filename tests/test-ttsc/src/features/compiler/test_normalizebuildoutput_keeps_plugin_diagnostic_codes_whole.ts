import { normalizeBuildOutput } from "../../../../../packages/ttsc/src/compiler/internal/build/normalizeBuildOutput";
import assert from "node:assert/strict";

/**
 * Verifies structured diagnostics keep a plugin-defined code whole.
 *
 * The public diagnostic code is a number for TypeScript's `TSnnnn` and a stable
 * string for a native plugin's own identifier. The line parser consumed an
 * optional run of letters before every code, so `FOO123` became TypeScript's
 * `123`, `MY_RULE` became `Y_RULE`, and a plugin error could be deduplicated
 * against an unrelated TypeScript diagnostic.
 *
 * 1. Normalize global, colon-located, and paren-located diagnostic lines.
 * 2. Use TypeScript codes, bare digits, and plugin codes with letters, digits,
 *    underscores, hyphens, and a `TS` prefix not followed only by digits.
 * 3. Assert TypeScript codes become numbers and every other code stays whole.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls normalizeBuildOutput on global, colon-located and parenthesized diagnostic text and checks exact code values, distinguishing numeric TypeScript codes from truncated or misclassified plugin identifiers.
 * @evidence contracts/testing.md#independent-expectations The public diagnostic contract represents TS digits and bare digits numerically while retaining plugin identifiers as strings. The literal token/expected table independently requires FOO123, MY_RULE, TS-RULE and TS12X to remain whole.
 * @evidence contracts/testing.md#distinguishing-cases This entry owns nine token identities across all three line formats, including lowercase ts2322, bare 2322 and near-TypeScript TS12X. Each token labels its assertion failure; location metadata and diagnostic deduplication are outside this code-preservation case.
 * @evidence contracts/testing.md#execution-ownership This exported source-unit entry owns all 27 line-format/token inputs and invokes the authored normalizer directly with captured-output records. It neither launches the producer nor builds a native plugin.
 */
export const test_normalizebuildoutput_keeps_plugin_diagnostic_codes_whole =
  () => {
    const cases: [string, number | string][] = [
      ["TS2322", 2322],
      ["ts2322", 2322],
      ["2322", 2322],
      ["FOO123", "FOO123"],
      ["EVIDENCE001", "EVIDENCE001"],
      ["MY_RULE", "MY_RULE"],
      ["ABC", "ABC"],
      ["TS-RULE", "TS-RULE"],
      ["TS12X", "TS12X"],
    ];
    for (const [token, expected] of cases) {
      const lines = [
        `error ${token}: global failure`,
        `/project/src/main.ts:2:4 - error ${token}: located failure`,
        `/project/src/main.ts(2,4): error ${token}: classic failure`,
      ];
      const result = normalizeBuildOutput(
        { status: 1, stdout: lines.join("\n"), stderr: "" },
        "/project",
      );
      assert.deepEqual(
        result.diagnostics.map((diagnostic) => diagnostic.code),
        [expected, expected, expected],
        token,
      );
    }
  };
