package linthost

import (
  "path/filepath"
  "sort"
  "strings"
  "testing"
)

const noImportAssignRangeStart = "/* no-import-assign:start */"

const noImportAssignRangeEnd = "/* no-import-assign:end */"

type noImportAssignExpectedFinding struct {
  snippet string
  message string
}

func runNoImportAssignProject(t *testing.T, source string) []*Finding {
  t.Helper()
  root := seedLintProjectFile(t, "main.ts", source)
  writeFile(t, filepath.Join(root, "src", "dep.ts"), `
const defaultValue = { member: { deep: 0 } };
export default defaultValue;
export let value = 0;
export let same = 0;
export interface Model { member: number }
export const member = { deep: 0 };
`)
  writeFile(t, filepath.Join(root, "src", "dep2.ts"), "export let same = 0;\n")
  writeFile(t, filepath.Join(root, "src", "dep-default.ts"), "export default interface DefaultModel { member: number }\n")

  engine := NewEngine(RuleConfig{"no-import-assign": SeverityError})
  if !engine.NeedsTypeChecker() {
    t.Fatal("no-import-assign did not request the checker required for binding identity")
  }
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
    t.Fatal("no-import-assign requires a loaded checker")
  }
  return program.runLintCycle(engine)
}

func assertNoImportAssignFindings(
  t *testing.T,
  source string,
  findings []*Finding,
  expected []noImportAssignExpectedFinding,
) {
  t.Helper()
  type rangedFinding struct {
    pos     int
    end     int
    message string
  }
  wants := make([]rangedFinding, 0, len(expected))
  for _, item := range expected {
    marked := noImportAssignRangeStart + item.snippet + noImportAssignRangeEnd
    markerPos := strings.Index(source, marked)
    if markerPos < 0 {
      t.Fatalf("missing marked expected snippet %q", item.snippet)
    }
    pos := markerPos + len(noImportAssignRangeStart)
    wants = append(wants, rangedFinding{pos: pos, end: pos + len(item.snippet), message: item.message})
  }
  sort.Slice(wants, func(i, j int) bool {
    if wants[i].pos != wants[j].pos {
      return wants[i].pos < wants[j].pos
    }
    return wants[i].message < wants[j].message
  })
  sort.Slice(findings, func(i, j int) bool {
    if findings[i].Pos != findings[j].Pos {
      return findings[i].Pos < findings[j].Pos
    }
    return findings[i].Message < findings[j].Message
  })
  if len(findings) != len(wants) {
    for _, finding := range findings {
      snippet := ""
      if finding.Pos >= 0 && finding.End >= finding.Pos && finding.End <= len(source) {
        snippet = source[finding.Pos:finding.End]
      }
      t.Logf("actual %s/%s [%d,%d) %q: %q",
        finding.Rule, finding.Severity.String(), finding.Pos, finding.End, finding.Message, snippet)
    }
    t.Fatalf("want %d findings, got %d (%+v)", len(wants), len(findings), findings)
  }
  for index, finding := range findings {
    want := wants[index]
    if finding.Rule != "no-import-assign" || finding.Severity != SeverityError ||
      finding.Pos != want.pos || finding.End != want.end || finding.Message != want.message {
      t.Fatalf("finding %d mismatch: want no-import-assign/error [%d,%d) %q, got %s/%s [%d,%d) %q",
        index, want.pos, want.end, want.message,
        finding.Rule, finding.Severity.String(), finding.Pos, finding.End, finding.Message)
    }
    if len(finding.Fix) != 0 || len(finding.Suggestions) != 0 {
      t.Fatalf("finding %d unexpectedly offered edits: %+v", index, finding)
    }
  }
}
