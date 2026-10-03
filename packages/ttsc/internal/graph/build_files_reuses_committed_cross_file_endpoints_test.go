package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestBuildFilesReusesCommittedCrossFileEndpoints verifies partial extraction
// resolves selected-file facts against, but does not re-emit, the preceding
// generation's unchanged declaration index.
//
// A member implementation edge is the boundary case: resolving the base class
// alone is insufficient because the edge targets the base member node. If a
// partial builder sees only its replacement file, that member disappears unless
// the committed endpoint index participates in checker resolution. Conversely,
// emitting the base and unrelated nodes again would turn a file edit back into
// a whole-project graph replacement.
//
//  1. Compile a base interface, one implementation and an unrelated source.
//  2. Build the complete generation, then rebuild only the implementation file
//     against its node index.
//  3. Require the implementation/member facts and cross-file edge while
//     rejecting re-emission of the base and unrelated nodes.
//
// @evidence contracts/testing.md#behavioral-verification Verifies partial extraction resolves selected-file facts against, but does not re-emit, the preceding generation's unchanged declaration index.
// @evidence contracts/testing.md#independent-expectations The expectations are literal: with only impl.ts selected and the complete generation's nodes as the base index, the partial graph must contain the Impl.run method node, no node from base.ts or unrelated.ts, and a member-relation edge from Impl.run to Base.run whose origin is implements.
// @evidence contracts/testing.md#distinguishing-cases Compile a base interface, one implementation and an unrelated source; Build the complete generation, then rebuild only the implementation file against its node index; Require the implementation/member facts and cross-file edge while rejecting re-emission of the base and unrelated nodes.
// @evidence contracts/testing.md#execution-ownership TestBuildFilesReusesCommittedCrossFileEndpoints is a Go source-unit entry. BuildFiles, Build, nodeID execute directly over the authored source or explicit input facts. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary.
func TestBuildFilesReusesCommittedCrossFileEndpoints(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
`)
  writeFile(t, filepath.Join(root, "src", "base.ts"), `export interface Base {
  run(): void;
}
`)
  writeFile(t, filepath.Join(root, "src", "impl.ts"), `import { Base } from "./base";
export class Impl implements Base {
  run(): void {}
}
`)
  writeFile(t, filepath.Join(root, "src", "unrelated.ts"), `export const unrelated = 1;
`)

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %v", diags)
  }
  defer func() { _ = prog.Close() }()

  complete := Build(prog)
  implFile := sourceFile(t, prog, "impl.ts").FileName()
  baseFile := sourceFile(t, prog, "base.ts").FileName()
  unrelatedFile := sourceFile(t, prog, "unrelated.ts").FileName()
  partial := BuildFiles(prog, []string{implFile}, complete.Nodes)

  implMethod := nodeID(implFile, "Impl.run", NodeMethod)
  baseMethod := nodeID(baseFile, "Base.run", NodeMethod)
  if partial.Nodes[implMethod] == nil {
    t.Fatalf("partial build omitted selected method %s", implMethod)
  }
  for _, node := range partial.Nodes {
    if node.File == baseFile || node.File == unrelatedFile {
      t.Fatalf("partial build re-emitted unchanged node %s", node.ID)
    }
  }
  found := false
  for _, edge := range partial.Edges {
    if edge.From == implMethod && edge.To == baseMethod &&
      edge.Kind == EdgeMemberRelation && edge.Origin == "implements" {
      found = true
      break
    }
  }
  if !found {
    t.Fatalf("partial build omitted checker-valid member edge %s -> %s", implMethod, baseMethod)
  }
}
