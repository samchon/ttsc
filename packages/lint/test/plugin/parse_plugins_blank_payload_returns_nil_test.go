package main

import "testing"

// TestParsePluginsBlankPayloadReturnsNil verifies blank plugin payload handling.
//
// The native sidecar can be invoked in tests or command probes without a
// serialized plugin manifest. A whitespace-only payload should behave like no
// plugins rather than a JSON syntax error.
//
// This scenario covers the early trim branch before JSON decoding starts.
//
// 1. Pass a whitespace-only plugins-json payload.
// 2. Decode it through ParsePlugins.
// 3. Assert it returns no entries and no error.
func TestParsePluginsBlankPayloadReturnsNil(t *testing.T) {
  entries, err := ParsePlugins(" \n\t ")
  if err != nil {
    t.Fatalf("ParsePlugins: %v", err)
  }
  if entries != nil {
    t.Fatalf("blank payload should return nil entries, got %+v", entries)
  }
}
