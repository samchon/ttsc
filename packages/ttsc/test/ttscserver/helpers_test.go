package ttscserver_test

import (
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
// package. The shared command builds there so it
// sees the same module graph as a developer launching the LSP host by hand.
func packageRoot(t *testing.T) string {
  t.Helper()
  _, file, _, ok := runtime.Caller(0)
  if !ok {
    t.Fatal("could not resolve test helper path")
  }
  return filepath.Dir(filepath.Dir(filepath.Dir(file)))
}

// runTtscserver executes the ttscserver binary with the given args from the
// `packages/ttsc` module root and returns its exit code, stdout, and stderr.
// Tests use it for cases where the cwd should be the package root (default).
func runTtscserver(t *testing.T, args ...string) (int, string, string) {
  t.Helper()
  return runTtscserverWithStdin(t, "", args...)
}

// runTtscserverWithStdin runs the command with the supplied stdin payload. An
// empty payload closes stdin immediately so the LSP host sees EOF and shuts
// down cleanly — useful for exercising the happy-path return paths without
// driving a real LSP handshake.
func runTtscserverWithStdin(t *testing.T, stdin string, args ...string) (int, string, string) {
  t.Helper()
  return runTtscserverFromDir(t, packageRoot(t), stdin, args...)
}

// runTtscserverFromDir runs the command from an explicit working directory.
// Use it when a test needs the spawned binary to see a particular cwd (e.g.,
// to exercise the implicit-cwd Getwd path).
func runTtscserverFromDir(t *testing.T, runDir, stdin string, args ...string) (int, string, string) {
  t.Helper()
  bin := buildTtscserverBinary(t)

  cmd := exec.Command(bin, args...)
  cmd.Dir = runDir
  cmd.Stdin = strings.NewReader(stdin)
  cmd.Env = append(os.Environ(), "TTSC_TSGO_BINARY="+tsgoBinaryForCommandTest(t))
  if coverDir := os.Getenv("TTSC_NATIVE_COMMAND_COVERDIR"); coverDir != "" {
    cmd.Env = append(cmd.Env, "GOCOVERDIR="+coverDir)
  }
  out, err := cmd.Output()
  stderr := ""
  if exit, ok := err.(*exec.ExitError); ok {
    stderr = string(exit.Stderr)
    return exit.ExitCode(), string(out), stderr
  }
  if err != nil {
    t.Fatalf("ttscserver failed before exit code: %v", err)
  }
  return 0, string(out), stderr
}

func tsgoBinaryForCommandTest(t *testing.T) string {
  t.Helper()
  if binary := os.Getenv("TTSC_TSGO_BINARY"); binary != "" {
    return binary
  }
  script := `
const path = require("node:path");
const root = path.dirname(require.resolve("typescript/package.json", { paths: [process.cwd()] }));
const platformPackage = "@typescript/typescript-" + process.platform + "-" + process.arch;
const platformRoot = path.dirname(require.resolve(platformPackage + "/package.json", { paths: [root] }));
process.stdout.write(path.join(platformRoot, "lib", process.platform === "win32" ? "tsc.exe" : "tsc"));
`
  cmd := exec.Command("node", "-e", script)
  cmd.Dir = packageRoot(t)
  output, err := cmd.CombinedOutput()
  if err != nil {
    t.Fatalf("could not resolve tsgo binary: %v\n%s", err, output)
  }
  binary := strings.TrimSpace(string(output))
  if _, err := os.Stat(binary); err != nil {
    t.Fatalf("resolved tsgo binary is not usable: %s: %v", binary, err)
  }
  return binary
}

// Product sources, build flags and toolchain remain fixed in this test package.
// TestMain owns the artifact through all cases, parallel callers and -count runs;
// no individual case cleanup may delete a later consumer's binary.
var ttscserverBuild struct {
  once      sync.Once
  directory string
  binary    string
  err       error
}

// TestMain releases the suite-owned command only after every case has returned.
func TestMain(m *testing.M) {
  code := m.Run()
  if ttscserverBuild.directory != "" {
    if err := removeCommandTestDirectory(ttscserverBuild.directory); err != nil {
      fmt.Fprintf(os.Stderr, "remove ttscserver command test artifact: %v\n", err)
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

// buildTtscserverBinary links once for fresh command processes. A failed producer
// remains a failure for every dependent case rather than being retried or skipped.
func buildTtscserverBinary(t *testing.T) string {
  t.Helper()
  ttscserverBuild.once.Do(func() {
    directory, err := os.MkdirTemp(os.Getenv("GOTMPDIR"), "ttscserver-command-test-")
    ttscserverBuild.directory = directory
    if err != nil {
      ttscserverBuild.err = err
      return
    }
    binary := filepath.Join(directory, "ttscserver")
    if runtime.GOOS == "windows" {
      binary += ".exe"
    }
    goArgs := []string{"build", "-o", binary}
    if coverDir := os.Getenv("TTSC_NATIVE_COMMAND_COVERDIR"); coverDir != "" {
      if err := os.MkdirAll(coverDir, 0o755); err != nil {
        ttscserverBuild.err = err
        return
      }
      goArgs = append(goArgs, "-cover", "-covermode=atomic", "-coverpkg="+nativeCommandCoverPackages())
    }
    goArgs = append(goArgs, "./cmd/ttscserver")
    build := exec.Command("go", goArgs...)
    build.Dir = packageRoot(t)
    if output, err := build.CombinedOutput(); err != nil {
      ttscserverBuild.err = fmt.Errorf("go build ./cmd/ttscserver: %w\n%s", err, output)
      return
    }
    ttscserverBuild.binary = binary
  })
  if ttscserverBuild.err != nil {
    t.Fatalf("ttscserver command producer failed: %v", ttscserverBuild.err)
  }
  return ttscserverBuild.binary
}

// nativeCommandCoverPackages lists the packages charged to coverage profiles
// when ttscserver black-box tests run with TTSC_NATIVE_COMMAND_COVERDIR. The
// list mirrors the cli helper so a single -coverpkg arg covers both binaries.
func nativeCommandCoverPackages() string {
  return strings.Join([]string{
    "github.com/samchon/ttsc/packages/ttsc/cmd/ttsc",
    "github.com/samchon/ttsc/packages/ttsc/cmd/ttscserver",
    "github.com/samchon/ttsc/packages/ttsc/driver",
    "github.com/samchon/ttsc/packages/ttsc/internal/lspserver",
    "github.com/samchon/ttsc/packages/ttsc/utility",
  }, ",")
}
