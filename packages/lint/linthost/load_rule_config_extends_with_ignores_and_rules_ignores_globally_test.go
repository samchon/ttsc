package linthost

import (
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestLoadRuleConfigExtendsWithIgnoresAndRulesIgnoresGlobally verifies that a
// config carrying `extends` + `ignores` + `rules` excludes the ignored files
// from the INHERITED rules too, not just from its own rules entry.
//
// A config file is a single ITtscLintConfig object, so its top-level `ignores`
// (with no `files` filter) is the only way to say "never lint these files".
// Before the fix, the `extends` target produced a separate ConfigEntry with no
// ignores of its own, so the base config's rules kept firing on the ignored
// paths — exactly the shape of a Next.js package whose lint.config.ts extends
// a shared config and ignores `.next/**` and `next-env.d.ts`, yet still saw
// `typescript/triple-slash-reference` errors reported for those files.
//
//  1. Write a base config with rules and a package config that extends it,
//     ignores "generated/**/*.ts" plus "env.d.ts", and adds its own rules.
//  2. Resolve rules for an ordinary source file and for both ignored shapes.
//  3. Assert the source file gets base + local rules while the ignored files
//     resolve to Ignored=true with no rules at all.
//  4. Preserve the original .next, next-env and main source inputs through resolver-to-Engine execution.
//  5. Require only the main no-var/no-console pair, then remove ignores to expose both previously suppressed findings.
//
// @evidence contracts/testing.md#behavioral-verification LoadConfigResolver resolves both base no-var/error and local no-console/error for ordinary source, while generated and env.d.ts paths are ignored with an empty rule map; the exact Next-shaped sources yield only ordinary main no-var/no-console errors, with no ignored-file findings and recovered rule-execution errors rejected.
// @evidence contracts/testing.md#independent-expectations Top-level ignores without files exclude a source from inherited as well as local config entries; independently authored path patterns and rule maps supply expected inclusion and exclusion.
// @evidence contracts/testing.md#distinguishing-cases Owns ordinary source, nested generated glob, exact declaration-file ignore, original dot-directory and triple-slash declaration inputs across an extends chain; the adjacent no-ignores control exposes all four findings and distinguishes suppression from inactive rules; file-scoped local ignores are covered by external-store cases.
// @evidence contracts/testing.md#execution-ownership TestLoadRuleConfigExtendsWithIgnoresAndRulesIgnoresGlobally is a selected Go unit entry calling LoadConfigResolver, ResolveRules and NewEngineWithResolver directly with exact authored JSON and parsed sources, without installing consumers, native compilation or a product child. All three authored sources are passed directly to Engine; compiler tsconfig include discovery and native diagnostic transport remain separate shared boundaries.
func TestLoadRuleConfigExtendsWithIgnoresAndRulesIgnoresGlobally(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(dir, "base.config.json"), `{
    "rules": { "no-var": "error" }
  }`)
  writeFile(t, filepath.Join(dir, "lint.config.json"), `{
    "extends": "./base.config.json",
    "ignores": ["generated/**/*.ts", "env.d.ts"],
    "rules": { "no-console": "error" }
  }`)

  resolver, err := LoadConfigResolver(&PluginEntry{
    Config: map[string]any{},
  }, dir, "tsconfig.json")
  if err != nil {
    t.Fatalf("LoadConfigResolver: %v", err)
  }

  main := resolver.ResolveRules(filepath.Join(dir, "src", "main.ts"))
  if main.Ignored {
    t.Fatal("src/main.ts must not be ignored")
  }
  if main.Rules.Severity("no-var") != SeverityError {
    t.Fatalf("src/main.ts no-var: want error inherited from base, got %v", main.Rules.Severity("no-var"))
  }
  if main.Rules.Severity("no-console") != SeverityError {
    t.Fatalf("src/main.ts no-console: want error from local rules, got %v", main.Rules.Severity("no-console"))
  }

  for _, ignored := range []string{
    filepath.Join(dir, "generated", "types", "validator.ts"),
    filepath.Join(dir, "env.d.ts"),
  } {
    resolved := resolver.ResolveRules(ignored)
    if !resolved.Ignored {
      t.Fatalf("%s: want Ignored=true from top-level ignores, got %+v", ignored, resolved)
    }
    if len(resolved.Rules) != 0 {
      t.Fatalf("%s: ignored file must have no rules, got %v", ignored, resolved.Rules)
    }
    if resolved.Rules.Severity("no-var") != SeverityOff {
      t.Fatalf("%s no-var: base config rules leaked onto an ignored file: %v", ignored, resolved.Rules.Severity("no-var"))
    }
  }

  nextRoot := t.TempDir()
  writeFile(t, filepath.Join(nextRoot, "tsconfig.json"), `{
    "compilerOptions":{"target":"ES2022","module":"commonjs","strict":true,"noEmit":true,"plugins":[{"transform":"@ttsc/lint"}]},
    "include":["next-env.d.ts",".next/types/**/*.ts","src"]
  }`)
  writeFile(t, filepath.Join(nextRoot, "base.config.json"), `{"rules":{"no-var":"error","typescript/triple-slash-reference":"error"}}`)
  child := filepath.Join(nextRoot, "lint.config.json")
  writeFile(t, child, `{"extends":"./base.config.json","ignores":[".next/**/*.ts","next-env.d.ts"],"rules":{"no-console":"error"}}`)
  nextResolver, err := LoadConfigResolver(&PluginEntry{}, nextRoot, "tsconfig.json")
  if err != nil {
    t.Fatalf("original Next-shaped config: %v", err)
  }
  mainFile := parseTSFile(t, filepath.Join(nextRoot, "src", "main.ts"), "var value = 1;\nconsole.log(value);\n")
  generated := parseTSFile(t, filepath.Join(nextRoot, ".next", "types", "validator.ts"), "var generated = 1;\nexport const gen = generated;\n")
  declaration := parseTSFile(t, filepath.Join(nextRoot, "next-env.d.ts"), "/// <reference path=\"./src/main.ts\" />\n")
  files := []*shimast.SourceFile{mainFile, generated, declaration}
  nextEngine := NewEngineWithResolver(nextResolver)
  if err := nextEngine.ConfigError(); err != nil {
    t.Fatalf("original Next-shaped binding: %v", err)
  }
  findings := nextEngine.Run(files, nil)
  expectedRules := RuleConfig{"no-var": SeverityError, "no-console": SeverityError, "typescript/triple-slash-reference": SeverityError}
  if err := validateSemanticRuleFindings(expectedRules, findings); err != nil {
    t.Fatalf("ignored configuration semantic findings: %v", err)
  }
  if len(findings) != 2 {
    t.Fatalf("want exactly two unignored main findings, got %+v", findings)
  }
  for i, want := range []string{"no-var", "no-console"} {
    if findings[i].Rule != want || findings[i].Severity != SeverityError || findings[i].File != mainFile {
      t.Fatalf("finding %d must be main %s/error, got %+v", i, want, findings[i])
    }
  }
  writeFile(t, child, `{"extends":"./base.config.json","rules":{"no-console":"error"}}`)
  unignored, err := LoadConfigResolver(&PluginEntry{}, nextRoot, "tsconfig.json")
  if err != nil {
    t.Fatalf("adjacent unignored config: %v", err)
  }
  unignoredEngine := NewEngineWithResolver(unignored)
  if err := unignoredEngine.ConfigError(); err != nil {
    t.Fatalf("adjacent unignored binding: %v", err)
  }
  active := unignoredEngine.Run(files, nil)
  if err := validateSemanticRuleFindings(expectedRules, active); err != nil {
    t.Fatalf("unignored configuration semantic findings: %v", err)
  }
  if len(active) != 4 {
    t.Fatalf("without ignores all four original rule findings must become visible: %+v", active)
  }
  seenGenerated, seenDeclaration := false, false
  for _, finding := range active {
    if finding.File == generated && finding.Rule == "no-var" && finding.Severity == SeverityError {
      seenGenerated = true
    }
    if finding.File == declaration && finding.Rule == "typescript/triple-slash-reference" && finding.Severity == SeverityError {
      seenDeclaration = true
    }
  }
  if !seenGenerated || !seenDeclaration {
    t.Fatalf("unignored generated and declaration sources must prove their suppressed rules are active: %+v", active)
  }
}
