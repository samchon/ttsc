package main

import (
  "os"
  "path/filepath"
  "testing"
)

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
  if snapshot, _, _, err := session.SnapshotShards(); err != nil || snapshot == nil {
    t.Fatalf("initial shard snapshot = snapshot:%v error:%v", snapshot != nil, err)
  }
  if err := os.WriteFile(index, []byte("import { external } from './api';\nexport function local(): number { return external() + 2; }\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  snapshot, mode, changed, err := session.SnapshotShards()
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
