package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusNoDeprecated verifies a reduced trigger for the lint rule corpus
// typescript-no-deprecated.ts under a real Program, plus a clean function control.
//
// `typescript/no-deprecated` is type-aware: a parser-only engine run skips it
// because Context.Checker is nil. This Go scenario reuses the `seedLintProject`
// shape established by the other type-aware ts rules: materialize a tsconfig
// project, run `ttsc lint check`, and assert on the rendered diagnostics.
//
//  1. Seed a project that declares a deprecated function and then calls
//     it.
//  2. Run `check` with typescript/no-deprecated enabled as error.
//  3. Assert the command exits non-zero and stderr mentions the rule.
//
// @evidence contracts/testing.md#behavioral-verification A call to a JSDoc-deprecated function must report its reference.
// @evidence contracts/testing.md#independent-expectations The authored original source requires exactly one typescript/no-deprecated rendered error at line 3, exit code 2 and empty stdout; an independently authored clean source requires code 0 and no rule findings.
// @evidence contracts/testing.md#distinguishing-cases A nondeprecated function with the same return shape remains clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoDeprecated runs the real Program/Checker via the in-process check command and shared typed semantic oracles; fixture project files configure the operation without installing, building a native artifact or spawning a compiler.
func TestRuleCorpusNoDeprecated(t *testing.T) {
  root := seedLintProject(t, `/** @deprecated Use newFn instead. */
declare function oldFn(): number;
const a = oldFn();
JSON.stringify(a);
`)
  seedLintRules(t, root, map[string]string{"typescript/no-deprecated": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-deprecated]") {
    t.Fatalf("no-deprecated diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/no-deprecated", stderr, 3)
  assertTypedRuleCleanSource(t, "typescript/no-deprecated", "declare function newFn(): number;\nconst a = newFn();\nJSON.stringify(a);\n")
}
