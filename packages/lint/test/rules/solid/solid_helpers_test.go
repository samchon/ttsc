package linthost

import (
  "path/filepath"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// assertSolidFindings runs the requested solid rules over one virtual component
// and compares the normalized findings with the expectation list.
//
// The engine picks the lane. A source-only rule set runs against a parsed file
// with no checker, which is what most solid rules need. A rule set containing a
// type-aware rule takes the project-backed lane the shared snapshot helpers
// use, because a type-aware rule handed a nil checker cannot resolve a binding
// and silently reports nothing: the expectation would then fail for a reason
// that has nothing to do with the rule under test.
func assertSolidFindings(t *testing.T, source string, rules RuleConfig, expected []ruleExpectation) {
  t.Helper()
  engine := NewEngine(rules)
  if engine.NeedsTypeChecker() {
    assertSolidCheckerFindings(t, engine, source, expected)
    return
  }
  file := parseTSXFile(t, "/virtual/component.tsx", source)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  assertSolidExpectations(t, file, findings, expected)
  recordExpectedBehavioralWitnesses(t, expected, behavioralWitnessEngine)
}

func assertSolidCheckerFindings(
  t *testing.T,
  engine *Engine,
  source string,
  expected []ruleExpectation,
) {
  t.Helper()
  const fileName = "component.tsx"
  root := seedLintProjectFile(t, fileName, source)
  engine.SetCurrentDirectory(root)
  program, diagnostics, err := loadProgram(root, "tsconfig.json", loadProgramOptions{
    forceNoEmit:      true,
    needsRuleChecker: true,
  })
  if program != nil {
    defer program.close()
  }
  if err != nil {
    t.Fatalf("loadProgram: %v", err)
  }
  if len(diagnostics) != 0 {
    t.Fatalf("loadProgram diagnostics: %+v", diagnostics)
  }
  if program == nil || program.checker == nil {
    t.Fatal("loadProgram returned no checker for a type-aware rule set")
  }
  files := program.userSourceFiles()
  if len(files) != 1 {
    t.Fatalf("user source files = %d, want 1", len(files))
  }
  wanted := filepath.ToSlash(filepath.Join("src", fileName))
  if got := filepath.ToSlash(files[0].FileName()); !strings.HasSuffix(got, wanted) {
    t.Fatalf("user source file = %q, want one ending in %q", got, wanted)
  }
  assertSolidExpectations(t, files[0], program.runLintCycle(engine), expected)
  recordExpectedBehavioralWitnesses(t, expected, behavioralWitnessChecker)
}

func assertSolidExpectations(
  t *testing.T,
  file *shimast.SourceFile,
  findings []*Finding,
  expected []ruleExpectation,
) {
  t.Helper()
  actual := normalizeRuleFindings(file, findings)
  if len(actual) != len(expected) {
    t.Fatalf("want %v, got %v", expected, actual)
  }
  for i := range expected {
    if actual[i] != expected[i] {
      t.Fatalf("[%d]: want %+v, got %+v; all findings=%+v", i, expected[i], actual[i], actual)
    }
  }
}
