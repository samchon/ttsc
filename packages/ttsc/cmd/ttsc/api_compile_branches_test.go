package main

import (
  "errors"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// apiCompileApplyErrorPlugin is the independently failing linked Program hook fixture.
//
// The owning branch test registers this actual implementation and declares
// one transform manifest entry. The zero-field value carries no expected
// response or compiler state; ApplyProgram owns its literal fixture error.
//
// Native private fixture grounds remain with the test; no fake public API
// or unsupported exported-host Evidence annotation is added.
// Common: Principled implementation: The actual driver registry receives this ProgramPlugin implementation for the command's real linked apply/emit failure branch.
// Common: Clear and simple design: A zero-field type supplies only the failing hook method and retains no auxiliary fixture state.
// Common: Prohibited implementation shortcuts: The test exercises a real registered hook rather than injecting a cached status or manufactured command stderr.
// Common: Meaningful documentation: Native prose identifies registration, manifest pairing and the separate literal error owner.
// Applicability: This empty carrier owns no processing algorithm, native OS boundary, reusable work or resource lease; the branch test owns registry/environment cleanup.
type apiCompileApplyErrorPlugin struct{}

// ApplyProgram returns the literal api compile apply boom fixture cause.
//
// The real command's emission path invokes the registered hook. This fixture
// fails without altering its borrowed Program; the wrapper must propagate
// its independently authored cause and returned failure status.
//
// Native fixture grounds describe this actual hook, without Evidence tags.
// Common: Principled implementation: Returning the authored error exercises the actual linked hook error propagation used by the owning command test.
// Common: Clear and simple design: The fixture constructs one fixed error without inspecting or mutating the borrowed Program.
// Common: Prohibited implementation shortcuts: Neither wrapper output nor status is supplied by this fixture; assertions observe the command's own handling.
// Common: Meaningful documentation: Native prose states the exact error contribution and borrowed Program non-mutation.
// Applicability: The fixed in-process error return performs no native OS operation, processing traversal, reuse coordination or resource acquisition; its command caller owns the Program lease.
func (apiCompileApplyErrorPlugin) ApplyProgram(*driver.Program, driver.PluginContext) error {
  return errors.New("api compile apply boom")
}

// TestAPICompileBranches verifies API compile setup, diagnostic and linked emit failures.
//
// The real wrapper returns usage/setup status two and serializes diagnostic JSON for an independently invalid assignment. A registered ApplyProgram hook supplies a distinct literal failure reported by actual emission; this body checks the diagnostics field presence, not its full contents.
//
// 1. Exercise incomplete flags and an injected failing cwd reader.
// 2. Load missing and invalid-type fixture configurations, and check warning conversion.
// 3. Register an actual failing linked hook and assert status three with its literal cause.
//
// @evidence contracts/testing.md#behavioral-verification Direct runAPICompile observes setup status two, cwd/config causes, diagnostic JSON-field presence and linked emit status three; toAPICompileDiagnostic separately returns literal warning category.
// @evidence contracts/testing.md#independent-expectations Literal statuses, cwd boom, tsconfig not found, warning and api compile apply boom come from independent malformed inputs and authored hook errors. The incomplete-flag check only observes status, and JSON diagnostics presence does not certify every diagnostic.
// @evidence contracts/testing.md#distinguishing-cases Incomplete argv, cwd reader error, missing config, invalid assignment, warning category and linked apply failure distinguish separate wrapper branches; valid API emission is owned by the aggregate command-operation family.
// @evidence contracts/testing.md#execution-ownership Owning-private command adapters and real driver Programs execute synchronously in this Go test, with no child or native artifact build. captureCommand restores streams/cwd seam; wrappers close acquired Programs; TempDir and Setenv restore fixtures/environment. A cleanup reset clears the test-registered entry after all consumers; it does not restore an inherited registry snapshot.
func TestAPICompileBranches(t *testing.T) {
  code, _, _ := captureCommand(t, func() int {
    return runAPICompile([]string{"--cwd"})
  })
  if code != 2 {
    t.Fatalf("bad flag status mismatch: %d", code)
  }

  code, _, errText := captureCommand(t, func() int {
    getwd = failGetwd
    return runAPICompile(nil)
  })
  if code != 2 || !strings.Contains(errText, "cwd boom") {
    t.Fatalf("cwd error mismatch: code=%d stderr=%q", code, errText)
  }

  root := t.TempDir()
  code, _, errText = captureCommand(t, func() int {
    return runAPICompile([]string{"--cwd", root, "--tsconfig", "missing.json"})
  })
  if code != 2 || !strings.Contains(errText, "tsconfig not found") {
    t.Fatalf("missing config mismatch: code=%d stderr=%q", code, errText)
  }

  writeCommandProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "strict": true },
  "files": ["index.ts"]
}
`)
  writeCommandProjectFile(t, root, "index.ts", `const value: number = "text";
export { value };
`)
  code, out, _ := captureCommand(t, func() int {
    return runAPICompile([]string{"--cwd", root, "--tsconfig", "tsconfig.json"})
  })
  if code != 2 || !strings.Contains(out, `"diagnostics"`) {
    t.Fatalf("diagnostic compile mismatch: code=%d stdout=%q", code, out)
  }
  if got := toAPICompileDiagnostic(driver.Diagnostic{Severity: driver.SeverityWarning}).Category; got != "warning" {
    t.Fatalf("warning category mismatch: %q", got)
  }

  resetCommandLinkedPluginRegistry()
  t.Cleanup(resetCommandLinkedPluginRegistry)
  driver.RegisterPlugin(apiCompileApplyErrorPlugin{})
  t.Setenv(driver.LinkedPluginsEnv, `[{"name":"error","stage":"transform","config":{}}]`)
  writeCommandProjectFile(t, root, "index.ts", `export const value = 1;
`)
  code, _, errText = captureCommand(t, func() int {
    return runAPICompile([]string{"--cwd", root, "--tsconfig", "tsconfig.json"})
  })
  if code != 3 || !strings.Contains(errText, "api compile apply boom") {
    t.Fatalf("emit error mismatch: code=%d stderr=%q", code, errText)
  }
}
