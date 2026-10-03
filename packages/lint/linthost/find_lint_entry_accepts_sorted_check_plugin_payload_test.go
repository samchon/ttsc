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
// descriptor; if the function were position-sensitive or stopped at a non-lint check
// entries, multi-plugin projects would produce "no lint entry" errors.
//
//  1. Build a payload with a leading check plugin, @ttsc/lint in the middle,
//     and a transform plugin at the end.
//  2. Decode via ParsePlugins and then FindLintEntry.
//  3. Assert the returned entry is @ttsc/lint, not nil or one of the others.
//
// @evidence contracts/testing.md#behavioral-verification Actual descriptor selection locates the middle lint entry among unrelated check/transform entries, preserves stage/path and caller ownership, and returns nil without error when absent.
// @evidence contracts/testing.md#independent-expectations The authored three-entry JSON and literal middle index/name/check/path establish expected selection independently of FindLintEntry; absent lists have a literal nil oracle.
// @evidence contracts/testing.md#distinguishing-cases Unrelated descriptors before and after lint distinguish position-sensitive selection; nil list and the same unrelated pair without lint provide absence controls.
// @evidence contracts/testing.md#execution-ownership Actual ParsePlugins and FindLintEntry run in one Go process without compiler host staging, native plugin preparation, installation or interface-text checks.
func TestFindLintEntryAcceptsSortedCheckPluginPayload(t *testing.T) {
  const blob = `[
    {"name": "other-check", "stage": "check", "config": {}},
    {"name": "@ttsc/lint", "stage": "check", "config": {"configFile": "./lint.config.ts"}},
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
  if len(entries) != 3 || entry != &entries[1] || entry.Stage != "check" || entry.Config["configFile"] != "./lint.config.ts" { t.Fatalf("descriptor position, payload or ownership lost: %+v", entry) }
  for _, absent := range [][]PluginEntry{nil, {entries[0], entries[2]}} {
    if found, err := FindLintEntry(absent); err != nil || found != nil { t.Fatalf("absent lint descriptor selected: %+v / %v", found, err) }
  }
}
