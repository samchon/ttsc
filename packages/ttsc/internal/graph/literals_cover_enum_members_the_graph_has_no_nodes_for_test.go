package graph

import (
  "path/filepath"
  "slices"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLiteralsCoverEnumMembersTheGraphHasNoNodesFor verifies that an enum
// reports its member values, string-valued, numeric, and implicitly numbered
// alike, in the authored multiline, single-line and implicit fixtures.
// The negative node check is limited to Wrapped.A with kind method; it neither
// proves all member nodes absent nor makes literals the only enum detail field.
//
//  1. Compile a fixture with a multi-line string enum, a single-line one, and an
//     enum whose members are implicitly numbered.
//  2. Build the graph.
//  3. Assert the literal value arrays and reject one Wrapped.A method-node ID.
//
// @evidence contracts/testing.md#behavioral-verification Build must report ordered a/b/c string values for Wrapped, identical values for Flat, ordered 0/1 for Implicit, and no method node at Wrapped.A. This does not authenticate the acquisition algorithm or absence of all possible enum-member nodes.
// @evidence contracts/testing.md#independent-expectations Wrapped and Implicit use literal expected arrays for authored string and implicit numeric enums. Flat equality reuses Wrapped only after its exact literal check. The single Wrapped.A method-ID negative does not cover other member names or node kinds, and implicit values are expected semantics rather than proof that only a checker could produce them.
// @evidence contracts/testing.md#distinguishing-cases Multiline and single-line equal declarations contrast layout, while implicit numbering supplies 0/1 without explicit numeric initializers. One method-node-ID absence is the bounded negative counterpart; other enum detail fields remain permitted.
// @evidence contracts/testing.md#execution-ownership This Go source-unit writes a native project, constructs/closes its driver Program in-process and directly calls Build and the existing-node literalsOf helper. Actual filenames/shared ID formatting select endpoints; a restored empty linked-plugin manifest excludes ambient hooks. No emit, enum execution, installed consumer or product process runs.
func TestLiteralsCoverEnumMembersTheGraphHasNoNodesFor(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export enum Wrapped {
  A = 'a',
  B = 'b',
  C = 'c',
}

export enum Flat { A = 'a', B = 'b', C = 'c' }

export enum Implicit {
  First,
  Second,
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

  // Multiline declaration with independent literal expected values.
  wrapped := literalsOf(t, graph, nodeID(path, "Wrapped", NodeEnum))
  if want := []string{`"a"`, `"b"`, `"c"`}; !slices.Equal(wrapped, want) {
    t.Fatalf("multi-line enum under-reported its members: got %v, want %v", wrapped, want)
  }
  // Layout is not the fact; the single-line twin must agree exactly.
  flat := literalsOf(t, graph, nodeID(path, "Flat", NodeEnum))
  if !slices.Equal(flat, wrapped) {
    t.Fatalf("enum layout changed the value set: wrapped %v, flat %v", wrapped, flat)
  }
  // Implicitly numbered members have literal semantic expectations; no numeric
  // initializers are written, but this does not certify the acquisition method.
  implicit := literalsOf(t, graph, nodeID(path, "Implicit", NodeEnum))
  if want := []string{"0", "1"}; !slices.Equal(implicit, want) {
    t.Fatalf("implicitly numbered enum did not report its resolved values: got %v, want %v", implicit, want)
  }
  // Reject this particular method-node identity; other enum detail fields and
  // member-node spellings are not examined.
  if node, ok := graph.Nodes[nodeID(path, "Wrapped.A", NodeMethod)]; ok {
    t.Fatalf("enum member unexpectedly modeled as a node (%v); literals may no longer be the only carrier", node.ID)
  }
}
