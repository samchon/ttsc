package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusPreferFind verifies the lint rule corpus fixture
// typescript-prefer-find.ts under a real Program.
//
// `typescript/prefer-find` is type-aware: the engine's checker-less AST
// harness used by `assertRuleCorpusCase` skips it because
// Context.Checker is nil. This Go scenario therefore reuses the
// `seedLintProject` shape established by `prefer-includes` and
// `no-for-in-array`: materialize a tsconfig project, run `ttsc lint
// check`, and assert on the rendered diagnostics.
//
// Fixture-shape parity with
// tests/test-lint/src/cases/typescript-prefer-find.ts is enforced by
// the TypeScript feature corpus; this Go scenario locks the
// minimum-viable trigger (`arr.filter(p)[0]` on a `string[]`) so a
// future shim regression surfaces here without depending on the full
// fixture.
//
//  1. Seed a project that indexes `[0]` into `arr.filter(p)` on a
//     `string[]`.
//  2. Run `check` with typescript/prefer-find enabled as error.
//  3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusPreferFind(t *testing.T) {
  root := seedLintProject(t, `declare const arr: string[];
const first = arr.filter((s) => s.length > 0)[0];
JSON.stringify(first);
`)
  seedLintRules(t, root, map[string]string{"typescript/prefer-find": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/prefer-find]") {
    t.Fatalf("prefer-find diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
