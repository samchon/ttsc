package main

import (
  "strings"
  "testing"
)

// TestParseExternalConfigRulesRejectsUnresolvedStringExtends verifies string extends rejection.
//
// External config parsing accepts ESLint-style flat config data and reduces it into the lint
// engine rule model. These tests cover file matching, ignores, extends reduction, and
// runtime-only markers before the command path loads a real project.
//
// This scenario focuses on parse external config rules rejects unresolved string extends. It
// protects the boundary between native fallback rules and cases that must delegate to an
// installed ESLint runtime.
//
// 1. Create the external config object or array for the branch.
// 2. Parse it through the external config reducer or store builder.
// 3. Assert resolved rules, ignored files, or runtime-required flags.
func TestParseExternalConfigRulesRejectsUnresolvedStringExtends(t *testing.T) {
  _, err := parseExternalConfigRules(map[string]any{
    "extends": []any{"eslint:recommended"},
  })
  if err == nil {
    t.Fatal("expected string extends to be rejected")
  }
  if !strings.Contains(err.Error(), "config.extends[0] must be an object or flat config array") {
    t.Fatalf("error should explain unsupported unresolved extends, got %v", err)
  }
}
