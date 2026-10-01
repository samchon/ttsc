package linthost

import (
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestLoadRuleConfigResolvesLinearExtendsChain verifies that a valid, acyclic
// `extends` chain still merges rules in the documented order.
//
// The cycle/depth guard must not regress legitimate inheritance: the
// extends-target's entries are appended first so the extending file's own
// rules win on collision. This pins that a base file's rules are inherited and
// that a local override outranks the inherited severity.
//
//  1. Write a base `b.config.json` (`noVar: warning`, `eqeqeq: error`).
//  2. Write `a.config.json` that `extends` it and re-declares `noVar: error`.
//  3. Call LoadRuleConfig and assert `eqeqeq` is inherited and the local
//     `noVar: error` override wins over the base `warning`.
//  4. Discover the original base-only config and run its exact var/export source through Engine.
//  5. Require one inherited no-var/error finding and none for the adjacent const source.
//
// @evidence contracts/testing.md#behavioral-verification LoadRuleConfig inherits eqeqeq/error from b.config.json while local no-var/error overrides the base no-var/warning; the original discovered base-only fixture produces exactly one no-var/error finding for var/export and no finding for its const control.
// @evidence contracts/testing.md#independent-expectations Extends entries fold base-first and child declarations win severity collisions; independently authored base and child maps supply exact expected inherited and overridden values.
// @evidence contracts/testing.md#distinguishing-cases Owns successful two-file inheritance with one collision and one base-only rule, plus discovered inheritance reaching actual Engine findings and a nonacting const control; cycle and depth failures have dedicated cases.
// @evidence contracts/testing.md#execution-ownership TestLoadRuleConfigResolvesLinearExtendsChain is a selected Go unit entry calling LoadRuleConfig, LoadConfigResolver and NewEngineWithResolver directly with exact authored JSON and parsed sources, without installing consumers, native compilation or a product child. The native CLI severity-to-exit transport is covered by the shared command boundary rather than this direct engine case.
func TestLoadRuleConfigResolvesLinearExtendsChain(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(dir, "b.config.json"), `{
    "rules": { "no-var": "warning", "eqeqeq": "error" }
  }`)
  writeFile(t, filepath.Join(dir, "a.config.json"), `{
    "extends": "./b.config.json",
    "rules": { "no-var": "error" }
  }`)

  cfg, err := LoadRuleConfig(&PluginEntry{
    Config: map[string]any{
      "configFile": "./a.config.json",
    },
  }, dir, "tsconfig.json")
  if err != nil {
    t.Fatalf("LoadRuleConfig: %v", err)
  }
  if cfg.Severity("eqeqeq") != SeverityError {
    t.Errorf("eqeqeq: want error inherited from base, got %v", cfg.Severity("eqeqeq"))
  }
  if cfg.Severity("no-var") != SeverityError {
    t.Errorf("noVar: want error from local override, got %v", cfg.Severity("no-var"))
  }

  discovered := t.TempDir()
  writeFile(t, filepath.Join(discovered, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(discovered, "lint.config.json"), `{"extends":"./base.config.json"}`)
  writeFile(t, filepath.Join(discovered, "base.config.json"), `{"rules":{"no-var":"error"}}`)
  resolver, err := LoadConfigResolver(&PluginEntry{}, discovered, "tsconfig.json")
  if err != nil {
    t.Fatalf("discovered extends: %v", err)
  }
  engine := NewEngineWithResolver(resolver)
  if err := engine.ConfigError(); err != nil {
    t.Fatalf("inherited engine binding: %v", err)
  }
  fileName := filepath.Join(discovered, "src", "main.ts")
  source := "var value = 1;\nexport const ok = value;\n"
  file := parseTSFile(t, fileName, source)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 || findings[0].Rule != "no-var" || findings[0].Severity != SeverityError || findings[0].File != file {
    t.Fatalf("exact inherited source must report one no-var error: %+v", findings)
  }
  valid := parseTSFile(t, fileName, "const value = 1;\nexport const ok = value;\n")
  if findings := engine.Run([]*shimast.SourceFile{valid}, nil); len(findings) != 0 {
    t.Fatalf("adjacent const source must remain accepted: %+v", findings)
  }
}
