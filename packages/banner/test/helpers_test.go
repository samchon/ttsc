package banner_test

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

// packageRoot resolves the `packages/banner` module root from this external
// test package. Command tests run from that directory so `go run ./plugin`
// observes the same go.mod boundary as the native sidecar binary.
func packageRoot(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not resolve helper path")
	}
	return filepath.Dir(filepath.Dir(file))
}

// runPlugin executes the banner plugin through its real command entrypoint.
// When TTSC_PLUGIN_COVERDIR is set, the subprocess is instrumented with Go's
// command coverage so wrapper branches can be measured from this test package.
func runPlugin(t *testing.T, args ...string) (int, string, string) {
	t.Helper()
	goArgs := []string{"run"}
	if coverDir := os.Getenv("TTSC_PLUGIN_COVERDIR"); coverDir != "" {
		if err := os.MkdirAll(coverDir, 0o755); err != nil {
			t.Fatal(err)
		}
		goArgs = append(goArgs, "-cover", "-coverpkg=./plugin")
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

// goRunExitStatus recovers the wrapped program's status from `go run`, which
// reports non-zero program exits as a Go tool failure with `exit status N`.
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

// bannerManifest builds the plugin manifest shape that ttsc passes to native
// first-party plugins through --plugins-json.
func bannerManifest(t *testing.T, text string) string {
	t.Helper()
	return mustJSON(t, []map[string]any{{
		"name":  "@ttsc/banner",
		"stage": "transform",
		"config": map[string]any{
			"transform": "@ttsc/banner",
			"text":      text,
		},
	}})
}

// bannerPrefix mirrors the JSDoc banner text expected from the shared utility
// transform host, keeping build assertions focused on the sidecar contract.
func bannerPrefix(text string) string {
	sep := strings.Repeat("-", 64)
	return "/**\n * " + sep + "\n * " + text + "\n *\n * @packageDocumentation\n */\n"
}
