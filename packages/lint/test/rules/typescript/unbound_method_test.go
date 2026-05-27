package linthost

import (
	"strings"
	"testing"
)

// TestRuleCorpusUnboundMethod verifies the lint rule corpus fixture
// unbound-method.ts under a real Program.
//
// `typescript/unbound-method` is type-aware: the engine's checker-less
// AST harness used by `assertRuleCorpusCase` skips it because
// Context.Checker is nil. The rule reuses the `command_*` shape
// established by `no-floating-promises`'s corpus test: materialize a
// tsconfig project, run `ttsc lint check`, and assert on the rendered
// diagnostics.
//
// Fixture-shape parity with tests/test-lint/src/cases/unbound-method.ts
// is enforced by the TypeScript feature corpus; this Go scenario locks
// the minimum-viable trigger (a class method referenced as a value)
// so a future shim regression surfaces here without depending on the
// full fixture.
//
// 1. Seed a project that pulls a class instance method off as a value.
// 2. Run `check` with typescript/unbound-method enabled as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusUnboundMethod(t *testing.T) {
	root := seedLintProject(t, `class Greeter {
  public name = "world";
  public greet(): string {
    return this.name;
  }
}
const g = new Greeter();
const fn = g.greet;
JSON.stringify(fn);
`)
	seedLintRules(t, root, map[string]string{"typescript/unbound-method": "error"})

	code, stdout, stderr := captureCommandOutput(t, func() int {
		return run([]string{
			"check",
			"--cwd", root,
			"--plugins-json", lintManifest(t),
		})
	})
	if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/unbound-method]") {
		t.Fatalf("unbound-method diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}
