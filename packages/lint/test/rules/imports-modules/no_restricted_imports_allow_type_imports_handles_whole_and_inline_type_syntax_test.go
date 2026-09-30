package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedImportsAllowTypeImportsHandlesWholeAndInlineTypeSyntax verifies Type import exemptions distinguish whole declarations and inline specifiers from remaining value imports and reexports.
//
// Pins the distinct option, syntax or failure branch represented by this fixture.
//
// 1. Supply the authored source and configuration inputs.
// 2. Run the owning engine or command operation in this process.
// 3. Compare the literal findings, messages or failure state below.
//
// @evidence contracts/testing.md#behavioral-verification Type import exemptions distinguish whole declarations and inline specifiers from remaining value imports and reexports.
// @evidence contracts/testing.md#independent-expectations allowTypeImports exempts type-only names while the authored options still forbid value exposure. The literal target list requires two whole-module types targets and two Bar specifiers.
// @evidence contracts/testing.md#distinguishing-cases Clause and inline type imports, mixed clauses, type reexports, export-type-star and import-equals controls coexist with named Bar and default Value violations.
// @evidence contracts/testing.md#execution-ownership runNoRestrictedImports calls runRuleFindingsSnapshot for this entry's authored source/options and validates rule, ranges and absence of edits. assertNoRestrictedImportsTargets compares the displayed literal target list; this Test owns every invocation and message assertion in the Go process.
func TestNoRestrictedImportsAllowTypeImportsHandlesWholeAndInlineTypeSyntax(t *testing.T) {
  source := `import type { Foo } from "types";
import { type Foo } from "types";
import { type Foo, Bar } from "types";
export type { Foo } from "types";
export { type Foo } from "types";
export type * from "types";
import type Legacy = require("types");
import { type Foo, Bar } from "names";
export { type Foo, Bar } from "names";
import Value from "types";
void Bar;
void Value;
`
  findings := runNoRestrictedImports(
    t,
    source,
    json.RawMessage(`{"paths":[{"name":"types","allowTypeImports":true},{"name":"names","importNames":["Foo","Bar"],"allowTypeImports":true}]}`),
  )
  assertNoRestrictedImportsTargets(t, findings, `"types"`, "Bar", "Bar", `"types"`)
}
