package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusPreferStringStartsEndsWith verifies a reduced trigger from the lint rule corpus
// fixture typescript-prefer-string-starts-ends-with.ts under a real
// Program.
//
// `typescript/prefer-string-starts-ends-with` is type-aware: a parser-only engine
// run skips it because Context.Checker is nil. This Go scenario therefore reuses
// the `seedLintProject` shape established by `prefer-includes` and
// `no-for-in-array`: materialize a tsconfig project, run `ttsc lint check`, and
// assert on the rendered diagnostics.
//
// The corpus fixture packages/lint/test/testdata/corpus/typescript-prefer-string-starts-ends-with.ts is run by TestLintFixtureCorpus; this Go scenario locks the minimum-viable
// trigger (`text.indexOf(needle) === 0`) so a future shim regression surfaces here
// without depending on the full fixture.
//
//  1. Seed a project that compares `text.indexOf(needle) === 0` against
//     a `string` receiver.
//  2. Run `check` with typescript/prefer-string-starts-ends-with
//     enabled as error.
//  3. Assert the command exits non-zero and stderr mentions the rule.
//
// @evidence contracts/testing.md#behavioral-verification String indexOf compared to zero must report.
// @evidence contracts/testing.md#independent-expectations The original authored input fixes exactly one typescript/prefer-string-starts-ends-with rendered error at line 3, code 2 and empty stdout; its independently authored typed counterpart requires code 0 and no rule errors.
// @evidence contracts/testing.md#distinguishing-cases Direct startsWith keeps the prefix query.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPreferStringStartsEndsWith invokes the in-process check command and shared typed semantic oracles over real Program/Checker instances; fixture configuration feeds that operation without a native build, child compiler or installed consumer.
func TestRuleCorpusPreferStringStartsEndsWith(t *testing.T) {
  root := seedLintProject(t, `declare const text: string;
declare const needle: string;
const startsWith = text.indexOf(needle) === 0;
JSON.stringify(startsWith);
`)
  seedLintRules(t, root, map[string]string{"typescript/prefer-string-starts-ends-with": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/prefer-string-starts-ends-with]") {
    t.Fatalf("prefer-string-starts-ends-with diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/prefer-string-starts-ends-with", stderr, 3)
  assertTypedRuleCleanSource(t, "typescript/prefer-string-starts-ends-with", "declare const text: string;\ndeclare const needle: string;\nconst startsWith = text.startsWith(needle);\n")
}
