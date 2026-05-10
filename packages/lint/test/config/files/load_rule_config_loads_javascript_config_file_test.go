package main

import (
	"path/filepath"
	"testing"
)

// TestLoadRuleConfigLoadsJavaScriptConfigFile verifies load rule config loads JavaScript
// config file.
//
// LoadRuleConfig bridges plugin JSON, discovered config files, and explicit config paths. These
// tests materialize temporary config files so path resolution and legacy-key rejection are
// checked with real filesystem behavior.
//
// This scenario focuses on load rule config loads JavaScript config file. It ensures the lint
// package accepts only the supported config contract while still loading JSON, JavaScript, and
// TypeScript config files through the documented path.
//
// 1. Create the temporary tsconfig and lint config files required by the branch.
// 2. Load the rule config through the package helper used by command execution.
// 3. Assert resolved severities or the precise rejection message.
func TestLoadRuleConfigLoadsJavaScriptConfigFile(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")
	writeFile(t, filepath.Join(dir, "ttsc-lint.config.cjs"), `module.exports = {
    "no-console": "warn",
    "no-debugger": "error",
  };`)

	cfg, err := LoadRuleConfig(&PluginEntry{
		Config: map[string]any{
			"config": "./ttsc-lint.config.cjs",
		},
	}, dir, "tsconfig.json")
	if err != nil {
		t.Fatalf("LoadRuleConfig: %v", err)
	}
	if cfg.Severity("no-console") != SeverityWarn {
		t.Errorf("no-console: want warning, got %v", cfg.Severity("no-console"))
	}
	if cfg.Severity("no-debugger") != SeverityError {
		t.Errorf("no-debugger: want error, got %v", cfg.Severity("no-debugger"))
	}
}
