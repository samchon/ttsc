package main

import (
  "bytes"
  "encoding/json"
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/graph"
)

// TestRunDumpEmitsOnlyCheckerVerifiedMemberRelations verifies the shipped dump
// command serializes native member facts and does not revive a rejected pair.
//
// The graph reader no longer synthesizes member edges from equal names, so the
// command boundary must prove all three layers together: compiler diagnostics,
// native pair validation, and the public implements/overrides wire vocabulary.
//
//  1. Dump a program with one valid and one TS2416-invalid implementation.
//  2. Locate the container and member nodes in the serialized document.
//  3. Require the valid member edge and its evidence, reject the invalid edge,
//     and ensure the internal native edge kind never reaches JSON.
func TestRunDumpEmitsOnlyCheckerVerifiedMemberRelations(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/main.ts"]
}
`)
  writeGraphFile(t, filepath.Join(root, "src", "main.ts"), `export interface Contract {
  execute(input: number): void;
}
export class Good implements Contract {
  execute(input: number): void {}
}
export class Bad implements Contract {
  execute(input: string): void {}
}
`)

  oldStdout, oldStderr := stdout, stderr
  defer func() { stdout, stderr = oldStdout, oldStderr }()
  var out, errBuf bytes.Buffer
  stdout, stderr = &out, &errBuf

  if code := run([]string{"dump", "--cwd", root, "--tsconfig", "tsconfig.json"}); code != 0 {
    t.Fatalf("run dump exit = %d, want 0; stderr:\n%s", code, errBuf.String())
  }
  if bytes.Contains(out.Bytes(), []byte("member-relation")) {
    t.Fatalf("internal edge kind leaked into the public dump:\n%s", out.String())
  }

  var dump graph.Dump
  if err := json.Unmarshal(out.Bytes(), &dump); err != nil {
    t.Fatalf("dump output is not valid JSON: %v\n%s", err, out.String())
  }
  seen2416 := false
  for _, diagnostic := range dump.Diagnostics {
    seen2416 = seen2416 || diagnostic.Code == 2416
  }
  if !seen2416 {
    t.Fatalf("fixture must retain TS2416 in the same snapshot: %v", dump.Diagnostics)
  }

  node := func(name, kind string) *graph.DumpNode {
    t.Helper()
    for i := range dump.Nodes {
      candidate := &dump.Nodes[i]
      declaredName := candidate.QualifiedName
      if declaredName == "" {
        declaredName = candidate.Name
      }
      if declaredName == name && candidate.Kind == kind {
        return candidate
      }
    }
    t.Fatalf("missing %s %s; nodes: %v", kind, name, dump.Nodes)
    return nil
  }
  contract := node("Contract", "interface")
  good := node("Good", "class")
  contractExecute := node("Contract.execute", "method")
  goodExecute := node("Good.execute", "method")
  badExecute := node("Bad.execute", "method")

  countEdge := func(from, to, kind string) int {
    count := 0
    for _, edge := range dump.Edges {
      if edge.From == from && edge.To == to && edge.Kind == kind {
        count++
      }
    }
    return count
  }
  if count := countEdge(good.ID, contract.ID, "implements"); count != 1 {
    t.Fatalf("container implementation edge count = %d, want 1; edges: %v", count, dump.Edges)
  }
  if count := countEdge(goodExecute.ID, contractExecute.ID, "implements"); count != 1 {
    t.Fatalf("valid member implementation edge count = %d, want 1; edges: %v", count, dump.Edges)
  }
  if count := countEdge(badExecute.ID, contractExecute.ID, "implements"); count != 0 {
    t.Fatalf("checker-invalid member implementation edge count = %d, want 0; edges: %v", count, dump.Edges)
  }
  for _, edge := range dump.Edges {
    if edge.From == goodExecute.ID && edge.To == contractExecute.ID && edge.Kind == "implements" {
      if edge.Evidence == nil || goodExecute.Evidence == nil ||
        edge.Evidence.StartLine != goodExecute.Evidence.StartLine {
        t.Fatalf("member edge evidence does not identify Good.execute: edge=%v node=%v", edge.Evidence, goodExecute.Evidence)
      }
    }
  }
}
