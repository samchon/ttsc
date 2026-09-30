package paths_test

import (
  "bytes"
  "encoding/json"
  "fmt"
  "os"
  "os/exec"
  "path/filepath"
  "runtime"
  "sync"
  "testing"
)

type transformResult struct {
  TypeScript map[string]string `json:"typescript"`
}

// packageRoot resolves the `packages/paths` module root from this external
// test package. Command tests run from that directory so the shared native producer
// exercises the native sidecar the same way a host process would.
func packageRoot(t *testing.T) string {
  t.Helper()
  if directory := os.Getenv("TTSC_UTILITY_TEST_MODULE_ROOT"); directory != "" {
    if _, err := os.Stat(filepath.Join(directory, "go.mod")); err != nil {
      t.Fatalf("prepared utility module root: %v", err)
    }
    return directory
  }
  _, file, _, ok := runtime.Caller(0)
  if !ok {
    t.Fatal("could not resolve helper path")
  }
  directory := filepath.Dir(file)
  for {
    if _, err := os.Stat(filepath.Join(directory, "go.mod")); err == nil {
      return directory
    }
    parent := filepath.Dir(directory)
    if parent == directory {
      t.Fatalf("helper source %q has no enclosing Go module", file)
    }
    directory = parent
  }
}

// One immutable producer is shared by this test process; invocation state is not.
var pluginBinaryOnce sync.Once
var pluginBinaryPath string
var pluginBinaryDirectory string
var pluginBinaryError error

// TestMain releases the producer directory owned by this test process after
// all cases, including failing cases, finish. A suite-supplied binary remains
// the suite runner's responsibility; each invocation still has its own process.
// Failed deletion reports status 1 and may leave files for later cleanup.
// Abrupt termination or a test panic can prevent this normal cleanup path.
//
// @evidence contracts/common.md#principled-implementation sync.Once resolves one producer before concurrent callers execute it; m.Run completes the population before releasing only the fallback directory acquired by this process.
// @evidence contracts/common.md#clear-and-simple-design TestMain owns release, resolvePluginBinary owns acquisition and runPlugin owns independent invocation; the supplied-binary branch has no hidden rebuild.
// @evidence contracts/common.md#prohibited-implementation-shortcuts These helpers execute the actual compiled plugin with original arguments and separate fixtures; they do not replace product methods, globals, statuses or output expectations.
// @evidence contracts/common.md#meaningful-documentation The declaration documents fallback ownership, runner ownership and the abrupt-termination limitation separately from these acknowledgments; private helper comments explain reuse and both captured streams.
// @evidence contracts/performance.md#efficient-algorithms Producer resolution and its admission stat occur once per Go test process; the caller-provided module context is checked per invocation, and commands execute directly instead of reentering the Go build tool for each of N cases. Capturing B output bytes costs O(B) time and temporary storage with no imposed byte cap.
// @evidence contracts/performance.md#reuse-equivalent-work Only immutable producer bytes from the same checkout, Go workspace and inherited toolchain flags are reused during this process; configuration and fixture state remain per invocation, and a new suite invocation rebuilds after source changes.
// @evidence contracts/performance.md#bound-retention-and-release-resources At most one fallback directory and producer are retained until m.Run returns, then RemoveAll attempts release; deletion failure reports status 1 and may leave that directory. Supplied bytes are released by the runner, and hard termination has no guaranteed cleanup.
// @evidence contracts/portability.md#os-neutral-implementation filepath joins native paths and exec.Command preserves individual arguments without a shell; only the executable suffix uses GOOS, and actual process ExitCode and separate byte streams supply the result without parsing platform-dependent Go-tool diagnostics.
func TestMain(m *testing.M) {
  status := m.Run()
  if pluginBinaryDirectory != "" {
    if err := os.RemoveAll(pluginBinaryDirectory); err != nil {
      fmt.Fprintf(os.Stderr, "cleanup native producer: %v\n", err)
      status = 1
    }
  }
  os.Exit(status)
}

// resolvePluginBinary reuses one real producer with inherited toolchain flags.
// A supplied binary is mandatory, not a hint that permits an unobserved rebuild.
func resolvePluginBinary(t *testing.T) string {
  t.Helper()
  pluginBinaryOnce.Do(func() {
    pluginBinaryPath = os.Getenv("TTSC_UTILITY_TEST_BINARY")
    if pluginBinaryPath != "" {
      if _, err := os.Stat(pluginBinaryPath); err != nil {
        pluginBinaryError = fmt.Errorf("prepared native producer: %w", err)
      }
      return
    }
    pluginBinaryDirectory, pluginBinaryError = os.MkdirTemp("", "ttsc-paths-test-producer-")
    if pluginBinaryError != nil {
      return
    }
    pluginBinaryPath = filepath.Join(pluginBinaryDirectory, "plugin")
    if runtime.GOOS == "windows" {
      pluginBinaryPath += ".exe"
    }
    buildArgs := []string{"build", "-o", pluginBinaryPath}
    if os.Getenv("TTSC_PLUGIN_COVERDIR") != "" {
      buildArgs = append(buildArgs, "-cover", "-covermode=atomic", "-coverpkg=./plugin,./driver")
    }
    buildArgs = append(buildArgs, "./plugin")
    command := exec.Command("go", buildArgs...)
    command.Dir = packageRoot(t)
    if output, err := command.CombinedOutput(); err != nil {
      pluginBinaryError = fmt.Errorf("build native producer: %w\n%s", err, output)
    }
  })
  if pluginBinaryError != nil {
    t.Fatal(pluginBinaryError)
  }
  return pluginBinaryPath
}

// runPlugin captures the real producer status and both streams on every exit.
// Each invocation gets its own process and fixture state; only compiled bytes are shared.
func runPlugin(t *testing.T, args ...string) (int, string, string) {
  t.Helper()
  cmd := exec.Command(resolvePluginBinary(t), args...)
  cmd.Dir = packageRoot(t)
  if coverDir := os.Getenv("TTSC_PLUGIN_COVERDIR"); coverDir != "" {
    if err := os.MkdirAll(coverDir, 0o755); err != nil {
      t.Fatal(err)
    }
    cmd.Env = append(os.Environ(), "GOCOVERDIR="+coverDir)
  }
  var stdout, stderr bytes.Buffer
  cmd.Stdout = &stdout
  cmd.Stderr = &stderr
  err := cmd.Run()
  if exit, ok := err.(*exec.ExitError); ok {
    return exit.ExitCode(), stdout.String(), stderr.String()
  }
  if err != nil {
    t.Fatalf("native producer failed before exit code: %v", err)
  }
  return 0, stdout.String(), stderr.String()
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
