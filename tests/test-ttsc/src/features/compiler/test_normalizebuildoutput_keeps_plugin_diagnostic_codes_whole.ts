import assert from "node:assert/strict";
import path from "node:path";

import { CompilerDiagnostics } from "../../../../../packages/ttsc/src/compiler/internal/build/CompilerDiagnostics";
import { normalizeBuildOutput } from "../../../../../packages/ttsc/src/compiler/internal/build/normalizeBuildOutput";
import type { ITtscCompilerDiagnostic } from "../../../../../packages/ttsc/src/structures/ITtscCompilerDiagnostic";
import type { TtscBuildResult } from "../../../../../packages/ttsc/src/structures/internal/TtscBuildResult";

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
 * 4. Filter fallback reports by typed identity and pairwise position, retaining a
 *    different line/code/category and only the surviving rendered context.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual normalizer/parser and filterReportedTypeScriptDiagnostics to distinguish numeric TypeScript codes from plugin strings and suppress only previously reported fallback findings, preserving unrelated structured reports and rendered context.
 * @evidence contracts/testing.md#independent-expectations Literal token/code expectations preserve plugin identities. Independently authored TS2322 identity/positions require matching offsets only when both are present, otherwise line/column; changed line, typed code and category remain distinct. Literal partial stdout/stderr expectations retain the surviving context and exclude duplicate lines and summary.
 * @evidence contracts/testing.md#distinguishing-cases Owns 27 format/token inputs, colon/paren same-line deduplication, equal versus unequal offsets, one-sided offset fallback, line/code/category negatives, all-duplicate null and partial report/text retention. No-diagnostic successful and failed results exercise the separate status branch.
 * @evidence contracts/testing.md#execution-ownership This selectable source unit directly invokes actual operations with authored diagnostic/output records. It neither launches a producer nor certifies native fallback/recovery, combined stderr publication or a product host.
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
    const cwd = path.resolve("diagnostic-policy-root");
    const headline = "Type 'string' is not assignable to type 'number'.";
    const colon = `src/index.ts:5:7 - error TS2322: ${headline}`;
    const paren = `src/index.ts(5,7): error TS2322: ${headline}`;
    const diagnostic: ITtscCompilerDiagnostic = {
      category: "error",
      code: 2322,
      file: path.join(cwd, "src", "index.ts"),
      line: 5,
      character: 7,
      messageText: headline,
    };
    assert.deepEqual(
      CompilerDiagnostics.parseDiagnosticLine(colon, cwd),
      diagnostic,
    );
    assert.deepEqual(
      CompilerDiagnostics.parseDiagnosticLine(paren, cwd),
      diagnostic,
    );
    const build = (
      diagnostics: ITtscCompilerDiagnostic[],
      stdout = "",
      stderr = "",
    ): TtscBuildResult => ({
      diagnostics,
      stdout,
      stderr,
      status: 1,
    });
    for (const [name, reported, fallback, duplicate] of [
      ["same rendered position", diagnostic, diagnostic, true],
      ["reported offset only", { ...diagnostic, start: 42 }, diagnostic, true],
      ["fallback offset only", diagnostic, { ...diagnostic, start: 42 }, true],
      [
        "equal offsets override rendered line",
        { ...diagnostic, start: 42 },
        { ...diagnostic, start: 42, line: 6 },
        true,
      ],
      [
        "different offsets remain distinct",
        { ...diagnostic, start: 42 },
        { ...diagnostic, start: 43 },
        false,
      ],
      [
        "different line remains distinct",
        diagnostic,
        { ...diagnostic, line: 6 },
        false,
      ],
      [
        "string code remains distinct",
        diagnostic,
        { ...diagnostic, code: "2322" },
        false,
      ],
      [
        "category remains distinct",
        diagnostic,
        { ...diagnostic, category: "warning" },
        false,
      ],
    ] as const) {
      const typechecked = build([fallback]);
      assert.equal(
        CompilerDiagnostics.filterReportedTypeScriptDiagnostics(
          build([reported]),
          typechecked,
          cwd,
        ),
        duplicate ? null : typechecked,
        name,
      );
    }
    const otherLine: ITtscCompilerDiagnostic = { ...diagnostic, line: 6 };
    const retained = `src/index.ts(6,7): error TS2322: ${headline}`;
    const fallback = build(
      [diagnostic, otherLine],
      [
        "before reports",
        paren,
        "  duplicate detail",
        retained,
        "  retained detail",
        "Found 2 errors.",
      ].join("\n"),
      [colon, retained, "Found 2 errors."].join("\n"),
    );
    const partial = CompilerDiagnostics.filterReportedTypeScriptDiagnostics(
      build([diagnostic]),
      fallback,
      cwd,
    );
    assert.notEqual(partial, null);
    assert.deepEqual(partial!.diagnostics, [otherLine]);
    assert.equal(partial!.diagnostics[0], otherLine);
    assert.equal(
      partial!.stdout,
      `before reports\n${retained}\n  retained detail`,
    );
    assert.equal(partial!.stderr, retained);
    assert.equal(partial!.status, 1);
    assert.deepEqual(fallback.diagnostics, [diagnostic, otherLine]);
    const noDiagnosticFailure = build([]);
    assert.equal(
      CompilerDiagnostics.filterReportedTypeScriptDiagnostics(
        build([diagnostic]),
        noDiagnosticFailure,
        cwd,
      ),
      noDiagnosticFailure,
    );
    assert.equal(
      CompilerDiagnostics.filterReportedTypeScriptDiagnostics(
        build([diagnostic]),
        { ...noDiagnosticFailure, status: 0 },
        cwd,
      ),
      null,
    );
  };
