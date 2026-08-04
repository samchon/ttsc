package linthost

import (
  "testing"
)

// TestSourceExtensionTablesSeparateSelectionFromWidening verifies the two
// extension tables stay distinct.
//
// A project's own selection may name JavaScript, because a project that lists
// `.js` under `allowJs` owns it. The widening may not: JavaScript reaches the
// Program only when an import pulls it in, and lint would then judge a file the
// project never chose. The two tables are adjacent functions differing only by
// the JavaScript suffixes, so an edit that unified them would silently widen
// lint onto imported JavaScript (samchon/ttsc#1065). This case guards that.
//
// 1. Assert every TypeScript source extension satisfies both tables.
// 2. Assert every JavaScript extension satisfies selection but not widening.
// 3. Assert non-source extensions satisfy neither.
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
