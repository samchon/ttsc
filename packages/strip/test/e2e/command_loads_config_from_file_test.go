//go:build e2e

package strip_test

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"

  shared "github.com/samchon/ttsc/packages/strip/test/internal/shared"
)

// TestCommandLoadsConfigFromFile verifies that the strip sidecar reads its
// configuration from a strip.config.json file, both when specified via
// configFile and when auto-discovered from the tsconfig directory.
//
// Locks the config-file loading path in loadStripConfigMap and its integration
// with ApplyProgram so that the file-based configuration contract is observable
// from the command boundary. The call the file names (console.warn) must be
// absent from output, and a call it does not name (console.info) must survive.
//
//  1. Create a project with src/main.ts containing console.warn (stripped) and
//     console.info (kept); supply config via strip.config.json.
//  2. Run transform via configFile (explicit) and via auto-discovery (implicit).
//  3. Assert console.warn is absent and console.info is present in both cases.
// @evidence contracts/testing.md#behavioral-verification Explicit configFile and auto-discovery each load calls:[console.warn],statements:[] through native transform; warn disappears and console.info("keep") remains in successful JSON output.
// @evidence contracts/testing.md#independent-expectations The authored JSON explicitly selects warn and leaves info outside the target set, so literal absent/present output gives an independent option oracle.
// @evidence contracts/testing.md#distinguishing-cases Separate disposable explicit and implicit projects use the same policy. Retained info detects over-stripping; both source-selection routes must carry the policy into transform.
// @evidence contracts/testing.md#execution-ownership The discoverable TestCommandLoadsConfigFromFile entry runs in the strip E2E population and calls the real compiled package sidecar; runPlugin captures its native exit and separate streams. This classification does not move its portable assertions into units.
// @evidence contracts/e2e.md#necessary-boundary File-backed JSON selection must reach the native strip transform through manifest configuration and discovery. Direct config parsing cannot establish selected-file-to-project wiring; two command consumers currently remain.
// @evidence contracts/e2e.md#shared-execution runPlugin reaches the compiled sidecar through resolvePluginBinary, which builds ./plugin once per test process under sync.Once unless TTSC_UTILITY_TEST_BINARY names a prebuilt binary; this function starts two transform processes, one per t.Run scenario (explicit configFile, auto-discovered), from that binary and shares no loaded project or running session with any other entry.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each t.Run scenario calls seedProject, so each of the two projects lives in its own t.TempDir removed when that subtest ends; the scenarios share only the compiled binary. TestMain removes only the fallback producer directory after m.Run. No cold or invalidated state is exercised.
// @evidence contracts/e2e.md#preserved-coverage The status/stderr check (L74), JSON decode (L78) and the console.warn-absent / console.info-present checks (L82-L87) run in each of the two scenarios in this body; nothing is delegated to a unit test. The doc prose previously described console.log and debugger default targets, which this body does not run (prose corrected).
func TestCommandLoadsConfigFromFile(t *testing.T) {
  for _, scenario := range []struct {
    label  string
    config map[string]any
    files  map[string]string
  }{
    {
      label: "explicit configFile",
      config: map[string]any{
        "transform":  "@ttsc/strip",
        "configFile": "strip.config.json",
      },
      files: map[string]string{
        "tsconfig.json":     `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true},"include":["src"]}`,
        "strip.config.json": `{"calls":["console.warn"],"statements":[]}`,
        "src/main.ts":       "console.warn(\"drop\");\nconsole.info(\"keep\");\nexport const v = 1;\n",
      },
    },
    {
      label: "auto-discovered",
      config: map[string]any{
        "transform": "@ttsc/strip",
      },
      files: map[string]string{
        "tsconfig.json":     `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true},"include":["src"]}`,
        "strip.config.json": `{"calls":["console.warn"],"statements":[]}`,
        "src/main.ts":       "console.warn(\"drop\");\nconsole.info(\"keep\");\nexport const v = 1;\n",
      },
    },
  } {
    t.Run(scenario.label, func(t *testing.T) {
      root := shared.SeedProject(t, scenario.files)
      manifest := shared.MustJSON(t, []map[string]any{{
        "name":   "@ttsc/strip",
        "stage":  "transform",
        "config": scenario.config,
      }})
      code, stdout, stderr := runPlugin(t, "transform",
        "--cwd="+root,
        "--tsconfig="+filepath.Join(root, "tsconfig.json"),
        "--plugins-json="+manifest,
      )
      if code != 0 || stderr != "" {
        t.Fatalf("transform mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
      }
      var result transformResult
      if err := json.Unmarshal([]byte(strings.TrimSpace(stdout)), &result); err != nil {
        t.Fatalf("transform output is not JSON: %v\n%s", err, stdout)
      }
      main := result.TypeScript["src/main.ts"]
      if strings.Contains(main, "console.warn") {
        t.Fatalf("console.warn not stripped:\n%s", main)
      }
      if !strings.Contains(main, `console.info("keep")`) {
        t.Fatalf("console.info missing from output:\n%s", main)
      }
    })
  }
}
