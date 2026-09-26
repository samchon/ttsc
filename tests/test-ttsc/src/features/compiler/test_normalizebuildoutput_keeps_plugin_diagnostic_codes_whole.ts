import { normalizeBuildOutput } from "../../../../../packages/ttsc/lib/compiler/internal/build/normalizeBuildOutput.js";
import { assert } from "../../internal/toolchain";

/**
 * Verifies structured diagnostics keep a plugin-defined code whole.
 *
 * The public diagnostic code is a number for TypeScript's `TSnnnn` and a
 * stable string for a native plugin's own identifier. The line parser consumed
 * an optional run of letters before every code, so `FOO123` became TypeScript's
 * `123`, `MY_RULE` became `Y_RULE`, and a plugin error could be deduplicated
 * against an unrelated TypeScript diagnostic.
 *
 * 1. Normalize global, colon-located, and paren-located diagnostic lines.
 * 2. Use TypeScript codes, bare digits, and plugin codes with letters, digits,
 *    underscores, hyphens, and a `TS` prefix not followed only by digits.
 * 3. Assert TypeScript codes become numbers and every other code stays whole.
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
