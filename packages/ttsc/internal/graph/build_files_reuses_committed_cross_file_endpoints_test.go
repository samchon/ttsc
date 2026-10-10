package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestBuildFilesReusesCommittedCrossFileEndpoints verifies partial extraction
// resolves selected-file facts against, but does not re-emit, the preceding
// full build's declaration index from the same unchanged Program.
//
// A member implementation edge is the boundary case: resolving the base class
// alone is insufficient because the edge targets the base member node. If a
// partial builder sees only its replacement file, that member disappears unless
// the committed endpoint index participates in checker resolution. Conversely,
// emitting the base and unrelated nodes again would violate this selected-file
// extraction's output boundary. No edit or committed shard replacement runs.
//
//  1. Compile a base interface, one implementation and an unrelated source.
//  2. Build the complete generation, then rebuild only the implementation file
//     against its node index.
//  3. Require the implementation/member facts and cross-file edge while
//     rejecting re-emission of the base and unrelated nodes.
//
// @evidence contracts/testing.md#behavioral-verification BuildFiles selects impl.ts using the same Program's full-build nodes as its base index, emits Impl.run and its implements member relation to Base.run, and emits no node from base.ts or unrelated.ts.
// @evidence contracts/testing.md#independent-expectations The method names, implements relation and forbidden file membership are authored expectations. File paths come from the loaded Program, and method IDs use the owning nodeID formatter, so ID grammar and filename reporting are not independently certified.
// @evidence contracts/testing.md#distinguishing-cases Compile a base interface, one implementation and an unrelated source; Build the complete generation, then rebuild only the implementation file against its node index; Require the implementation/member facts and cross-file edge while rejecting re-emission of the base and unrelated nodes.
// @evidence contracts/testing.md#execution-ownership This graph Go source-unit writes its native temporary project, constructs and closes a driver compiler Program in-process, then calls Build and BuildFiles directly. A restored empty linked-plugin manifest excludes ambient hooks; no consumer installation or native product command is used.
func TestBuildFilesReusesCommittedCrossFileEndpoints(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
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
  partial := BuildFiles(prog, []string{implFile.AsString()}, complete.Nodes)

  implMethod := nodeID(implFile.AsString(), "Impl.run", NodeMethod)
  baseMethod := nodeID(baseFile.AsString(), "Base.run", NodeMethod)
  if partial.Nodes[implMethod] == nil {
    t.Fatalf("partial build omitted selected method %s", implMethod)
  }
  for _, node := range partial.Nodes {
    if node.File == baseFile.AsString() || node.File == unrelatedFile.AsString() {
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
