//go:build e2e

package ttsc_test

import (
  "bytes"
  "errors"
  "fmt"
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
// Stdout and stderr are captured separately on both zero and nonzero exit.
// Buffers preserve full observed bytes; they have no independent byte cap.
//
// Review grounds below cover this declaration and its callees.
// Go Evidence addresses exported declarations only; these native grounds
// remain part of the owning operation review rather than automated coverage.
//
// Common: Principled implementation: Explicit stdout and stderr writers retain each actual stream even on status zero; ExitError contributes status rather than substituting its prefix/suffix stderr capture.
// Common: Clear and simple design: One synchronous cmd.Run owns both stream buffers and preserves the caller's argv and cwd.
// Common: Prohibited implementation shortcuts: Successful stderr is observed rather than fabricated empty; status and case expectations are not replaced or retried.
// Common: Meaningful documentation: Native prose states stream separation, full-byte observation and the absent independent output cap.
// Portability: OS-neutral implementation: Native executable, cwd and argv remain separate Go process inputs; bytes.Buffer retains protocol/output bytes without OS text conversion.
// Performance: Efficient algorithms: Each output stream is copied once into its invocation-local buffer with work proportional to observed bytes.
// Performance: Reuse equivalent work: The existing once-built artifact serves these fresh effectful command invocations; stream results remain specific to each argv/cwd execution.
// Performance: Bound retention and release resources: cmd.Run waits for the child and stream copying before return. Both buffers last through this invocation's returned strings; output bytes have no independent cap and no per-command timeout is introduced.
func runBuiltNativeCommandInDir(t *testing.T, dir string, args ...string) (int, string, string) {
  t.Helper()
  cmd := exec.Command(buildNativeCommandBinary(t), args...)
  cmd.Dir = dir
  if coverDir := os.Getenv("TTSC_NATIVE_COMMAND_COVERDIR"); coverDir != "" {
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
    t.Fatalf("built ttsc failed before exit code: %v\nstdout=%q\nstderr=%q", err, stdout.String(), stderr.String())
  }
  return 0, stdout.String(), stderr.String()
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
//
// @evidence contracts/common.md#principled-implementation m.Run completes before the nativeCommandBuild producer directory is released; failures in cleanup convert the suite exit to failure rather than certifying an unreleased artifact. All command consumers wait for child completion before returning.
// @evidence contracts/common.md#clear-and-simple-design The suite exit hook is the sole shared-artifact reclamation owner; individual case cleanup cannot remove an artifact still needed by another case or a count repetition.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Bounded retries apply only to actual Windows access/share denials after joined executable use, matching Go TempDir image-release behavior. No arbitrary failure is ignored, producer replaced or case skipped.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs state suite ownership, waited command lifetimes and the bounded Windows release distinction; a blank comment line separates those facts from these acknowledgments. No repository prose changes are needed.
// @evidence contracts/performance.md#efficient-algorithms The exit hook delegates one recursive removal of the one suite artifact directory; its work scales with the bounded authored producer files. A Windows transient denial retries the same operation at 10 ms intervals for at most two seconds, without scanning unrelated paths.
// @evidence contracts/performance.md#reuse-equivalent-work The sync.Once producer and its fixed source, toolchain and coverage inputs stay valid for all cases and count repetitions; the exit hook retains that shared artifact until the final consumer returns. A new Go test process rebuilds instead of reusing unvalidated historical state.
// @evidence contracts/performance.md#bound-retention-and-release-resources The suite owns one temporary producer directory, one compiled command artifact and one cached build outcome. The retained population does not grow with case count. Successful and failed m.Run paths both attempt release, and cleanup failure is a suite failure.
// @evidence contracts/portability.md#os-neutral-implementation filepath and Go process APIs own native paths and argv. Windows uses the executable suffix and recognizes only native access/share error codes for bounded removal retries; this does not infer filesystem case policy. POSIX removal errors return immediately.
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

