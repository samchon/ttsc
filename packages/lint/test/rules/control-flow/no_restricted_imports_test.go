package linthost

import "testing"

// TestRuleCorpusNoRestrictedImports verifies that enabling no-restricted-imports without
// options does not infer a project policy from the corpus fixture.
func TestRuleCorpusNoRestrictedImports(t *testing.T) {
  assertRuleSkipsSource(t, "no-restricted-imports", "// No options means no project policy is inferred.\nimport _ from \"lodash\";\n\n// Re-exports are likewise unrestricted until paths or patterns are supplied.\nexport { isArray } from \"underscore\";\n\n// Arbitrary imports remain accepted.\nimport * as fs from \"node:fs\";\n\nvoid _;\nvoid fs;\n")
}
