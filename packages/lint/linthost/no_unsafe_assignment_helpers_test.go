package linthost

import (
  "path/filepath"
  "reflect"
  "regexp"
  "sort"
  "strconv"
  "strings"
  "testing"
)

var noUnsafeAssignmentRenderedDiagnostic = regexp.MustCompile(
  `(?m)main\.(?:ts|tsx):(\d+):\d+\s+-\s+error\s+TS\d+:\s*\[typescript/no-unsafe-assignment\]\s*([^\r\n]+)`,
)

var noUnsafeAssignmentANSI = regexp.MustCompile(`\x1b\[[0-9;]*[A-Za-z]`)

// assertNoUnsafeAssignmentCase runs one annotated source file through the real
// type-aware command path and compares every rule diagnostic by line.
//
// 1. Materialize a strict project and enable only no-unsafe-assignment.
// 2. Run the check command with a real Program and Checker.
// 3. Require exactly the annotated findings, including duplicate-line counts.
func assertNoUnsafeAssignmentCase(t *testing.T, source string) {
  t.Helper()
  assertNoUnsafeAssignmentFileCase(t, "main.ts", source)
}

// assertNoUnsafeAssignmentTSXCase is the JSX-enabled sibling of
// assertNoUnsafeAssignmentCase.
//
// 1. Materialize the source as TSX with preserve-mode JSX enabled.
// 2. Run the same type-aware check command and rule configuration.
// 3. Compare the JSX attribute findings with the source annotations.
func assertNoUnsafeAssignmentTSXCase(t *testing.T, source string) {
  t.Helper()
  assertNoUnsafeAssignmentFileCase(t, "main.tsx", source)
}

func assertNoUnsafeAssignmentFileCase(t *testing.T, fileName, source string) {
  t.Helper()
  expected := parseRuleExpectations(t, source)
  if len(expected) == 0 {
    t.Fatal("no-unsafe-assignment case must include at least one expectation")
  }
  expectedLines := make([]int, 0, len(expected))
  for _, finding := range expected {
    if finding.Rule != "typescript/no-unsafe-assignment" || finding.Severity != SeverityError {
      t.Fatalf("unexpected expectation: %+v", finding)
    }
    expectedLines = append(expectedLines, finding.Line)
  }
  sort.Ints(expectedLines)

  root := seedNoUnsafeAssignmentProject(t, fileName, source)
  seedLintRules(t, root, map[string]string{"typescript/no-unsafe-assignment": "error"})
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })

  rendered := noUnsafeAssignmentANSI.ReplaceAllString(stderr, "")
  matches := noUnsafeAssignmentRenderedDiagnostic.FindAllStringSubmatch(rendered, -1)
  actualLines := make([]int, 0, len(matches))
  for _, match := range matches {
    line, err := strconv.Atoi(match[1])
    if err != nil {
      t.Fatalf("invalid rendered line %q: %v", match[1], err)
    }
    if !strings.HasPrefix(match[2], "Unsafe ") {
      t.Fatalf("unexpected diagnostic message %q", match[2])
    }
    actualLines = append(actualLines, line)
  }
  sort.Ints(actualLines)

  if code != 2 || stdout != "" || !reflect.DeepEqual(actualLines, expectedLines) {
    t.Fatalf(
      "no-unsafe-assignment mismatch: code=%d stdout=%q\nwant lines=%v\ngot lines=%v\nstderr=%s",
      code,
      stdout,
      expectedLines,
      actualLines,
      stderr,
    )
  }
}

func seedNoUnsafeAssignmentProject(t *testing.T, fileName, source string) string {
  t.Helper()
  root := t.TempDir()
  jsxOption := ""
  if filepath.Ext(fileName) == ".tsx" {
    jsxOption = `,
    "jsx": "preserve"`
  }
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"`+jsxOption+`
  },
  "files": ["src/`+fileName+`"]
}
`)
  writeFile(t, filepath.Join(root, "src", fileName), source)
  return root
}
