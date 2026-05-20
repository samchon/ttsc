package linthost

import (
  "testing"
)

// TestEngineRecordsUnknownRules verifies that rules not present in the registry are
// tracked in UnknownRules() and excluded from EnabledRules(), while valid rules remain.
//
// When a config references a rule name that was never registered, the engine must not
// silently drop it — it must surface the unrecognized name so the renderer can emit a
// diagnostic. At the same time, the unknown rule must not pollute the enabled-rule map
// because that would cause nil-rule dispatches. This pins both the segregation invariant
// and the non-contamination of the known-rule path.
//
// 1. Build an engine with one unknown rule name and one registered rule name.
// 2. Call UnknownRules() and EnabledRules().
// 3. Assert the unknown name is isolated and the known rule is still active.
func TestEngineRecordsUnknownRules(t *testing.T) {
  engine := NewEngine(RuleConfig{
    "never-existed": SeverityError,
    "no-var":        SeverityError,
  })
  unknown := engine.UnknownRules()
  if len(unknown) != 1 || unknown[0] != "never-existed" {
    t.Fatalf("want [never-existed], got %v", unknown)
  }
  if _, ok := engine.EnabledRules()["never-existed"]; ok {
    t.Errorf("unknown rule should not be enabled")
  }
  if _, ok := engine.EnabledRules()["no-var"]; !ok {
    t.Errorf("known rule should still be enabled")
  }
}
