package linthost

import "testing"

// TestReactPerfRulesSkipJsxSource verifies the family only runs on TSX source files.
//
// `@ttsc/lint` can parse JavaScript-family files, but this rule family is part
// of the TypeScript-only adoption path requested for ttsc. The filename guard
// keeps `.jsx` projects from receiving React diagnostics from this TypeScript
// lint surface.
//
// 1. Parse JSX-shaped source under a `.jsx` filename.
// 2. Enable a `react-perf/*` rule.
// 3. Assert no diagnostics are emitted even though the AST shape matches.
func TestReactPerfRulesSkipJsxSource(t *testing.T) {
	source := "const view = <Item config={{}} />;\n"
	reactPerfAssertZero(
		t,
		"react-perf/jsx-no-new-object-as-prop",
		"/virtual/main.jsx",
		source,
		nil,
	)
}
