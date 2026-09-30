package strip_test

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandLoadsConfigFromFile verifies that the strip sidecar reads its
// configuration from a strip.config.json file, both when specified via
// configFile and when auto-discovered from the tsconfig directory.
//
// Locks the config-file loading path in loadStripConfigMap and its integration
// with ApplyProgram so that the file-based configuration contract is observable
// from the command boundary. The default strip targets (console.log, debugger)
// must be absent from output; a call explicitly configured to be retained must
// survive.
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
// @evidence contracts/e2e.md#shared-execution All strip command entries use resolvePluginBinary once per test process, or the suite-supplied immutable producer. This case starts independent command consumers with the exact arguments above; only binary bytes are shared, not a loaded project or process session.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity For TestCommandLoadsConfigFromFile, command exits release each process; t.TempDir owns any fixture and output tree until case cleanup. TestMain owns only a fallback producer directory, while a supplied binary is runner-owned. No cold/invalidation transition is asserted here.
// @evidence contracts/e2e.md#preserved-coverage The existing TestCommandLoadsConfigFromFile inputs, statuses, stream checks and any output assertions remain executable in this entry unchanged. No portable owner is inferred merely from another unit suite, and further reduction requires an exact assertion transfer.
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
      root := seedProject(t, scenario.files)
      manifest := mustJSON(t, []map[string]any{{
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
