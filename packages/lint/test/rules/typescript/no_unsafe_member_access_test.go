package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusNoUnsafeMemberAccess verifies the lint rule corpus
// fixture typescript-no-unsafe-member-access.ts under a real Program.
//
// `typescript/no-unsafe-member-access` is type-aware: it asks the Checker
// for the receiver's static type at each `PropertyAccessExpression` and
// `ElementAccessExpression` and flags access against an `any` value. The
// engine's checker-less AST harness used by `assertRuleCorpusCase` skips
// the rule because Context.Checker is nil, so this Go scenario reuses
// the `seedLintProject` shape established by `no-floating-promises` and
// `no-for-in-array`: materialize a tsconfig project, run `ttsc lint
// check`, and assert on the rendered diagnostics.
//
// Fixture-shape parity with
// tests/test-lint/src/cases/typescript-no-unsafe-member-access.ts is
// enforced by the TypeScript feature corpus; this Go scenario locks the
// minimum-viable trigger (`anyValue.foo`) so a future shim regression
// surfaces here without depending on the full fixture.
//
// 1. Seed a project that reads a property off an `any` receiver.
// 2. Run `check` with typescript/no-unsafe-member-access enabled.
// 3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusNoUnsafeMemberAccess(t *testing.T) {
  root := seedLintProject(t, `declare const anyValue: any;
const prop = anyValue.foo;
JSON.stringify({ prop });
`)
  seedLintRules(t, root, map[string]string{"typescript/no-unsafe-member-access": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-unsafe-member-access]") {
    t.Fatalf("no-unsafe-member-access diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
