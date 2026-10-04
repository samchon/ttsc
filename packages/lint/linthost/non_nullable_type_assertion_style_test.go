package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusNonNullableTypeAssertionStyle verifies a reduced trigger from the lint rule corpus
// fixture non-nullable-type-assertion-style.ts under a real Program.
//
// `typescript/non-nullable-type-assertion-style` is type-aware: it consults the
// Checker via `GetTypeAtLocation`, `GetNonNullableType`, and `GetTypeFromTypeNode`,
// so a parser-only engine run skips it because Context.Checker is nil. This Go
// scenario therefore reuses the seedLintProject shape established by
// `no-floating-promises` and `await-thenable`: materialize a tsconfig project, run
// `ttsc lint check`, and assert on the rendered diagnostics.
//
//  1. Seed a project whose source assertion strips `undefined` and is
//     therefore equivalent to a `!` non-null assertion.
//  2. Run `check` with typescript/non-nullable-type-assertion-style enabled
//     as error.
//  3. Assert the command exits non-zero and stderr mentions the rule.
//
// @evidence contracts/testing.md#behavioral-verification Removing only undefined by type assertion must report.
// @evidence contracts/testing.md#independent-expectations The original authored input fixes exactly one typescript/non-nullable-type-assertion-style rendered error at line 2, code 2 and empty stdout; its independently authored typed counterpart requires code 0 and no rule errors.
// @evidence contracts/testing.md#distinguishing-cases Unknown-to-string narrowing changes more than nullability.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNonNullableTypeAssertionStyle invokes the in-process check command and shared typed semantic oracles over real Program/Checker instances; fixture configuration feeds that operation without a native build, child compiler or installed consumer.
func TestRuleCorpusNonNullableTypeAssertionStyle(t *testing.T) {
  root := seedLintProject(t, `declare const maybeUndefined: string | undefined;
const value = maybeUndefined as string;
JSON.stringify(value);
`)
  seedLintRules(t, root, map[string]string{
    "typescript/non-nullable-type-assertion-style": "error",
  })

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/non-nullable-type-assertion-style]") {
    t.Fatalf("non-nullable-type-assertion-style diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/non-nullable-type-assertion-style", stderr, 2)
  assertTypedRuleCleanSource(t, "typescript/non-nullable-type-assertion-style", "declare const input: unknown;\nconst value = input as string;\n")
}
