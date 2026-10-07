package linthost

import "testing"

// TestUnicornConsistentTemplateLiteralEscapeFixesTemplateLiteralTypes
// verifies template literal types canonicalize the same way value
// templates do.
//
// The owning Go rule visits TemplateLiteralType heads and spans as well
// as NoSubstitutionTemplateLiteral nodes. These authored type-position
// escapes therefore report and fix. This unit does not run an upstream
// parser or rule; the independently declared source bytes are its oracle. A
// no-substitution type template shares KindNoSubstitutionTemplateLiteral
// with value templates and cannot be told apart by kind alone.
//
//  1. Fix a substitution-carrying template literal type and a
//     no-substitution literal type.
//  2. Compare against the canonical spelling byte-for-byte and reparse.
//  3. Assert the fixed source no longer fires (idempotence).
//
// @evidence contracts/testing.md#behavioral-verification exact fix snapshot normalizes two template literal types, parser diagnostics remain empty and re-lint is clean.
// @evidence contracts/testing.md#independent-expectations The literal expected source specifies canonical escaped dollar-brace spelling without deriving replacement text from the Go scanner.
// @evidence contracts/testing.md#distinguishing-cases Substitution-bearing and no-substitution type templates both change, while the real string type substitution remains intact and canonical results stay clean.
// @evidence contracts/testing.md#execution-ownership This Go unit invokes owning engine/fix and parse operations over virtual source in the shared process. Virtual/temporary fixture execution does not install consumers, build native artifacts or launch a product host.
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
