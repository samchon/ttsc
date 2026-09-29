package linthost

import (
  "bytes"
  "strings"
  "testing"
)

// TestCommandCheckPreservesSeverityExitContract verifies command failure policy.
//
// The batched corpus compares rule findings through the real renderer. This
// command boundary must independently preserve the renderer's error count:
// warnings alone succeed, either lint or compiler errors fail, and a clean
// project emits neither diagnostics nor an erroneous failure.
//
// 1. Create clean, lint-error, warning-only and warning-with-type-error projects.
// 2. Run the real in-process check entrypoint with discovered config files.
// 3. Assert exact status, rendered rule presence and silent stdout.
func TestCommandCheckPreservesSeverityExitContract(t *testing.T) {
  cases := []struct {
    name, source, severity string
    status                 int
    finding                bool
  }{
    {"clean", "const value = 1;\nJSON.stringify(value);\n", "error", 0, false},
    {"lint-error", "var value = 1;\nJSON.stringify(value);\n", "error", 2, true},
    {"warning-only", "var value = 1;\nJSON.stringify(value);\n", "warn", 0, true},
    {"warning-and-type-error", "var value: string = 1;\nJSON.stringify(value);\n", "warn", 2, true},
  }
  for _, scenario := range cases {
    t.Run(scenario.name, func(t *testing.T) {
      root := seedLintProject(t, scenario.source)
      seedLintRules(t, root, map[string]string{"no-var": scenario.severity})
      var stdout, stderr bytes.Buffer
      status := RunCheckWithIO([]string{
        "--cwd", root, "--plugins-json", lintManifest(t), "--noEmit",
      }, &stdout, &stderr)
      if status != scenario.status || stdout.Len() != 0 {
        t.Errorf("status=%d stdout=%q stderr=%q; want status=%d and silent stdout", status, stdout.String(), stderr.String(), scenario.status)
      }
      if found := strings.Contains(stderr.String(), "[no-var]"); found != scenario.finding {
        t.Errorf("rendered finding=%v, want %v: %s", found, scenario.finding, stderr.String())
      }
      if !scenario.finding && stderr.Len() != 0 {
        t.Errorf("clean check must be silent: %s", stderr.String())
      }
    })
  }
}
