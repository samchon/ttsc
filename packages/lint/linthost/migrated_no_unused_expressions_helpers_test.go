package linthost

import (
  "path/filepath"
  "reflect"
  "regexp"
  "strconv"
  "testing"
)

func assertMigratedNoUnusedExpressionRendering(t *testing.T, mainSource, jsxSource string) {
  t.Helper()
  root := seedLintProject(t, mainSource)
  writeFile(t, filepath.Join(root, "src", "default-jsx.tsx"), jsxSource)
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true,"noEmit":true,"rootDir":"src","jsx":"preserve"},"include":["src"]}`)
  writeFile(t, filepath.Join(root, "package.json"), `{"private":true,"dependencies":{"@ttsc/lint":"*"}}`)
  seedLintRules(t, root, map[string]string{"no-unused-expressions": "error"})
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{"check", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  rendered := ansiControlSequencePattern.ReplaceAllString(stderr, "")
  pattern := regexp.MustCompile(`(?m)(main\.ts|default-jsx\.tsx):(\d+):\d+\s+-\s+(error|warning)\s+TS\d+:\s*\[([@\w/-]+)\]`)
  actual := map[string][]ruleExpectation{
    "main.ts":         {},
    "default-jsx.tsx": {},
  }
  for _, match := range pattern.FindAllStringSubmatch(rendered, -1) {
    line, err := strconv.Atoi(match[2])
    if err != nil {
      t.Fatal(err)
    }
    severity := SeverityError
    if match[3] == "warning" {
      severity = SeverityWarn
    }
    actual[match[1]] = append(actual[match[1]], ruleExpectation{Rule: match[4], Severity: severity, Line: line})
  }
  expected := map[string][]ruleExpectation{
    "main.ts":         parseRuleExpectations(t, mainSource),
    "default-jsx.tsx": parseRuleExpectations(t, jsxSource),
  }
  codes := []string{}
  for _, match := range regexp.MustCompile(`\bTS(\d+):`).FindAllStringSubmatch(rendered, -1) {
    codes = append(codes, match[1])
  }
  if code != 2 || stdout != "" || !reflect.DeepEqual(actual, expected) ||
    !reflect.DeepEqual(codes, []string{"17505", "17505"}) {
    t.Fatalf("default expression rendering: code=%d stdout=%q codes=%v want=%+v got=%+v stderr=%s", code, stdout, codes, expected, actual, stderr)
  }
}
