package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusNoUnsafeArgument verifies the lint rule corpus fixture
// typescript-no-unsafe-argument.ts under a real Program.
//
// `typescript/no-unsafe-argument` is type-aware: it asks the Checker for
// each argument's static type, walks the resolved callee signature, and
// flags an `any`-typed value flowing into a concretely typed parameter.
// The engine's checker-less AST harness used by `assertRuleCorpusCase`
// skips the rule because Context.Checker is nil, so this Go scenario
// reuses the `seedLintProject` shape established by `no-floating-promises`
// and `no-for-in-array`: materialize a tsconfig project, run `ttsc lint
// check`, and assert on the rendered diagnostics.
//
// Fixture-shape parity with
// tests/test-lint/src/cases/typescript-no-unsafe-argument.ts is enforced
// by the TypeScript feature corpus; this Go scenario locks the
// minimum-viable trigger (`takesNumber(anyValue)`) so a future shim
// regression surfaces here without depending on the full fixture.
//
// 1. Seed a project that passes an `any` argument to a `number` parameter.
// 2. Run `check` with typescript/no-unsafe-argument enabled as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusNoUnsafeArgument(t *testing.T) {
  root := seedLintProject(t, `declare const anyValue: any;
declare function takesNumber(value: number): void;
takesNumber(anyValue);
`)
  seedLintRules(t, root, map[string]string{"typescript/no-unsafe-argument": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-unsafe-argument]") {
    t.Fatalf("no-unsafe-argument diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
