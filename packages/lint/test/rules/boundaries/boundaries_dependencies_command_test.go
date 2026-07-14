package linthost

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"
)

// TestBoundariesDependenciesReportsThroughCheckCommand verifies the production
// command front door surfaces unified policy diagnostics.
//
// Direct engine tests cannot catch config loading, checker provisioning,
// declaration routing, or diagnostic rendering regressions. This witness uses
// the same manifest and `lint.config.json` path as a consuming ttsc project.
//
// 1. Materialize an app-to-domain project and lint configuration.
// 2. Invoke the real `check` command through the package command router.
// 3. Assert one rendered rule diagnostic and a failing lint exit code.
func TestBoundariesDependenciesReportsThroughCheckCommand(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "src", "app", "main.ts"), `import "../domain/model";`)
  writeFile(t, filepath.Join(root, "src", "domain", "model.ts"), `export {};`)
  tsconfig, err := json.Marshal(map[string]any{
    "compilerOptions": map[string]any{
      "target":  "ES2022",
      "module":  "NodeNext",
      "strict":  true,
      "noEmit":  true,
      "rootDir": "src",
    },
    "files": []string{"src/app/main.ts", "src/domain/model.ts"},
  })
  if err != nil {
    t.Fatalf("marshal tsconfig: %v", err)
  }
  writeFile(t, filepath.Join(root, "tsconfig.json"), string(tsconfig))
  seedLintConfig(t, root, map[string]any{
    "rules": map[string]any{
      "boundaries/dependencies": []any{"error", map[string]any{
        "elements": []any{
          map[string]any{"type": "app", "pattern": "src/app/**"},
          map[string]any{"type": "domain", "pattern": "src/domain/**"},
        },
        "default": "allow",
        "policies": []any{
          map[string]any{"from": "app", "disallow": "domain"},
        },
      }},
    },
  })

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{"check", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  if code != 2 || stdout != "" || strings.Count(stderr, "[boundaries/dependencies]") != 1 {
    t.Fatalf("command result: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if !strings.Contains(stderr, `boundary element "app"`) || !strings.Contains(stderr, `boundary element "domain"`) {
    t.Fatalf("command diagnostic lost direction context: %q", stderr)
  }
}
