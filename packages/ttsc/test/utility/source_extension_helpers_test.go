package ttsc_test

import "testing"

// TestUtilitySourceExtensionHelpersPreferCompoundExtensions verifies source
// extension helpers handle declaration and module suffixes before generic
// extensions.
//
// Paths rewriting relies on these helpers when it records source stems and when
// it predicts emitted JavaScript names. Compound declaration suffixes must be
// removed as one logical extension.
//
// This scenario keeps the exact helper semantics covered from the package test
// tree. The link binding is limited to deterministic string helpers that do not
// require package-local state.
//
// 1. Strip known source extensions from declaration, module, and JSX names.
// 2. Replace a declaration source extension with a JavaScript extension.
// 3. Assert emitted extension selection for `.mts`, `.cts`, and normal TS.
func TestUtilitySourceExtensionHelpersPreferCompoundExtensions(t *testing.T) {
  cases := map[string]string{
    "types.d.ts":     "types",
    "types.d.mts":    "types",
    "module.test.ts": "module.test",
    "entry.jsx":      "entry",
  }
  for input, want := range cases {
    if got := utilityStripKnownSourceExtension(input); got != want {
      t.Fatalf("stripKnownSourceExtension(%q) = %q, want %q", input, got, want)
    }
  }
  if got := utilityReplaceSourceExtension("types.d.ts", ".js"); got != "types.js" {
    t.Fatalf("replaceSourceExtension() = %q, want %q", got, "types.js")
  }
  emitted := map[string]string{
    "entry.mts": ".mjs",
    "entry.cts": ".cjs",
    "entry.tsx": ".js",
  }
  for input, want := range emitted {
    if got := utilityEmittedJavaScriptExtension(input); got != want {
      t.Fatalf("emittedJavaScriptExtension(%q) = %q, want %q", input, got, want)
    }
  }
}
