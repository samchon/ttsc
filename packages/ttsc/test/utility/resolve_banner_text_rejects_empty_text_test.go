package ttsc_test

import (
  "strings"
  "testing"
)

// TestUtilityResolveBannerTextRejectsEmptyObjectText verifies inline banner
// text validation rejects a whitespace-only `text` field in object config.
//
// Inline config bypasses file discovery, so this branch is the direct guard
// against accepting a banner plugin entry that cannot produce visible preamble
// content.
//
// This scenario binds to the resolver helper to keep the validation branch
// isolated from compiler program setup. Broader utility command tests still
// cover how the same error is surfaced to callers.
//
// 1. Resolve banner text from an inline whitespace-only `text` value.
// 2. Capture the returned validation error.
// 3. Assert the error reports the non-empty string requirement.
func TestUtilityResolveBannerTextRejectsEmptyObjectText(t *testing.T) {
  _, err := utilityResolveBannerText(map[string]any{
    "text": "  ",
  }, t.TempDir(), "tsconfig.json")
  if err == nil || !strings.Contains(err.Error(), "non-empty string") {
    t.Fatalf("expected non-empty string error, got %v", err)
  }
}
