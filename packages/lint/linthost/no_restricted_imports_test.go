package linthost

import "testing"

// TestRuleCorpusNoRestrictedImports verifies that enabling no-restricted-imports without
// options does not infer a project policy.
//
// @evidence contracts/testing.md#behavioral-verification Engine requires no findings for every original import and re-export with no configured restriction policy.
// @evidence contracts/testing.md#independent-expectations The empty-options contract supplies an independently empty result; neither lodash nor underscore is forbidden by name without a user policy.
// @evidence contracts/testing.md#distinguishing-cases Default/named re-export/namespace imports stay clean under missing options; TestNoRestrictedImportsExactPathsCoverEveryStaticModuleForm and pattern cases own configured positive counterparts.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoRestrictedImports is selected in the shared Go unit population. It calls assertRuleSkipsSource directly with all original import/re-export inputs and no-restricted-imports default options. No installed consumer, native artifact build or real product host runs.
func TestRuleCorpusNoRestrictedImports(t *testing.T) {
  assertRuleSkipsSource(t, "no-restricted-imports", "// No options means no project policy is inferred.\nimport _ from \"lodash\";\n\n// Re-exports are likewise unrestricted until paths or patterns are supplied.\nexport { isArray } from \"underscore\";\n\n// Arbitrary imports remain accepted.\nimport * as fs from \"node:fs\";\n\nvoid _;\nvoid fs;\n")
}
