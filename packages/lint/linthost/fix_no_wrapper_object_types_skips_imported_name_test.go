package linthost

import "testing"

// TestFixNoWrapperObjectTypesSkipsImportedName verifies the shadow bailout
// also covers an imported wrapper name.
//
// The guard recognizes the named import's local binding syntactically and
// suppresses reporting beside it. This parser-only fixture does not provide
// or resolve ./m, so it does not establish the imported symbol's type.
//
//  1. Parse a file that imports `String` and annotates with it.
//  2. Run the rule under the engine and confirm zero findings.
//  3. The imported `String` annotation survives byte-for-byte.
//
// @evidence contracts/testing.md#behavioral-verification The wrapper-type rule leaves an imported String name unreported.
// @evidence contracts/testing.md#independent-expectations The authored named import introduces a local alias; zero findings pin the supported syntactic binding policy without resolving the foreign module's type.
// @evidence contracts/testing.md#distinguishing-cases The named import triggers the bailout unlike the unshadowed String positive arm; module resolution and successful compilation are not certified.
// @evidence contracts/testing.md#execution-ownership TestFixNoWrapperObjectTypesSkipsImportedName invokes assertRuleSkipsSource on the named-import fixture.
func TestFixNoWrapperObjectTypesSkipsImportedName(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "typescript/no-wrapper-object-types",
    "import { String } from \"./m\";\nconst x: String = \"\" as unknown as String;\nJSON.stringify(x);\n",
  )
}
