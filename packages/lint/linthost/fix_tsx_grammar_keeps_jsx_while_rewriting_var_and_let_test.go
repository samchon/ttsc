package linthost

import "testing"

// TestFixTSXGrammarKeepsJSXWhileRewritingVarAndLet verifies that the no-var and
// prefer-const fixers rewrite a source whose filename selects the TSX grammar
// without disturbing its JSX element.
//
// A `.tsx` source needs the JSX-aware parser, and the two rules take different
// lifecycles: no-var is AST-only, while prefer-const needs the checker of a real
// Program. Both must still change only their declaration keyword.
//
//  1. Fix a `var` declared beside `<div />` in component.tsx.
//  2. Fix a never-reassigned `let` declared beside `<div />` in component.tsx.
//  3. Assert only the keyword of each declaration changed.
//
// @evidence contracts/testing.md#behavioral-verification no-var rewrites var to let and prefer-const rewrites let to const in component.tsx while the JSX element and the surrounding statements stay byte-identical.
// @evidence contracts/testing.md#independent-expectations The literal expected sources change exactly one declaration keyword each, following the no-var and prefer-const fixing contracts rather than the emitted edits.
// @evidence contracts/testing.md#distinguishing-cases An AST-only rule and a checker-requiring rule are both exercised on TSX input; reassigned-binding and unsafe-scope boundaries of each rule belong to their own fix tests.
// @evidence contracts/testing.md#execution-ownership TestFixTSXGrammarKeepsJSXWhileRewritingVarAndLet calls assertFixSnapshotFile twice in the Go unit process, once on the parser path and once through loadProgram with a real checker; no consumer install or child host runs.
func TestFixTSXGrammarKeepsJSXWhileRewritingVarAndLet(t *testing.T) {
  assertFixSnapshotFile(
    t,
    "no-var",
    "component.tsx",
    "var legacy = 1;\nconst view = <div />;\nJSON.stringify([legacy, view]);\nexport {};\n",
    "let legacy = 1;\nconst view = <div />;\nJSON.stringify([legacy, view]);\nexport {};\n",
  )
  assertFixSnapshotFile(
    t,
    "prefer-const",
    "component.tsx",
    "const view = <div />;\nlet stable = 1;\nJSON.stringify([view, stable]);\n",
    "const view = <div />;\nconst stable = 1;\nJSON.stringify([view, stable]);\n",
  )
}
