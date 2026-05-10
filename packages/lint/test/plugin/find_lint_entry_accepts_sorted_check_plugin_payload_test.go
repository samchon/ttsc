package main

import (
	"testing"
)

// TestFindLintEntryAcceptsSortedCheckPluginPayload verifies find lint entry accepts sorted
// check plugin payload.
//
// The lint sidecar receives plugin metadata as serialized JSON from ttsc. These tests verify
// that payload decoding and lint-entry selection remain stable even when other check or
// transform plugins are present.
//
// This scenario focuses on find lint entry accepts sorted check plugin payload. It protects the
// package protocol before rule config parsing starts.
//
// 1. Build the serialized plugin payload for the branch.
// 2. Decode it and locate the @ttsc/lint entry.
// 3. Assert entry selection, stage preservation, or malformed JSON errors.
func TestFindLintEntryAcceptsSortedCheckPluginPayload(t *testing.T) {
	const blob = `[
    {"name": "other-check", "stage": "check", "config": {}},
    {"name": "@ttsc/lint", "stage": "check", "config": {"config": {"no-var": "error"}}},
    {"name": "source-transform", "stage": "transform", "config": {}}
  ]`
	entries, err := ParsePlugins(blob)
	if err != nil {
		t.Fatalf("ParsePlugins: %v", err)
	}
	entry, err := FindLintEntry(entries)
	if err != nil {
		t.Fatalf("FindLintEntry: %v", err)
	}
	if entry == nil {
		t.Fatal("FindLintEntry returned nil")
	}
	if entry.Name != "@ttsc/lint" {
		t.Fatalf("unexpected entry: %+v", entry)
	}
}
