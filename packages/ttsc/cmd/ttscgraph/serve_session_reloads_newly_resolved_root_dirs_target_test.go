package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeSessionReloadsNewlyResolvedRootDirsTarget verifies virtual relative
// paths across rootDirs participate in module-resolution freshness.
func TestServeSessionReloadsNewlyResolvedRootDirsTarget(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "rootDirs": ["src", "generated"]
  },
  "files": ["src/views/index.ts"]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "views", "index.ts"), "import { template } from './template';\nexport function render(): void { template(); }\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if _, _, _, err := session.Snapshot(); err != nil {
    t.Fatal(err)
  }

  target := filepath.Join(root, "generated", "views", "template.ts")
  if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(target, []byte("export function template(): void {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  dump, mode, changed, err := session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != "reload" || !changed || !hasDumpNode(*dump, "template") {
    t.Fatalf("new rootDirs target = dump:%v mode:%q changed:%v nodes:%#v", dump != nil, mode, changed, dump)
  }
}
