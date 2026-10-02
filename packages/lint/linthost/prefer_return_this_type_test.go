package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusPreferReturnThisType verifies the lint rule corpus
// fixture typescript-prefer-return-this-type.ts under a real Program.
//
// `typescript/prefer-return-this-type` is type-aware: it inspects the declared
// return type of methods that always `return this`, so a parser-only engine run
// skips it. This Go scenario therefore reuses the `seedLintProject` shape
// established by `prefer-includes` and `no-for-in-array`: materialize a tsconfig
// project, run `ttsc lint check`, and assert on the rendered diagnostics.
//
// The corpus fixture packages/lint/test/testdata/corpus/typescript-prefer-return-this-type.ts is run by TestLintFixtureCorpus; this Go scenario locks the minimum-viable
// trigger (a class method declared to return the class name whose body is exactly
// `return this;`) so a future shim regression surfaces here without depending on
// the full fixture.
//
//  1. Seed a project with a class method that returns `this` but is
//     annotated to return the class name.
//  2. Run `check` with typescript/prefer-return-this-type enabled as
//     error.
//  3. Assert the command exits non-zero and stderr mentions the rule.
//
// @evidence contracts/testing.md#behavioral-verification A this-returning method annotated with its concrete class must report.
// @evidence contracts/testing.md#independent-expectations The original authored input fixes exactly one typescript/prefer-return-this-type rendered error at line 2, code 2 and empty stdout; its independently authored typed counterpart requires code 0 and no rule errors.
// @evidence contracts/testing.md#distinguishing-cases Existing this return annotation preserves the fluent receiver.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPreferReturnThisType invokes the in-process check command and shared typed semantic oracles over real Program/Checker instances; fixture configuration feeds that operation without a native build, child compiler or installed consumer.
func TestRuleCorpusPreferReturnThisType(t *testing.T) {
  root := seedLintProject(t, `class Chainable {
  setName(name: string): Chainable {
    JSON.stringify(name);
    return this;
  }
}
JSON.stringify(new Chainable());
`)
  seedLintRules(t, root, map[string]string{"typescript/prefer-return-this-type": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/prefer-return-this-type]") {
    t.Fatalf("prefer-return-this-type diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/prefer-return-this-type", stderr, 2)
  assertTypedRuleCleanSource(t, "typescript/prefer-return-this-type", "class Chainable { setName(name: string): this { JSON.stringify(name); return this; } }\n")
}
