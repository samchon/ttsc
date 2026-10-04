package linthost

import (
  "testing"
)

// TestSourceExtensionTablesSeparateSelectionFromWidening verifies the two
// extension tables stay distinct.
//
// A project's own selection may name JavaScript, because a project that lists
// `.js` under `allowJs` owns it. Imported-source widening excludes JavaScript,
// so an imported JavaScript file outside the project's selected roots is not
// admitted through that lane. The tables are adjacent functions differing by
// the JavaScript suffixes, so an edit that unified them would silently widen
// lint onto imported JavaScript (samchon/ttsc#1065). This case guards that.
//
// 1. Assert every TypeScript source extension satisfies both tables.
// 2. Assert every JavaScript extension satisfies selection but not widening.
// 3. Assert non-source extensions satisfy neither.
//
// @evidence contracts/testing.md#behavioral-verification Actual source-selection predicates accept all four TypeScript extensions in both lanes, accept all four JavaScript extensions only for explicit project selection, and reject authored nonsource suffixes in both lanes; case variants preserve classification.
// @evidence contracts/testing.md#independent-expectations Explicit project ownership may include JavaScript, but imported-source widening is TypeScript-only. Literal TS/JS/nonsource filenames define the policy inputs independently of the two returned classifications.
// @evidence contracts/testing.md#distinguishing-cases TS/TSX/MTS/CTS contrast with JS/JSX/MJS/CJS, mixed-case names test normalization, and JSON/Markdown/buildinfo/extensionless/source-map inputs reject loose suffix matching. This unit does not claim declaration-file exclusion, which uses a separate AST flag.
// @evidence contracts/testing.md#execution-ownership Direct filename-predicate calls run in-process on authored strings; they exercise product selection policy without reading repository filenames, asserting package existence, compiling native hosts or installing consumers.
func TestSourceExtensionTablesSeparateSelectionFromWidening(t *testing.T) {
  for _, name := range []string{"a.ts", "a.tsx", "a.mts", "a.cts", "A.TS", "A.Tsx"} {
    if !isTypeScriptSourceFileName(name) || !isLintSourceFileName(name) {
      t.Fatalf("%q must be both a selectable and a widenable source", name)
    }
  }
  for _, name := range []string{"a.js", "a.jsx", "a.mjs", "a.cjs", "A.JS"} {
    if isTypeScriptSourceFileName(name) {
      t.Fatalf("%q must not widen the read scope", name)
    }
    if !isLintSourceFileName(name) {
      t.Fatalf("%q must remain selectable by the project", name)
    }
  }
  for _, name := range []string{"a.json", "a.md", "a.tsbuildinfo", "a", "a.tsx.map"} {
    if isTypeScriptSourceFileName(name) || isLintSourceFileName(name) {
      t.Fatalf("%q is not a lint source under either table", name)
    }
  }
}
