package banner_test

import (
  "bytes"
  "encoding/json"
  "fmt"
  "os"
  "os/exec"
  "path/filepath"
  "runtime"
  "strconv"
  "strings"
  "sync"
  "testing"
)

type transformResult struct {
  TypeScript map[string]string `json:"typescript"`
}

// packageRoot resolves the `packages/banner` module root from this external
// test package. Command tests run from that directory so the shared native producer
// observes the same go.mod boundary as the native sidecar binary.
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
    pluginBinaryDirectory, pluginBinaryError = os.MkdirTemp("", "ttsc-banner-test-producer-")
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

// seedProject materializes a project-shaped fixture tree. The banner plugin is
// tested through real tsconfig projects rather than mocked compiler inputs.
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

// mustJSON serializes plugin manifests used by the sidecar command tests.
func mustJSON(t *testing.T, value any) string {
  t.Helper()
  data, err := json.Marshal(value)
  if err != nil {
    t.Fatal(err)
  }
  return string(data)
}

// readFile reads emitted project output and fails the test with the path still
// present in the stack when output is missing.
func readFile(t *testing.T, file string) string {
  t.Helper()
  data, err := os.ReadFile(file)
  if err != nil {
    t.Fatal(err)
  }
  return string(data)
}

// writeExecutable writes a launcher fixture with executable mode.
func writeExecutable(t *testing.T, file string, contents string) string {
  t.Helper()
  if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(file, []byte(contents), 0o755); err != nil {
    t.Fatal(err)
  }
  return file
}

// writeDirectLauncher writes a fake launcher that prints fixed bytes and
// exits. POSIX gets a `#!/bin/sh` script; Windows cannot spawn an
// extensionless shell script, so it gets the equivalent `.cmd` batch file and
// the returned path carries that extension. Both stay OFF the script-extension
// list, preserving the direct-exec (not node-routed) classification under
// test. Payloads must avoid cmd metacharacters (%, ^, &, |, <, >) ??batch has
// no way to quote them that sh's single quotes would mirror.
func writeDirectLauncher(t *testing.T, file, stdout, stderr string, exitCode int) string {
  t.Helper()
  var b strings.Builder
  if runtime.GOOS == "windows" {
    b.WriteString("@echo off\r\n")
    if stdout != "" {
      b.WriteString("echo " + stdout + "\r\n")
    }
    if stderr != "" {
      // The redirect goes up front: a trailing `1>&2` would emit "x ", and
      // a bare `>&2` glued to a payload ending in a digit would turn that
      // digit into a file-descriptor redirect.
      b.WriteString("1>&2 echo " + stderr + "\r\n")
    }
    b.WriteString("exit /b " + strconv.Itoa(exitCode) + "\r\n")
    return writeExecutable(t, file+".cmd", b.String())
  }
  b.WriteString("#!/bin/sh\n")
  if stdout != "" {
    b.WriteString("printf '" + stdout + "'\n")
  }
  if stderr != "" {
    b.WriteString("printf '" + stderr + "' >&2\n")
  }
  if exitCode != 0 {
    b.WriteString("exit " + strconv.Itoa(exitCode) + "\n")
  }
  return writeExecutable(t, file, b.String())
}

// bannerManifest builds the plugin manifest shape that ttsc passes to native
// plugins through --plugins-json. It writes a temporary banner.config.cjs file
// in dir exporting an object with a "text" string and returns a manifest that
// references it via "configFile".
func bannerManifest(t *testing.T, dir, text string) string {
  t.Helper()
  configFile := filepath.Join(dir, "banner.config.cjs")
  body := "module.exports = { text: " + mustJSON(t, text) + " };\n"
  if err := os.WriteFile(configFile, []byte(body), 0o644); err != nil {
    t.Fatal(err)
  }
  return mustJSON(t, []map[string]any{{
    "name":  "@ttsc/banner",
    "stage": "transform",
    "config": map[string]any{
      "transform":  "@ttsc/banner",
      "configFile": configFile,
    },
  }})
}

// bannerPrefix mirrors the JSDoc banner text expected from the shared utility
// transform host, keeping build assertions focused on the sidecar contract.
func bannerPrefix(text string) string {
  sep := strings.Repeat("-", 64)
  return "/**\n * " + sep + "\n * " + text + "\n *\n * @packageDocumentation\n */\n"
}
