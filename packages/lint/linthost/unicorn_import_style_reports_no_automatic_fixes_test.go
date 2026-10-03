package linthost

import (
  "testing"
)

// TestUnicornImportStyleReportsNoAutomaticFixes verifies the rule is
// diagnostic-only through the real fix applier: a violation yields a
// finding but `ttsc fix` applies nothing and the source is unchanged.
//
// Upstream ships no fixer for this rule; an accidental edit here would
// rewrite user imports non-semantically.
//
//  1. Violate the default `util` policy.
//  2. Run the fix pipeline.
//  3. Assert zero applied fixes and byte-identical source.
//
// @evidence contracts/testing.md#behavioral-verification The engine now requires the exact default-util diagnostic, and the original fix pipeline must apply zero edits and preserve source.
// @evidence contracts/testing.md#independent-expectations The supported util named-only policy independently requires its authored finding, while the diagnostic-only rule independently forbids automatic import rewrites.
// @evidence contracts/testing.md#distinguishing-cases The default util violation must both report and remain byte-identical; compliant imports belong to default-policy clean hosts.
// @evidence contracts/testing.md#execution-ownership TestUnicornImportStyleReportsNoAutomaticFixes owns these literal source/options variants as a discoverable Go unit entry; actual engine/config/fix functions execute in one shared Go process without installation, native producer or product child host, retaining named malformed subcases where present.
func TestUnicornImportStyleReportsNoAutomaticFixes(t *testing.T) {
  assertUnicornImportStyleFindings(t,
    runUnicornImportStyleFindings(t, "import util from \"util\";\nvoid util;\n", ""),
    unicornImportStyleFinding{
      target: `import util from "util";`,
      message: "Use named import for module `util`.",
    },
  )
  assertNoFixSnapshot(t, unicornImportStyleRuleName, "import util from \"util\";\nvoid util;\n")
}
