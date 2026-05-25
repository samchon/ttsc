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
