package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeSessionRebuildsImportGraphChange verifies an added import reports
// rebuild mode and exposes the authored main-to-helper call edge.
//
// The fixture initially declares BeforeEdit and a separate helper function.
// Replacing the class with main's import and call must yield the new relation.
// The test observes the reported mode and graph edge, not compiler-construction
// counts, AST identity or checker-pool lifecycle.
//
// 1. Start with BeforeEdit and a separate exported helper function.
// 2. Edit the first file to import and call the second.
// 3. Assert rebuild mode and a calls edge from `main` to `helper`.
//
// @evidence contracts/testing.md#behavioral-verification Replacing the fixture class with a main function importing and calling helper reports rebuild and publishes their calls edge. It does not count native constructions or assert AST/checker identity.
// @evidence contracts/testing.md#independent-expectations The authored import and call require literal rebuild mode, changed, distinct nonempty node IDs for main and helper, and a calls edge joining those IDs. Node names and edge kind come from the fixture's semantics, not the edge builder's bookkeeping. Initial edge absence and the entire node set are not asserted.
// @evidence contracts/testing.md#distinguishing-cases Start with BeforeEdit and a separate helper; replace the class file with an import and main calling helper; require reported rebuild and the literal main-to-helper calls relation.
// @evidence contracts/testing.md#execution-ownership TestServeSessionRebuildsImportGraphChange is a Go source-unit entry. snapshotGraphState calls the actual prepareDumpSnapshot state operation and completes its graph projection with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeSessionRebuildsImportGraphChange(t *testing.T) {
  root := graphSessionFixture(t)
  helper := filepath.Join(root, "src", "helper.ts")
  if err := os.WriteFile(helper, []byte("export function helper(): void {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if _, _, _, err := snapshotGraphState(session); err != nil {
    t.Fatal(err)
  }

  index := filepath.Join(root, "src", "index.ts")
  content := "import { helper } from './helper';\nexport function main(): void { helper(); }\n"
  if err := os.WriteFile(index, []byte(content), 0o644); err != nil {
    t.Fatal(err)
  }
  dump, mode, changed, err := snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != "rebuild" || !changed {
    t.Fatalf("import edit = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
  mainID, helperID := "", ""
  for _, node := range dump.Nodes {
    if node.Name == "main" {
      mainID = node.ID
    } else if node.Name == "helper" {
      helperID = node.ID
    }
  }
  if mainID == "" || helperID == "" || mainID == helperID {
    t.Fatalf("rebuilt graph lacks distinct main and helper nodes: main=%q helper=%q", mainID, helperID)
  }
  for _, edge := range dump.Edges {
    if edge.From == mainID && edge.To == helperID && edge.Kind == "calls" {
      return
    }
  }
  t.Fatalf("rebuilt graph omitted main -> helper call: nodes=%#v edges=%#v", dump.Nodes, dump.Edges)
}
