package linthost

import (
  "encoding/json"
  "testing"
)

// TestParseRulesAcceptsESLintTuplesInStandardInlineConfig verifies tuple support.
//
// Inline lint config now accepts ESLint-style `[severity, options]` tuples
// alongside bare severity literals. The two slots are captured into the
// RuleConfig severity map and the RuleOptionsMap options blob respectively,
// so rule implementations can decode their per-rule option struct from the
// stored JSON.
//
// 1. Build an inline rules map mixing a bare severity and a tuple form.
// 2. Parse it through `ParseRulesWithOptions`.
// 3. Assert severity and options are routed to the correct collection.
func TestParseRulesAcceptsESLintTuplesInStandardInlineConfig(t *testing.T) {
  cfg, opts, err := ParseRulesWithOptions(map[string]any{
    "noVar": "error",
    "formatSortImports": []any{
      "warning",
      map[string]any{
        "importOrder":           []any{"<THIRD_PARTY_MODULES>", "^[./]"},
        "importOrderSeparation": true,
      },
    },
  })
  if err != nil {
    t.Fatalf("ParseRulesWithOptions: %v", err)
  }
  if cfg["noVar"] != SeverityError {
    t.Fatalf("noVar severity: want error, got %v", cfg["noVar"])
  }
  if cfg["formatSortImports"] != SeverityWarn {
    t.Fatalf("formatSortImports severity: want warning, got %v", cfg["formatSortImports"])
  }
  if _, exists := opts["noVar"]; exists {
    t.Fatalf("severity-only rule must not have an options blob recorded")
  }
  raw, ok := opts["formatSortImports"]
  if !ok {
    t.Fatalf("tuple rule must produce an options blob")
  }
  var decoded struct {
    ImportOrder           []string `json:"importOrder"`
    ImportOrderSeparation bool     `json:"importOrderSeparation"`
  }
  if err := json.Unmarshal(raw, &decoded); err != nil {
    t.Fatalf("options blob is not valid JSON: %v", err)
  }
  if len(decoded.ImportOrder) != 2 || decoded.ImportOrder[0] != "<THIRD_PARTY_MODULES>" {
    t.Fatalf("importOrder did not round-trip: %+v", decoded)
  }
  if !decoded.ImportOrderSeparation {
    t.Fatalf("importOrderSeparation did not round-trip")
  }
}
