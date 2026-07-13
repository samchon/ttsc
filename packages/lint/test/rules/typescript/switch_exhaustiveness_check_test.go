package linthost

import "testing"

// TestRuleCorpusSwitchExhaustivenessCheck pins the scalar-default reproduction
// from issue #416 against a real TypeScript-Go Program.
//
// A real default does not hide an omitted finite member unless
// considerDefaultExhaustiveForUnions is enabled. Singleton literals, unique
// symbols, and the enumerable undefined part of an open union are checked too.
//
//  1. Exercise the five positive switches from the issue reproduction.
//  2. Include a fully covered union with a permitted default as the negative
//     control.
//  3. Assert every diagnostic names its actual missing member.
func TestRuleCorpusSwitchExhaustivenessCheck(t *testing.T) {
  assertSwitchExhaustivenessCheckForTest(t, `
type Choice = "alpha" | "beta";
declare const withDefault: Choice;
switch (withDefault) {
  case "alpha":
    break;
  default:
    break;
}

declare const withoutDefault: Choice;
switch (withoutDefault) {
  case "alpha":
    break;
}

declare const singleton: "only";
switch (singleton) {}

declare const first: unique symbol;
declare const second: unique symbol;
declare const symbolValue: typeof first | typeof second;
switch (symbolValue) {
  case first:
    break;
}

declare const maybeText: string | undefined;
switch (maybeText) {
  case "known":
    break;
}
`, nil, 5, map[string]int{
    `Cases not matched: "beta"`: 2,
    `Cases not matched: "only"`: 1,
    "Cases not matched: typeof second": 1,
    "Cases not matched: undefined":     1,
  })

  assertSwitchExhaustivenessCheckForTest(t, `
type Choice = "alpha" | "beta";
declare const complete: Choice;
switch (complete) {
  case "alpha":
    break;
  case "beta":
    break;
  default:
    break;
}
`, nil, 0, nil)
}
