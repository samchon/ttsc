package shared

import (
  "os"
  "path/filepath"
  "runtime"
  "testing"
)

// WriteFile writes a fixture file, creating parent directories first.
func WriteFile(t *testing.T, file string, contents string) {
  t.Helper()
  if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(file, []byte(contents), 0o644); err != nil {
    t.Fatal(err)
  }
}

// ShedConfigToolEnvironment removes the compiler and launcher variables from
// the test's environment for the duration of one case.
//
// `go test` injects neither variable and forwards the ambient environment
// wholesale. That is the point. `ttsx` exports TTSC_TSGO_BINARY and
// TTSC_TTSX_BINARY to every descendant, so a suite launched anywhere below one
// inherits both, and every existing loader case pins TTSC_TTSX_BINARY at a fake
// launcher of its own — between them, an evaluator that read the environment
// and nothing else looked correct. A case that means to exercise the
// project-anchored resolution has to shed them first, or it proves only that
// something upstream set them.
func ShedConfigToolEnvironment(t *testing.T) {
  t.Helper()
  t.Setenv("TTSC_TSGO_BINARY", "")
  t.Setenv("TTSC_TTSX_BINARY", "")
}

// SeedProjectTypeScript materializes the `typescript` install a project-anchored
// compiler resolution walks to, under `root`'s node_modules, and returns the
// platform executable path it should produce.
//
// The layout mirrors an npm install: the `typescript` manifest, and the
// `@typescript/typescript-<platform>-<arch>` platform package beside it holding
// `lib/tsc` (`lib/tsc.exe` on Windows). The platform name comes from
// nodePlatformPair so the fixture tracks the host it runs on;
// TestNodePlatformPairMatchesTheNpmPlatformVocabulary pins that mapping
// independently, so a wrong mapping fails there rather than passing here.
func SeedProjectTypeScript(t *testing.T, root string) string {
  t.Helper()
  binary := SeedProjectTypeScriptWithoutCompiler(t, root)
  WriteFile(t, binary, "")
  return binary
}

// SeedProjectTypeScriptWithoutCompiler is SeedProjectTypeScript stopping one
// file short: both manifests exist and the platform executable does not. It is
// the shape an install left behind by a failed or partial unpack, and the
// resolution must decline it rather than hand the child a path it cannot spawn.
func SeedProjectTypeScriptWithoutCompiler(t *testing.T, root string) string {
  t.Helper()
  platform, arch := BannerNodePlatformPair()
  modules := filepath.Join(root, "node_modules")
  WriteFile(t, filepath.Join(modules, "typescript", "package.json"), `{"name":"typescript"}`)
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
  WriteFile(t, filepath.Join(filepath.Dir(filepath.Dir(binary)), "package.json"), `{"name":"platform"}`)
  return binary
}

// SeedProjectTtscWithoutLauncher installs the `ttsc` manifest and no launcher
// file, the shape a resolution must decline rather than name a path that is not
// there.
func SeedProjectTtscWithoutLauncher(t *testing.T, root string) string {
  t.Helper()
  installDir := filepath.Join(root, "node_modules", "ttsc")
  WriteFile(t, filepath.Join(installDir, "package.json"), `{"name":"ttsc"}`)
  return filepath.Join(installDir, "lib", "launcher", "ttsx.js")
}
