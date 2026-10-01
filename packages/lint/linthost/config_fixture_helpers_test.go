// Shared config fixture operations used by portable units and the minimal
// Windows kernel batch. No corpus or witness dependency is needed here.
package linthost

import (
  "os"
  "path/filepath"
  "runtime"
  "testing"
)

// writeFile materializes a config fixture file for discovery and loader tests.
//
// 1. Create the parent directory to model nested project layouts.
// 2. Write the exact config text used by the scenario.
func writeFile(t *testing.T, location, text string) {
  t.Helper()
  if err := os.MkdirAll(filepath.Dir(location), 0o755); err != nil {
    t.Fatalf("MkdirAll: %v", err)
  }
  if err := os.WriteFile(location, []byte(text), 0o644); err != nil {
    t.Fatalf("WriteFile: %v", err)
  }
}

// shedConfigToolEnvironment removes the compiler and launcher variables from
// the test's environment for the duration of one case.
//
// `go test` exports TTSC_TSGO_BINARY and TTSC_TTSX_BINARY into
// the `go test` child, which is exactly what hid the config evaluator resolving
// both tools from the environment alone. A case that means to exercise the
// project-anchored resolution has to shed them first, or it proves only that
// the runner set them.
func shedConfigToolEnvironment(t *testing.T) {
  t.Helper()
  t.Setenv("TTSC_TSGO_BINARY", "")
  t.Setenv("TTSC_TTSX_BINARY", "")
}

// seedProjectTypeScript materializes the `typescript` install a project-anchored
// compiler resolution walks to, under `root`'s node_modules, and returns the
// platform executable path it should produce.
//
// The layout mirrors an npm install: the `typescript` manifest, and the
// `@typescript/typescript-<platform>-<arch>` platform package beside it holding
// `lib/tsc` (`lib/tsc.exe` on Windows). The platform name comes from
// nodePlatformPair so the fixture tracks the host it runs on;
// TestNodePlatformPairMatchesTheNpmPlatformVocabulary pins that mapping
// independently, so a wrong mapping fails there rather than passing here.
func seedProjectTypeScript(t *testing.T, root string) string {
  t.Helper()
  platform, arch := nodePlatformPair()
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
  writeFile(t, binary, "")
  return binary
}
