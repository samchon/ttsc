package linthost

import (
  "regexp"
  "strings"
  "testing"
)

const switchExhaustivenessCheckRuleName = "typescript/switch-exhaustiveness-check"

func runSwitchExhaustivenessCheckForTest(
  t *testing.T,
  source string,
  options map[string]any,
  configure func(root string),
) (int, string) {
  t.Helper()
  root := seedLintProject(t, source)
  if configure != nil {
    configure(root)
  }
  var setting any = "error"
  if options != nil {
    setting = []any{"error", options}
  }
  seedLintConfig(t, root, map[string]any{
    "rules": map[string]any{switchExhaustivenessCheckRuleName: setting},
  })
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if stdout != "" {
    t.Fatalf("switch-exhaustiveness-check wrote stdout: %q", stdout)
  }
  return code, stderr
}

func assertSwitchExhaustivenessCheckForTest(
  t *testing.T,
  source string,
  options map[string]any,
  wantFindings int,
  wantOccurrences map[string]int,
) {
  t.Helper()
  code, stderr := runSwitchExhaustivenessCheckForTest(t, source, options, nil)
  assertSwitchExhaustivenessCheckResultForTest(t, code, stderr, wantFindings, wantOccurrences)
}

func assertSwitchExhaustivenessCheckResultForTest(
  t *testing.T,
  code int,
  stderr string,
  wantFindings int,
  wantOccurrences map[string]int,
) {
  t.Helper()
  wantCode := 0
  if wantFindings > 0 {
    wantCode = 2
  }
  if code != wantCode {
    t.Fatalf("switch-exhaustiveness-check exit code: want %d, got %d\nstderr:\n%s", wantCode, code, stderr)
  }
  if got := strings.Count(stderr, "["+switchExhaustivenessCheckRuleName+"]"); got != wantFindings {
    t.Fatalf("switch-exhaustiveness-check finding count: want %d, got %d\nstderr:\n%s", wantFindings, got, stderr)
  }
  for text, want := range wantOccurrences {
    if got := strings.Count(stderr, text); got != want {
      t.Fatalf("switch-exhaustiveness-check occurrence count for %q: want %d, got %d\nstderr:\n%s", text, want, got, stderr)
    }
  }
  rendered := noMisusedPromisesANSI.ReplaceAllString(stderr, "")
  pattern := regexp.MustCompile("(?m)main\\.ts:\\d+:\\d+\\s+-\\s+(error|warning)\\s+TS\\d+:\\s*\\[" + regexp.QuoteMeta(switchExhaustivenessCheckRuleName) + "\\]\\s*([^\\r\\n]*)")
  matches := pattern.FindAllStringSubmatch(rendered, -1)
  if len(matches) != wantFindings {
    t.Fatalf("switch rule errors = %v, want %d", matches, wantFindings)
  }
  for _, match := range matches {
    if match[1] != "error" {
      t.Fatalf("switch rule severity = %q, want error", match[1])
    }
  }
  for text, want := range wantOccurrences {
    got := 0
    for _, match := range matches {
      if strings.Contains(match[2], text) {
        got++
      }
    }
    if got != want {
      t.Fatalf("switch rule diagnostic message %q: got %d, want %d; diagnostics=%v", text, got, want, matches)
    }
  }
}
