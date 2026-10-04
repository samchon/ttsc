package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusRestrictPlusOperands verifies an authored typed trigger for
// typescript/restrict-plus-operands under a real Program.
//
// `typescript/restrict-plus-operands` is type-aware: it queries `GetTypeAtLocation`
// on both operands of `+`, so a parser-only engine run skips it because
// Context.Checker is nil. This Go scenario therefore reuses the `seedLintProject`
// shape established by `no-floating-promises` and `no-for-in-array`: materialize a
// tsconfig project, run `ttsc lint check`, and assert on the rendered diagnostics.
//
// The corpus fixture packages/lint/test/testdata/corpus/typescript-restrict-plus-operands.ts is run by TestLintFixtureCorpus; this Go scenario locks the minimum-viable
// trigger (`1 + "a"`) so a future shim regression surfaces here without depending
// on the full fixture.
//
// 1. Seed a project that adds a number literal to a string literal.
// 2. Run `check` with typescript/restrict-plus-operands enabled as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
//
// @evidence contracts/testing.md#behavioral-verification Mixed number/string addition must report.
// @evidence contracts/testing.md#independent-expectations The original authored input fixes exactly one typescript/restrict-plus-operands rendered error at line 1, code 2 and empty stdout; its independently authored typed counterpart requires code 0 and no rule errors.
// @evidence contracts/testing.md#distinguishing-cases Number-plus-number is the valid counterpart.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusRestrictPlusOperands invokes the in-process check command and shared typed semantic oracles over real Program/Checker instances; fixture configuration feeds that operation without a native build, child compiler or installed consumer.
func TestRuleCorpusRestrictPlusOperands(t *testing.T) {
  root := seedLintProject(t, `const mixed = 1 + "a";
JSON.stringify(mixed);
`)
  seedLintRules(t, root, map[string]string{"typescript/restrict-plus-operands": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/restrict-plus-operands]") {
    t.Fatalf("restrict-plus-operands diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/restrict-plus-operands", stderr, 1)
  assertTypedRuleCleanSource(t, "typescript/restrict-plus-operands", "const sum = 1 + 2;\n")
}
