package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusNoUnnecessaryTypeArguments verifies the lint rule
// corpus fixture typescript-no-unnecessary-type-arguments.ts under a
// real Program.
//
// `typescript/no-unnecessary-type-arguments` is type-aware: it resolves
// the generic's symbol via the Checker, walks the declaration's
// type-parameter list, and compares each explicit argument's type
// against the parameter's declared default. The engine's checker-less
// AST harness used by `assertRuleCorpusCase` skips it because
// Context.Checker is nil, so this Go scenario seeds a real tsconfig
// project, runs `ttsc lint check`, and asserts on the rendered
// diagnostics.
//
//  1. Seed a project where a `function withDefault<T = string>()` is
//     called as `withDefault<string>("hello")` — the explicit argument
//     repeats the declared default.
//  2. Run `check` with typescript/no-unnecessary-type-arguments enabled
//     as error.
//  3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusNoUnnecessaryTypeArguments(t *testing.T) {
  root := seedLintProject(t, `declare function withDefault<T = string>(value: T): T;
const out = withDefault<string>("hello");
JSON.stringify(out);
`)
  seedLintRules(t, root, map[string]string{"typescript/no-unnecessary-type-arguments": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-unnecessary-type-arguments]") {
    t.Fatalf("no-unnecessary-type-arguments diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
