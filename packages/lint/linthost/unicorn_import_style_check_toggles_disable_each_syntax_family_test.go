package linthost

import (
  "testing"
)

// TestUnicornImportStyleCheckTogglesDisableEachSyntaxFamily verifies
// the four `check*` switches: each one silences exactly its own syntax
// family, and `checkExportFrom` defaults to off.
//
// A port wiring a toggle to the wrong listener (for example
// `checkDynamicImport` to the declarator path only) would pass a
// smoke test but fail one of these targeted probes.
//
//  1. Violate one family per toggle with the toggle disabled.
//  2. Assert zero findings for each.
//  3. Re-enable `checkExportFrom` and assert the export is reported.
//
// @evidence contracts/testing.md#behavioral-verification The engine checks each disabled syntax family and the enabled export counterpart.
// @evidence contracts/testing.md#independent-expectations The supported independent checkImport/checkDynamicImport/checkRequire/checkExportFrom switches establish silence only for their own families.
// @evidence contracts/testing.md#distinguishing-cases Disabled import/dynamic/require forms and default-off export stay clean; explicitly enabled export reports.
// @evidence contracts/testing.md#execution-ownership TestUnicornImportStyleCheckTogglesDisableEachSyntaxFamily owns these literal source/options variants as a discoverable Go unit entry; actual engine/config/fix functions execute in one shared Go process without installation, native producer or product child host, retaining named malformed subcases where present.
func TestUnicornImportStyleCheckTogglesDisableEachSyntaxFamily(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    unicornImportStyleRuleName,
    "import \"chalk\";\n",
    `{"checkImport": false}`,
  )
  assertRuleSkipsSourceWithOptions(
    t,
    unicornImportStyleRuleName,
    `import("chalk");
async () => {
  const { red } = await import("chalk");
  void red;
};
`,
    `{"checkDynamicImport": false}`,
  )
  assertRuleSkipsSourceWithOptions(
    t,
    unicornImportStyleRuleName,
    `require("chalk");
const { red } = require("chalk");
void red;
`,
    `{"checkRequire": false}`,
  )
  assertRuleSkipsSource(t, unicornImportStyleRuleName, "export * from \"util\";\n")

  findings := runUnicornImportStyleFindings(
    t,
    "export * from \"util\";\n",
    `{"checkExportFrom": true}`,
  )
  assertUnicornImportStyleFindings(t, findings, unicornImportStyleFinding{
    target:  `export * from "util";`,
    message: "Use named import for module `util`.",
  })
}
