package linthost

import "testing"

// TestBanTsCommentSuggestionCompilerErrorBoundary verifies the opt-in rewrite
// creates TS2578 above an error-free line but remains valid above a genuine
// type error.
//
// @evidence contracts/testing.md#behavioral-verification Applying the ignore-to-expect-error suggestion causes TS2578 only on the error-free statement, while a genuine type error remains correctly suppressed.
// @evidence contracts/testing.md#independent-expectations TypeScript expect-error requires an error on the next line; authored want2578 booleans follow the number-versus-string assignments independently.
// @evidence contracts/testing.md#distinguishing-cases Two t.Run cases distinguish semantics of the suggested rewrite, reject all unexpected compiler diagnostics and require exactly one applied edit.
// @evidence contracts/testing.md#execution-ownership runRuleFindingsSnapshot obtains the suggestion; applyFindingFixesToText applies it; seedLintProject/loadProgram and programDiagnostics validate both named subcases in this Test without a CLI child. No consumer install or native product-host build/launch is used.
func TestBanTsCommentSuggestionCompilerErrorBoundary(t *testing.T) {
  cases := []struct {
    name      string
    statement string
    want2578  bool
  }{
    {name: "error free", statement: "const value: number = 1;", want2578: true},
    {name: "genuine error", statement: "const value: number = \"wrong\";", want2578: false},
  }
  for _, tc := range cases {
    t.Run(tc.name, func(t *testing.T) {
      source := "// @ts-ignore: boundary\n" + tc.statement + "\nJSON.stringify(value);\n"
      _, _, findings := runRuleFindingsSnapshot(t, "typescript/ban-ts-comment", source, nil)
      if len(findings) != 1 || len(findings[0].Suggestions) != 1 {
        t.Fatalf("findings = %+v", findings)
      }
      rewritten, applied := applyFindingFixesToText(source, []*Finding{{Fix: findings[0].Suggestions[0].Edits}})
      if applied != 1 {
        t.Fatalf("suggestion applied edits = %d, want 1", applied)
      }

      root := seedLintProject(t, rewritten)
      program, diagnostics, err := loadProgram(root, "tsconfig.json", loadProgramOptions{forceNoEmit: true})
      if err != nil {
        t.Fatal(err)
      }
      if len(diagnostics) != 0 {
        t.Fatalf("load diagnostics = %+v", diagnostics)
      }
      defer program.close()
      has2578 := false
      for _, diagnostic := range program.programDiagnostics() {
        if diagnostic.Code() == 2578 {
          has2578 = true
        } else {
          t.Fatalf("unexpected compiler diagnostic TS%d: %s", diagnostic.Code(), diagnostic.String())
        }
      }
      if has2578 != tc.want2578 {
        t.Fatalf("TS2578 present = %v, want %v", has2578, tc.want2578)
      }
    })
  }
}
