package linthost

import (
  "encoding/json"
  "testing"
)

// TestUnicornPreventAbbreviationsChecksPhysicalFilenameWithoutOfferingEdits verifies that the engine checks exact idx.ts reporting and disabled filename silence, while actual filename helpers check dot/virtual-name boundaries.
//
// The supported idx->index dictionary and diagnostic-only filename policy independently require the literal message without source edits.
//
// 1. Execute the retained binding, filename, option or command variants.
// 2. Compare the authored diagnostic, edit, helper value or preserved source.
//
// @evidence contracts/testing.md#behavioral-verification The engine checks exact idx.ts reporting and disabled filename silence, while actual filename helpers check dot/virtual-name boundaries.
// @evidence contracts/testing.md#independent-expectations The supported idx->index dictionary and diagnostic-only filename policy independently require the literal message without source edits.
// @evidence contracts/testing.md#distinguishing-cases idx.ts reports without edits unless disabled; leading-dot, angle-bracket physical and input/text virtual names retain their distinctions.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsChecksPhysicalFilenameWithoutOfferingEdits owns its explicit variants and named subcases where present as a discoverable Go unit entry; actual checker/engine/fix/filename/casing operations run in the shared process with isolated fixture files and no installed consumer, native producer or product child host.
func TestUnicornPreventAbbreviationsChecksPhysicalFilenameWithoutOfferingEdits(t *testing.T) {
  _, _, findings := runRuleFindingsSnapshotFile(
    t,
    unicornPreventAbbreviationsRuleName,
    "idx.ts",
    "export {};\n",
    nil,
  )
  assertUnicornRuleErrorFindingIdentities(t, unicornPreventAbbreviationsRuleName, findings)
  if len(findings) != 1 || findings[0].Message != "The filename `idx.ts` should be named `index.ts`. A more descriptive name will do too." ||
    len(findings[0].Fix) != 0 || len(findings[0].Suggestions) != 0 {
    t.Fatalf("unexpected filename finding: %+v", findings)
  }
  _, _, findings = runRuleFindingsSnapshotFile(
    t,
    unicornPreventAbbreviationsRuleName,
    "idx.ts",
    "export {};\n",
    json.RawMessage(`{"checkFilenames":false}`),
  )
  if len(findings) != 0 {
    t.Fatalf("checkFilenames false should suppress filename findings: %+v", findings)
  }
  if extension := unicornPreventAbbreviationsFilenameExtension(".err"); extension != "" {
    t.Fatalf("leading-dot basename must not be treated as an extension: %q", extension)
  }

  if unicornPreventAbbreviationsIsVirtualFilename("foo<err>.ts") {
    t.Fatal("a physical filename containing angle brackets must not be treated as virtual")
  }

  for _, filename := range []string{"<input>", "<text>"} {
    if !unicornPreventAbbreviationsIsVirtualFilename(filename) {
      t.Fatalf("virtual filename %q must be recognized", filename)
    }
  }
}
