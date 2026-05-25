package linthost

import (
  "fmt"
  "path/filepath"
  "strings"
  "testing"
)

// TestLoadRuleConfigRejectsOverlyDeepExtendsChain verifies that a linear,
// non-cyclic `extends` chain longer than extendsDepthLimit fails fast.
//
// The visited-path check rejects every cycle, but a future change that resolves
// the same file under two cleaned paths could let recursion escape it. The hard
// depth cap is the backstop: even a strictly non-cyclic chain is bounded, so a
// pathologically long chain cannot spawn an unbounded run of loader
// subprocesses.
//
//  1. Write `cfg0.config.json` ... `cfgN.config.json` where each file `extends`
//     the next and the chain length exceeds extendsDepthLimit.
//  2. Call LoadRuleConfig with `configFile: "./cfg0.config.json"`.
//  3. Assert a non-nil error that mentions the depth limit.
func TestLoadRuleConfigRejectsOverlyDeepExtendsChain(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")

  const chainLength = extendsDepthLimit + 8
  for i := 0; i < chainLength; i++ {
    name := fmt.Sprintf("cfg%d.config.json", i)
    if i == chainLength-1 {
      writeFile(t, filepath.Join(dir, name), `{ "rules": { "no-var": "error" } }`)
      continue
    }
    writeFile(t, filepath.Join(dir, name), fmt.Sprintf(
      `{ "extends": "./cfg%d.config.json", "rules": { "no-var": "error" } }`, i+1))
  }

  _, err := LoadRuleConfig(&PluginEntry{
    Config: map[string]any{
      "configFile": "./cfg0.config.json",
    },
  }, dir, "tsconfig.json")
  if err == nil {
    t.Fatal("expected an over-deep extends chain to fail")
  }
  if !strings.Contains(err.Error(), "depth limit") {
    t.Fatalf("error should mention the depth limit, got %v", err)
  }
}
