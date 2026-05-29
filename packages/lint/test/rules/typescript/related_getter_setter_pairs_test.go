package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusRelatedGetterSetterPairs verifies the lint rule corpus
// fixture typescript-related-getter-setter-pairs.ts under a real Program.
//
// `typescript/related-getter-setter-pairs` is type-aware: it consults
// `GetTypeFromTypeNode` on both the getter's return-type annotation
// and the setter's parameter-type annotation, so the engine's checker-
// less AST harness used by `assertRuleCorpusCase` skips it because
// Context.Checker is nil. This Go scenario reuses the
// `seedLintProject` shape established by `no-base-to-string` and
// `restrict-plus-operands`: materialize a tsconfig project, run
// `ttsc lint check`, and assert on the rendered diagnostics.
//
//  1. Seed a project where a class declares `get value(): string` and
//     `set value(next: number)` — the reader sees `string`, the writer
//     accepts only `number`.
//  2. Run `check` with typescript/related-getter-setter-pairs enabled as
//     error.
//  3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusRelatedGetterSetterPairs(t *testing.T) {
  root := seedLintProject(t, `class Mismatch {
  private _value = "abc";
  get value(): string {
    return this._value;
  }
  set value(next: number) {
    this._value = String(next);
  }
}
JSON.stringify({ Mismatch });
`)
  seedLintRules(t, root, map[string]string{"typescript/related-getter-setter-pairs": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/related-getter-setter-pairs]") {
    t.Fatalf("related-getter-setter-pairs diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
