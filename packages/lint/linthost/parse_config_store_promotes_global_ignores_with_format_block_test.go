package linthost

import "testing"

// TestParseConfigStorePromotesGlobalIgnoresWithFormatBlock verifies that a
// config object whose only rule surface is a `format` block still promotes a
// top-level `ignores` (no `files`) to a global ignore.
//
// Promotion must precede completion of the shared rules branch guarded by
// `hasRules || hasFormat`. A format-only config (`format: {...}` plus
// `ignores`) must globally exclude authored generated paths before folding
// its expanded `format/*` entries, just as an ordinary `rules` object does.
// This unit owns the format half of that branch; the companion owns the
// ordinary-rules half.
//
//  1. Parse one object with a `format` block (severity warning, so format
//     rules are active) plus `ignores` and no `files`.
//  2. Resolve an ignored path and an ordinary path.
//  3. Assert the ignored path is globally ignored while the ordinary path
//     keeps the expanded format rules.
//
// @evidence contracts/testing.md#behavioral-verification parseExternalConfigStore globally ignores generated/schema.ts with an empty rule set while preserving format/semi at warning for src/main.ts.
// @evidence contracts/testing.md#independent-expectations Top-level ignores without files apply equally when formatting is the sole rule surface; the authored generated pattern and explicit warning formatter block independently establish the contrasting resolved states.
// @evidence contracts/testing.md#distinguishing-cases Owns format-only global promotion and ordinary-source preservation, complementing the separate ordinary-rules promotion case.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. An authored warning formatter block reaches parseExternalConfigStore and two ResolveRules calls in-process; generated-versus-source rule sets observe promotion without running a formatter or child host.
func TestParseConfigStorePromotesGlobalIgnoresWithFormatBlock(t *testing.T) {
  store, err := parseExternalConfigStore(map[string]any{
    "ignores": []any{"generated/**"},
    "format":  map[string]any{"severity": "warning"},
  }, "/project")
  if err != nil {
    t.Fatalf("parseExternalConfigStore: %v", err)
  }

  ignored := store.ResolveRules("/project/generated/schema.ts")
  if !ignored.Ignored {
    t.Fatalf("generated/schema.ts: want Ignored=true, got %+v", ignored)
  }
  if len(ignored.Rules) != 0 {
    t.Fatalf("generated/schema.ts: format rules leaked onto an ignored file: %v", ignored.Rules)
  }

  main := store.ResolveRules("/project/src/main.ts")
  if main.Ignored {
    t.Fatal("src/main.ts must not be ignored")
  }
  if len(main.Rules) == 0 {
    t.Fatal("src/main.ts: expected the expanded format rules to apply")
  }
  if got := main.Rules["format/semi"]; got != SeverityWarn {
    t.Fatalf("src/main.ts: expected format/semi warning, got %v", got)
  }
}
