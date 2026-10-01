package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeSessionRebuildsImportGraphChange verifies an edited import set uses
// tsgo's safe rebuild path instead of claiming structural reuse.
//
// UpdateProgram can replace one AST only while its module references are
// unchanged. Adding an import must rebuild the Program, refresh the Checker, and
// emit the newly-resolved call edge in the same resident session.
//
// 1. Start with two exported functions and no edge between them.
// 2. Edit the first file to import and call the second.
// 3. Assert rebuild mode and a calls edge from `main` to `helper`.
//
// @evidence contracts/testing.md#behavioral-verification Verifies an edited import set uses tsgo's safe rebuild path instead of claiming structural reuse.
// @evidence contracts/testing.md#independent-expectations The explicit input facts and supported graph/command contract establish "rebuild", "main", "helper", "calls"; rebuild mode and a calls edge from `main` to `helper`.
// @evidence contracts/testing.md#distinguishing-cases Start with two exported functions and no edge between them; Edit the first file to import and call the second; Assert rebuild mode and a calls edge from `main` to `helper`.
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
  for _, edge := range dump.Edges {
    if edge.From == mainID && edge.To == helperID && edge.Kind == "calls" {
      return
    }
  }
  t.Fatalf("rebuilt graph omitted main -> helper call: nodes=%#v edges=%#v", dump.Nodes, dump.Edges)
}
