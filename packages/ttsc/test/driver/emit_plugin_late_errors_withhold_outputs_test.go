package driver_test

import (
  "fmt"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEmitPluginLateErrorsWithholdOutputs Verifies a late plugin checker error withholds all
// buffered JavaScript and declaration outputs.
//
// A plugin can query the checker itself after the pre-emit gate. An error from
// that query must fail both JS-only and declaration builds without writing a
// successful prefix or attempting to render a negative source position.
//
// 1. Load two clean source files under noEmitOnError.
// 2. Let the second transform query a generated unresolved member expression.
// 3. Assert TS2304, generated-code context and zero output callbacks.
//
// @evidence contracts/testing.md#behavioral-verification Calls actual late checker query from the second transform and requires TS2304, exactly two transform calls, zero writes, unanchored location and generated-code failure context.
// @evidence contracts/testing.md#independent-expectations Authored generated unresolved identifier independently owes a missing-name error; literal TS2304, zero output and no authored coordinates define expected failure.
// @evidence contracts/testing.md#distinguishing-cases JS-only and declaration modes both reject late errors after an earlier clean source; zero callbacks distinguishes complete withholding from successful-prefix leakage.
// @evidence contracts/testing.md#execution-ownership The owning Go driver unit executes actual in-process compiler/checker/transformer APIs on private input and closes its Program; no error output is replaced with a canned diagnostic.
func TestEmitPluginLateErrorsWithholdOutputs(t *testing.T) {
  for _, declarations := range []bool{false, true} {
    t.Run(fmt.Sprint(declarations), func(t *testing.T) {
      root := t.TempDir()
      writeProjectFile(t, root, "tsconfig.json", fmt.Sprintf(`{"compilerOptions":{"target":"es2020","module":"commonjs","outDir":"lib","sourceMap":true,"noEmitOnError":true,"declaration":%v},"files":["first.ts","second.ts"]}`, declarations))
      writeProjectFile(t, root, "first.ts", `export const first = 1;`)
      writeProjectFile(t, root, "second.ts", `export const second = 2;`)
      p, diagnostics, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
      if err != nil || len(diagnostics) != 0 {
        t.Fatalf("load: %v %v", err, diagnostics)
      }
      defer p.Close()
      calls, writes := 0, 0
      transform := func(_ *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
        calls++
        if calls == 2 {
          f := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
          member := f.NewPropertyAccessExpression(f.NewIdentifier("generatedInput"), nil, f.NewIdentifier("value"), shimast.NodeFlagsNone)
          member.Parent = sf.AsNode()
          shimast.SetParentInChildrenUnset(member)
          p.Checker.GetConstantValue(member)
        }
        return sf
      }
      diagnostics, err = p.EmitWithPluginTransformer(transform, func(_, _ string, _ *shimcompiler.WriteFileData) error {
        writes++
        return nil
      })
      if err == nil || writes != 0 || calls != 2 || len(diagnostics) != 1 || diagnostics[0].Code != 2304 {
        t.Fatalf("calls=%d writes=%d diags=%v err=%v", calls, writes, diagnostics, err)
      }
      d := diagnostics[0]
      if d.Line != 0 || d.Column != 0 || d.Start != nil || d.Length != nil {
        t.Fatalf("invented authored location: %+v", d)
      }
      // The pinned checker names a synthesized identifier "(Missing)" (its
      // DeclarationNameToString reports any zero-width node that way), so the
      // generated name itself is not part of the rendered contract.
      for _, text := range []string{"error TS2304", "generated code", "no authored source location", "native plugin"} {
        if !strings.Contains(err.Error(), text) {
          t.Fatalf("missing %q: %v", text, err)
        }
      }
    })
  }
}
