package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatSortImportsPreservesSideEffectImports verifies the rule
// declines to sort a block that contains a side-effect-only import.
//
// `import "./polyfill"` runs the polyfill's top-level code for its
// observable effect (e.g. installing globals). A later value import may
// depend on that effect having already run, so sorting it lexically
// next to other specifiers can silently change runtime behavior. The
// rule's safety policy matches the comment-trivia bail: refuse to
// reorder the block when correctness can't be locally proven.
//
//  1. Parse a source with mixed side-effect and value imports in an
//     order the lexical sort would change.
//  2. Run formatSortImports.
//  3. Assert zero findings, preserving the block's source order.
//
// @evidence contracts/testing.md#behavioral-verification The original mixed polyfill/shim/value block must remain silent, and a reversed namespace dependency block must also emit no findings with safe defaults. The exact original default-plus-named b-before-namespace a module also remains edit-free; its existing runtime actor owns the independently authored b,a output.
// @evidence contracts/testing.md#independent-expectations The public safe mode preserves runtime dependency order because module top-level effects can be observed. Zero findings independently forbids declaration edits rather than assuming a dependency is pure.
// @evidence contracts/testing.md#distinguishing-cases The mixed block covers bare side-effect, named and default imports; a separate namespace pair covers that runtime syntax. The explicit unsafe bare-import unit supplies a permitted reorder positive. The binding-only case has no bare side-effect import and therefore distinguishes preserving effectful bindings from recognizing bare syntax alone.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsPreservesSideEffectImports owns its literal mixed-runtime input and direct engine zero-finding assertion plus the authored namespace and exact binding-only boundaries in the selected public Go unit population. The same binding-only main.mjs bytes execute through the existing test_e2e_runtime_batch actor rather than a new Node child. Parsing, owning syntax rule and fixture observations execute in one Go process without native builds, consumer installation or real product-host children.
func TestFormatSortImportsPreservesSideEffectImports(t *testing.T) {
  source := "import \"./polyfill\";\n" +
    "import { reduce } from \"./local-a\";\n" +
    "import \"./shim\";\n" +
    "import alpha from \"alpha\";\n" +
    "JSON.stringify({ reduce, alpha });\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{"format/sort-imports": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings (side-effect imports inhibit sort), got %d:\n%v",
      len(findings), findings)
  }
  assertRuleSkipsSource(t, "format/sort-imports", "import * as zebra from \"./z\";\nimport * as alpha from \"./a\";\nconsole.log(zebra, alpha);\n")
  bindingSource := `import bDefault, { bNamed } from "./b.mjs";
import * as aNamespace from "./a.mjs";
console.log(globalThis.__sortImportsTrace.join(","));
void bDefault;
void bNamed;
void aNamespace;
`
  bindingFile := parseTSFile(t, "/virtual/main.mjs", bindingSource)
  bindingFindings := NewEngine(RuleConfig{"format/sort-imports": SeverityError}).
    Run([]*shimast.SourceFile{bindingFile}, nil)
  if len(bindingFindings) != 0 {
    t.Fatalf("binding-only imports must preserve b-before-a order: findings=%+v", bindingFindings)
  }
}
