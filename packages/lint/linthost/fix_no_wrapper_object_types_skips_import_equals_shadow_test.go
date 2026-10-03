package linthost

import "testing"

// TestFixNoWrapperObjectTypesSkipsImportEqualsShadow verifies the shadow
// bailout also covers an `import String = require(...)` binding.
//
// The guard recognizes the local import-equals alias syntactically and
// suppresses reporting beside it. This parser-only fixture does not provide
// or resolve ./m, so it does not establish the imported symbol's type.
//
//  1. Parse a file that does `import String = require("./m")` and annotates.
//  2. Run the rule under the engine and confirm zero findings.
//  3. The shadowed `String` annotation survives byte-for-byte.
//
// @evidence contracts/testing.md#behavioral-verification The wrapper-type rule emits no finding for String introduced by import-equals.
// @evidence contracts/testing.md#independent-expectations Literal import String = require and its annotation establish the local binding independently; zero findings forbid rewriting it.
// @evidence contracts/testing.md#distinguishing-cases Import-equals is a distinct shadow form from named import and function/type declarations.
// @evidence contracts/testing.md#execution-ownership TestFixNoWrapperObjectTypesSkipsImportEqualsShadow calls assertRuleSkipsSource on the import-equals fixture.
func TestFixNoWrapperObjectTypesSkipsImportEqualsShadow(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "typescript/no-wrapper-object-types",
    "import String = require(\"./m\");\nconst x: String = \"\" as unknown as String;\nJSON.stringify(x);\n",
  )
}
