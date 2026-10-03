package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDecoratorsCaptureNameAndLiteralArguments verifies that collectDecorators
// records the two authored class/method decorator names and string arguments
// on their expected target nodes, while an undecorated method has no fact.
// It does not execute decorators or a consumer's convention interpretation.
//
// A convention's value lives in the decorator's literal argument, so the test
// pins both axes a consumer depends on: the decorator name (`Controller`,
// `Get`) and the unquoted literal value (`users`, `:id`), each on the right
// target node. A bare method with no decorator is the negative twin: it must
// contribute no decorator fact.
//
//  1. Compile a controller-shaped fixture with @Controller("users") on the class
//     and @Get(":id") on one method, plus an undecorated method, using local
//     decorator factories so the program type-checks with no dependency.
//  2. Build the graph.
//  3. Assert a Decorator targets the class with name "Controller" / literal
//     "users", one targets the method with name "Get" / literal ":id", and the
//     undecorated method has no fact.
//
// @evidence contracts/testing.md#behavioral-verification Build exposes matching Controller and Get facts on the expected class/method targets with one string argument each, and no decorator fact targets the plain method.
// @evidence contracts/testing.md#independent-expectations The decorator names and string values users and :id are authored literals. The first matching fact is checked, not duplicate-fact absence; target IDs use nodeID and the Program-reported path, so their grammar is not independently certified.
// @evidence contracts/testing.md#distinguishing-cases Compile a controller-shaped fixture with @Controller("users") on the class and @Get(":id") on one method, plus an undecorated method, using local decorator factories so the program type-checks with no dependency; Build the graph; Assert a Decorator targets the class with name "Controller" / literal "users", one targets the method with name "Get" / literal ":id", and the undecorated method has no fact.
// @evidence contracts/testing.md#execution-ownership This graph Go source-unit writes its native temporary project, constructs and closes a driver compiler Program in-process, and calls Build without emitting or executing the decorators. A restored empty linked-plugin manifest excludes ambient hooks; no installed consumer or native product command is used.
func TestDecoratorsCaptureNameAndLiteralArguments(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `function Controller(prefix: string): any {
  void prefix;
  return () => {};
}
function Get(path: string): any {
  void path;
  return () => {};
}
@Controller("users")
export class UsersController {
  @Get(":id")
  find(): void {}
  plain(): void {}
}
`)

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %v", diags)
  }
  defer func() { _ = prog.Close() }()

  graph := Build(prog)
  path := sourceFile(t, prog, "main.ts").FileName()

  controller := nodeID(path, "UsersController", NodeClass)
  find := nodeID(path, "UsersController.find", NodeMethod)
  plain := nodeID(path, "UsersController.plain", NodeMethod)

  classDec := findDecorator(graph, controller, "Controller")
  if classDec == nil {
    t.Fatalf("missing @Controller fact on the class; decorators: %v", graph.Decorators)
  }
  if len(classDec.Arguments) != 1 || classDec.Arguments[0].Literal != "users" {
    t.Fatalf("@Controller args: want one literal \"users\", got %v", classDec.Arguments)
  }

  methodDec := findDecorator(graph, find, "Get")
  if methodDec == nil {
    t.Fatalf("missing @Get fact on UsersController.find; decorators: %v", graph.Decorators)
  }
  if len(methodDec.Arguments) != 1 || methodDec.Arguments[0].Literal != ":id" {
    t.Fatalf("@Get args: want one literal \":id\", got %v", methodDec.Arguments)
  }

  // Negative twin: an undecorated method contributes no decorator fact, so a
  // consumer sees no decorator on it.
  for _, d := range graph.Decorators {
    if d.Target == plain {
      t.Fatalf("undecorated method UsersController.plain gained a decorator fact: %+v", d)
    }
  }
}

// findDecorator returns the first decorator fact targeting target with the given
// name, or nil.
func findDecorator(graph *Graph, target, name string) *Decorator {
  for _, d := range graph.Decorators {
    if d.Target == target && d.Name == name {
      return d
    }
  }
  return nil
}
