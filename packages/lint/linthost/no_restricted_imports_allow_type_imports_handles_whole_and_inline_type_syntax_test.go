package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedImportsAllowTypeImportsHandlesWholeAndInlineTypeSyntax
// verifies allowTypeImports exempts whole type-only declarations and inline
// type specifiers while value imports and reexports of the same modules are
// still reported.
//
// The "types" path is restricted outright with allowTypeImports; the "names"
// path restricts importNames Foo and Bar with allowTypeImports. The source mixes
// `import type`, inline `type` specifiers, `export type`, `export type *`,
// `import type … = require` and plain value forms.
//
// 1. Run the rule with the two path entries.
// 2. Compare the reported ranges with the literal list.
//
// @evidence contracts/testing.md#behavioral-verification For the "types" path the clause-level type forms (import type, mixed inline-type-only import, export type, inline export type, export type *, import type = require) are skipped and the lines 3 and 10 declarations are reported at their module specifiers; for the "names" path the inline type Foo specifiers are skipped and the value Bar specifiers of the import and the reexport are reported.
// @evidence contracts/testing.md#independent-expectations allowTypeImports exempts only type-only usage, so a declaration that still carries a value name remains restricted. The expected list is four literals in source order: the line 3 and line 10 "types" specifiers and the two Bar specifiers.
// @evidence contracts/testing.md#distinguishing-cases Whole-declaration type forms, inline type specifiers, a mixed clause with a value specifier (line 3), a plain default import (line 10) and the "names" path with a value name Bar all appear in one source, so exempting every declaration of the module or ignoring inline type syntax changes the result.
// @evidence contracts/testing.md#execution-ownership runNoRestrictedImports calls runRuleFindingsSnapshot, which binds the rule at error severity, parses the source in a temporary project and runs Engine.Run in the Go test process, then rejects other rules, edits and invalid ranges. assertNoRestrictedImportsTargets compares the four literal ranges; the Test asserts no messages.
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
