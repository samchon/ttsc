package linthost

import ("testing"; shimast "github.com/microsoft/typescript-go/shim/ast")

// TestNoUnusedExpressionsPreservesMigratedDefaultControls verifies the two
// original findings and productive expressions, directives and default JSX.
//
// 1. Run the unchanged TSX control through the owning rule engine and require no
//    findings.
// 2. Run the in-process check operation over the annotated source and the TSX
//    control, and compare every rendered finding with the annotations.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run over the TSX control must yield no findings, then assertMigratedNoUnusedExpressionRendering runs the in-process check command over main.ts and default-jsx.tsx; the exact per-file comparison of rendered rule, severity and line detects a missed tagged-template or misplaced-directive report and any report on the productive calls, assignment, update, delete, void, await, yield, wrapper and directive-prologue lines, while the JSX file must stay silent. The helper also requires exit code 2, empty stdout and exactly two rendered TS17505 diagnostic codes.
// @evidence contracts/testing.md#independent-expectations The `// expect:` annotations in the main source require a finding at the tag`value` statement and at the parenthesized "use strict" that follows other statements in misplacedDirective; the JSX source has no annotation and so expects none. The literal exit code 2 and the two TS17505 codes are authored constants of the check command's rendered output, not computed from it.
// @evidence contracts/testing.md#distinguishing-cases Two inert expressions (tagged template, late parenthesized directive) are reported; productive controls and arbitrary-text directive prologues in the same file are not, and the default-mode JSX element statement in the TSX file is not.
// @evidence contracts/testing.md#execution-ownership TestNoUnusedExpressionsPreservesMigratedDefaultControls is an in-process Go unit test: Engine.Run on a parsed TSX file, then assertMigratedNoUnusedExpressionRendering, which seeds a temp project and calls the package's run check command with captured stdout and stderr. No child process, native artifact build or installed consumer is started.
func TestNoUnusedExpressionsPreservesMigratedDefaultControls(t *testing.T) {
 mainSource := "\"use client\";\n\"use arbitrary directive\";\n\ndeclare function work(): Promise<void>;\ndeclare function generic<T>(): T;\ndeclare const tag: (strings: TemplateStringsArray) => string;\nconst box: { value?: number } = {};\nlet counter = 0;\n\nwork();\nnew Error(\"productive construction\");\ncounter = 1;\ncounter++;\ndelete box.value;\nvoid work();\nwork() as Promise<void>;\nwork()!;\ngeneric<Promise<void>>();\n\nasync function later(): Promise<void> {\n  await work();\n}\n\nfunction* sequence(): Generator<Promise<void>, void, unknown> {\n  yield work();\n}\n\nvoid later;\nvoid sequence;\n\n// expect: no-unused-expressions error\ntag`value`;\n\nfunction misplacedDirective(): void {\n  \"use function directive\";\n  console.log(\"before\");\n  // expect: no-unused-expressions error\n  (\"use strict\");\n}\n\nmisplacedDirective();\n"
 jsxSource := "declare namespace JSX {\n  interface IntrinsicElements {\n    div: Record<string, never>;\n  }\n}\n\n<div />;\n"
 file := parseTSXFile(t, "/virtual/default-jsx.tsx", jsxSource)
 findings := NewEngine(RuleConfig{"no-unused-expressions":SeverityError}).Run([]*shimast.SourceFile{file},nil)
 if len(findings) != 0 {t.Fatalf("default JSX must stay clean: %+v",findings)}
 assertMigratedNoUnusedExpressionRendering(t, mainSource, jsxSource)
}
