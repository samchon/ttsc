package main

import (
  "strings"
  "testing"
)

// TestParsePluginsRejectsBadJSON verifies parse plugins rejects bad json.
//
// The lint sidecar receives plugin metadata as serialized JSON from ttsc. These tests verify
// that payload decoding and lint-entry selection remain stable even when other check or
// transform plugins are present.
//
// This scenario focuses on parse plugins rejects bad json. It protects the package protocol
// before rule config parsing starts.
//
// 1. Build the serialized plugin payload for the branch.
// 2. Decode it and locate the @ttsc/lint entry.
// 3. Assert entry selection, stage preservation, or malformed JSON errors.
func TestParsePluginsRejectsBadJSON(t *testing.T) {
  if _, err := ParsePlugins("not-json"); err == nil {
    t.Error("expected error for malformed JSON")
  } else if !strings.Contains(err.Error(), "invalid --plugins-json") {
    t.Errorf("error should mention plugins-json: %v", err)
  }
}
