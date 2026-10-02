package strip_test

import (
  "bytes"
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"

  shared "github.com/samchon/ttsc/packages/strip/test/internal/shared"
)

type transformResult struct {
  TypeScript map[string]string `json:"typescript"`
}

// runPlugin dispatches one @ttsc/strip command through the production utility
// entry that the standalone sidecar's main delegates to, with invocation-owned
// output buffers, and returns its status, stdout and stderr.
func runPlugin(t *testing.T, args ...string) (int, string, string) {
  t.Helper()
  t.Setenv("TTSC_PLUGIN_CONFIG_DIR", "")
  var stdout, stderr bytes.Buffer
  code := utility.RunCommandWithIO("@ttsc/strip", "0.0.1", args, &stdout, &stderr)
  return code, stdout.String(), stderr.String()
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

// stripManifest returns the plugin manifest sent through --plugins-json by
// ttsc's native plugin host.
func stripManifest(t *testing.T) string {
  t.Helper()
  return shared.MustJSON(t, []map[string]any{{
    "name":  "@ttsc/strip",
    "stage": "transform",
    "config": map[string]any{
      "transform": "@ttsc/strip",
    },
  }})
}

// seedStripProject creates a fixture with removable debugger and console.log
// statements. withOutDir selects build-ready output settings.
func seedStripProject(t *testing.T, withOutDir bool) string {
  t.Helper()
  compilerOptions := `{"target":"ES2022","module":"commonjs","strict":true}`
  if withOutDir {
    compilerOptions = `{"target":"ES2022","module":"commonjs","strict":true,"outDir":"dist","rootDir":"src"}`
  }
  return shared.SeedProject(t, map[string]string{
    "tsconfig.json": `{"compilerOptions":` + compilerOptions + `,"include":["src"]}`,
    "src/main.ts": strings.Join([]string{
      `debugger;`,
      `console.log("drop");`,
      `export const value = "ok";`,
      ``,
    }, "\n"),
  })
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

// seedProjectTtsc materializes the `ttsc` install a project-anchored launcher
// resolution walks to, under `root`'s node_modules, and returns the launcher
// path it should produce. Only the manifest and `lib/launcher/ttsx.js` matter;
// nothing spawns the file, so its contents are irrelevant.
func seedProjectTtsc(t *testing.T, root string) string {
  t.Helper()
  launcher := shared.SeedProjectTtscWithoutLauncher(t, root)
  shared.WriteFile(t, launcher, "")
  return launcher
}
