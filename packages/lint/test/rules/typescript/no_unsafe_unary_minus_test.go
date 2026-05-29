package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusNoUnsafeUnaryMinus verifies the lint rule corpus fixture
// typescript-no-unsafe-unary-minus.ts under a real Program.
//
// `typescript/no-unsafe-unary-minus` is type-aware: the engine's
// checker-less AST harness used by `assertRuleCorpusCase` skips it
// because Context.Checker is nil. This Go scenario reuses the
// `seedLintProject` shape established by `restrict-plus-operands`:
// materialize a tsconfig project, run `ttsc lint check`, and assert on
// the rendered diagnostics.
//
// Fixture-shape parity with
// tests/test-lint/src/cases/typescript-no-unsafe-unary-minus.ts is
// enforced by the TypeScript feature corpus; this Go scenario locks the
// minimum-viable trigger (`-text` where `text: string`) so a future
// shim regression surfaces here without depending on the full fixture.
//
// 1. Seed a project that applies unary `-` to a `string`-typed operand.
// 2. Run `check` with typescript/no-unsafe-unary-minus enabled as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusNoUnsafeUnaryMinus(t *testing.T) {
  root := seedLintProject(t, `declare const text: string;
const a = -text;
JSON.stringify(a);
`)
  seedLintRules(t, root, map[string]string{"typescript/no-unsafe-unary-minus": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-unsafe-unary-minus]") {
    t.Fatalf("no-unsafe-unary-minus diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
