package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusPreferConst verifies the prefer-const corpus through a real Program.
//
// Binding identity comes from TypeScript's checker, so the parser-only corpus
// helper cannot exercise this rule. The command path supplies the checker and
// preserves the existing positive and reassignment controls.
//
//  1. Seed initialized, updated, loop, and destructuring-assignment bindings.
//  2. Run check with only prefer-const enabled.
//  3. Assert only the stable declaration and fresh for-of binding are reported.
func TestRuleCorpusPreferConst(t *testing.T) {
  root := seedLintProject(t, `let stable = 1;
let changing = 1;
changing = 2;

for (let i = 0; i < 2; i++) {
  JSON.stringify(i);
}

for (let item of [1, 2]) {
  JSON.stringify(item);
}

let swapLeft = 1;
let swapRight = 2;
[swapLeft, swapRight] = [swapRight, swapLeft];

let picked = 0;
({ picked } = { picked: 9 });

JSON.stringify([stable, changing, swapLeft, swapRight, picked]);
`)
  seedLintRules(t, root, map[string]string{"prefer-const": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || strings.Count(stderr, "[prefer-const]") != 2 {
    t.Fatalf("prefer-const diagnostics mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
