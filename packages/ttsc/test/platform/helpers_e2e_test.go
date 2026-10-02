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
  "sync"
  "syscall"
  "testing"
  "time"
)

// platformPackageRoot returns the `packages/ttsc` module root from this
// black-box test package. Platform command tests run from there so
// the suite build sees the same module graph as a developer building
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
// point using the suite's one compiled artifact. This keeps tests black-box:
// only exit code, stdout, and stderr are observed.
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
func runPlatformCommand(t *testing.T, args ...string) (int, string, string) {
  t.Helper()
  cmd := exec.Command(buildPlatformCommand(t), args...)
  cmd.Dir = platformPackageRoot(t)
  if coverDir := os.Getenv("TTSC_PLATFORM_COMMAND_COVERDIR"); coverDir != "" {
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
    t.Fatalf("platform command failed before exit code: %v\nstdout=%q\nstderr=%q", err, stdout.String(), stderr.String())
  }
  return 0, stdout.String(), stderr.String()
}

// The source, toolchain and coverage settings are fixed for the test process.
// A failed build remains visible to every consumer; cases cannot delete a shared
// artifact before another consumer runs, including repeated -count execution.
var platformCommandBuild struct {
  once sync.Once
  directory string
  binary string
  err error
}

func buildPlatformCommand(t *testing.T) string {
  t.Helper()
  platformCommandBuild.once.Do(func() {
    directory, err := os.MkdirTemp(os.Getenv("GOTMPDIR"), "ttsc-platform-test-")
    platformCommandBuild.directory = directory
    if err != nil {
      platformCommandBuild.err = err
      return
    }
    binary := filepath.Join(directory, "platform")
    if runtime.GOOS == "windows" { binary += ".exe" }
    args := []string{"build", "-o", binary}
    if coverDir := os.Getenv("TTSC_PLATFORM_COMMAND_COVERDIR"); coverDir != "" {
      if err := os.MkdirAll(coverDir, 0o755); err != nil {
        platformCommandBuild.err = err
        return
      }
      args = append(args, "-cover", "-covermode=atomic", "-coverpkg=github.com/samchon/ttsc/packages/ttsc/cmd/platform")
    }
    build := exec.Command("go", append(args, "./cmd/platform")...)
    build.Dir = platformPackageRoot(t)
    if output, err := build.CombinedOutput(); err != nil {
      platformCommandBuild.err = fmt.Errorf("build platform: %w\n%s", err, output)
      return
    }
    platformCommandBuild.binary = binary
  })
  if platformCommandBuild.err != nil { t.Fatalf("platform producer failed: %v", platformCommandBuild.err) }
  return platformCommandBuild.binary
}

// TestMain joins the artifact lifetime after every command has been waited for.
// Windows can briefly retain an exited image; only its access/share denials are
// retried, matching Go TempDir cleanup, and persistent failure fails the suite.
//
// @evidence contracts/common.md#principled-implementation m.Run completes before the platformCommandBuild producer directory is released; failures in cleanup convert the suite exit to failure rather than certifying an unreleased artifact. All command consumers wait for child completion before returning.
// @evidence contracts/common.md#clear-and-simple-design The suite exit hook is the sole shared-artifact reclamation owner; individual case cleanup cannot remove an artifact still needed by another case or a count repetition.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Bounded retries apply only to actual Windows access/share denials after joined executable use, matching Go TempDir image-release behavior. No arbitrary failure is ignored, producer replaced or case skipped.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs state suite ownership, waited command lifetimes and the bounded Windows release distinction; a blank comment line separates those facts from these acknowledgments. No repository prose changes are needed.
// @evidence contracts/performance.md#efficient-algorithms The exit hook delegates one recursive removal of the one suite artifact directory; its work scales with the bounded authored producer files. A Windows transient denial retries the same operation at 10 ms intervals for at most two seconds, without scanning unrelated paths.
// @evidence contracts/performance.md#reuse-equivalent-work The sync.Once producer and its fixed source, toolchain and coverage inputs stay valid for all cases and count repetitions; the exit hook retains that shared artifact until the final consumer returns. A new Go test process rebuilds instead of reusing unvalidated historical state.
// @evidence contracts/performance.md#bound-retention-and-release-resources The suite owns one temporary producer directory, one compiled command artifact and one cached build outcome. The retained population does not grow with case count. Successful and failed m.Run paths both attempt release, and cleanup failure is a suite failure.
// @evidence contracts/portability.md#os-neutral-implementation filepath and Go process APIs own native paths and argv. Windows uses the executable suffix and recognizes only native access/share error codes for bounded removal retries; this does not infer filesystem case policy. POSIX removal errors return immediately.
func TestMain(m *testing.M) {
  code := m.Run()
  if directory := platformCommandBuild.directory; directory != "" {
    deadline := time.Now().Add(2*time.Second)
    for {
      err := os.RemoveAll(directory)
      if runtime.GOOS == "windows" && (errors.Is(err, syscall.Errno(5)) || errors.Is(err, syscall.Errno(32))) && time.Now().Add(10*time.Millisecond).Before(deadline) {
        time.Sleep(10*time.Millisecond)
        continue
      }
      if err != nil { fmt.Fprintf(os.Stderr, "remove platform artifact: %v\n", err); code = 1 }
      break
    }
  }
  os.Exit(code)
}