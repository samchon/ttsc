package driver_test

import (
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

type applyErrorProgramPlugin struct {
  calls *int
}

func (p applyErrorProgramPlugin) ApplyProgram(*driver.Program, driver.PluginContext) error {
  if p.calls != nil {
    (*p.calls)++
  }
  return errLinkedApplyBoom
}

var errLinkedApplyBoom = &linkedApplyError{}

type linkedApplyError struct{}

func (*linkedApplyError) Error() string { return "linked apply boom" }

// TestEmitWithPluginTransformersPropagateLinkedApplyErrors verifies that a
// linked ProgramPlugin failure aborts the emit instead of being swallowed.
//
// EmitWithPluginTransformers runs linked ProgramPlugins before output: a hook that fails must
// surface to the host (which reports emit failure) and must not let a
// half-mutated program emit as if nothing happened.
//
// 1. Register a linked ProgramPlugin whose ApplyProgram always errors.
// 2. Emit through EmitWithPluginTransformers.
// 3. Assert the emit returns that error and writes no output.
// @evidence contracts/testing.md#behavioral-verification Calls actual emission with a failing registered ProgramPlugin and requires linked apply boom plus zero captured output.
// @evidence contracts/testing.md#independent-expectations The authored plugin returns a literal linked apply boom error; independent zero writes defines failure publication.
// @evidence contracts/testing.md#distinguishing-cases First application failure contrasts the adjacent previously-latched failure and clean linked-hook cases.
// @evidence contracts/testing.md#execution-ownership The owning driver Go unit invokes actual registered in-process plugin/compiler APIs with private Program cleanup and test-scoped manifest; no canned producer or subprocess.
func TestEmitWithPluginTransformersPropagateLinkedApplyErrors(t *testing.T) {
  resetLinkedPluginRegistry()
  t.Setenv(driver.LinkedPluginsEnv, `[{"name":"boom","stage":"transform","config":{}}]`)
  driver.RegisterPlugin(applyErrorProgramPlugin{})

  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", "export const a = 0;\n")
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  emitted := map[string]string{}
  _, err = prog.EmitWithPluginTransformers(nil, func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    emitted[fileName] = text
    return nil
  })
  if err == nil || !strings.Contains(err.Error(), "linked apply boom") {
    t.Fatalf("expected linked apply error to abort emit, got err=%v", err)
  }
  if err != errLinkedApplyBoom {
    t.Fatalf("emit replaced the authored hook error: %v", err)
  }
  if len(emitted) != 0 {
    t.Fatalf("emit produced output despite linked apply failure: %#v", emitted)
  }
}

// TestEmitWithPluginTransformersReportLatchedLinkedApplyErrors Verifies an earlier ignored
// linked-plugin apply error remains latched and prevents subsequent emit writes.
//
// SourceFiles triggers linked application but ignores its returned error. The later emit
// must recover the same latched failure rather than treat the once-only application as a
// successful no-op and publish output from a partially applied program.
//
// 1. Register a linked ProgramPlugin whose ApplyProgram always errors.
// 2. Call SourceFiles first (the swallowing lane).
// 3. Assert the emit still fails with the latched error and writes nothing.
//
// @evidence contracts/testing.md#behavioral-verification Calls SourceFiles to trigger the real failing hook before emission; emission must return the same authored error and write nothing, with exactly one hook invocation across both calls.
// @evidence contracts/testing.md#independent-expectations Literal hook error and zero output are independently required after the known first application attempt.
// @evidence contracts/testing.md#distinguishing-cases A read-only initial trigger contrasts first-trigger emission, detecting loss of failure through once-only hook state.
// @evidence contracts/testing.md#execution-ownership The owning Go driver unit uses actual source access and emitter operations on a private Program with captured writes and deferred close and scoped manifest; no plugin binary runs.
func TestEmitWithPluginTransformersReportLatchedLinkedApplyErrors(t *testing.T) {
  resetLinkedPluginRegistry()
  t.Setenv(driver.LinkedPluginsEnv, `[{"name":"boom","stage":"transform","config":{}}]`)
  applyCalls := 0
  driver.RegisterPlugin(applyErrorProgramPlugin{calls: &applyCalls})

  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", "export const a = 0;\n")
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  if files := prog.SourceFiles(); len(files) == 0 {
    t.Fatal("expected program sources despite the swallowed apply failure")
  }
  emitted := map[string]string{}
  _, err = prog.EmitWithPluginTransformers(nil, func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    emitted[fileName] = text
    return nil
  })
  if err == nil || !strings.Contains(err.Error(), "linked apply boom") {
    t.Fatalf("expected latched apply error to abort emit, got err=%v", err)
  }
  if err != errLinkedApplyBoom {
    t.Fatalf("emit replaced the latched hook error: %v", err)
  }
  if applyCalls != 1 {
    t.Fatalf("expected the failed hook to run once across source access and emit, got %d", applyCalls)
  }
  if len(emitted) != 0 {
    t.Fatalf("emit produced output despite latched apply failure: %#v", emitted)
  }
}
