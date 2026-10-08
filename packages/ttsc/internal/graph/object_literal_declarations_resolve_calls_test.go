package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestObjectLiteralDeclarationsResolveCalls verifies statically bound object
// members have their own identities, source spans and checker-resolved callers.
//
//  1. Load methods, callable properties, nested objects, static and dynamic keys,
//     accessors, aliases and ordinary function/class controls in one Program.
//  2. Build the native graph and require precise member-to-helper and
//     caller-to-member relationships.
//  3. Reject unnamed callback object members and dynamic-key declarations.
//
// @evidence contracts/testing.md#behavioral-verification Build must publish each named object member and resolve actual alias/property calls to it, including its own helper dependency and positive source span.
// @evidence contracts/testing.md#independent-expectations The literal API names and call sites prescribe endpoints independently of extraction; dynamic computed keys and anonymous returned literals have no stable lexical declaration name.
// @evidence contracts/testing.md#distinguishing-cases Shorthand/generic, arrow/function, nested, quoted/computed-literal, getter/setter, transparent wrappers and alias calls contrast dynamic keys and unbound literals. Literal bracket text remains distinct from a nested empty key, including namespace-prefixed objects. Numeric/Unicode/empty keys retain their names; private-looking public literals in object and class methods/properties/accessors remain distinct from actual private members and ordinary function/class controls.
// @evidence contracts/testing.md#execution-ownership Owns one native temporary project and directly loaded compiler Program, closes it, and calls Build in the Go test process without installing or launching a product host.
func TestObjectLiteralDeclarationsResolveCalls(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export function helper(): number { return 1; }
const dynamic: string = "unknown";
export const api = ({
  create<T>(input: T): number { return helper(); },
  arrow: (): number => helper(),
  classic: function (): number { return helper(); },
  nested: { run(): number { return helper(); } },
  "quoted.key"(): number { return helper(); },
  quoted: { key(): number { return helper(); } },
  'a[""]'(): number { return helper(); },
  a: { ""(): number { return helper(); } },
  "["(): number { return helper(); },
  "]"(): number { return helper(); },
  "__#41@#value"(): number { return helper(); },
  nestedPrivate: { "prefix__#7@#read"(): number { return helper(); } },
  1.0(): number { return helper(); },
  "\u00FEkey"(): number { return helper(); },
  ""(): number { return helper(); },
  ["computed"](): number { return helper(); },
  [dynamic](): number { return helper(); },
  get value(): number { return helper(); },
  set value(input: number) { helper(); },
} satisfies Record<string, unknown>);
const alias = api;
export function caller(): number {
  alias.create(1); api.arrow(); api.classic(); api.nested.run();
  api["quoted.key"](); api.quoted.key(); api.computed(); api.value = 1;
  api['a[""]'](); api.a[""](); api["["](); api["]"]();
  api["__#41@#value"](); api.nestedPrivate["prefix__#7@#read"]();
  api[1](); api["\u00FEkey"](); api[""]();
  return api.value;
}
export class Control {
  #value(): number { return helper(); }
  "__#41@#value"(): number { return this.#value(); }
  "__#7@#property" = (): number => helper();
  get "prefix__#7@#read"(): number { return helper(); }
  set "prefix__#7@#read"(input: number) { helper(); }
  run(): number { return helper(); }
}
export function control(input: Control): number {
  input["__#41@#value"](); input["__#7@#property"]();
  input["prefix__#7@#read"] = 1; return input.run();
}
export function anonymous() { return { skipped(): number { return helper(); } }; }
export namespace Names {
  export const api = { 'a[""]'(): number { return helper(); }, a: { ""(): number { return helper(); } } };
  export function caller(): number { api['a[""]'](); return api.a[""](); }
}
`)
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  defer func() { _ = prog.Close() }()
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %v", diags)
  }
  graph := Build(prog)
  path := sourceFile(t, prog, "main.ts").FileName()
  caller := nodeID(path, "caller", NodeFunction)
  helper := nodeID(path, "helper", NodeFunction)
  for _, item := range []struct {
    name     string
    kind     NodeKind
    relation EdgeKind
  }{
    {"api.create", NodeMethod, EdgeValueCall},
    {"api.arrow", NodeVariable, EdgeValueCall},
    {"api.classic", NodeVariable, EdgeValueCall},
    {"api.nested.run", NodeMethod, EdgeValueCall},
    {"api[\"quoted.key\"]", NodeMethod, EdgeValueCall},
    {"api.quoted.key", NodeMethod, EdgeValueCall},
    {`api["a[\"\"]"]`, NodeMethod, EdgeValueCall},
    {`api.a[""]`, NodeMethod, EdgeValueCall},
    {`api["["]`, NodeMethod, EdgeValueCall},
    {`api["]"]`, NodeMethod, EdgeValueCall},
    {"api.__#41@#value", NodeMethod, EdgeValueCall},
    {"api.nestedPrivate.prefix__#7@#read", NodeMethod, EdgeValueCall},
    {"api.1", NodeMethod, EdgeValueCall},
    {"api.þkey", NodeMethod, EdgeValueCall},
    {"api[\"\"]", NodeMethod, EdgeValueCall},
    {"api.computed", NodeMethod, EdgeValueCall},
    {"api.value", NodeMethod, EdgeValueAccess},
  } {
    id := nodeID(path, item.name, item.kind)
    node := graph.Nodes[id]
    if node == nil || node.Pos <= 0 || node.End <= node.Pos {
      t.Errorf("missing member/span %s: %+v", item.name, node)
      continue
    }
    if !hasEdge(graph, caller, id, item.relation) {
      t.Errorf("missing caller relation to %s", item.name)
    }
    if !hasEdge(graph, id, helper, EdgeValueCall) {
      t.Errorf("missing member-to-helper relation from %s", item.name)
    }
  }
  if !hasEdge(graph, nodeID(path, "control", NodeFunction), nodeID(path, "Control.run", NodeMethod), EdgeValueCall) {
    t.Error("ordinary class method call was lost")
  }
  for _, name := range []string{`Names.api["a[\"\"]"]`, `Names.api.a[""]`} {
    id := nodeID(path, name, NodeMethod)
    if graph.Nodes[id] == nil || !hasEdge(graph, nodeID(path, "Names.caller", NodeFunction), id, EdgeValueCall) || !hasEdge(graph, id, helper, EdgeValueCall) {
      t.Errorf("namespace object identity/relationships missing: %s", name)
    }
  }
  for _, item := range []struct {
    qualified, simple string
    kind              NodeKind
    relation          EdgeKind
  }{
    {"api.__#41@#value", "__#41@#value", NodeMethod, EdgeValueCall},
    {"api.nestedPrivate.prefix__#7@#read", "prefix__#7@#read", NodeMethod, EdgeValueCall},
    {"api.1", "1", NodeMethod, EdgeValueCall},
    {"api.þkey", "þkey", NodeMethod, EdgeValueCall},
    {"api[\"\"]", "", NodeMethod, EdgeValueCall},
    {"Control.__#41@#value", "__#41@#value", NodeMethod, EdgeValueCall},
    {"Control.__#7@#property", "__#7@#property", NodeVariable, EdgeValueCall},
    {"Control.prefix__#7@#read", "prefix__#7@#read", NodeMethod, EdgeValueAccess},
    {"Control.#value", "#value", NodeMethod, EdgeValueCall},
  } {
    id := nodeID(path, item.qualified, item.kind)
    node := graph.Nodes[id]
    if node == nil || node.Simple != item.simple || node.Pos <= 0 || node.End <= node.Pos {
      t.Errorf("literal/private identity %q: %+v, want simple %q", item.qualified, node, item.simple)
      continue
    }
    if item.qualified == "Control.#value" {
      if !hasEdge(graph, nodeID(path, "Control.__#41@#value", NodeMethod), id, EdgeValueCall) {
        t.Error("public literal method lost its distinct private call target")
      }
    } else if len(item.qualified) >= len("Control.") && item.qualified[:len("Control.")] == "Control." {
      if !hasEdge(graph, nodeID(path, "control", NodeFunction), id, item.relation) {
        t.Errorf("missing control caller relation to %q", item.qualified)
      }
    }
  }
  for _, node := range graph.Nodes {
    if node.Name == "api.unknown" || node.Name == "skipped" || node.Name == "anonymous.skipped" {
      t.Errorf("unnameable member acquired guessed identity: %s", node.Name)
    }
  }
}
