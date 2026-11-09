package main

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// buildEnvironmentReadingPlugin reads the named variables through
// PluginContext.Env when the build applies linked program hooks.
//
// Native private fixture grounds remain with the test.
// Common: Principled implementation: The actual driver registry receives this ProgramPlugin, so the read goes through the real context the build lane constructs.
// Common: Clear and simple design: One field lists the names to read; the hook does not mutate the Program.
// Common: Prohibited implementation shortcuts: The fixture records nothing itself; the summary line must come from the driver's ledger.
// Common: Meaningful documentation: Native prose identifies the hook and its only effect.
// Applicability: The in-process hook owns no algorithm, native boundary, reuse or resource; the test owns registry and environment cleanup.
type buildEnvironmentReadingPlugin struct {
  names []string
}

// ApplyProgram reads each configured variable and leaves the Program unchanged.
//
// Common: Principled implementation: Reading through ctx.Env is the behavior under test.
// Common: Clear and simple design: A loop over the configured names with no other effect.
// Common: Prohibited implementation shortcuts: The returned values are discarded; only the driver's record is observed.
// Common: Meaningful documentation: Native prose states the read and the unchanged Program.
// Applicability: No native operation, processing strategy, reuse or resource acquisition.
func (plugin buildEnvironmentReadingPlugin) ApplyProgram(_ *driver.Program, ctx driver.PluginContext) error {
  for _, name := range plugin.names {
    ctx.Env(name)
  }
  return nil
}

// TestBuildVerboseNamesEnvironmentInputs verifies the native build lane's
// verbose summary names the variables its linked plugins read, right after the
// emitted-file list, and never prints their values.
//
// 1. Build with a linked plugin that reads one set variable, under --verbose.
// 2. Assert the line after the emitted-file list is the sorted name array and
//    stdout does not contain the value.
// 3. Build with a plugin that reads nothing and assert no such line.
//
// @evidence contracts/testing.md#behavioral-verification runBuild emits a real temporary project through a registered linked hook; stdout must carry `// ttsc: environment inputs=["…"]` directly after the emitted-file list, without the value, and omit the line for a non-reading hook.
// @evidence contracts/testing.md#independent-expectations The expected line is the contract literal with the summary's own `// ttsc: ` prefix; the value is the literal this test sets.
// @evidence contracts/testing.md#distinguishing-cases A reading hook against a non-reading hook on the same project. The utility lane's line and the envelopes belong to the test/utility package tests.
// @evidence contracts/testing.md#execution-ownership Go unit test in the cmd/ttsc process calling runBuild in-process with captured streams; t.Setenv restores the manifest and the read variable, and a cleanup resets the registry.
func TestBuildVerboseNamesEnvironmentInputs(t *testing.T) {
  root := t.TempDir()
  writeCommandProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020" },
  "files": ["index.ts"]
}
`)
  writeCommandProjectFile(t, root, "index.ts", "export const value = 1;\n")
  t.Setenv("TTSC_TEST_TRACKED_ENV_BUILD_MODE", "secret-build-value")
  t.Setenv(driver.LinkedPluginsEnv, `[{"name":"env","stage":"transform","config":{}}]`)
  t.Cleanup(resetCommandLinkedPluginRegistry)

  build := func(plugin buildEnvironmentReadingPlugin) string {
    t.Helper()
    resetCommandLinkedPluginRegistry()
    driver.RegisterPlugin(plugin)
    code, out, errText := captureCommand(t, func() int {
      return runBuild([]string{"--cwd", root, "--tsconfig", "tsconfig.json", "--emit", "--outDir", "dist", "--verbose"})
    })
    if code != 0 {
      t.Fatalf("build mismatch: code=%d stdout=%q stderr=%q", code, out, errText)
    }
    return out
  }

  out := build(buildEnvironmentReadingPlugin{names: []string{"TTSC_TEST_TRACKED_ENV_BUILD_MODE"}})
  lines := strings.Split(out, "\n")
  want := `// ttsc: environment inputs=["TTSC_TEST_TRACKED_ENV_BUILD_MODE"]`
  found := false
  for index, line := range lines {
    if line == want {
      found = index > 0 && strings.HasPrefix(lines[index-1], "  + ")
    }
  }
  if !found || strings.Contains(out, "secret-build-value") {
    t.Fatalf("verbose summary must list the name after the emitted files and omit the value:\n%s", out)
  }

  if silent := build(buildEnvironmentReadingPlugin{}); strings.Contains(silent, "environment inputs") {
    t.Fatalf("a plugin that reads nothing must not add the line:\n%s", silent)
  }
}
