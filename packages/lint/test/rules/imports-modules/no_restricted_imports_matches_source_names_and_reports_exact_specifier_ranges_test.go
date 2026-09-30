package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestNoRestrictedImportsMatchesSourceNamesAndReportsExactSpecifierRanges verifies Restricted named imports match exported source names despite local aliases, and namespace/star imports expose the restricted set.
//
// Pins the distinct option, syntax or failure branch represented by this fixture.
//
// 1. Supply the authored source and configuration inputs.
// 2. Run the owning engine or command operation in this process.
// 3. Compare the literal findings, messages or failure state below.
//
// @evidence contracts/testing.md#behavioral-verification Restricted named imports match exported source names despite local aliases, and namespace/star imports expose the restricted set.
// @evidence contracts/testing.md#independent-expectations The literal default and source option names identify seven authored source substrings; message fragments require source names rather than local alias spelling.
// @evidence contracts/testing.md#distinguishing-cases Default/named aliases, named reexports, namespaces and export-all report; allowed named bindings and a bare side effect stay clean.
// @evidence contracts/testing.md#execution-ownership runNoRestrictedImports calls runRuleFindingsSnapshot for this entry's authored source/options and validates rule, ranges and absence of edits. assertNoRestrictedImportsTargets compares the displayed literal target list; this Test owns every invocation and message assertion in the Go process.
func TestNoRestrictedImportsMatchesSourceNamesAndReportsExactSpecifierRanges(t *testing.T) {
  source := `import Default, { source as alias, allowed } from "pkg";
import * as namespace from "pkg";
export { source as renamed, allowed } from "pkg";
export { default as exportedDefault } from "pkg";
export * from "pkg";
export * as exportedNamespace from "pkg";
import "pkg";
void Default;
void namespace;
`
  findings := runNoRestrictedImports(
    t,
    source,
    json.RawMessage(`{"paths":[{"name":"pkg","importNames":["default","source"]}]}`),
  )
  assertNoRestrictedImportsTargets(
    t,
    findings,
    "Default",
    "source as alias",
    "* as namespace",
    "source as renamed",
    "default as exportedDefault",
    "*",
    "*",
  )
  if !strings.Contains(findings[0].message, "'default' import from 'pkg' is restricted") ||
    !strings.Contains(findings[1].message, "'source' import from 'pkg' is restricted") {
    t.Fatalf("aliases were matched by local rather than source names: %+v", findings)
  }
  for _, index := range []int{2, 5, 6} {
    if !strings.Contains(findings[index].message, "* import is invalid because 'default' and 'source' from 'pkg' are restricted") {
      t.Fatalf("namespace diagnostic mismatch: %+v", findings[index])
    }
  }
}
