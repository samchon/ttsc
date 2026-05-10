package strip_test

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

// packageRoot resolves the `packages/strip` module root from this external
// test package. Command tests execute `go run ./plugin` from that root.
func packageRoot(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not resolve helper path")
	}
	return filepath.Dir(filepath.Dir(file))
}

// runPlugin executes the strip sidecar exactly through its command entrypoint.
// TTSC_PLUGIN_COVERDIR optionally enables Go command coverage for subprocess
// branches that this external test package cannot otherwise count.
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

// goRunExitStatus extracts the sidecar exit code from the `go run` wrapper
// error text.
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

// seedProject writes a self-contained TypeScript fixture project under a fresh
// temporary directory.
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

// mustJSON serializes the native plugin manifest shape expected by the sidecar.
func mustJSON(t *testing.T, value any) string {
	t.Helper()
	data, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

// readFile loads emitted JavaScript output for build assertions.
func readFile(t *testing.T, file string) string {
	t.Helper()
	data, err := os.ReadFile(file)
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

// stripManifest returns the first-party plugin manifest sent through
// --plugins-json by ttsc's native plugin host.
func stripManifest(t *testing.T) string {
	t.Helper()
	return mustJSON(t, []map[string]any{{
		"name":  "@ttsc/strip",
		"stage": "transform",
		"config": map[string]any{
			"transform": "@ttsc/strip",
		},
	}})
}

// seedStripProject creates a reusable fixture with removable debugger and
// console.log statements. withOutDir selects build-ready output settings.
func seedStripProject(t *testing.T, withOutDir bool) string {
	t.Helper()
	compilerOptions := `{"target":"ES2022","module":"commonjs","strict":true}`
	if withOutDir {
		compilerOptions = `{"target":"ES2022","module":"commonjs","strict":true,"outDir":"dist","rootDir":"src"}`
	}
	return seedProject(t, map[string]string{
		"tsconfig.json": `{"compilerOptions":` + compilerOptions + `,"include":["src"]}`,
		"src/main.ts": strings.Join([]string{
			`debugger;`,
			`console.log("drop");`,
			`export const value = "ok";`,
			``,
		}, "\n"),
	})
}
