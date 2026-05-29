package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusPreferRegexpExec verifies the lint rule corpus fixture
// typescript-prefer-regexp-exec.ts under a real Program.
//
// `typescript/prefer-regexp-exec` is type-aware: the engine's
// checker-less AST harness used by `assertRuleCorpusCase` skips it
// because Context.Checker is nil. This Go scenario therefore reuses the
// `seedLintProject` shape established by `prefer-includes` and
// `no-for-in-array`: materialize a tsconfig project, run `ttsc lint
// check`, and assert on the rendered diagnostics.
//
// Fixture-shape parity with
// tests/test-lint/src/cases/typescript-prefer-regexp-exec.ts is
// enforced by the TypeScript feature corpus; this Go scenario locks the
// minimum-viable trigger (`str.match(/foo/)`) so a future shim
// regression surfaces here without depending on the full fixture.
//
// 1. Seed a project that calls `str.match(/foo/)` on a `string`.
// 2. Run `check` with typescript/prefer-regexp-exec enabled as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusPreferRegexpExec(t *testing.T) {
  root := seedLintProject(t, `declare const text: string;
const m = text.match(/foo/);
JSON.stringify(m);
`)
  seedLintRules(t, root, map[string]string{"typescript/prefer-regexp-exec": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/prefer-regexp-exec]") {
    t.Fatalf("prefer-regexp-exec diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
