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
//
// @evidence contracts/testing.md#behavioral-verification NewEngineWithResolver.Run via the reactPerf assertion helpers verifies an allocating prop under a .jsx filename produces no findings; exact finding-line comparison rejects extra or missing diagnostics for react-perf/jsx-no-new-object-as-prop.
// @evidence contracts/testing.md#independent-expectations The explicit TypeScript-only rule-family contract accepts this .jsx source despite matching JSX syntax.
// @evidence contracts/testing.md#distinguishing-cases This pins the supported TSX-only adoption guard; TestReactPerfJsxNoNewObjectAsProp owns the equivalent reported TSX expression.
// @evidence contracts/testing.md#execution-ownership TestReactPerfRulesSkipJsxSource owns this authored .jsx filename case under default rule options as one Go unit entry; TSX parsing and actual engine execution share the Go test process without installing React or starting a product host.
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
