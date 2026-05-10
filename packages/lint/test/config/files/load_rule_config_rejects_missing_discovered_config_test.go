package main

import (
	"path/filepath"
	"strings"
	"testing"
)

// TestLoadRuleConfigRejectsMissingDiscoveredConfig verifies load rule config rejects missing
// discovered config.
//
// LoadRuleConfig bridges plugin JSON, discovered config files, and explicit config paths. These
// tests materialize temporary config files so path resolution and legacy-key rejection are
// checked with real filesystem behavior.
//
// This scenario focuses on load rule config rejects missing discovered config. It ensures the
// lint package accepts only the supported config contract while still loading JSON, JavaScript,
// and TypeScript config files through the documented path.
//
// 1. Create the temporary tsconfig and lint config files required by the branch.
// 2. Load the rule config through the package helper used by command execution.
// 3. Assert resolved severities or the precise rejection message.
func TestLoadRuleConfigRejectsMissingDiscoveredConfig(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")

	_, err := LoadRuleConfig(&PluginEntry{
		Config: map[string]any{},
	}, dir, "tsconfig.json")
	if err == nil {
		t.Fatal("expected missing lint config to fail")
	}
	if !strings.Contains(err.Error(), "config") || !strings.Contains(err.Error(), "lint.config") {
		t.Fatalf("error should explain required config discovery, got %v", err)
	}
}
