package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusNoUnsafeEnumComparison verifies the lint rule corpus
// fixture typescript-no-unsafe-enum-comparison.ts under a real Program.
//
// `typescript/no-unsafe-enum-comparison` is type-aware: the engine's
// checker-less AST harness used by `assertRuleCorpusCase` skips it
// because Context.Checker is nil. This Go scenario reuses the
// `seedLintProject` shape established by `no-base-to-string` and
// `switch-exhaustiveness-check`: materialize a tsconfig project, run
// `ttsc lint check`, and assert on the rendered diagnostics.
//
// Fixture-shape parity with
// tests/test-lint/src/cases/typescript-no-unsafe-enum-comparison.ts is
// enforced by the TypeScript feature corpus; this Go scenario locks the
// minimum-viable trigger (`Color === "red"`) so a future shim
// regression surfaces here without depending on the full fixture.
//
//  1. Seed a project that compares a string enum value against a raw
//     string literal.
//  2. Run `check` with typescript/no-unsafe-enum-comparison enabled as
//     error.
//  3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusNoUnsafeEnumComparison(t *testing.T) {
  root := seedLintProject(t, `enum Color { Red = "red", Blue = "blue" }
declare const color: Color;
const matchesRed = color === "red";
JSON.stringify(matchesRed);
`)
  seedLintRules(t, root, map[string]string{"typescript/no-unsafe-enum-comparison": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-unsafe-enum-comparison]") {
    t.Fatalf("no-unsafe-enum-comparison diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
