package linthost

import (
  "testing"
)

// TestFindLintEntryAcceptsSortedCheckPluginPayload verifies that FindLintEntry
// locates the @ttsc/lint descriptor when the payload contains unrelated check
// and transform plugins listed before and after it.
//
// ttsc serialises the full plugin manifest and passes it to the lint sidecar
// via --plugins-json. The lint binary uses FindLintEntry to select its own
// descriptor; if the function were position-sensitive or skipped non-lint check
// entries, multi-plugin projects would produce "no lint entry" errors.
//
//  1. Build a payload with a leading check plugin, @ttsc/lint in the middle,
//     and a transform plugin at the end.
//  2. Decode via ParsePlugins and then FindLintEntry.
//  3. Assert the returned entry is @ttsc/lint, not nil or one of the others.
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
