package linthost

import (
  "encoding/json"
  "testing"
)

// TestReactPerfNativeAllowList verifies intrinsic JSX element exceptions are configurable.
//
// React projects often accept inline `style` on native elements while still
// enforcing stable props for custom components. The `nativeAllowList` option
// mirrors eslint-plugin-react-perf's option surface: `"all"` skips every prop
// on lowercase/native tags, while a string list skips selected native props only.
//
// 1. Check a native `style` object is reported by default.
// 2. Re-run with `nativeAllowList: ["style"]` and assert the native prop is skipped.
// 3. Re-run with `nativeAllowList: "all"` and assert custom components still report.
//
// @evidence contracts/testing.md#behavioral-verification NewEngineWithResolver.Run via the reactPerf assertion helpers verifies default intrinsic style is reported, a style allow-list suppresses it, and all-native allowance still reports a custom Item prop; exact finding-line comparison rejects extra or missing diagnostics for react-perf/jsx-no-new-object-as-prop.
// @evidence contracts/testing.md#independent-expectations The nativeAllowList contract exempts selected props on intrinsic tags while keeping custom-component allocations checked; expected zero or line 1 is authored from these option meanings.
// @evidence contracts/testing.md#distinguishing-cases The same intrinsic allocation changes result only when the option is present; lowercase div and custom Item must not share the exception.
// @evidence contracts/testing.md#execution-ownership TestReactPerfNativeAllowList owns these explicit source/option variants as one Go unit entry; TSX parsing and actual engine execution share the Go test process without installing React or starting a product host.
func TestReactPerfNativeAllowList(t *testing.T) {
  ruleName := "react-perf/jsx-no-new-object-as-prop"
  defaultSource := "const view = <div style={{ display: \"none\" }} />;\n"
  reactPerfAssertLines(t, ruleName, defaultSource, []int{1})

  reactPerfAssertZero(
    t,
    ruleName,
    "/virtual/main.tsx",
    defaultSource,
    json.RawMessage(`{"nativeAllowList":["style"]}`),
  )

  reactPerfAssertZero(t, ruleName, "/virtual/main.tsx", defaultSource, json.RawMessage(`{"nativeAllowList":"all"}`))

  customSource := "const view = <Item config={{}} />;\n"
  got := reactPerfFindingLines(
    t,
    ruleName,
    "/virtual/main.tsx",
    customSource,
    json.RawMessage(`{"nativeAllowList":"all"}`),
  )
  if len(got) != 1 || got[0] != 1 {
    t.Fatalf("%s: custom component should still report under nativeAllowList=all, got lines %v", ruleName, got)
  }
}
