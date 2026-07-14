package linthost

import (
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestLoadConfigResolverScopesExtendsOptionsInEngine exercises the real JSON
// loader, extends ordering, alias normalization, and per-file engine binding.
// Both files contain both candidate nodes; only their matching selector may
// report, making an option leak observable as an exact wrong diagnostic.
func TestLoadConfigResolverScopesExtendsOptionsInEngine(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{}`)
  writeFile(t, filepath.Join(root, "base.json"), `{
    "rules": {
      "no-restricted-syntax": ["error", "VariableDeclaration"]
    }
  }`)
  writeFile(t, filepath.Join(root, "lint.config.json"), `{
    "extends": "./base.json",
    "files": ["tests/**"],
    "rules": {
      "eslint/no-restricted-syntax": ["warning", "DebuggerStatement"]
    }
  }`)

  resolver, err := LoadConfigResolver(&PluginEntry{Config: map[string]any{
    "configFile": "./lint.config.json",
  }}, root, "tsconfig.json")
  if err != nil {
    t.Fatalf("LoadConfigResolver: %v", err)
  }
  engine := NewEngineWithResolver(resolver)
  if err := engine.ConfigError(); err != nil {
    t.Fatalf("NewEngineWithResolver: %v", err)
  }

  source := "const value = 1;\ndebugger;\n"
  main := parseTSFile(t, filepath.Join(root, "src", "main.ts"), source)
  testFile := parseTSFile(t, filepath.Join(root, "tests", "unit.ts"), source)
  findings := engine.Run([]*shimast.SourceFile{main, testFile}, nil)
  if len(findings) != 2 {
    t.Fatalf("want one scoped finding per file, got %+v", findings)
  }
  if findings[0].File != main || findings[0].Severity != SeverityError ||
    findings[0].Message != "Using 'VariableDeclaration' is not allowed." {
    t.Fatalf("base file received the wrong rule setting: %+v", findings[0])
  }
  if findings[1].File != testFile || findings[1].Severity != SeverityWarn ||
    findings[1].Message != "Using 'DebuggerStatement' is not allowed." {
    t.Fatalf("selected file received the wrong rule setting: %+v", findings[1])
  }
}
