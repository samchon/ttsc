package linthost

import (
  "path/filepath"
  "testing"
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
    if resolved.Rules.Severity("no-var") != SeverityOff {
      t.Fatalf("%s no-var: base config rules leaked onto an ignored file: %v", ignored, resolved.Rules.Severity("no-var"))
    }
  }
}
