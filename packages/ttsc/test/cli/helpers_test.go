package ttsc_test

import (
  "errors"
  "fmt"
  "io"
  "os"
  "os/exec"
  "path/filepath"
  "runtime"
  "strings"
  "sync"
  "syscall"
  "testing"
  "time"
)

type apiDiagnostic struct {
  Category    string `json:"category"`
  MessageText string `json:"messageText"`
}

type apiCompileResult struct {
  Diagnostics []apiDiagnostic   `json:"diagnostics,omitempty"`
  Output      map[string]string `json:"output"`
}

type apiTransformResult struct {
  Diagnostics []apiDiagnostic   `json:"diagnostics,omitempty"`
  TypeScript  map[string]string `json:"typescript"`
}

type utilityTransformResult struct {
  TypeScript map[string]string `json:"typescript"`
}

// packageRoot returns the `packages/ttsc` module root from this black-box test
// package. Command tests build there using
// the same module graph as a developer running the native host by hand.
func packageRoot(t *testing.T) string {
  t.Helper()
  _, file, _, ok := runtime.Caller(0)
  if !ok {
    t.Fatal("could not resolve test helper path")
  }
  return filepath.Dir(filepath.Dir(filepath.Dir(file)))
}

// writeProjectFile materializes one project-shaped fixture file. The tests in
// this package intentionally build real tsconfig projects instead of mocking
// compiler internals, so each scenario owns its whole temporary project tree.
func writeProjectFile(t *testing.T, root, name, contents string) {
  t.Helper()
  file := filepath.Join(root, filepath.FromSlash(name))
  if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(file, []byte(contents), 0o644); err != nil {
    t.Fatal(err)
  }
}

// runNativeCommand starts a fresh process using the suite's one native artifact.
func runNativeCommand(t *testing.T, args ...string) (int, string, string) {
  t.Helper()
  return runBuiltNativeCommandInDir(t, packageRoot(t), args...)
}

// runBuiltNativeCommandInDir preserves each caller's cwd, arguments and streams.
func runBuiltNativeCommandInDir(t *testing.T, dir string, args ...string) (int, string, string) {
  t.Helper()
  cmd := exec.Command(buildNativeCommandBinary(t), args...)
  cmd.Dir = dir
  if coverDir := os.Getenv("TTSC_NATIVE_COMMAND_COVERDIR"); coverDir != "" {
    cmd.Env = append(os.Environ(), "GOCOVERDIR="+coverDir)
  }
  out, err := cmd.Output()
  if exit, ok := err.(*exec.ExitError); ok {
    return exit.ExitCode(), string(out), string(exit.Stderr)
  }
  if err != nil {
    t.Fatalf("built ttsc failed before exit code: %v", err)
  }
  return 0, string(out), ""
}

// Product sources, build flags and toolchain remain fixed in this test package.
// TestMain owns the artifact through all cases, parallel callers and -count runs;
// no individual case cleanup may delete a later consumer's binary.
var nativeCommandBuild struct {
  once      sync.Once
  directory string
  binary    string
  err       error
}

// TestMain releases the suite-owned command only after every case has returned.
func TestMain(m *testing.M) {
  code := m.Run()
  if nativeCommandBuild.directory != "" {
    if err := removeCommandTestDirectory(nativeCommandBuild.directory); err != nil {
      fmt.Fprintf(os.Stderr, "remove ttsc command test artifact: %v\n", err)
      code = 1
    }
  }
  os.Exit(code)
}

// removeCommandTestDirectory follows testing.TempDir's bounded Windows cleanup
// policy (Go issues 50051 and 51442): a waited-for command image can still carry
// transient access/share denial. Other errors and persistent locks remain failures.
func removeCommandTestDirectory(directory string) error {
  const windowsAccessDenied = syscall.Errno(5)
  const windowsSharingViolation = syscall.Errno(32)
  deadline := time.Now().Add(2 * time.Second)
  for {
    err := os.RemoveAll(directory)
    if runtime.GOOS != "windows" ||
      (!errors.Is(err, windowsAccessDenied) && !errors.Is(err, windowsSharingViolation)) ||
      time.Now().Add(10*time.Millisecond).After(deadline) {
      return err
    }
    time.Sleep(10 * time.Millisecond)
  }
}

// buildNativeCommandBinary links once for fresh command processes. A failed producer
// remains a failure for every dependent case rather than being retried or skipped.
func buildNativeCommandBinary(t *testing.T) string {
  t.Helper()
  nativeCommandBuild.once.Do(func() {
    directory, err := os.MkdirTemp(os.Getenv("GOTMPDIR"), "ttsc-command-test-")
    nativeCommandBuild.directory = directory
    if err != nil {
      nativeCommandBuild.err = err
      return
    }
    binary := filepath.Join(directory, "ttsc")
    if runtime.GOOS == "windows" {
      binary += ".exe"
    }
    goArgs := []string{"build", "-o", binary}
    if coverDir := os.Getenv("TTSC_NATIVE_COMMAND_COVERDIR"); coverDir != "" {
      if err := os.MkdirAll(coverDir, 0o755); err != nil {
        nativeCommandBuild.err = err
        return
      }
      goArgs = append(goArgs, "-cover", "-covermode=atomic", "-coverpkg="+nativeCommandCoverPackages())
    }
    goArgs = append(goArgs, "./cmd/ttsc")
    build := exec.Command("go", goArgs...)
    build.Dir = packageRoot(t)
    if output, err := build.CombinedOutput(); err != nil {
      nativeCommandBuild.err = fmt.Errorf("go build ./cmd/ttsc: %w\n%s", err, output)
      return
    }
    nativeCommandBuild.binary = binary
  })
  if nativeCommandBuild.err != nil {
    t.Fatalf("ttsc command producer failed: %v", nativeCommandBuild.err)
  }
  return nativeCommandBuild.binary
}

// nativeCommandCoverPackages lists the packages charged to command-frontdoor
// coverage when TTSC_NATIVE_COMMAND_COVERDIR asks these black-box tests to emit
// native Go coverage profiles.
func nativeCommandCoverPackages() string {
  return strings.Join([]string{
    "github.com/samchon/ttsc/packages/ttsc/cmd/ttsc",
    "github.com/samchon/ttsc/packages/ttsc/driver",
    "github.com/samchon/ttsc/packages/ttsc/utility",
  }, ",")
}

// captureUtilityOutput redirects process stdout/stderr around utility package
// entrypoints. The utility host intentionally writes to os.Stdout/os.Stderr
// because it is a command-sidecar API; the test captures those real streams.
func captureUtilityOutput(t *testing.T, fn func() int) (int, string, string) {
  t.Helper()
  prevOut, prevErr := os.Stdout, os.Stderr
  outReader, outWriter, err := os.Pipe()
  if err != nil {
    t.Fatal(err)
  }
  errReader, errWriter, err := os.Pipe()
  if err != nil {
    t.Fatal(err)
  }
  os.Stdout = outWriter
  os.Stderr = errWriter
  code := fn()
  if err := outWriter.Close(); err != nil {
    t.Fatal(err)
  }
  if err := errWriter.Close(); err != nil {
    t.Fatal(err)
  }
  os.Stdout = prevOut
  os.Stderr = prevErr
  out, err := io.ReadAll(outReader)
  if err != nil {
    t.Fatal(err)
  }
  errOut, err := io.ReadAll(errReader)
  if err != nil {
    t.Fatal(err)
  }
  return code, string(out), string(errOut)
}
