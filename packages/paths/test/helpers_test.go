package paths_test

import (
  "encoding/json"
  "os"
  "os/exec"
  "path/filepath"
  "runtime"
  "strconv"
  "strings"
  "testing"
)

type transformResult struct {
  TypeScript map[string]string `json:"typescript"`
}

// packageRoot resolves the `packages/paths` module root from this external
// test package. Command tests run from that directory so `go run ./plugin`
// exercises the native sidecar the same way a host process would.
func packageRoot(t *testing.T) string {
  t.Helper()
  _, file, _, ok := runtime.Caller(0)
  if !ok {
    t.Fatal("could not resolve helper path")
  }
  return filepath.Dir(filepath.Dir(file))
}

// runPlugin executes the paths plugin through its command entrypoint. Optional
// TTSC_PLUGIN_COVERDIR instrumentation lets command-wrapper coverage be merged
// separately from this external test package.
func runPlugin(t *testing.T, args ...string) (int, string, string) {
  t.Helper()
  goArgs := []string{"run"}
  if coverDir := os.Getenv("TTSC_PLUGIN_COVERDIR"); coverDir != "" {
    if err := os.MkdirAll(coverDir, 0o755); err != nil {
      t.Fatal(err)
    }
    goArgs = append(goArgs, "-cover", "-covermode=atomic", "-coverpkg=./plugin,./driver")
  }
  goArgs = append(goArgs, "./plugin")
  cmd := exec.Command("go", append(goArgs, args...)...)
  cmd.Dir = packageRoot(t)
  if coverDir := os.Getenv("TTSC_PLUGIN_COVERDIR"); coverDir != "" {
    cmd.Env = append(os.Environ(), "GOCOVERDIR="+coverDir)
  }
  out, err := cmd.Output()
  stderr := ""
  if exit, ok := err.(*exec.ExitError); ok {
    stderr = string(exit.Stderr)
    if status, ok := goRunExitStatus(stderr); ok {
      return status, string(out), stderr
    }
    return exit.ExitCode(), string(out), stderr
  }
  if err != nil {
    t.Fatalf("go run ./plugin failed before exit code: %v", err)
  }
  return 0, string(out), stderr
}

// goRunExitStatus unwraps non-zero process statuses reported by `go run`.
func goRunExitStatus(stderr string) (int, bool) {
  for _, line := range strings.Split(strings.TrimSpace(stderr), "\n") {
    line = strings.TrimSpace(line)
    if !strings.HasPrefix(line, "exit status ") {
      continue
    }
    value := strings.TrimPrefix(line, "exit status ")
    status, err := strconv.Atoi(value)
    if err != nil {
      return 0, false
    }
    return status, true
  }
  return 0, false
}

// seedProject creates a project-shaped fixture tree for command-frontdoor
// tests. The sidecar is intentionally tested through real files and tsconfig.
func seedProject(t *testing.T, files map[string]string) string {
  t.Helper()
  root := t.TempDir()
  for name, text := range files {
    file := filepath.Join(root, filepath.FromSlash(name))
    if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(file, []byte(text), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  return root
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

// readFile reads emitted build output for assertions against the sidecar's
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
  return seedProject(t, map[string]string{
    "tsconfig.json":      `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true,"paths":{"@lib/*":["./src/lib/*"]},"outDir":"dist","rootDir":"src"},"include":["src"]}`,
    "src/lib/message.ts": `export const message = "ok";` + "\n",
    "src/main.ts":        `import { message } from "@lib/message";` + "\n" + `export const value = message;` + "\n",
  })
}
