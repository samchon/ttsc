package ttsc_test

import (
  "os"
  "os/exec"
  "path/filepath"
  "runtime"
  "strconv"
  "strings"
  "testing"
)

// platformPackageRoot returns the `packages/ttsc` module root from this
// black-box test package. Platform command tests run from there so
// `go run ./cmd/platform` sees the same module graph as a developer running
// the helper binary by hand.
func platformPackageRoot(t *testing.T) string {
  t.Helper()
  _, file, _, ok := runtime.Caller(0)
  if !ok {
    t.Fatal("could not resolve test helper path")
  }
  return filepath.Dir(filepath.Dir(filepath.Dir(file)))
}

// runPlatformCommand executes the platform helper binary through its CLI entry
// point via `go run ./cmd/platform`. This keeps platform tests black-box:
// only exit code, stdout, and stderr are observed.
func runPlatformCommand(t *testing.T, args ...string) (int, string, string) {
  t.Helper()
  goArgs := []string{"run"}
  if coverDir := os.Getenv("TTSC_PLATFORM_COMMAND_COVERDIR"); coverDir != "" {
    if err := os.MkdirAll(coverDir, 0o755); err != nil {
      t.Fatal(err)
    }
    goArgs = append(goArgs, "-cover", "-covermode=atomic", "-coverpkg=github.com/samchon/ttsc/packages/ttsc/cmd/platform")
  }
  cmd := exec.Command("go", append(append(goArgs, "./cmd/platform"), args...)...)
  cmd.Dir = platformPackageRoot(t)
  if coverDir := os.Getenv("TTSC_PLATFORM_COMMAND_COVERDIR"); coverDir != "" {
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
    t.Fatalf("go run ./cmd/platform failed before exit code: %v", err)
  }
  return 0, string(out), stderr
}

// goRunExitStatus recovers the wrapped program exit code from `go run`.
// The Go tool exits with status 1 for any non-zero program status and appends
// `exit status N` to stderr, so platform command tests need this small unwrap.
func goRunExitStatus(stderr string) (int, bool) {
  for _, line := range strings.Split(strings.TrimSpace(stderr), "\n") {
    line = strings.TrimSpace(line)
    if !strings.HasPrefix(line, "exit status ") {
      continue
    }
    status, err := strconv.Atoi(strings.TrimPrefix(line, "exit status "))
    if err != nil {
      return 0, false
    }
    return status, true
  }
  return 0, false
}
