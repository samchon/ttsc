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
//
// @evidence contracts/testing.md#behavioral-verification LoadRuleConfig rejects a non-cyclic authored config lineage longer than its supported depth budget with a depth-limit diagnostic.
// @evidence contracts/testing.md#independent-expectations The bounded extends contract caps recursive loading independently of cycle presence; an explicitly constructed strictly forward chain supplies the over-limit premise.
// @evidence contracts/testing.md#distinguishing-cases Owns a depth-limit-plus-eight acyclic lineage; short linear inheritance and self/two-file cycles are distinct tests. The fixture uses the named limit to remain an over-limit case rather than certify a particular numeric policy.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. The temporary forward JSON lineage reaches LoadRuleConfig directly in the shared Go process; recursive loading and its depth error require no script evaluator or native host build.
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
