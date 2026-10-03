package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusNoUnnecessaryTypeAssertion verifies the lint rule corpus
// fixture typescript-no-unnecessary-type-assertion.ts under a real Program.
//
// `typescript/no-unnecessary-type-assertion` is type-aware: it consults the Checker
// via `GetTypeAtLocation`, `GetTypeFromTypeNode`, and `IsTypeAssignableTo`, so a
// parser-only engine run skips it because Context.Checker is nil. This Go scenario
// therefore reuses the seedLintProject shape established by
// `non-nullable-type-assertion-style`: materialize a tsconfig project, run `ttsc
// lint check`, and assert on the rendered diagnostics.
//
//  1. Seed a project that asserts a `string` value back to `string`.
//  2. Run `check` with typescript/no-unnecessary-type-assertion enabled
//     as error.
//  3. Assert the command exits non-zero and stderr mentions the rule.
//
// @evidence contracts/testing.md#behavioral-verification A type assertion that leaves the checker-resolved type unchanged must report.
// @evidence contracts/testing.md#independent-expectations The authored original source requires exactly one typescript/no-unnecessary-type-assertion rendered error at line 2, exit code 2 and empty stdout; an independently authored clean source requires code 0 and no rule findings.
// @evidence contracts/testing.md#distinguishing-cases An unknown-to-string narrowing assertion changes the type and stays clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoUnnecessaryTypeAssertion runs the real Program/Checker via the in-process check command and shared typed semantic oracles; fixture project files configure the operation without installing, building a native artifact or spawning a compiler.
func TestRuleCorpusNoUnnecessaryTypeAssertion(t *testing.T) {
  root := seedLintProject(t, `declare const definitelyString: string;
const value = definitelyString as string;
JSON.stringify(value);
`)
  seedLintRules(t, root, map[string]string{
    "typescript/no-unnecessary-type-assertion": "error",
  })

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-unnecessary-type-assertion]") {
    t.Fatalf("no-unnecessary-type-assertion diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/no-unnecessary-type-assertion", stderr, 2)
  assertTypedRuleCleanSource(t, "typescript/no-unnecessary-type-assertion", "declare const input: unknown;\nconst value = input as string;\nJSON.stringify(value);\n")
}
