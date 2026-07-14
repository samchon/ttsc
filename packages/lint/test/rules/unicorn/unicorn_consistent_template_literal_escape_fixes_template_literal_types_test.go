package linthost

import "testing"

// TestUnicornConsistentTemplateLiteralEscapeFixesTemplateLiteralTypes
// verifies template literal types canonicalize the same way value
// templates do.
//
// Under the typescript-eslint parser the upstream rule visits the
// TemplateElement quasis of TSTemplateLiteralType and TSLiteralType
// nodes, and `isTaggedTemplateLiteral` is false there, so type-position
// escapes report and fix. Skipping types would also be incoherent: a
// no-substitution type template shares KindNoSubstitutionTemplateLiteral
// with value templates and cannot be told apart by kind alone.
//
//  1. Fix a substitution-carrying template literal type and a
//     no-substitution literal type.
//  2. Compare against the canonical spelling byte-for-byte and reparse.
//  3. Assert the fixed source no longer fires (idempotence).
func TestUnicornConsistentTemplateLiteralEscapeFixesTemplateLiteralTypes(t *testing.T) {
  source := "type Pattern = `$\\{value}${string}$\\{rest}`;\ntype Single = `$\\{only}`;\n"
  expected := "type Pattern = `\\${value}${string}\\${rest}`;\ntype Single = `\\${only}`;\n"

  assertFixSnapshot(t, unicornConsistentTemplateLiteralEscapeRuleName, source, expected)
  file := parseTSFile(t, "/virtual/fixed-template-literal-escape-types.ts", expected)
  if diagnostics := file.Diagnostics(); len(diagnostics) != 0 {
    t.Fatalf("fixed source has parse diagnostics: %+v\n%s", diagnostics, expected)
  }
  assertRuleSkipsSource(t, unicornConsistentTemplateLiteralEscapeRuleName, expected)
}
