package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusNoBaseToString verifies the lint rule corpus fixture
// typescript-no-base-to-string.ts under a real Program.
//
// `typescript/no-base-to-string` is type-aware: a parser-only engine run skips it
// because Context.Checker is nil. This Go scenario reuses the `seedLintProject`
// shape established by `no-floating-promises` and `no-for-in-array`: materialize a
// tsconfig project, run `ttsc lint check`, and assert on the rendered diagnostics.
//
// Fixture-shape parity with
// packages/lint/test/testdata/corpus/typescript-no-base-to-string.ts is enforced by
// TestLintFixtureCorpus; this Go scenario locks the minimum-viable trigger
// (`String(obj)` on a plain object literal) so a future shim regression surfaces
// here without depending on the full fixture.
//
//  1. Seed a project that calls `String(obj)` on a plain `{ id: number }`
//     object.
//  2. Run `check` with typescript/no-base-to-string enabled as error.
//  3. Assert the command exits non-zero and stderr mentions the rule.
// @evidence contracts/testing.md#behavioral-verification Plain-object string coercion must report the checker-backed base representation.
// @evidence contracts/testing.md#independent-expectations The authored original source requires exactly one typescript/no-base-to-string rendered error at line 2, exit code 2 and empty stdout; an independently authored clean source requires code 0 and no rule findings.
// @evidence contracts/testing.md#distinguishing-cases The same String coercion applied to a string is clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoBaseToString runs the real Program/Checker via the in-process check command and shared typed semantic oracles; fixture project files configure the operation without installing, building a native artifact or spawning a compiler.
func TestRuleCorpusNoBaseToString(t *testing.T) {
  root := seedLintProject(t, `declare const obj: { id: number };
const out = String(obj);
JSON.stringify(out);
`)
  seedLintRules(t, root, map[string]string{"typescript/no-base-to-string": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-base-to-string]") {
    t.Fatalf("no-base-to-string diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/no-base-to-string", stderr, 2)
  assertTypedRuleCleanSource(t, "typescript/no-base-to-string", "declare const value: string;\nconst out = String(value);\nJSON.stringify(out);\n")
}
