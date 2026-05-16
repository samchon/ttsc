package main

import "testing"

// TestFormatBlockEnablesAllFormatRulesAtPrettierDefaults verifies that
// declaring an empty `format: {}` block in a tsconfig plugin entry
// turns on every always-on format rule at its Prettier-aligned
// default and uses the documented severity default of "warning".
//
// The block's "presence implies defaults" semantics is the entire
// pitch of the new surface — a user can copy a `.prettierrc` over,
// type out only their non-default keys, and the rest light up
// automatically. A regression that kept rules off under an empty
// block would defeat the design.
//
//  1. Build a plugin entry with `format: {}` only.
//  2. Resolve through `LoadConfigResolver`.
//  3. Assert format/semi, format/quotes, format/trailing-comma, and
//     format/print-width are all enabled at severity "warning".
//  4. Assert format/sort-imports and format/jsdoc stay off (opt-in
//     rules require explicit fields).
func TestFormatBlockEnablesAllFormatRulesAtPrettierDefaults(t *testing.T) {
  entry := &PluginEntry{
    Config: map[string]any{
      "format": map[string]any{},
    },
  }
  resolver, err := LoadConfigResolver(entry, "/virtual", "")
  if err != nil {
    t.Fatalf("LoadConfigResolver: %v", err)
  }
  enabled := resolver.EnabledRuleConfig()
  for _, name := range []string{
    "format/semi",
    "format/quotes",
    "format/trailing-comma",
    "format/print-width",
  } {
    sev, ok := enabled[name]
    if !ok {
      t.Errorf("expected %q to be enabled, got %v", name, enabled)
      continue
    }
    if sev != SeverityWarn {
      t.Errorf("expected %q at warning, got %v", name, sev)
    }
  }
  for _, name := range []string{"format/sort-imports", "format/jsdoc"} {
    if _, ok := enabled[name]; ok {
      t.Errorf("expected %q to stay off (opt-in), got enabled", name)
    }
  }
}
