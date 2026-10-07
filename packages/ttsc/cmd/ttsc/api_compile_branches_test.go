package main

import (
  "encoding/json"
  "errors"
  "slices"
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
// The real wrapper returns usage/setup status two. One independently invalid
// assignment is prepared through the real compile loader policy; its single
// Program supplies both actual compile and transform JSON writers. A registered
// ApplyProgram hook supplies a separate actual emission failure.
//
// 1. Exercise incomplete flags and an injected failing cwd reader.
// 2. Load missing and invalid-type fixture configurations, and check warning conversion.
// 3. Register an actual failing linked hook and assert status three with its literal cause.
//
// @evidence contracts/testing.md#behavioral-verification Direct runAPICompile observes setup status two, cwd/config causes and linked emit status three. Actual compile preparation/load and response writers retain TS2322 failure status/diagnostics and publish the failed Program's source, type-only graph edge and completeness; toAPICompileDiagnostic separately returns literal warning category.
// @evidence contracts/testing.md#independent-expectations Literal statuses, cwd boom, tsconfig not found, warning and api compile apply boom come from independent malformed inputs and authored hook errors. The incomplete-flag check only observes status, and JSON diagnostics presence does not certify every diagnostic.
// @evidence contracts/testing.md#distinguishing-cases Incomplete argv, cwd reader error, missing config, invalid assignment, warning category and linked apply failure distinguish separate wrapper branches; valid API emission is owned by the aggregate command-operation family.
// @evidence contracts/testing.md#execution-ownership Owning-private command adapters and real driver Programs execute synchronously in this Go test, with no child or native artifact build. The invalid-type Program is loaded once, borrowed by two actual JSON writers and closed before the linked-failure state; cleanup also closes it on early failure. This does not certify transform's distinct ForceNoEmit loader policy. captureCommand restores streams/cwd seam; other wrappers close their acquired Programs; TempDir and Setenv restore fixtures/environment. A cleanup reset clears the test-registered entry after all consumers; it does not restore an inherited registry snapshot.
func TestAPICompileBranches(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
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
  "files": ["index.ts", "mytype.ts"]
}
`)
  writeCommandProjectFile(t, root, "index.ts", `const value: number = "not-a-number";
export { value };
import type { MyType } from "./mytype";
export const typed: MyType = { id: "x" };
`)
  writeCommandProjectFile(t, root, "mytype.ts", "export interface MyType { id: string }\n")
  var failedProgram *driver.Program
  var failedInitial []driver.Diagnostic
  t.Cleanup(func() {
    if failedProgram != nil {
      if err := failedProgram.Close(); err != nil {
        t.Errorf("failed API Program Close: %v", err)
      }
    }
  })
  code, out, _ := captureCommand(t, func() int {
    request, status := prepareAPICompileInvocation([]string{"--cwd", root, "--tsconfig", "tsconfig.json"})
    if status != 0 {
      return status
    }
    var err error
    failedProgram, failedInitial, err = driver.LoadProgram(request.cwd, request.tsconfigPath, request.options)
    if err != nil {
      t.Fatal(err)
    }
    if failedProgram == nil {
      t.Fatal("semantic failure must retain its actual Program")
    }
    return writeCompiledProgramResponse(failedProgram, failedInitial, request.cwd)
  })
  if code != 2 || !strings.Contains(out, `"diagnostics"`) {
    t.Fatalf("diagnostic compile mismatch: code=%d stdout=%q", code, out)
  }
  transformCode, transformedOutput, _ := captureCommand(t, func() int {
    return writeTransformedProgramResponse(failedProgram, failedInitial, root)
  })
  if transformCode != 2 {
    t.Errorf("failed Program transform response status = %d, want 2", transformCode)
  }
  var transformed apiTransformResult
  if err := json.Unmarshal([]byte(transformedOutput), &transformed); err != nil {
    t.Fatal(err)
  }
  if !strings.Contains(transformed.TypeScript["index.ts"], `const value: number = "not-a-number"`) || !strings.Contains(transformed.TypeScript["mytype.ts"], "interface MyType") {
    t.Error("failed native response omitted original source")
  }
  if transformed.Graph == nil || !slices.Equal(transformed.Graph.Edges["index.ts"], []string{"mytype.ts"}) {
    t.Errorf("failed native response omitted type-only graph: %#v", transformed.Graph)
  }
  if len(transformed.Diagnostics) != 1 || transformed.Diagnostics[0].Code != 2322 {
    t.Errorf("failed native response diagnostics = %#v", transformed.Diagnostics)
  }
  complete := append([]string{}, transformed.DependenciesComplete...)
  slices.Sort(complete)
  if !slices.Equal(complete, []string{"index.ts", "mytype.ts"}) {
    t.Errorf("failed native completeness = %v", complete)
  }
  if err := failedProgram.Close(); err != nil {
    t.Fatal(err)
  }
  failedProgram = nil
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
