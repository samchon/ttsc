package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLiteralsAreAbsentWhenTheTypeAdmitsMoreThanItCanName verifies the negative
// counterparts for four authored non-enumerable shapes: each reports no
// literals, while a four-member control union has a four-entry result.
//
// This is what lets a present `literals` mean the whole type. `Widened` admits
// four literals and every other string besides, and a caller cannot tell a
// four-value answer for it from a four-value answer for a genuine four-member
// union — so it must get no answer, and read the signature instead. Each fixture
// here is one way a constituent stops being nameable: a primitive next to the
// literals, an unresolved type parameter, a plain primitive alias, and a
// computed enum member whose value the checker cannot fold to a constant.
//
//  1. Compile a fixture holding each non-enumerable shape.
//  2. Build the graph.
//  3. Assert none of them recorded a value set.
//
// @evidence contracts/testing.md#behavioral-verification Actual Build nodes for Widened, Generic, Primitive and Computed must have zero literals; the Narrow control must have four entries. The helper requires each queried node to exist. Other type shapes and control literal contents are not asserted here.
// @evidence contracts/testing.md#independent-expectations The expectations are literal: the control union Narrow must report four values, and Widened (union with string), Generic (type parameter), Primitive (string alias) and Computed (enum with a computed member) must each report no values at all rather than a subset.
// @evidence contracts/testing.md#distinguishing-cases Compile a fixture holding each non-enumerable shape; Build the graph; Assert none of them recorded a value set.
// @evidence contracts/testing.md#execution-ownership This Go source-unit writes a native project, constructs/closes a driver Program in-process and directly calls Build. Actual Program filename/shared ID formatting and literalsOf select existing nodes and their reported arrays; a restored empty linked-plugin manifest excludes ambient hooks. No compute() execution, emit, installed consumer or product process runs.
func TestLiteralsAreAbsentWhenTheTypeAdmitsMoreThanItCanName(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `declare const compute: () => number;

export type Narrow = 'a' | 'b' | 'c' | 'd';
export type Widened = Narrow | string;
export type Generic<T> = T | 'a';
export type Primitive = string;

export enum Computed {
  A = 'a',
  B = compute(),
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

  // A nonempty control detects omission of the entire literal pass; this count
  // does not independently check the control's four values.
  if got := literalsOf(t, graph, nodeID(path, "Narrow", NodeTypeAlias)); len(got) != 4 {
    t.Fatalf("control union did not report its four members: got %v", got)
  }

  for _, testCase := range []struct {
    name string
    kind NodeKind
    why  string
  }{
    {"Widened", NodeTypeAlias, "a union with `string` in it admits values no list can name"},
    {"Generic", NodeTypeAlias, "an unresolved type parameter names no value"},
    {"Primitive", NodeTypeAlias, "a primitive is not a value set"},
    {"Computed", NodeEnum, "a computed enum member has a value nothing here can name"},
  } {
    if got := literalsOf(t, graph, nodeID(path, testCase.name, testCase.kind)); len(got) != 0 {
      t.Fatalf("%s reported a partial value set %v: %s", testCase.name, got, testCase.why)
    }
  }
}
