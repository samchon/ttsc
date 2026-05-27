package linthost

import (
	"strings"
	"testing"
)

// TestRuleCorpusSwitchExhaustivenessCheck verifies the lint rule corpus
// fixture typescript-switch-exhaustiveness-check.ts under a real Program.
//
// `typescript/switch-exhaustiveness-check` is type-aware: it queries
// `GetTypeAtLocation` on the switch discriminant and on every case
// expression to compute uncovered union members, so the engine's
// checker-less AST harness used by `assertRuleCorpusCase` skips it
// because Context.Checker is nil. This Go scenario therefore reuses the
// `seedLintProject` shape established by `no-for-in-array` and
// `restrict-plus-operands`: materialize a tsconfig project, run
// `ttsc lint check`, and assert on the rendered diagnostics.
//
// 1. Seed a project that switches on a `"a" | "b" | "c"` union with
//    only the `"a"` and `"b"` cases covered and no `default` clause.
// 2. Run `check` with typescript/switch-exhaustiveness-check enabled as
//    error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusSwitchExhaustivenessCheck(t *testing.T) {
	root := seedLintProject(t, `type Tag = "a" | "b" | "c";
declare const tag: Tag;
declare function sideEffect(value: string): void;
switch (tag) {
  case "a":
    sideEffect("a");
    break;
  case "b":
    sideEffect("b");
    break;
}
`)
	seedLintRules(t, root, map[string]string{"typescript/switch-exhaustiveness-check": "error"})

	code, stdout, stderr := captureCommandOutput(t, func() int {
		return run([]string{
			"check",
			"--cwd", root,
			"--plugins-json", lintManifest(t),
		})
	})
	if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/switch-exhaustiveness-check]") {
		t.Fatalf("switch-exhaustiveness-check diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}
