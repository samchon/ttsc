package linthost

import (
  "strings"
  "testing"
)

// TestFormatBlockRejectsUnknownKey verifies the loader surfaces
// typos in top-level `format` keys at the block's boundary rather
// than silently ignoring them.
//
// A `printwidth: 80` (lowercase w) typo without the boundary check
// would leave `format/print-width` rendered at the default 80
// without surfacing the user's intent. The reject prevents silent
// no-op configs.
//
//  1. Build `format: { printwidth: 80 }` (unknown key).
//  2. Parse it through `parseExternalConfigStore`.
//  3. Assert the error names the unknown key and points at the
//     allowed surface.
//
// @evidence contracts/testing.md#behavioral-verification parseExternalConfigStore rejects misspelled printwidth and names both the offending key and ITtscLintFormat surface.
// @evidence contracts/testing.md#independent-expectations The typed public key is printWidth; the authored lowercase typo is independently unknown and must not silently retain defaults.
// @evidence contracts/testing.md#distinguishing-cases Owns a plausible top-level typo with a valid numeric value; valid printWidth translation and nested unknown-key validation are complementary cases.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. An authored printwidth typo reaches parseExternalConfigStore directly in-process; the key and public surface error are inspected without formatting source or evaluating a config script.
func TestFormatBlockRejectsUnknownKey(t *testing.T) {
  _, err := parseExternalConfigStore(map[string]any{
    "format": map[string]any{"printwidth": 80},
  }, "")
  if err == nil {
    t.Fatal("expected error for unknown format key, got nil")
  }
  if !strings.Contains(err.Error(), "printwidth") {
    t.Errorf("expected error to name the bad key, got %v", err)
  }
  if !strings.Contains(err.Error(), "ITtscLintFormat") {
    t.Errorf("expected error to point at ITtscLintFormat, got %v", err)
  }
}
