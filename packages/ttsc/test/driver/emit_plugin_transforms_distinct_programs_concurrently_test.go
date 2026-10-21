package driver_test

import (
  "fmt"
  "path/filepath"
  "strings"
  "sync"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEmitWithPluginTransformerDistinctProgramsConcurrently verifies that two
// Programs loaded in one process can run plugin emits at the same time when
// each transform builds its nodes through the per-file EmitContext factory.
// This is the contract driver-api.mdx documents for embedders that keep
// several Programs resident.
//
// The transform wraps every authored string literal in an immediately invoked
// arrow function whose parameter it creates, the shape whose source-file
// parent the printer asserts. Run under `go test -race` (`pnpm test:go:race`),
// a data race in the driver's emit path fails the test. Without `-race` it
// still requires every output to keep its own Program's markers.
//
// 1. Load two Programs from separate projects with disjoint literal markers.
// 2. Emit each once serially, then from two goroutines repeatedly at once.
// 3. Require every emit to wrap each of its own markers and none of the other's.
//
// @evidence contracts/testing.md#behavioral-verification Calls LoadProgram twice and EmitWithPluginTransformer serially and concurrently, requiring each index/first/second output to contain the factory-built `(input => input)("<marker>")` call for its own Program.
// @evidence contracts/testing.md#independent-expectations Marker literals are fixed per project before emit, so the expected wrapped calls and the forbidden foreign markers come from the fixture rather than from any emitter output.
// @evidence contracts/testing.md#distinguishing-cases A dropped transform, a node attached to another Program's file, or output from the wrong Program fails the marker checks; the race detector additionally rejects unsynchronized shared driver state when the test runs with -race.
// @evidence contracts/testing.md#execution-ownership The owning driver unit loads and closes in-process Programs over private temporary projects and records output through its own callbacks, without an executable compiler or installed consumer.
func TestEmitWithPluginTransformerDistinctProgramsConcurrently(t *testing.T) {
  const iterations = 8
  projects := []string{"alpha", "beta"}
  files := []string{"index", "first", "second"}

  programs := make([]*driver.Program, len(projects))
  for index, project := range projects {
    root := t.TempDir()
    writeProjectFile(t, root, "tsconfig.json", fmt.Sprintf(`{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true },
  "files": [%s]
}
`, `"`+strings.Join(filesList(files), `", "`)+`"`))
    for _, file := range files {
      writeProjectFile(t, root, file+".ts", fmt.Sprintf("export const value: string = %q;\n", project+"-"+file))
    }
    program, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
    if err != nil {
      t.Fatal(err)
    }
    if len(diags) != 0 {
      t.Fatalf("unexpected config diagnostics: %#v", diags)
    }
    t.Cleanup(func() { program.Close() })
    programs[index] = program
  }

  // Every node the transform returns comes from ec.Factory, as PluginTransform
  // asks; no factory is shared between files, calls or Programs.
  transform := func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    var visitor *shimast.NodeVisitor
    visit := func(node *shimast.Node) *shimast.Node {
      if node == nil {
        return node
      }
      if node.Kind == shimast.KindStringLiteral {
        f := ec.Factory
        parameter := f.NewParameterDeclaration(nil, nil, f.NewIdentifier("input"), nil, nil, nil)
        arrow := f.NewArrowFunction(nil, nil, f.NewNodeList([]*shimast.Node{parameter}), nil, nil, f.NewToken(shimast.KindEqualsGreaterThanToken), f.NewIdentifier("input"))
        argument := f.NewStringLiteral(node.Text(), 0)
        return f.NewCallExpression(f.NewParenthesizedExpression(arrow), nil, nil, f.NewNodeList([]*shimast.Node{argument}), shimast.NodeFlagsNone)
      }
      return visitor.VisitEachChild(node)
    }
    visitor = ec.NewNodeVisitor(visit)
    return visitor.VisitSourceFile(sf)
  }

  emit := func(index int) error {
    outputs := map[string]string{}
    diags, err := programs[index].EmitWithPluginTransformer(transform, func(fileName shimtspath.RootedFilePath, text string, _ *shimcompiler.WriteFileData) error {
      outputs[filepath.Base(string(fileName))] = text
      return nil
    })
    if err != nil {
      return err
    }
    if len(diags) != 0 {
      return fmt.Errorf("unexpected emit diagnostics: %#v", diags)
    }
    for _, file := range files {
      js := outputs[file+".js"]
      want := fmt.Sprintf("(input => input)(%q)", projects[index]+"-"+file)
      if !strings.Contains(js, want) {
        return fmt.Errorf("%s/%s.js lacks %s:\n%s", projects[index], file, want, js)
      }
      for other, project := range projects {
        if other != index && strings.Contains(js, project+"-") {
          return fmt.Errorf("%s/%s.js carries a %s marker:\n%s", projects[index], file, project, js)
        }
      }
    }
    return nil
  }

  for index := range programs {
    if err := emit(index); err != nil {
      t.Fatalf("serial emit: %v", err)
    }
  }

  start := make(chan struct{})
  failures := make(chan error, len(programs))
  var workers sync.WaitGroup
  for index := range programs {
    workers.Add(1)
    go func() {
      defer workers.Done()
      <-start
      for range iterations {
        if err := emit(index); err != nil {
          failures <- fmt.Errorf("concurrent emit: %w", err)
          return
        }
      }
    }()
  }
  close(start)
  workers.Wait()
  close(failures)
  for err := range failures {
    t.Error(err)
  }
}
