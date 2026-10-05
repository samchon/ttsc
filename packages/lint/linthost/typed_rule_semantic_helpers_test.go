package linthost

import (
  "regexp"
  "strconv"
  "testing"
)

func assertTypedRuleRenderedErrors(t *testing.T, ruleName, stderr string, expectedLines ...int) {
  t.Helper()
  rendered := noMisusedPromisesANSI.ReplaceAllString(stderr, "")
  pattern := regexp.MustCompile("(?m)main\\.ts:(\\d+):\\d+\\s+-\\s+(error|warning)\\s+TS\\d+:\\s*\\[" + regexp.QuoteMeta(ruleName) + "\\]")
  matches := pattern.FindAllStringSubmatch(rendered, -1)
  if len(matches) != len(expectedLines) {
    t.Fatalf("%s: rendered errors = %v, want lines %v; stderr=%s", ruleName, matches, expectedLines, stderr)
  }
  for index, match := range matches {
    line, err := strconv.Atoi(match[1])
    if err != nil || line != expectedLines[index] || match[2] != "error" {
      t.Fatalf("%s: error %d = %v, want line %d", ruleName, index, match, expectedLines[index])
    }
  }
}

func assertTypedRuleCleanSource(t *testing.T, ruleName, source string) {
  t.Helper()
  root := seedLintProject(t, source)
  seedLintRules(t, root, map[string]string{ruleName: "error"})
  code, stdout, stderr := captureCommandOutput(t, func() int { return run([]string{"check", "--cwd", root, "--plugins-json", lintManifest(t)}) })
  if code != 0 || stdout != "" {
    t.Fatalf("%s clean boundary: code %d stdout %q stderr %s", ruleName, code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, ruleName, stderr)
}
