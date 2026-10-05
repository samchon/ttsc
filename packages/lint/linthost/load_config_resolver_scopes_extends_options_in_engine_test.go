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
//
// 1. Write base and test-scoped JSON config fixtures with distinct selectors.
// 2. Load the resolver and run both candidate node kinds in both files.
// 3. Require exactly the intended file, severity and message for each finding.
//
// @evidence contracts/testing.md#behavioral-verification LoadConfigResolver and Engine produce exactly two findings: base VariableDeclaration/error for src/main.ts and child DebuggerStatement/warning for tests/unit.ts without leaking options between files.
// @evidence contracts/testing.md#independent-expectations The authored files selector and distinct literal syntax selectors determine the independently expected file, message, and severity pairs; both source files contain both candidate nodes to make leakage observable.
// @evidence contracts/testing.md#distinguishing-cases Owns inherited option binding, eslint alias normalization, matching and nonmatching paths, and competing syntax nodes in each file; neither extra finding nor wrong severity is tolerated.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry loads authored base and child JSON through LoadConfigResolver, then parses two source files and runs the real no-restricted-syntax engine in one process; no script config evaluator, native producer or independently installed consumer is involved.
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
  if findings[0].File != main || findings[0].Rule != "no-restricted-syntax" || findings[0].Severity != SeverityError ||
    findings[0].Message != "Using 'VariableDeclaration' is not allowed." {
    t.Fatalf("base file received the wrong rule setting: %+v", findings[0])
  }
  if findings[1].File != testFile || findings[1].Rule != "no-restricted-syntax" || findings[1].Severity != SeverityWarn ||
    findings[1].Message != "Using 'DebuggerStatement' is not allowed." {
    t.Fatalf("selected file received the wrong rule setting: %+v", findings[1])
  }
}
