package strip_test

import (
  "bytes"
  "encoding/json"
  "fmt"
  "os"
  "os/exec"
  "path/filepath"
  "runtime"
  "strings"
  "sync"
  "testing"
)

type transformResult struct {
  TypeScript map[string]string `json:"typescript"`
}

// packageRoot resolves the `packages/strip` module root from this external
// test package. Command tests execute the shared native producer from that root.
func packageRoot(t *testing.T) string {
  t.Helper()
  _, file, _, ok := runtime.Caller(0)
  if !ok {
    t.Fatal("could not resolve helper path")
  }
  return filepath.Dir(filepath.Dir(file))
}

// One immutable producer is shared by this test process; invocation state is not.
var pluginBinaryOnce sync.Once
var pluginBinaryPath string
var pluginBinaryDirectory string
var pluginBinaryError error

// TestMain releases the producer directory owned by this test process after
// all cases, including failing cases, finish. A suite-supplied binary remains
// the suite runner's responsibility; each invocation still has its own process.
// Abrupt termination or a test panic can prevent this normal cleanup path.
//
// @evidence contracts/common.md#principled-implementation sync.Once resolves one producer before concurrent callers execute it; m.Run completes the population before releasing only the fallback directory acquired by this process.
// @evidence contracts/common.md#clear-and-simple-design TestMain owns release, resolvePluginBinary owns acquisition and runPlugin owns independent invocation; the supplied-binary branch has no hidden rebuild.
// @evidence contracts/common.md#prohibited-implementation-shortcuts These helpers execute the actual compiled plugin with original arguments and separate fixtures; they do not replace product methods, globals, statuses or output expectations.
// @evidence contracts/common.md#meaningful-documentation The declaration documents fallback ownership, runner ownership and the abrupt-termination limitation separately from these acknowledgments; private helper comments explain reuse and both captured streams.
// @evidence contracts/performance.md#efficient-algorithms Resolution and stat occur once per Go test process; each necessary command executes directly and captures its streams, without reentering the Go build tool for every case.
// @evidence contracts/performance.md#reuse-equivalent-work Only immutable producer bytes from the same checkout, Go workspace and inherited toolchain flags are reused during this process; configuration and fixture state remain per invocation, and a new suite invocation rebuilds after source changes.
// @evidence contracts/performance.md#bound-retention-and-release-resources At most one fallback directory and producer are retained until m.Run returns, then RemoveAll releases them and reports failure through status; supplied bytes are released by the runner, and hard termination has no guaranteed cleanup.
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
    pluginBinaryDirectory, pluginBinaryError = os.MkdirTemp("", "ttsc-strip-test-producer-")
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

// writeFile writes a fixture file, creating parent directories first.
func writeFile(t *testing.T, file string, contents string) {
  t.Helper()
  if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(file, []byte(contents), 0o644); err != nil {
    t.Fatal(err)
  }
}

// shedConfigToolEnvironment removes the compiler and launcher variables from
// the test's environment for the duration of one case.
//
// Neither runner for this package injects them: scripts/test-go-utility-plugins.cjs
// and scripts/test-go-coverage.cjs both forward the ambient environment
// wholesale. That is the point. `ttsx` exports TTSC_TSGO_BINARY and
// TTSC_TTSX_BINARY to every descendant, so a suite launched anywhere below one
// inherits both, and every existing loader case pins TTSC_TTSX_BINARY at a fake
// launcher of its own — between them, an evaluator that read the environment
// and nothing else looked correct. A case that means to exercise the
// project-anchored resolution has to shed them first, or it proves only that
// something upstream set them. (scripts/test-go-lint.cjs injects both outright,
// which is what kept the same defect invisible in @ttsc/lint.)
func shedConfigToolEnvironment(t *testing.T) {
  t.Helper()
  t.Setenv("TTSC_TSGO_BINARY", "")
  t.Setenv("TTSC_TTSX_BINARY", "")
}

// requireNoAmbientInstall skips the case when a real install of pkg answers
// above the fixture.
//
// The negative resolutions assert that a project answers with nothing, and the
// walk they exercise climbs to the filesystem root by design, exactly as Node's
// does. A stray install above the system temp directory would answer for the
// project the case deliberately left empty, and the failure would read as a
// defect in the resolution rather than as pollution outside the tree. The probe
// anchors one level above `root`, so it inspects the ambient ancestry only and
// never the fixture.
func requireNoAmbientInstall(t *testing.T, root, pkg string) {
  t.Helper()
  probe := filepath.Join(filepath.Dir(root), "ambient-probe-anchor")
  if found := stripNodePackageManifestFrom(probe, pkg); found != "" {
    t.Skipf("an ambient %s install at %s answers above the fixture", pkg, found)
  }
}

// seedProjectTypeScript materializes the `typescript` install a project-anchored
// compiler resolution walks to, under `root`'s node_modules, and returns the
// platform executable path it should produce.
//
// The layout mirrors an npm install: the `typescript` manifest, and the
// `@typescript/typescript-<platform>-<arch>` platform package beside it holding
// `lib/tsc` (`lib/tsc.exe` on Windows). The platform name comes from
// stripNodePlatformPair so the fixture tracks the host it runs on;
// TestNodePlatformPairMatchesTheNpmPlatformVocabulary pins that mapping
// independently, so a wrong mapping fails there rather than passing here.
func seedProjectTypeScript(t *testing.T, root string) string {
  t.Helper()
  binary := seedProjectTypeScriptWithoutCompiler(t, root)
  writeFile(t, binary, "")
  return binary
}

// seedProjectTypeScriptWithoutCompiler is seedProjectTypeScript stopping one
// file short: both manifests exist and the platform executable does not. It is
// the shape an install left behind by a failed or partial unpack, and the
// resolution must decline it rather than hand the child a path it cannot spawn.
func seedProjectTypeScriptWithoutCompiler(t *testing.T, root string) string {
  t.Helper()
  platform, arch := stripNodePlatformPair()
  modules := filepath.Join(root, "node_modules")
  writeFile(t, filepath.Join(modules, "typescript", "package.json"), `{"name":"typescript"}`)
  name := "tsc"
  if runtime.GOOS == "windows" {
    name = "tsc.exe"
  }
  binary := filepath.Join(
    modules,
    "@typescript",
    "typescript-"+platform+"-"+arch,
    "lib",
    name,
  )
  writeFile(t, filepath.Join(filepath.Dir(filepath.Dir(binary)), "package.json"), `{"name":"platform"}`)
  return binary
}

// seedProjectTtsc materializes the `ttsc` install a project-anchored launcher
// resolution walks to, under `root`'s node_modules, and returns the launcher
// path it should produce. Only the manifest and `lib/launcher/ttsx.js` matter;
// nothing spawns the file, so its contents are irrelevant.
func seedProjectTtsc(t *testing.T, root string) string {
  t.Helper()
  launcher := seedProjectTtscWithoutLauncher(t, root)
  writeFile(t, launcher, "")
  return launcher
}

// seedProjectTtscWithoutLauncher installs the `ttsc` manifest and no launcher
// file, the shape a resolution must decline rather than name a path that is not
// there.
func seedProjectTtscWithoutLauncher(t *testing.T, root string) string {
  t.Helper()
  installDir := filepath.Join(root, "node_modules", "ttsc")
  writeFile(t, filepath.Join(installDir, "package.json"), `{"name":"ttsc"}`)
  return filepath.Join(installDir, "lib", "launcher", "ttsx.js")
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

// stripManifest returns the plugin manifest sent through
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
