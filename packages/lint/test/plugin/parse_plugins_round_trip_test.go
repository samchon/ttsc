package linthost

import (
  "testing"
)

// TestParsePluginsRoundTrip verifies the full JSON decode path from a
// --plugins-json payload through rule-config parsing.
//
// This is the end-to-end happy path that every lint invocation relies on:
// ParsePlugins must faithfully preserve entry fields (name, stage, config),
// FindLintEntry must return the @ttsc/lint entry, and ParseRules must produce
// the correct severity for the embedded rule config. A regression at any seam
// — dropped fields, re-keyed JSON, misrouted stage string — would silently
// produce an empty rule set with no error reported.
//
//  1. Build a single-entry @ttsc/lint payload with `"no-var": "error"`.
//  2. Parse, locate the entry, and decode the rule config.
//  3. Assert entry.Stage is "check" and Severity("no-var") is SeverityError.
func TestParsePluginsRoundTrip(t *testing.T) {
  const blob = `[
    {"name": "@ttsc/lint", "stage": "check", "config": {"config": {"no-var": "error"}}}
  ]`
  entries, err := ParsePlugins(blob)
  if err != nil {
    t.Fatalf("ParsePlugins: %v", err)
  }
  if len(entries) != 1 {
    t.Fatalf("want 1 entry, got %d", len(entries))
  }
  entry, err := FindLintEntry(entries)
  if err != nil {
    t.Fatalf("FindLintEntry: %v", err)
  }
  if entry == nil {
    t.Fatal("FindLintEntry returned nil")
  }
  if entry.Stage != "check" {
    t.Errorf("entry.Stage: want check, got %q", entry.Stage)
  }
  cfg, err := ParseRules(entry.Config["config"])
  if err != nil {
    t.Fatalf("ParseRules: %v", err)
  }
  if cfg.Severity("no-var") != SeverityError {
    t.Errorf("no-var severity: want error, got %v", cfg.Severity("no-var"))
  }
}
