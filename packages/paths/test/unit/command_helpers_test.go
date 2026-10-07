package paths_test

import (
  "bytes"
  "encoding/json"
  "os"
  "path/filepath"
  "testing"

  _ "github.com/samchon/ttsc/packages/paths/driver"
  "github.com/samchon/ttsc/packages/ttsc/utility"

  shared "github.com/samchon/ttsc/packages/paths/test/internal/shared"
)

// commandVersion mirrors the version constant `plugin/main.go` hands to the
// shared dispatch; only the dispatch semantics, not the number, matter here.
const commandVersion = "test"

type transformResult struct {
  TypeScript map[string]string `json:"typescript"`
}

// runCommand drives the same dispatch the standalone sidecar's `main` calls,
// in this process, with the paths plugin registered by the blank driver import.
// It returns the dispatch status and both captured streams.
func runCommand(args ...string) (int, string, string) {
  var stdout, stderr bytes.Buffer
  status := utility.RunCommandWithIO("@ttsc/paths", commandVersion, args, &stdout, &stderr)
  return status, stdout.String(), stderr.String()
}

// mustJSON serializes --plugins-json payloads with test failure context.
func mustJSON(t *testing.T, value any) string {
  t.Helper()
  data, err := json.Marshal(value)
  if err != nil {
    t.Fatal(err)
  }
  return string(data)
}

// readFile reads emitted build output for assertions against the command's
// filesystem effects.
func readFile(t *testing.T, file string) string {
  t.Helper()
  data, err := os.ReadFile(file)
  if err != nil {
    t.Fatal(err)
  }
  return string(data)
}

// writeFile writes a fixture file, creating parent directories first.
func writeFile(t *testing.T, file string, contents string) {
  t.Helper()
  if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(file, []byte(contents), 0o644); err != nil {
    t.Fatal(err)
  }
}

// pathsManifest returns the descriptor shape ttsc passes to @ttsc/paths.
func pathsManifest(t *testing.T) string {
  t.Helper()
  return mustJSON(t, []map[string]any{{
    "name":   "@ttsc/paths",
    "stage":  "transform",
    "config": map[string]any{"transform": "@ttsc/paths"},
  }})
}

// seedPathsProject creates the common alias-rewrite fixture. Each test owns a
// fresh directory so command runs cannot share output state.
func seedPathsProject(t *testing.T) string {
  t.Helper()
  return shared.SeedProject(t, map[string]string{
    "tsconfig.json":      `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true,"paths":{"@lib/*":["./src/lib/*"]},"outDir":"dist","rootDir":"src"},"include":["src"]}`,
    "src/lib/message.ts": `export const message = "ok";` + "\n",
    "src/main.ts":        `import { message } from "@lib/message";` + "\n" + `export const value = message;` + "\n",
  })
}
