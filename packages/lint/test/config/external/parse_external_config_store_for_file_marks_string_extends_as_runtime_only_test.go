package main

import (
	"testing"
)

// TestParseExternalConfigStoreForFileMarksStringExtendsAsRuntimeOnly verifies parse external
// config store for file marks string extends as runtime only.
//
// External config parsing accepts ESLint-style flat config data and reduces it into the lint
// engine rule model. These tests cover file matching, ignores, extends reduction, and
// runtime-only markers before the command path loads a real project.
//
// This scenario focuses on parse external config store for file marks string extends as runtime
// only. It protects the boundary between native fallback rules and cases that must delegate to
// an installed ESLint runtime.
//
// 1. Create the external config object or array for the branch.
// 2. Parse it through the external config reducer or store builder.
// 3. Assert resolved rules, ignored files, or runtime-required flags.
func TestParseExternalConfigStoreForFileMarksStringExtendsAsRuntimeOnly(t *testing.T) {
	store, err := parseExternalConfigStoreForFile(map[string]any{
		"extends": []any{"eslint/recommended"},
		"rules": map[string]any{
			"no-var": "error",
		},
	}, "/project")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !store.WantsESLintRuntime() {
		t.Fatal("string extends should request ESLint runtime")
	}
	if !store.RequiresESLintRuntime() {
		t.Fatal("string extends should require ESLint runtime")
	}
	if store.Flatten().Severity("no-var") != SeverityError {
		t.Fatalf("local rules should still be available for fallback diagnostics, got %+v", store.Flatten())
	}
}
