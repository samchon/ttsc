package linthost

import (
  "encoding/json"
  "testing"
)

// TestUnicornPreventAbbreviationsAppliesInternalImportDefaultsAndPreservesImportedNames verifies that the actual fixer checks authored internal import renames, and option-enabled/disabled runs retain their finding counts.
//
// The supported internal/external import policy independently chooses which local bindings rename while imported export names remain unchanged.
//
// @evidence contracts/testing.md#behavioral-verification The actual fixer checks authored internal import renames, and option-enabled/disabled runs retain their finding counts.
// @evidence contracts/testing.md#independent-expectations The supported internal/external import policy independently chooses which local bindings rename while imported export names remain unchanged.
// @evidence contracts/testing.md#distinguishing-cases Internal default/named rename by default; external namespace/default/named and both explicit control modes retain their distinctions.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsAppliesInternalImportDefaultsAndPreservesImportedNames owns its explicit variants and named subcases where present as a discoverable Go unit entry; Checker-backed rule snapshots and actual disk fix application run in the shared Go process with isolated authored fixture files; no installed consumer, native producer or product child host runs.
func TestUnicornPreventAbbreviationsAppliesInternalImportDefaultsAndPreservesImportedNames(t *testing.T) {
  source := "import err from \"./local-default\";\nimport * as ctx from \"external-ns\";\nimport doc from \"./node_modules/external-default\";\nimport { prop } from \"./local-named\";\nimport { ref } from \"external-named\";\nvoid [err, ctx, doc, prop, ref];\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "import error from \"./local-default\";\nimport * as ctx from \"external-ns\";\nimport doc from \"./node_modules/external-default\";\nimport { prop as property } from \"./local-named\";\nimport { ref } from \"external-named\";\nvoid [error, ctx, doc, property, ref];\n",
  )
  _, _, findings := runRuleFindingsSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    json.RawMessage(`{"checkDefaultAndNamespaceImports":true,"checkShorthandImports":true}`),
  )
  assertUnicornRuleErrorFindingIdentities(t, unicornPreventAbbreviationsRuleName, findings)
  if len(findings) != 5 {
    t.Fatalf("expected all five imports when enabled, got %d (%+v)", len(findings), findings)
  }
  assertRuleSkipsSourceWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    `{"checkDefaultAndNamespaceImports":false,"checkShorthandImports":false}`,
  )
}
