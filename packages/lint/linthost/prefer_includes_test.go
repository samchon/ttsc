package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusPreferIncludes verifies a reduced trigger from the lint rule corpus
// typescript-prefer-includes.ts under a real Program.
//
// `typescript/prefer-includes` is type-aware: a parser-only engine run skips it
// because Context.Checker is nil. This Go scenario therefore reuses the
// `seedLintProject` shape established by `require-array-sort-compare` and
// `no-for-in-array`: materialize a tsconfig project, run `ttsc lint check`, and
// assert on the rendered diagnostics.
//
// The corpus fixture packages/lint/test/testdata/corpus/typescript-prefer-includes.ts is run by TestLintFixtureCorpus; this Go scenario locks the minimum-viable trigger
// (`arr.indexOf(x) !== -1` on a `string[]`) so a future shim regression surfaces
// here without depending on the full fixture.
//
//  1. Seed a project that calls `.indexOf` on a `string[]` and compares
//     against `-1`.
//  2. Run `check` with typescript/prefer-includes enabled as error.
//  3. Assert the command exits non-zero and stderr mentions the rule.
//
// @evidence contracts/testing.md#behavioral-verification Array indexOf sentinel comparison must report.
// @evidence contracts/testing.md#independent-expectations The original authored input fixes exactly one typescript/prefer-includes rendered error at line 2, code 2 and empty stdout; its independently authored typed counterpart requires code 0 and no rule errors.
// @evidence contracts/testing.md#distinguishing-cases Direct includes retains the membership query.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPreferIncludes invokes the in-process check command and shared typed semantic oracles over real Program/Checker instances; fixture configuration feeds that operation without a native build, child compiler or installed consumer.
func TestRuleCorpusPreferIncludes(t *testing.T) {
  root := seedLintProject(t, `declare const arr: string[];
const found = arr.indexOf("a") !== -1;
JSON.stringify(found);
`)
  seedLintRules(t, root, map[string]string{"typescript/prefer-includes": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/prefer-includes]") {
    t.Fatalf("prefer-includes diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/prefer-includes", stderr, 2)
  assertTypedRuleCleanSource(t, "typescript/prefer-includes", "declare const arr: string[];\nconst found = arr.includes(\"a\");\n")
}
