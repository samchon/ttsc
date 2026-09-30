package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedImportsExactPathsCoverEveryStaticModuleForm verifies The restricted-import engine reports each of eight static blocked module forms and preserves the exact custom message.
//
// Pins the distinct option, syntax or failure branch represented by this fixture.
//
// 1. Supply the authored source and configuration inputs.
// 2. Run the owning engine or command operation in this process.
// 3. Compare the literal findings, messages or failure state below.
//
// @evidence contracts/testing.md#behavioral-verification The restricted-import engine reports each of eight static blocked module forms and preserves the exact custom message.
// @evidence contracts/testing.md#independent-expectations A paths entry naming blocked forbids the module operation regardless of declaration syntax; eight literal quoted targets and the authored message are independent expectations.
// @evidence contracts/testing.md#distinguishing-cases Default, aliased named, namespace, side-effect, named/star/namespace reexports and import-equals report; allowed remains clean.
// @evidence contracts/testing.md#execution-ownership runNoRestrictedImports calls runRuleFindingsSnapshot for this entry's authored source/options and validates rule, ranges and absence of edits. assertNoRestrictedImportsTargets compares the displayed literal target list; this Test owns every invocation and message assertion in the Go process.
func TestNoRestrictedImportsExactPathsCoverEveryStaticModuleForm(t *testing.T) {
  source := `import Default from "blocked";
import { source as alias } from "blocked";
import * as namespace from "blocked";
import "blocked";
export { source as renamed } from "blocked";
export * from "blocked";
export * as exportedNamespace from "blocked";
import legacy = require("blocked");
import allowed from "allowed";
void Default;
void namespace;
void legacy;
void allowed;
`
  findings := runNoRestrictedImports(
    t,
    source,
    json.RawMessage(`{"paths":[{"name":"blocked","message":"Use the supported boundary instead."}]}`),
  )
  assertNoRestrictedImportsTargets(
    t,
    findings,
    `"blocked"`,
    `"blocked"`,
    `"blocked"`,
    `"blocked"`,
    `"blocked"`,
    `"blocked"`,
    `"blocked"`,
    `"blocked"`,
  )
  for _, finding := range findings {
    if finding.message != "'blocked' import is restricted from being used. Use the supported boundary instead." {
      t.Fatalf("unexpected exact-path message: %+v", finding)
    }
  }
}
