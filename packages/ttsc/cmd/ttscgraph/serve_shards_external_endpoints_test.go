package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeShardsKeepReferencedExternalEndpointsOnIncrementalLane verifies an incremental local edit retains its referenced external endpoint.
//
// A partial projection must not prune an ambient callable still named by a local
// edge. The full projection comparison checks another publication lane, while
// both lanes continue to share the compiler and extraction helpers. This unit
// independently checks the cached endpoint name and External flag, not the
// local call edge or its endpoints.
//
// 1. Load an ambient external declaration and a local call to it.
// 2. Publish the base, then change only the local implementation body.
// 3. Require incremental publication, endpoint retention and full-lane agreement.
//
// @evidence contracts/testing.md#behavioral-verification An incremental private-body edit whose authored source continues to call external retains a cached node named external with External true. The local call edge and its endpoints are not independently asserted.
// @evidence contracts/testing.md#independent-expectations The literal local body continues to call external, so that endpoint must remain in the committed node cache. Canonical facts are also compared with the full projection lane over the same compiler; the shared compiler and extraction helpers mean that comparison is not an independent checker oracle.
// @evidence contracts/testing.md#distinguishing-cases Initial publication, a local body-only edit, the incremental mode and the still-referenced external endpoint contrast a retained dependency with the separate last-reference removal case.
// @evidence contracts/testing.md#execution-ownership This Go source-unit entry calls newGraphSession and snapshotGraphShardState, which complete the actual prepared state transaction with explicit empty ignore membership; real Git acquisition remains in the worktree E2E.
func TestServeShardsKeepReferencedExternalEndpointsOnIncrementalLane(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs", "strict": true },
  "include": ["src"]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "api.d.ts"), "export declare function external(): number;\n")
  index := filepath.Join(root, "src", "index.ts")
  writeGraphFile(t, index, "import { external } from './api';\nexport function local(): number { return external() + 1; }\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if snapshot, _, _, err := snapshotGraphShardState(session); err != nil || snapshot == nil {
    t.Fatalf("initial shard snapshot = snapshot:%v error:%v", snapshot != nil, err)
  }
  if err := os.WriteFile(index, []byte("import { external } from './api';\nexport function local(): number { return external() + 2; }\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  snapshot, mode, changed, err := snapshotGraphShardState(session)
  if err != nil {
    t.Fatal(err)
  }
  if snapshot == nil || mode != serveModeIncremental || !changed {
    t.Fatalf("external endpoint edit = snapshot:%v mode:%q changed:%v", snapshot != nil, mode, changed)
  }
  retained := false
  for _, node := range session.graphStore.nodes {
    if node.External && node.Name == "external" {
      retained = true
      break
    }
  }
  if !retained {
    t.Fatalf(
      "referenced external endpoint left the internal base-node cache: nodes=%#v references=%#v external=%#v",
      session.graphStore.nodes,
      session.graphStore.externalReferences,
      session.graphStore.externalNodes,
    )
  }
  assertServeShardFactsMatchFullDump(t, session)
}
