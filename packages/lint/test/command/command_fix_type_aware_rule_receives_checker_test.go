package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandFixTypeAwareRuleReceivesChecker verifies fix mode still supplies
// Context.Checker to type-aware rules.
//
// The checker optimization is driven before Program creation. fix uses a
// separate reload path from check/build, so awaitThenable must keep that path
// on the single-checker setup or its fixer silently abstains.
//
// 1. Materialize a project with `await` on a number.
// 2. Run `ttsc lint fix` with awaitThenable enabled.
// 3. Assert the command succeeds and removes the redundant await.
func TestCommandFixTypeAwareRuleReceivesChecker(t *testing.T) {
  root := seedLintProject(t, `async function main() {
  const value = 1;
  await value;
}
void main();
`)
  seedLintRules(t, root, map[string]string{"await-thenable": "error"})

  code, _, stderr := captureCommandOutput(t, func() int {
    return RunFix([]string{
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 0 {
    t.Fatalf("RunFix exited %d; stderr:\n%s", code, stderr)
  }

  data, err := os.ReadFile(filepath.Join(root, "src", "main.ts"))
  if err != nil {
    t.Fatal(err)
  }
  got := string(data)
  if strings.Contains(got, "await value") {
    t.Fatalf("awaitThenable did not apply its checker-backed fix:\n%s", got)
  }
  if !strings.Contains(got, "value;") {
    t.Fatalf("fixed source did not keep the operand statement:\n%s", got)
  }
}
