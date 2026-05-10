package main

import (
	"testing"
)

// TestParseExternalConfigStoreForFileRequiresRuntimeFields verifies parse external config store
// for file requires runtime fields.
//
// External config parsing accepts ESLint-style flat config data and reduces it into the lint
// engine rule model. These tests cover file matching, ignores, extends reduction, and
// runtime-only markers before the command path loads a real project.
//
// This scenario focuses on parse external config store for file requires runtime fields. It
// protects the boundary between native fallback rules and cases that must delegate to an
// installed ESLint runtime.
//
// 1. Create the external config object or array for the branch.
// 2. Parse it through the external config reducer or store builder.
// 3. Assert resolved rules, ignored files, or runtime-required flags.
func TestParseExternalConfigStoreForFileRequiresRuntimeFields(t *testing.T) {
	store, err := parseExternalConfigStoreForFile(map[string]any{
		"languageOptions": map[string]any{
			"parser": map[string]any{},
		},
		"plugins": map[string]any{
			"@typescript-eslint": map[string]any{},
		},
		"rules": map[string]any{
			"@typescript-eslint/no-explicit-any": "error",
		},
	}, "/project")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !store.WantsESLintRuntime() {
		t.Fatal("runtime-only fields should request ESLint runtime")
	}
	if !store.RequiresESLintRuntime() {
		t.Fatal("runtime-only fields should require ESLint runtime")
	}
}
