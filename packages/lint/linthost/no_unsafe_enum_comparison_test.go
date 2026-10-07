package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusNoUnsafeEnumComparison verifies a reduced trigger from the lint rule corpus
// fixture typescript-no-unsafe-enum-comparison.ts under a real Program.
//
// `typescript/no-unsafe-enum-comparison` is type-aware: a parser-only engine run
// skips it because Context.Checker is nil. This Go scenario reuses the
// `seedLintProject` shape established by `no-base-to-string` and
// `switch-exhaustiveness-check`: materialize a tsconfig project, run `ttsc lint
// check`, and assert on the rendered diagnostics.
//
// The corpus fixture packages/lint/test/testdata/corpus/typescript-no-unsafe-enum-comparison.ts is run by TestLintFixtureCorpus; this Go scenario locks the minimum-viable
// trigger (`color === "red"`) so a future shim regression surfaces here without
// depending on the full fixture.
//
//  1. Seed a project that compares a string enum value against a raw
//     string literal.
//  2. Run `check` with typescript/no-unsafe-enum-comparison enabled as
//     error.
//  3. Assert the command exits non-zero and stderr mentions the rule.
//
// @evidence contracts/testing.md#behavioral-verification Comparing an enum to a raw string must report.
// @evidence contracts/testing.md#independent-expectations The original authored input fixes exactly one typescript/no-unsafe-enum-comparison rendered error at line 3, code 2 and empty stdout; its independently authored typed counterpart requires code 0 and no rule errors.
// @evidence contracts/testing.md#distinguishing-cases A same-enum member is the clean comparison.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoUnsafeEnumComparison invokes the in-process check command and shared typed semantic oracles over real Program/Checker instances; fixture configuration feeds that operation without a native build, child compiler or installed consumer.
func TestRuleCorpusNoUnsafeEnumComparison(t *testing.T) {
  root := seedLintProject(t, `enum Color { Red = "red", Blue = "blue" }
declare const color: Color;
const matchesRed = color === "red";
JSON.stringify(matchesRed);
`)
  seedLintRules(t, root, map[string]string{"typescript/no-unsafe-enum-comparison": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-unsafe-enum-comparison]") {
    t.Fatalf("no-unsafe-enum-comparison diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/no-unsafe-enum-comparison", stderr, 3)
  assertTypedRuleCleanSource(t, "typescript/no-unsafe-enum-comparison", "enum Color { Red = \"red\", Blue = \"blue\" }\ndeclare const color: Color;\nconst matchesRed = color === Color.Red;\n")
}
