package strip_test

import (
  "strings"
  "testing"
)

// TestConfigAndPatternHelpers verifies strip config parsing and call-pattern matching.
//
// The command tests exercise real AST rewrites. These helper checks pin the
// configuration contract around default values, explicit empty lists, wildcard
// placement, and array coercion so invalid descriptors fail before source
// traversal starts.
//
// 1. Parse default and explicit strip configs.
// 2. Reject malformed call, statement, and array values.
// 3. Assert exact, wildcard, empty, and mismatched call patterns.
//
// @evidence contracts/testing.md#behavioral-verification Calls strip parsers, pattern/array/slice helpers and nil AST adapters to assert defaults, explicit trace options, invalid inputs and safe nil guards.
// @evidence contracts/testing.md#independent-expectations The default policy strips console.log, assert.* and debugger statements but not console.info, which the literal default assertions check; literal exact/wildcard expectations distinguish segment matching, and the explicit trace config proves an empty statements list disables the debugger default.
// @evidence contracts/testing.md#distinguishing-cases Owns default/explicit options, missing/nil/wrong-type/blank/non-string arrays, malformed call parts/middle wildcard, unsupported return statement, exact/wildcard matching, unequal slices and nil guards. Nonnil AST transforms stay in boundary cases.
// @evidence contracts/testing.md#execution-ownership Unit entry TestConfigAndPatternHelpers is discovered in test/unit by `go test ./packages/strip/...`, the root `test:go` command. Runs stripParseStrip, stripParseCallPattern, matching/config helpers and nil traversal adapters in the Go process; no Program, parser session or subprocess is prepared.
func TestConfigAndPatternHelpers(t *testing.T) {
  defaults, err := stripParseStrip(map[string]any{})
  if err != nil {
    t.Fatal(err)
  }
  if !defaults.stripDebugger || !stripMatchesCall(defaults, "console.log") || !stripMatchesCall(defaults, "assert.equal") || stripMatchesCall(defaults, "console.info") {
    t.Fatalf("default strip config mismatch: %#v", defaults)
  }
  explicit, err := stripParseStrip(map[string]any{
    "calls":      []any{"trace"},
    "statements": []any{},
  })
  if err != nil {
    t.Fatal(err)
  }
  if explicit.stripDebugger || !stripMatchesCall(explicit, "trace") || stripMatchesCall(explicit, "trace.extra") {
    t.Fatalf("explicit strip config mismatch: %#v", explicit)
  }

  for label, config := range map[string]map[string]any{
    "calls wrong type":      {"calls": "console.log"},
    "calls empty item":      {"calls": []any{""}},
    "calls non-string item": {"calls": []any{1}},
    "call empty part":       {"calls": []any{"console..log"}},
    "wildcard middle":       {"calls": []any{"console.*.log"}},
    "statements wrong type": {"statements": "debugger"},
    "unsupported statement": {"statements": []any{"return"}},
  } {
    if _, err := stripParseStrip(config); err == nil {
      t.Fatalf("expected %s to fail", label)
    }
  }

  wildcard, err := stripParseStrip(map[string]any{"calls": []any{"console.*"}})
  if err != nil {
    t.Fatal(err)
  }
  if !stripMatchesCall(wildcard, "console.debug") || !stripMatchesCall(wildcard, "console.a.b") || stripMatchesCall(wildcard, "console") || stripMatchesCall(wildcard, "consolex.log") {
    t.Fatal("wildcard pattern mismatch")
  }
  exact, err := stripParseStrip(map[string]any{"calls": []any{"console.log"}})
  if err != nil {
    t.Fatal(err)
  }
  if !stripMatchesCall(exact, "console.log") || stripMatchesCall(exact, "console.debug") || stripMatchesCall(exact, "console.log.x") {
    t.Fatal("exact pattern mismatch")
  }
  for _, text := range []string{"*", "*.log", "con*sole.log", "console.lo*"} {
    if _, err := stripParseCallPattern(text); err == nil {
      t.Fatalf("expected call pattern %q to be rejected", text)
    }
  }
  if _, err := stripParseCallPattern("console."); err == nil || !strings.Contains(err.Error(), "invalid call pattern") {
    t.Fatalf("expected invalid trailing part error, got %v", err)
  }

  values, err := stripStringArrayConfig(map[string]any{"items": []any{"a", "b"}, "missing": nil}, "items")
  if err != nil || len(values) != 2 || values[0] != "a" || values[1] != "b" {
    t.Fatalf("array config mismatch: values=%#v err=%v", values, err)
  }
  if values, err := stripStringArrayConfig(map[string]any{}, "items"); err != nil || values != nil {
    t.Fatalf("missing array config mismatch: values=%#v err=%v", values, err)
  }
  if values, err := stripStringArrayConfig(map[string]any{"items": nil}, "items"); err != nil || values != nil {
    t.Fatalf("nil array config mismatch: values=%#v err=%v", values, err)
  }
  if _, err := stripStringArrayConfig(map[string]any{"items": []any{" "}}, "items"); err == nil {
    t.Fatal("expected blank array item error")
  }
  if _, err := stripStringArrayConfig(map[string]any{"items": 1}, "items"); err == nil {
    t.Fatal("expected non-array config error")
  }

  if !stripEqualStringSlices([]string{"a"}, []string{"a"}) || stripEqualStringSlices([]string{"a"}, []string{"a", "b"}) || stripEqualStringSlices([]string{"a"}, []string{"b"}) {
    t.Fatal("equal string slice helper mismatch")
  }
  stripApply(nil, nil)
  stripApply(&stripRewriter{}, nil)
  if stripShouldStripStatement(nil, defaults) {
    t.Fatal("nil statement should not strip")
  }
  stripFilterChildStatements(nil, defaults)
  if name, ok := stripCallExpressionName(nil); ok || name != "" {
    t.Fatalf("nil call expression mismatch: name=%q ok=%v", name, ok)
  }
  if name, ok := stripDottedName(nil); ok || name != "" {
    t.Fatalf("nil dotted name mismatch: name=%q ok=%v", name, ok)
  }
}
