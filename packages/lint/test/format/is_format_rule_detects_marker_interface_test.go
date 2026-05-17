package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestIsFormatRuleDetectsMarkerInterface verifies isFormatRule's positive,
// negative, and false-marker branches.
//
// The marker is the only thing distinguishing format and lint dispatch, so a
// regression here would silently miscategorize every rule that opts into the
// FormatRule interface. The three branches cover: a rule that implements
// FormatRule and returns true, a rule that does not implement FormatRule at
// all, and a rule that implements FormatRule but returns false (which the
// host treats as "lint", matching the documented marker semantics).
//
// 1. Build three synthetic rules covering each branch.
// 2. Probe each through isFormatRule.
// 3. Assert the boolean result per branch.
func TestIsFormatRuleDetectsMarkerInterface(t *testing.T) {
  cases := []struct {
    name string
    rule Rule
    want bool
  }{
    {name: "format-rule", rule: synthFormatRule{}, want: true},
    {name: "lint-rule", rule: synthLintRule{}, want: false},
    {name: "format-rule-returning-false", rule: synthFormatRuleFalse{}, want: false},
  }
  for _, tc := range cases {
    if got := isFormatRule(tc.rule); got != tc.want {
      t.Errorf("%s: want %v, got %v", tc.name, tc.want, got)
    }
  }
}

type synthFormatRule struct{}

func (synthFormatRule) Name() string                  { return "synth/format" }
func (synthFormatRule) IsFormat() bool                { return true }
func (synthFormatRule) Visits() []shimast.Kind        { return nil }
func (synthFormatRule) Check(*Context, *shimast.Node) {}

type synthLintRule struct{}

func (synthLintRule) Name() string                  { return "synth/lint" }
func (synthLintRule) Visits() []shimast.Kind        { return nil }
func (synthLintRule) Check(*Context, *shimast.Node) {}

type synthFormatRuleFalse struct{}

func (synthFormatRuleFalse) Name() string                  { return "synth/format-false" }
func (synthFormatRuleFalse) IsFormat() bool                { return false }
func (synthFormatRuleFalse) Visits() []shimast.Kind        { return nil }
func (synthFormatRuleFalse) Check(*Context, *shimast.Node) {}
