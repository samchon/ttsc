package linthost

import (
  "path/filepath"
  "reflect"
  "regexp"
  "strconv"
  "testing"
)

// assertMigratedTypedRuleCase retains the original consumer fixture's source,
// compiler configuration and complete rendered rule diagnostic oracle while
// invoking the owning Go command directly. Package discovery and native wire
// coverage belong to the shared E2E survivor, not this semantic operation.
func assertMigratedTypedRuleCase(
  t *testing.T,
  source, config, packageConfig, rule string,
  setting any,
  expected []ruleExpectation,
) {
  t.Helper()
  root := seedLintProject(t, source)
  writeFile(t, filepath.Join(root, "tsconfig.json"), config)
  writeFile(t, filepath.Join(root, "package.json"), packageConfig)
  seedLintConfig(t, root, map[string]any{"rules": map[string]any{rule: setting}})
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{"check", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  rendered := ansiControlSequencePattern.ReplaceAllString(stderr, "")
  pattern := regexp.MustCompile(`(?m)main\.ts:(\d+):\d+\s+-\s+(error|warning)\s+TS\d+:\s*\[([@\w/-]+)\]`)
  actual := []ruleExpectation{}
  for _, match := range pattern.FindAllStringSubmatch(rendered, -1) {
    line, err := strconv.Atoi(match[1])
    if err != nil {
      t.Fatal(err)
    }
    severity := SeverityError
    if match[2] == "warning" {
      severity = SeverityWarn
    }
    actual = append(actual, ruleExpectation{Rule: match[3], Severity: severity, Line: line})
  }
  if code != 2 || stdout != "" || !reflect.DeepEqual(actual, expected) {
    t.Fatalf("%s: code=%d stdout=%q\nwant=%+v\ngot=%+v\nstderr=%s", rule, code, stdout, expected, actual, stderr)
  }
}
