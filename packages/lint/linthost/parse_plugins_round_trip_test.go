package linthost

import (
  "testing"
)

// TestParsePluginsRoundTrip verifies the full JSON decode path from a
// --plugins-json payload to the located @ttsc/lint plugin entry.
//
// This is the direct descriptor decode/selection path lint invocations rely on:
// ParsePlugins must faithfully preserve entry fields (name, stage, config),
// and FindLintEntry must return the @ttsc/lint entry. A regression at any seam
// — dropped fields, re-keyed JSON, misrouted stage string — would silently
// produce a misconfigured run with no error reported.
//
//  1. Build a single-entry @ttsc/lint payload whose config carries `configFile`.
//  2. Parse the payload and locate the entry.
//  3. Assert entry.Stage is "check" and the `configFile` value round-tripped.
//
// @evidence contracts/testing.md#behavioral-verification Actual ParsePlugins and FindLintEntry preserve the lint name, check stage and literal configFile, selecting the caller-owned first descriptor rather than a detached replacement.
// @evidence contracts/testing.md#independent-expectations The literal JSON envelope independently defines all selected values and one-entry count; pointer identity is compared with the original caller slice, not a generated expected descriptor.
// @evidence contracts/testing.md#distinguishing-cases A populated lint descriptor contrasts with blank and malformed payload siblings; check stage, path value and pointer ownership distinguish partial decode from faithful selection.
// @evidence contracts/testing.md#execution-ownership Real Go decoder and selector execute directly in-process; no native sidecar, compiler subprocess, installation or repository structure assertion is claimed.
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
  if entry.Name != "@ttsc/lint" || entry != &entries[0] {
    t.Fatalf("selected descriptor identity or caller ownership lost: %+v", entry)
  }
  if got, _ := entry.Config["configFile"].(string); got != "./lint.config.ts" {
    t.Errorf("configFile: want ./lint.config.ts, got %q", got)
  }
}
