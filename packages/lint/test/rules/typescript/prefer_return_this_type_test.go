package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusPreferReturnThisType verifies the lint rule corpus
// fixture typescript-prefer-return-this-type.ts under a real Program.
//
// `typescript/prefer-return-this-type` is type-aware: it inspects the
// declared return type of methods that always `return this`, so the
// engine's checker-less AST harness used by `assertRuleCorpusCase`
// skips it. This Go scenario therefore reuses the `seedLintProject`
// shape established by `prefer-includes` and `no-for-in-array`:
// materialize a tsconfig project, run `ttsc lint check`, and assert on
// the rendered diagnostics.
//
// Fixture-shape parity with
// tests/test-lint/src/cases/typescript-prefer-return-this-type.ts is
// enforced by the TypeScript feature corpus; this Go scenario locks the
// minimum-viable trigger (a class method declared to return the class
// name whose body is exactly `return this;`) so a future shim
// regression surfaces here without depending on the full fixture.
//
//  1. Seed a project with a class method that returns `this` but is
//     annotated to return the class name.
//  2. Run `check` with typescript/prefer-return-this-type enabled as
//     error.
//  3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusPreferReturnThisType(t *testing.T) {
  root := seedLintProject(t, `class Chainable {
  setName(name: string): Chainable {
    JSON.stringify(name);
    return this;
  }
}
JSON.stringify(new Chainable());
`)
  seedLintRules(t, root, map[string]string{"typescript/prefer-return-this-type": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/prefer-return-this-type]") {
    t.Fatalf("prefer-return-this-type diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
