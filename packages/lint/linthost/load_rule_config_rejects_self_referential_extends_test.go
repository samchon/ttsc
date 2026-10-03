package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestLoadRuleConfigRejectsSelfReferentialExtends verifies that a config file
// whose `extends` points at itself fails fast.
//
// Seeding the lineage with the root config's cleaned absolute path lets the
// guard reject a self-reference on its first hop, before loading that root
// again. This case asserts the cycle and filename diagnostic; it does not
// count reads or distinguish first-hop detection from a later cycle error.
//
//  1. Write a single `a.config.json` whose `extends` names `a.config.json`.
//  2. Call LoadRuleConfig with `configFile: "./a.config.json"`.
//  3. Assert a non-nil error that says `extends cycle detected` and names the
//     file.
//
// @evidence contracts/testing.md#behavioral-verification LoadRuleConfig rejects a root config extending itself and names both the cycle and self-referential a.config.json.
// @evidence contracts/testing.md#independent-expectations A config lineage cannot revisit its root; independently authored self-reference and the literal cycle and filename fragments distinguish the required diagnostic.
// @evidence contracts/testing.md#distinguishing-cases Owns the first-hop self-cycle boundary; two-file cycles, valid linear chains, and non-cyclic excessive depth remain independent cases.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. A temporary JSON root extending itself reaches LoadRuleConfig directly in-process; cycle and filename errors observe owning recursion without a child host or native contributor.
func TestLoadRuleConfigRejectsSelfReferentialExtends(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(dir, "a.config.json"), `{
    "extends": "./a.config.json",
    "rules": { "no-var": "error" }
  }`)

  _, err := LoadRuleConfig(&PluginEntry{
    Config: map[string]any{
      "configFile": "./a.config.json",
    },
  }, dir, "tsconfig.json")
  if err == nil {
    t.Fatal("expected a self-referential extends to fail")
  }
  message := err.Error()
  if !strings.Contains(message, "extends cycle detected") {
    t.Fatalf("error should name the cycle, got %v", err)
  }
  if !strings.Contains(message, "a.config.json") {
    t.Fatalf("error should name the self-referential file, got %v", err)
  }
}
