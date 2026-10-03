package linthost

import (
  "io"
  "os"
  "path/filepath"
  "reflect"
  "regexp"
  "sort"
  "strconv"
  "testing"
)

var noMisusedPromisesRenderedDiagnostic = regexp.MustCompile(
  `(?m)main\.(?:ts|tsx):(\d+):\d+\s+-\s+error\s+TS\d+:\s*\[typescript/no-misused-promises\]`,
)

var noMisusedPromisesANSI = regexp.MustCompile(`\x1b\[[0-9;]*[A-Za-z]`)

// assertNoMisusedPromisesCase runs one annotated source through a real Program
// and compares every rule diagnostic by line.
//
// 1. Materialize a strict project with disposable-library support.
// 2. Run the lint command with the requested rule options.
// 3. Require exactly the annotated diagnostics and no extras.
func assertNoMisusedPromisesCase(t *testing.T, fileName, source string, options map[string]any) {
  t.Helper()
  expected := parseRuleExpectations(t, source)
  expectedLines := make([]int, 0, len(expected))
  for _, finding := range expected {
    if finding.Rule != "typescript/no-misused-promises" || finding.Severity != SeverityError {
      t.Fatalf("unexpected expectation: %+v", finding)
    }
    expectedLines = append(expectedLines, finding.Line)
  }
  sort.Ints(expectedLines)
  actualLines, code, stdout, stderr := runNoMisusedPromisesCase(t, fileName, source, options)
  if code != 2 || stdout != "" || !reflect.DeepEqual(actualLines, expectedLines) {
    t.Fatalf(
      "no-misused-promises mismatch: code=%d stdout=%q\nwant lines=%v\ngot lines=%v\nstderr=%s",
      code,
      stdout,
      expectedLines,
      actualLines,
      stderr,
    )
  }
}

func runNoMisusedPromisesCase(
  t *testing.T,
  fileName string,
  source string,
  options map[string]any,
) ([]int, int, string, string) {
  t.Helper()
  root := t.TempDir()
  jsx := ""
  if filepath.Ext(fileName) == ".tsx" {
    jsx = `,
    "jsx": "preserve"`
  }
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noEmit": true,
    "lib": ["ES2022", "DOM", "ESNext.Disposable"]`+jsx+`
  },
  "files": ["src/`+fileName+`"]
}
`)
  writeFile(t, filepath.Join(root, "src", fileName), source)
  setting := any("error")
  if options != nil {
    setting = []any{"error", options}
  }
  seedLintConfig(t, root, map[string]any{
    "rules": map[string]any{"typescript/no-misused-promises": setting},
  })
  code, stdout, stderr := captureNoMisusedPromisesOutput(t, func() int {
    return run([]string{"check", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  rendered := noMisusedPromisesANSI.ReplaceAllString(stderr, "")
  matches := noMisusedPromisesRenderedDiagnostic.FindAllStringSubmatch(rendered, -1)
  lines := make([]int, 0, len(matches))
  for _, match := range matches {
    line, err := strconv.Atoi(match[1])
    if err != nil {
      t.Fatalf("invalid rendered line %q: %v", match[1], err)
    }
    lines = append(lines, line)
  }
  sort.Ints(lines)
  return lines, code, stdout, stderr
}

func captureNoMisusedPromisesOutput(t *testing.T, runCommand func() int) (int, string, string) {
  t.Helper()
  stdoutFile, err := os.CreateTemp(t.TempDir(), "stdout-*.txt")
  if err != nil {
    t.Fatal(err)
  }
  stderrFile, err := os.CreateTemp(t.TempDir(), "stderr-*.txt")
  if err != nil {
    t.Fatal(err)
  }
  previousOut, previousErr := os.Stdout, os.Stderr
  os.Stdout, os.Stderr = stdoutFile, stderrFile
  code := runCommand()
  os.Stdout, os.Stderr = previousOut, previousErr
  if _, err := stdoutFile.Seek(0, 0); err != nil {
    t.Fatal(err)
  }
  if _, err := stderrFile.Seek(0, 0); err != nil {
    t.Fatal(err)
  }
  stdout, err := io.ReadAll(stdoutFile)
  if err != nil {
    t.Fatal(err)
  }
  stderr, err := io.ReadAll(stderrFile)
  if err != nil {
    t.Fatal(err)
  }
  if err := stdoutFile.Close(); err != nil {
    t.Fatal(err)
  }
  if err := stderrFile.Close(); err != nil {
    t.Fatal(err)
  }
  return code, string(stdout), string(stderr)
}
