package main

import (
	"testing"
)

// TestParsePluginsRoundTrip verifies parse plugins round trip.
//
// The lint sidecar receives plugin metadata as serialized JSON from ttsc. These tests verify
// that payload decoding and lint-entry selection remain stable even when other check or
// transform plugins are present.
//
// This scenario focuses on parse plugins round trip. It protects the package protocol before
// rule config parsing starts.
//
// 1. Build the serialized plugin payload for the branch.
// 2. Decode it and locate the @ttsc/lint entry.
// 3. Assert entry selection, stage preservation, or malformed JSON errors.
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
