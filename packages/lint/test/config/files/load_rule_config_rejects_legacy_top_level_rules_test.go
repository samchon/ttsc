package main

import (
	"path/filepath"
	"strings"
	"testing"
)

// TestLoadRuleConfigRejectsLegacyTopLevelRules verifies load rule config rejects legacy top
// level rules.
//
// LoadRuleConfig bridges plugin JSON, discovered config files, and explicit config paths. These
// tests materialize temporary config files so path resolution and legacy-key rejection are
// checked with real filesystem behavior.
//
// This scenario focuses on load rule config rejects legacy top level rules. It ensures the lint
// package accepts only the supported config contract while still loading JSON, JavaScript, and
// TypeScript config files through the documented path.
//
// 1. Create the temporary tsconfig and lint config files required by the branch.
// 2. Load the rule config through the package helper used by command execution.
// 3. Assert resolved severities or the precise rejection message.
func TestLoadRuleConfigRejectsLegacyTopLevelRules(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")

	_, err := LoadRuleConfig(&PluginEntry{
		Config: map[string]any{
			"rules": map[string]any{
				"no-var": "off",
			},
		},
	}, dir, "tsconfig.json")
	if err == nil {
		t.Fatal("expected top-level rules to be rejected")
	}
	if !strings.Contains(err.Error(), "use \"config\"") {
		t.Fatalf("error should point to config-only contract, got %v", err)
	}
}
