package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestUnicornConsistentTemplateLiteralEscapeFiresOnDeclarationFiles
// verifies the rule participates in declaration-file linting.
//
// Template literal types are ordinary `.d.ts` grammar, so the rule is on
// the `declarationFileRuleNames` allowlist; without that entry the engine
// would silently skip hand-written declaration sources and lose the
// type-position findings this rule exists to make.
//
//  1. Parse a declaration-shaped source with one bad type escape and mark
//     it as a declaration file.
//  2. Run the engine with only this rule enabled.
//  3. Assert exactly one finding is emitted.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run on an actual IsDeclarationFile source emits one rule error rather than silently skipping the template type.
// @evidence contracts/testing.md#independent-expectations The independently authored bad type escape follows the same upstream template-element contract as value templates; the assertion checks diagnostic rule/severity and excludes host failures.
// @evidence contracts/testing.md#distinguishing-cases The declaration-file flag is enabled while the literal-type escape is malformed; TestUnicornConsistentTemplateLiteralEscapeFixesTemplateLiteralTypes owns exact type rewrites and canonical negatives.
// @evidence contracts/testing.md#execution-ownership This Go unit sets the parser-owned declaration flag and runs the owning engine in the shared process with a virtual source. Virtual/temporary fixture execution does not install consumers, build native artifacts or launch a product host.
func TestUnicornConsistentTemplateLiteralEscapeFiresOnDeclarationFiles(t *testing.T) {
  file := parseTS(t, "declare const pattern: `$\\{value}${string}`;\n")
  file.IsDeclarationFile = true
  findings := NewEngine(RuleConfig{
    unicornConsistentTemplateLiteralEscapeRuleName: SeverityError,
  }).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 || findings[0].Rule != unicornConsistentTemplateLiteralEscapeRuleName || findings[0].Severity != SeverityError || findings[0].engineFailure {
    t.Fatalf("want one declaration-file finding, got %d (%+v)", len(findings), findings)
  }
}
