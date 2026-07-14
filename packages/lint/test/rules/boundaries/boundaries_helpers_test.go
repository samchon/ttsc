package linthost

import (
  "encoding/json"
  "path/filepath"
  "sort"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

func runBoundaryRule(t *testing.T, ruleName, sourcePath, source, optsJSON string, extraFiles map[string]string) []*Finding {
  t.Helper()
  root := t.TempDir()
  fullSourcePath := filepath.Join(root, filepath.FromSlash(sourcePath))
  writeFile(t, fullSourcePath, source)
  for rel, text := range extraFiles {
    writeFile(t, filepath.Join(root, filepath.FromSlash(rel)), text)
  }
  file := parseTSFile(t, fullSourcePath, source)
  resolver := InlineRuleResolver{
    Rules:   RuleConfig{ruleName: SeverityError},
    Options: RuleOptionsMap{ruleName: json.RawMessage(optsJSON)},
  }
  return NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
}

func assertSingleBoundaryFinding(t *testing.T, ruleName string, findings []*Finding, messagePart string) {
  t.Helper()
  if len(findings) != 1 {
    t.Fatalf("%s: want one finding, got %d (%+v)", ruleName, len(findings), findings)
  }
  if findings[0].Rule != ruleName {
    t.Fatalf("want rule %q, got %q", ruleName, findings[0].Rule)
  }
  if !strings.Contains(findings[0].Message, messagePart) {
    t.Fatalf("want message containing %q, got %q", messagePart, findings[0].Message)
  }
  if len(findings[0].Fix) != 0 {
    t.Fatalf("%s: boundaries diagnostics must not offer autofixes", ruleName)
  }
}

func runBoundaryRuleProgram(
  t *testing.T,
  ruleName string,
  sourcePath string,
  source string,
  optsJSON string,
  extraFiles map[string]string,
  compilerOptions map[string]any,
) []*Finding {
  t.Helper()
  root := t.TempDir()
  files := make([]string, 0, len(extraFiles)+1)
  files = append(files, filepath.ToSlash(sourcePath))
  writeFile(t, filepath.Join(root, filepath.FromSlash(sourcePath)), source)
  for relative, text := range extraFiles {
    files = append(files, filepath.ToSlash(relative))
    writeFile(t, filepath.Join(root, filepath.FromSlash(relative)), text)
  }
  sort.Strings(files)

  options := map[string]any{
    "target":           "ES2022",
    "module":           "NodeNext",
    "moduleResolution": "NodeNext",
    "strict":           true,
    "noEmit":           true,
    "baseUrl":          ".",
  }
  for name, value := range compilerOptions {
    options[name] = value
  }
  config, err := json.Marshal(map[string]any{
    "compilerOptions": options,
    "files":           files,
  })
  if err != nil {
    t.Fatalf("marshal tsconfig: %v", err)
  }
  writeFile(t, filepath.Join(root, "tsconfig.json"), string(config))

  resolver := InlineRuleResolver{
    Rules:   RuleConfig{ruleName: SeverityError},
    Options: RuleOptionsMap{ruleName: json.RawMessage(optsJSON)},
  }
  engine := NewEngineWithResolver(resolver)
  if err := engine.ConfigError(); err != nil {
    t.Fatalf("%s config: %v", ruleName, err)
  }
  engine.SetCurrentDirectory(root)
  program, diagnostics, err := loadProgram(root, "tsconfig.json", loadProgramOptions{
    forceNoEmit:      true,
    needsRuleChecker: engine.NeedsTypeChecker(),
  })
  if program != nil {
    defer program.close()
  }
  if err != nil {
    t.Fatalf("%s loadProgram: %v", ruleName, err)
  }
  if len(diagnostics) != 0 {
    t.Fatalf("%s loadProgram diagnostics: %+v", ruleName, diagnostics)
  }
  if program == nil || program.checker == nil {
    t.Fatalf("%s requires a checker-backed Program", ruleName)
  }
  return program.runLintCycle(engine)
}

func assertBoundaryFindingTexts(t *testing.T, source string, findings []*Finding, expected ...string) {
  t.Helper()
  if len(findings) != len(expected) {
    t.Fatalf("want %d findings, got %d (%+v)", len(expected), len(findings), findings)
  }
  actual := make([]string, 0, len(findings))
  for _, finding := range findings {
    if finding.Pos < 0 || finding.End < finding.Pos || finding.End > len(source) {
      t.Fatalf("invalid finding range %d..%d for %d-byte source", finding.Pos, finding.End, len(source))
    }
    actual = append(actual, source[finding.Pos:finding.End])
  }
  sort.Strings(actual)
  sort.Strings(expected)
  for index := range expected {
    if actual[index] != expected[index] {
      t.Fatalf("finding texts mismatch: want %q, got %q", expected, actual)
    }
  }
}
