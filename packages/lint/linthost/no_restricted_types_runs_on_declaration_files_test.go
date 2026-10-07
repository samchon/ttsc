package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedTypesRunsOnDeclarationFiles verifies no-restricted-types
// inspects declaration files.
//
// Declaration-file annotations are type syntax the rule must reach.
//
//  1. Parse a types.d.ts file using a banned Banned type.
//  2. Run the rule with Banned restricted.
//  3. Assert one exact-range error with the default message.
//
// @evidence contracts/testing.md#behavioral-verification Restrictions must inspect declaration-file annotations.
// @evidence contracts/testing.md#independent-expectations The authored Banned span in types.d.ts fixes one exact-range error and default message.
// @evidence contracts/testing.md#distinguishing-cases The d.ts path exercises declaration syntax; ordinary source is independently covered in the configured surface corpus.
// @evidence contracts/testing.md#execution-ownership TestNoRestrictedTypesRunsOnDeclarationFiles invokes the registered rule over an in-process parsed source through runRuleFindingsSnapshotFile; no native plugin build, compiler child or installation is involved.
func TestNoRestrictedTypesRunsOnDeclarationFiles(t *testing.T) {
  _, _, findings := runRuleFindingsSnapshotFile(
    t,
    noRestrictedTypesRuleName,
    "types.d.ts",
    "declare const value: Banned;\n",
    json.RawMessage(`{"types":{"Banned":true}}`),
  )
  if len(findings) != 1 || findings[0].Message != "Don't use `Banned` as a type." {
    t.Fatalf("declaration findings = %+v", findings)
  }
  start := len("declare const value: ")
  if findings[0].Rule != noRestrictedTypesRuleName || findings[0].Severity != SeverityError || findings[0].Pos != start || findings[0].End != start+len("Banned") {
    t.Fatalf("declaration restriction range = %+v", findings[0])
  }
}
