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
func TestUnicornConsistentTemplateLiteralEscapeFiresOnDeclarationFiles(t *testing.T) {
  file := parseTS(t, "declare const pattern: `$\\{value}${string}`;\n")
  file.IsDeclarationFile = true
  findings := NewEngine(RuleConfig{
    unicornConsistentTemplateLiteralEscapeRuleName: SeverityError,
  }).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("want one declaration-file finding, got %d (%+v)", len(findings), findings)
  }
}
