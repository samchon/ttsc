package ttscserver_test

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// packageRoot returns the `packages/ttsc` module root from this black-box test
// package. ttscserver command tests run from there so `go run ./cmd/ttscserver`
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
const root = path.dirname(require.resolve("@typescript/native-preview/package.json", { paths: [process.cwd()] }));
const platformPackage = "@typescript/native-preview-" + process.platform + "-" + process.arch;
const platformRoot = path.dirname(require.resolve(platformPackage + "/package.json", { paths: [root] }));
process.stdout.write(path.join(platformRoot, "lib", process.platform === "win32" ? "tsgo.exe" : "tsgo"));
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

// buildTtscserverBinary builds the ttscserver binary into a temp directory.
// Reusing the same temp directory across a test run would let subprocesses
// share it, but go test isolates each Test* per process so the simple
// per-test build is fine for the tiny package.
func buildTtscserverBinary(t *testing.T) string {
	t.Helper()
	bin := filepath.Join(t.TempDir(), "ttscserver")
	if filepath.Separator == '\\' {
		bin += ".exe"
	}
	goArgs := []string{"build"}
	if coverDir := os.Getenv("TTSC_NATIVE_COMMAND_COVERDIR"); coverDir != "" {
		if err := os.MkdirAll(coverDir, 0o755); err != nil {
			t.Fatal(err)
		}
		goArgs = append(goArgs,
			"-cover",
			"-covermode=atomic",
			"-coverpkg="+nativeCommandCoverPackages(),
		)
	}
	goArgs = append(goArgs, "-o", bin, "./cmd/ttscserver")
	build := exec.Command("go", goArgs...)
	build.Dir = packageRoot(t)
	if output, err := build.CombinedOutput(); err != nil {
		t.Fatalf("go build ./cmd/ttscserver failed: %v\n%s", err, output)
	}
	return bin
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
