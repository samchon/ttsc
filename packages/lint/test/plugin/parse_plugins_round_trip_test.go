package linthost

import (
  "testing"
)

// TestParsePluginsRoundTrip verifies the full JSON decode path from a
// --plugins-json payload to the located @ttsc/lint plugin entry.
//
// This is the end-to-end happy path that every lint invocation relies on:
// ParsePlugins must faithfully preserve entry fields (name, stage, config),
// and FindLintEntry must return the @ttsc/lint entry. A regression at any seam
// — dropped fields, re-keyed JSON, misrouted stage string — would silently
// produce a misconfigured run with no error reported.
//
//  1. Build a single-entry @ttsc/lint payload whose config carries `configFile`.
//  2. Parse the payload and locate the entry.
//  3. Assert entry.Stage is "check" and the `configFile` value round-tripped.
func TestParsePluginsRoundTrip(t *testing.T) {
  const blob = `[
    {"name": "@ttsc/lint", "stage": "check", "config": {"configFile": "./lint.config.ts"}}
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
  if got, _ := entry.Config["configFile"].(string); got != "./lint.config.ts" {
    t.Errorf("configFile: want ./lint.config.ts, got %q", got)
  }
}
