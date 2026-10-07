package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverEmitRewritesPluginCalls Verifies the public driver emit contract.
//
// This case directly observes the in-process driver emit facade's output.
// It does not start a native host or certify executable runtime behavior.
//
// 1. Build a real tsconfig project with a plugin-owned call expression.
// 2. Register one emit-time rewrite against the parsed source file.
// 3. Emit through the public driver facade and assert the rewritten JavaScript.
//
// @evidence contracts/testing.md#behavioral-verification LoadProgram, RewriteSet.Add and EmitAll produce JavaScript containing the rewrite sentinel and literal rewritten replacement.
// @evidence contracts/testing.md#independent-expectations The registered replacement literal and the documented sentinel establish those two expectations; substring checks do not prove runtime equivalence or removal of every original call.
// @evidence contracts/testing.md#distinguishing-cases One plugin.make call is replaced in a one-source Program; scanner rejection and preserved neighboring syntax are owned by the dedicated rewrite cases.
// @evidence contracts/testing.md#execution-ownership Go test/driver executes the driver facade and captures its write callback in memory without starting the product host.
func TestDriverEmitRewritesPluginCalls(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: use a normal tsconfig project so the driver exercises the
  // same host, parser, checker, and emitter path used by the native binary.
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin",
    "strict": true
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `declare const plugin: { make(input: string): string };
export const value = plugin.make("input");
`)

  // Program load: ForceEmit mirrors the command/runtime lanes that need output
  // even when a project-level option would otherwise suppress JavaScript.
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{
    ForceEmit: true,
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  sources := prog.SourceFiles()
  if len(sources) != 1 {
    t.Fatalf("expected one source file, got %#v", sources)
  }

  // Rewrite setup: the public RewriteSet API associates the replacement with
  // the parsed source file, then the emitter finds the matching output file.
  rewrites := driver.NewRewriteSet()
  rewrites.Add(driver.Rewrite{
    File:          sources[0],
    RootName:      "plugin",
    Method:        "make",
    Replacement:   `"rewritten"`,
    ConsumeParens: true,
  })

  // Emit assertion: capture WriteFile output in memory so the test observes the
  // emitted contract without depending on filesystem timing or cleanup.
  emitted := map[string]string{}
  result, emitDiags, err := prog.EmitAll(rewrites, func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    emitted[filepath.Base(fileName)] = text
    return nil
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(emitDiags) != 0 {
    t.Fatalf("unexpected emit diagnostics: %#v", emitDiags)
  }
  if result == nil || len(result.EmittedFiles) == 0 {
    t.Fatalf("emit result did not include emitted files: %#v", result)
  }

  js := emitted["index.js"]
  if !strings.Contains(js, driver.RewriteSentinel) || !strings.Contains(js, `"rewritten"`) {
    t.Fatalf("rewritten JavaScript missing sentinel or replacement:\n%s", js)
  }
}
