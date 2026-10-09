package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteHandlesNestedCallSyntax Verifies that EmitAll consumes the full nested namespace call without residual argument tokens.
//
// Template interpolation, regex, quoted parenthesis, and both comment forms coexist in the argument list.
//
// 1. Compile a plugin call with nested syntax in its argument list.
// 2. Register a namespace-aware rewrite for that call.
// 3. Assert the replacement succeeds without being confused by inner tokens.
//
// @evidence contracts/testing.md#behavioral-verification EmitAll consumes the full nested namespace call without residual argument tokens.
// @evidence contracts/testing.md#independent-expectations The complete authored exports.value replacement statement independently defines correct call extent.
// @evidence contracts/testing.md#distinguishing-cases Template interpolation, regex, quoted parenthesis, and both comment forms coexist in the argument list.
// @evidence contracts/testing.md#execution-ownership A Go Program and recording writer exercise the actual public rewrite pipeline directly. Go discovers TestDriverRewriteHandlesNestedCallSyntax under ./test/driver.
func TestDriverRewriteHandlesNestedCallSyntax(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: the call argument contains token shapes that would break a
  // naive parenthesis scanner.
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
  writeProjectFile(t, root, "index.ts", "declare const plugin: { ns: { make(...args: unknown[]): string } };\n"+
    "export const value = plugin.ns.make(\n"+
    "  `template ${\"value\"}`,\n"+
    "  (/a\\)b/.test(\"a)b\")),\n"+
    "  \"quoted )\",\n"+
    "  // line comment with )\n"+
    "  /* block comment with ) */ 1\n"+
    ");\n")
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()
  rewrites := driver.NewRewriteSet()
  rewrites.Add(driver.Rewrite{
    File:          prog.SourceFiles()[0],
    RootName:      "plugin",
    Namespaces:    []string{"ns"},
    Method:        "make",
    Replacement:   `"nested"`,
    ConsumeParens: true,
  })

  // Emit assertion: the complex argument list should still be consumed as one
  // call expression and replaced with the generated fragment.
  emitted := map[string]string{}
  _, emitDiags, err := prog.EmitAll(rewrites, func(fileName shimtspath.RootedFilePath, text string, _ *shimcompiler.WriteFileData) error {
    emitted[filepath.Base(fileName.AsString())] = text
    return nil
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(emitDiags) != 0 {
    t.Fatalf("unexpected emit diagnostics: %#v", emitDiags)
  }
  js := emitted["index.js"]
  // The whole statement is asserted: a scanner that closed the call at any
  // inner `)` would leave argument text behind the replacement.
  if !strings.Contains(js, `exports.value = "nested";`) {
    t.Fatalf("nested call rewrite failed:\n%s", js)
  }
}
