package driver_test

import (
  "fmt"
  "path/filepath"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// Verifies generated member accesses preserve declarations and checker state.
//
// Independent factories do not mark generated nodes as synthesized. Neither
// those nodes nor generated nodes with copied source ranges belong to the
// original checker. Genuine original mappings must still inline const enums.
//
// 1. Load valid sources with declarations, maps and noEmitOnError.
// 2. Inject a bound arrow with property or element access using each factory.
// 3. Emit twice and check complete output, clean diagnostics and enum inlining.
func TestEmitPluginGeneratedMembersKeepDeclarations(t *testing.T) {
  for _, factory := range []string{"emit", "standalone", "copied-range"} {
    for _, element := range []bool{false, true} {
      t.Run(fmt.Sprintf("%s/element=%v", factory, element), func(t *testing.T) {
        root := t.TempDir()
        writeProjectFile(t, root, "tsconfig.json", `{"compilerOptions":{"module":"commonjs","target":"es2020","outDir":"lib","strict":true,"declaration":true,"declarationMap":true,"sourceMap":true,"noEmitOnError":true},"files":["index.ts","other.ts"]}`)
        writeProjectFile(t, root, "index.ts", "const enum E { A = 7, B = 11 }\nexport const answer: number = 0;\nexport const constant = E.A + E[\"B\"];\n")
        writeProjectFile(t, root, "other.ts", "export interface Other { value: string; }\n")
        program, diagnostics, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
        if err != nil || len(diagnostics) != 0 {
          t.Fatalf("load: %v %v", err, diagnostics)
        }
        defer program.Close()
        if diagnostics := program.Diagnostics(); len(diagnostics) != 0 {
          t.Fatalf("source diagnostics: %v", diagnostics)
        }
        transform := func(ec *shimprinter.EmitContext, source *shimast.SourceFile) *shimast.SourceFile {
          var visitor *shimast.NodeVisitor
          visitor = ec.NewNodeVisitor(func(node *shimast.Node) *shimast.Node {
            if node.Kind == shimast.KindPropertyAccessExpression && node.Expression().Text() == "E" {
              // A rebuilt original is a valid checker input through ParseNode.
              rebuilt := ec.Factory.NewPropertyAccessExpression(node.Expression(), nil, node.Name(), shimast.NodeFlagsNone)
              ec.SetOriginal(rebuilt, node)
              return rebuilt
            }
            if node.Kind != shimast.KindNumericLiteral || node.Text() != "0" {
              return visitor.VisitEachChild(node)
            }
            f := ec.Factory
            memberFactory := &f.NodeFactory
            if factory != "emit" {
              memberFactory = shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
            }
            var access *shimast.Node
            if element {
              access = memberFactory.NewElementAccessExpression(f.NewIdentifier("input"), nil, memberFactory.NewStringLiteral("value", 0), shimast.NodeFlagsNone)
            } else {
              access = memberFactory.NewPropertyAccessExpression(f.NewIdentifier("input"), nil, memberFactory.NewIdentifier("value"), shimast.NodeFlagsNone)
            }
            if factory == "copied-range" {
              access.Loc = node.Loc
            }
            parameter := f.NewParameterDeclaration(nil, nil, f.NewIdentifier("input"), nil, nil, nil)
            arrow := f.NewArrowFunction(nil, nil, f.NewNodeList([]*shimast.Node{parameter}), nil, nil, f.NewToken(shimast.KindEqualsGreaterThanToken), access)
            argument := f.NewObjectLiteralExpression(f.NewNodeList([]*shimast.Node{
              f.NewPropertyAssignment(nil, f.NewIdentifier("value"), nil, nil, f.NewNumericLiteral("123", 0)),
            }), false)
            return f.NewCallExpression(f.NewParenthesizedExpression(arrow), nil, nil, f.NewNodeList([]*shimast.Node{argument}), shimast.NodeFlagsNone)
          })
          return visitor.VisitSourceFile(source)
        }
        for iteration := 0; iteration < 2; iteration++ {
          outputs := map[string]string{}
          diagnostics, err := program.EmitWithPluginTransformer(transform, func(name, source string, _ *shimcompiler.WriteFileData) error {
            outputs[filepath.Base(name)] = source
            return nil
          })
          if err != nil || len(diagnostics) != 0 {
            t.Fatalf("emit %d: %v %v", iteration, err, diagnostics)
          }
          for _, file := range []string{"index.js", "index.js.map", "index.d.ts", "index.d.ts.map", "other.d.ts", "other.d.ts.map"} {
            if outputs[file] == "" {
              t.Fatalf("missing %s: %v", file, outputs)
            }
          }
          if !strings.Contains(outputs["index.d.ts"], "answer: number") || !strings.Contains(outputs["index.js"], "7 /* E.A */ + 11 /* E[\"B\"] */") {
            t.Fatalf("declarations or original enum resolution changed: %v", outputs)
          }
          member := "input.value"
          if element {
            member = "input[\"value\"]"
          }
          if !strings.Contains(outputs["index.js"], "input => "+member) {
            t.Fatalf("generated member lost: %s", outputs["index.js"])
          }
          if diagnostics := program.Diagnostics(); len(diagnostics) != 0 {
            t.Fatalf("checker contaminated after emit: %v", diagnostics)
          }
        }
      })
    }
  }
}
