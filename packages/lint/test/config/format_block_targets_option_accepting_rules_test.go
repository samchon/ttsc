package linthost

import (
  "testing"
)

// TestFormatBlockTargetsOptionAcceptingRules verifies every formatter payload
// produced by the public format block lands on a structurally option-accepting
// rule, and every registered formatter is represented.
//
// Format settings are expanded into ordinary rule tuples before engine
// construction. This includes an empty object for rules that need no fields,
// so inferring acceptance only from DecodeOptions calls would reject a valid
// default format run. Deriving both sets from the live expansion and registry
// keeps the boundary free of a second formatter-name list.
//
//  1. Expand a format block with the opt-in sort rule enabled.
//  2. Parse its generated option payloads and compare them with registered
//     format rules.
//  3. Assert every generated target reports AcceptsTtscLintOptions.
func TestFormatBlockTargetsOptionAcceptingRules(t *testing.T) {
  expanded, err := expandFormatBlock(map[string]any{"sortImports": true})
  if err != nil {
    t.Fatal(err)
  }
  _, options, err := ParseRulesWithOptions(expanded)
  if err != nil {
    t.Fatal(err)
  }

  registeredFormat := map[string]struct{}{}
  for _, name := range AllRuleNames() {
    if isRegisteredBuiltInFormatRule(name, LookupRule(name)) {
      registeredFormat[name] = struct{}{}
    }
  }
  generated := make(map[string]struct{}, len(options))
  for name := range options {
    generated[name] = struct{}{}
    rule := LookupRule(name)
    if rule == nil {
      t.Errorf("format block generated payload for unregistered rule %q", name)
      continue
    }
    if !ruleAcceptsOptions(rule) {
      t.Errorf("format block generated payload for optionless rule %q", name)
    }
  }
  assertSameRuleNameSet(t, "registered format rules", registeredFormat, "generated format payloads", generated)
}
