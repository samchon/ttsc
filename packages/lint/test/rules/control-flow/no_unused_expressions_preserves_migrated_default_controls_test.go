package linthost

import ("testing"; shimast "github.com/microsoft/typescript-go/shim/ast")

// TestNoUnusedExpressionsPreservesMigratedDefaultControls verifies the two
// original findings and productive expressions, directives and default JSX.
//
// 1. Compare the annotated source through the owning rule engine.
// 2. Run the unchanged TSX control and require no findings.
//
// @evidence contracts/testing.md#behavioral-verification Calls Engine through assertRuleCorpusCase and Run on the TSX source, then the owning check operation; the exact comparison detects omissions or reports on productive calls, assignments, delete, void, await, yield and directives, while JSX must remain silent and the original two rendered TS17505 errors and exit code two are preserved.
// @evidence contracts/testing.md#independent-expectations The original authored annotations require a tagged-template and misplaced-directive finding; default JSX remains independently clean. The former consumer case's literal two TS17505 codes and exit code two are preserved as the rendering oracle.
// @evidence contracts/testing.md#distinguishing-cases Two inert expressions contrast with productive controls and arbitrary directive prologues; the unchanged JSX file preserves the separate grammar-sensitive negative case.
// @evidence contracts/testing.md#execution-ownership TestNoUnusedExpressionsPreservesMigratedDefaultControls runs the AST Engine and assertMigratedNoUnusedExpressionRendering, invoking the in-process check operation with both original source files and compiler options. No contributor artifact, CLI child or installed consumer runs; package auto-discovery and native transport belong to the surviving E2E batch.
func TestNoUnusedExpressionsPreservesMigratedDefaultControls(t *testing.T) {
 mainSource := "\"use client\";\n\"use arbitrary directive\";\n\ndeclare function work(): Promise<void>;\ndeclare function generic<T>(): T;\ndeclare const tag: (strings: TemplateStringsArray) => string;\nconst box: { value?: number } = {};\nlet counter = 0;\n\nwork();\nnew Error(\"productive construction\");\ncounter = 1;\ncounter++;\ndelete box.value;\nvoid work();\nwork() as Promise<void>;\nwork()!;\ngeneric<Promise<void>>();\n\nasync function later(): Promise<void> {\n  await work();\n}\n\nfunction* sequence(): Generator<Promise<void>, void, unknown> {\n  yield work();\n}\n\nvoid later;\nvoid sequence;\n\n// expect: no-unused-expressions error\ntag`value`;\n\nfunction misplacedDirective(): void {\n  \"use function directive\";\n  console.log(\"before\");\n  // expect: no-unused-expressions error\n  (\"use strict\");\n}\n\nmisplacedDirective();\n"
 assertRuleCorpusCase(t, "main.ts", mainSource)
 jsxSource := "declare namespace JSX {\n  interface IntrinsicElements {\n    div: Record<string, never>;\n  }\n}\n\n<div />;\n"
 file := parseTSXFile(t, "/virtual/default-jsx.tsx", jsxSource)
 findings := NewEngine(RuleConfig{"no-unused-expressions":SeverityError}).Run([]*shimast.SourceFile{file},nil)
 if len(findings) != 0 {t.Fatalf("default JSX must stay clean: %+v",findings)}
 assertMigratedNoUnusedExpressionRendering(t, mainSource, jsxSource)
}
