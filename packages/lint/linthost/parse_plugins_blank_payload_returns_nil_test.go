package linthost

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
//
// @evidence contracts/testing.md#behavioral-verification Actual ParsePlugins accepts mixed space, newline and tab input as no descriptor entries and no error, returning nil rather than an allocated empty slice.
// @evidence contracts/testing.md#independent-expectations Authored whitespace is an absent host envelope; literal nil entries and nil error specify the independent protocol result rather than expected parser-produced data.
// @evidence contracts/testing.md#distinguishing-cases Mixed whitespace isolates trim-before-JSON behavior; malformed input and the populated lint descriptor are exercised by sibling decode units.
// @evidence contracts/testing.md#execution-ownership Real descriptor parsing executes directly in the Go process without a subprocess argument transport, native producer, installed consumer or source-file presence oracle.
func TestParsePluginsBlankPayloadReturnsNil(t *testing.T) {
  entries, err := ParsePlugins(" \n\t ")
  if err != nil {
    t.Fatalf("ParsePlugins: %v", err)
  }
  if entries != nil {
    t.Fatalf("blank payload should return nil entries, got %+v", entries)
  }
}
