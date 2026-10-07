package main

import (
  "path/filepath"
  "testing"
)

// TestServeObjectMembersRefreshWithoutIdentityCollisions verifies resident
// object-member facts track edits through aliases and barrel re-exports.
//
//  1. Load an object API and a consumer through a re-exporting module.
//  2. Rename, remove and add its method and caller in the same resident session.
//  3. Require current identities and calls, no stale methods, and equivalence
//     with a full projection at every committed generation.
//
// @evidence contracts/testing.md#behavioral-verification Actual shard snapshots publish the current object method/caller call and remove obsolete members through successive source edits; committed facts match the full builder.
// @evidence contracts/testing.md#independent-expectations Literal method names and caller bodies prescribe each node and call independently. Differential full projection checks transaction consistency but cannot establish extraction semantics by itself.
// @evidence contracts/testing.md#distinguishing-cases Initial, renamed, removed and newly added method states retain alias and barrel resolution. Every transition rejects the other literal method names as stale endpoints.
// @evidence contracts/testing.md#execution-ownership Owns one temporary project and resident graphSession, invokes actual preparation/projection in the Go test process, and closes it without building or launching a product binary.
func TestServeObjectMembersRefreshWithoutIdentityCollisions(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true},"include":["src"]}`)
  writeGraphFile(t, filepath.Join(root, "src", "barrel.ts"), "export { api } from './api';\n")
  var session *graphSession
  for _, method := range []string{"create", "replace", "", "added"} {
    api := "export const api = {};\n"
    caller := "export function caller(): number { return 0; }\n"
    if method != "" {
      api = "export const api = { " + method + "(): number { return 1; } };\n"
      caller = "import { api as alias } from './barrel';\nexport function caller(): number { return alias." + method + "(); }\n"
    }
    writeGraphFile(t, filepath.Join(root, "src", "api.ts"), api)
    writeGraphFile(t, filepath.Join(root, "src", "use.ts"), caller)
    if session == nil {
      var err error
      session, err = newGraphSession(root, "tsconfig.json")
      if err != nil {
        t.Fatal(err)
      }
      defer session.Close()
    }
    snapshot, _, _, err := snapshotGraphShardState(session)
    if err != nil || snapshot == nil {
      t.Fatalf("snapshot for %q: %v", method, err)
    }
    assertServeShardFactsMatchFullDump(t, session)
    dump, err := projectGraphDump(session)
    if err != nil {
      t.Fatal(err)
    }
    var target, from string
    for _, node := range dump.Nodes {
      qualified := node.QualifiedName
      if qualified == "" {
        qualified = node.Name
      }
      for _, other := range []string{"create", "replace", "added"} {
        if qualified == "api."+other {
          if other != method {
            t.Errorf("stale method %q in state %q", other, method)
          }
          target = node.ID
        }
      }
      if qualified == "caller" {
        from = node.ID
      }
    }
    if method == "" {
      continue
    }
    found := false
    for _, edge := range dump.Edges {
      if edge.From == from && edge.To == target && edge.Kind == "calls" {
        found = true
      }
    }
    if target == "" || from == "" || !found {
      t.Errorf("missing current caller->api.%s", method)
    }
  }
}
