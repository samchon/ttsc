package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedImportsExactPathsCoverEveryStaticModuleForm verifies an exact
// restricted path is reported at the module specifier of every static form that
// loads the module, with the custom message appended.
//
// The source loads "blocked" through a default import, an aliased named import,
// a namespace import, a bare side-effect import, a named reexport, `export *`,
// `export * as`, and `import … = require`; "allowed" is imported once as a control.
//
// 1. Run the rule with a paths entry for "blocked" carrying a message.
// 2. Compare the eight reported ranges with the literal list.
// 3. Require every message to equal the exact path message plus the custom text.
//
// @evidence contracts/testing.md#behavioral-verification The rule reports eight findings, one at the "blocked" specifier of each of the eight authored forms, and none for the "allowed" import. Every message equals the exact-path message followed by the custom message.
// @evidence contracts/testing.md#independent-expectations A paths entry naming "blocked" forbids loading that module regardless of declaration syntax. Eight literal quoted targets and the full literal message text are authored independently of the rule output.
// @evidence contracts/testing.md#distinguishing-cases Default, aliased named, namespace, side-effect, named reexport, star reexport, namespace reexport and import-equals forms report; the allowed module in the same source stays clean.
// @evidence contracts/testing.md#execution-ownership runNoRestrictedImports calls runRuleFindingsSnapshot, which binds the rule at error severity, parses the source in a temporary project and runs Engine.Run in the Go test process, then rejects other rules, edits and invalid ranges. assertNoRestrictedImportsTargets compares the eight literal ranges, and the loop in the Test body compares each full message.
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
