package linthost

import "testing"

func runNoFloatingPromisesCase(
  t *testing.T,
  source string,
  options map[string]any,
) (int, string, string) {
  t.Helper()
  root := seedLintProject(t, source)
  var setting any = "error"
  if options != nil {
    setting = []any{"error", options}
  }
  seedLintConfig(t, root, map[string]any{
    "rules": map[string]any{
      "typescript/no-floating-promises": setting,
    },
  })
  return captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
}
