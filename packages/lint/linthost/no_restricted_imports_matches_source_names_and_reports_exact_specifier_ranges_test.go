package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestNoRestrictedImportsMatchesSourceNamesAndReportsExactSpecifierRanges
// verifies importNames restrictions match the exported source name rather than
// the local alias, and that namespace and star forms expose the restricted set.
//
// The path "pkg" restricts importNames "default" and "source". The source has a
// default import, an aliased `source`, an allowed named import, a namespace
// import, named and default reexports, `export *`, `export * as`, and a bare
// side-effect import.
//
// 1. Run the rule with the importNames path.
// 2. Compare the seven reported ranges with the literal list.
// 3. Check the message of the default and source specifiers and of each star-like finding.
//
// @evidence contracts/testing.md#behavioral-verification The default binding, `source as alias`, the namespace import, `source as renamed`, `default as exportedDefault`, `export *` and `export * as` are reported at their specifier ranges (the star findings cover only the asterisk); `allowed` specifiers and the bare `import "pkg"` are not. Messages name the source names default and source, not the local aliases, and the three star-like findings use the namespace message.
// @evidence contracts/testing.md#independent-expectations importNames restricts exported names, so a renamed local binding stays restricted. The seven literal ranges and the message fragments "'default' import from 'pkg' is restricted", "'source' import from 'pkg' is restricted" and "* import is invalid because 'default' and 'source' from 'pkg' are restricted" are authored literals.
// @evidence contracts/testing.md#distinguishing-cases Default and aliased named imports, named and default reexports, a namespace import and two star reexports report; the allowed named bindings and a bare side-effect import of the same module stay clean.
// @evidence contracts/testing.md#execution-ownership runNoRestrictedImports calls runRuleFindingsSnapshot, which binds the rule at error severity, parses the source in a temporary project and runs Engine.Run in the Go test process, then rejects other rules, edits and invalid ranges. assertNoRestrictedImportsTargets compares the seven literal spellings; the Test separately pins both repeated star offsets and checks the message of findings 0, 1, 2, 5 and 6.
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
  expectedStars := []int{
    strings.Index(source, "export * from ") + len("export "),
    strings.Index(source, "export * as exportedNamespace from ") + len("export "),
  }
  for index, expected := range expectedStars {
    if findings[index+5].pos != expected {
      t.Fatalf("star finding[%d] position = %d, want %d: %+v", index, findings[index+5].pos, expected, findings[index+5])
    }
  }
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
