package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusNoUnsafeAssignment verifies the lint rule corpus fixture
// typescript-no-unsafe-assignment.ts under a real Program.
//
// `typescript/no-unsafe-assignment` is type-aware: it asks the Checker
// for the RHS type of each `VariableDeclaration` initializer and `=`
// BinaryExpression and flags `any` flowing into a concretely typed
// target. The engine's checker-less AST harness used by
// `assertRuleCorpusCase` skips the rule because Context.Checker is nil,
// so this Go scenario reuses the `seedLintProject` shape established by
// `no-floating-promises` and `no-for-in-array`: materialize a tsconfig
// project, run `ttsc lint check`, and assert on the rendered
// diagnostics.
//
// Fixture-shape parity with
// tests/test-lint/src/cases/typescript-no-unsafe-assignment.ts is
// enforced by the TypeScript feature corpus; this Go scenario locks the
// minimum-viable trigger (`const num: number = anyValue;`) so a future
// shim regression surfaces here without depending on the full fixture.
//
// 1. Seed a project that initializes a typed `const` from an `any` value.
// 2. Run `check` with typescript/no-unsafe-assignment enabled as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusNoUnsafeAssignment(t *testing.T) {
  root := seedLintProject(t, `declare const anyValue: any;
const num: number = anyValue;
JSON.stringify({ num });
`)
  seedLintRules(t, root, map[string]string{"typescript/no-unsafe-assignment": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-unsafe-assignment]") {
    t.Fatalf("no-unsafe-assignment diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
