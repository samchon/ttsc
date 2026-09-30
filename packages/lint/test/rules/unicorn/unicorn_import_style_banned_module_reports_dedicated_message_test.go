package linthost

import (
  "testing"
)

// TestUnicornImportStyleBannedModuleReportsDedicatedMessage verifies
// the misuse diagnostic: a module whose four canonical styles are all
// explicitly `false` reports upstream's banned-module message on every
// import form, with and without `extendDefaultStyles`.
//
// The banned set is computed from explicit `false` entries only, so a
// near-miss (one style merely omitted) must stay completely silent.
//
//  1. Ban a module and exercise every syntax family.
//  2. Assert the dedicated message on each form.
//  3. Assert the three-of-four near-miss produces no findings.
//
// @evidence contracts/testing.md#behavioral-verification The engine checks ten banned forms, inherited-table mode and an almost-banned clean counterpart.
// @evidence contracts/testing.md#independent-expectations Explicit false for all four canonical styles independently requires the authored banned-module message; omitted styles are not false.
// @evidence contracts/testing.md#distinguishing-cases Every original syntax family reports for banned, while three-of-four false almost-banned remains unrestricted.
// @evidence contracts/testing.md#execution-ownership TestUnicornImportStyleBannedModuleReportsDedicatedMessage owns these literal source/options variants as a discoverable Go unit entry; actual engine/config/fix functions execute in one shared Go process without installation, native producer or product child host, retaining named malformed subcases where present.
func TestUnicornImportStyleBannedModuleReportsDedicatedMessage(t *testing.T) {
  bannedOptions := `{
    "checkExportFrom": true,
    "extendDefaultStyles": false,
    "styles": {"banned": {"unassigned": false, "default": false, "namespace": false, "named": false}}
  }`
  source := `import "banned";
import foo from "banned";
import * as bar from "banned";
import { baz } from "banned";
import("banned");
require("banned");
const qux = require("banned");
async () => {
  const quux = await import("banned");
};
export { corge } from "banned";
export * from "banned";
void [foo, bar, baz, qux];
`
  findings := runUnicornImportStyleFindings(t, source, bannedOptions)
  message := "All import styles are disabled for module `banned`. Use the `no-restricted-imports` rule to disallow a module."
  if len(findings) != 10 {
    t.Fatalf("want 10 findings, got %d (%+v)", len(findings), findings)
  }
  for index, finding := range findings {
    if finding.message != message {
      t.Fatalf("finding[%d] message: want %q, got %q", index, message, finding.message)
    }
  }

  extendedFindings := runUnicornImportStyleFindings(
    t,
    "import \"banned\";\n",
    `{"styles": {"banned": {"unassigned": false, "default": false, "namespace": false, "named": false}}}`,
  )
  assertUnicornImportStyleFindings(t, extendedFindings, unicornImportStyleFinding{
    target:  `import "banned";`,
    message: message,
  })

  assertRuleSkipsSourceWithOptions(
    t,
    unicornImportStyleRuleName,
    "import foo from \"almost-banned\";\nvoid foo;\n",
    `{"styles": {"almost-banned": {"default": false, "namespace": false, "named": false}}}`,
  )
}
