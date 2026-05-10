package ttsc_test

import (
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"testing"
)

func platformPackageRoot(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not resolve test helper path")
	}
	return filepath.Dir(filepath.Dir(filepath.Dir(file)))
}

func runPlatformCommand(t *testing.T, args ...string) (int, string, string) {
	t.Helper()
	cmd := exec.Command("go", append([]string{"run", "./cmd/platform"}, args...)...)
	cmd.Dir = platformPackageRoot(t)
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
