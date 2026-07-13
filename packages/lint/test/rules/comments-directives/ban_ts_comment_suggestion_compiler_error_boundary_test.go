package linthost

import "testing"

// TestBanTsCommentSuggestionCompilerErrorBoundary verifies the opt-in rewrite
// creates TS2578 above an error-free line but remains valid above a genuine
// type error.
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
