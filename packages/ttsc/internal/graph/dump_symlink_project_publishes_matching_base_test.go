package graph

import (
  "os"
  "path/filepath"
  "testing"
)

// TestDumpSymlinkProjectPublishesMatchingBase verifies relative wire paths and
// the published project coordinate share one canonical filesystem base.
//
// A raw symlink cwd combined with canonical source paths makes `../` siblings,
// missing literal roots and a symlinked relative tsconfig resolve incorrectly
// unless project publication and path mapping use the same physical root.
//
//  1. Select a real project directory through a symlink and add sibling inputs.
//  2. Map an existing sibling, a missing child and a relative config symlink.
//  3. Require stable coordinates and a canonical published project base.
//
// @evidence contracts/testing.md#behavioral-verification Actual directory and file symlinks feed newDumpPathMapper and NewDump, then SameFile checks the sibling resolved from the published project base.
// @evidence contracts/testing.md#independent-expectations The physical directory, sibling source and linked config are independently created fixture objects; literal ../shared.ts, src/new.ts and ../config/tsconfig.json define expected wire coordinates.
// @evidence contracts/testing.md#distinguishing-cases A directory alias, a real config-file symlink, a sibling and a missing child distinguish canonical base publication from lexical path joining. Both native link capabilities are required.
// @evidence contracts/testing.md#execution-ownership This Go unit entry calls the owning path mapper and dump constructor directly with temporary filesystem resolver inputs; it builds no artifact and starts no product host. A host unable to create either link skips the case; such a return is a capability limitation, not executed mapping coverage.
func TestDumpSymlinkProjectPublishesMatchingBase(t *testing.T) {
  root := t.TempDir()
  realRoot := filepath.Join(root, "real")
  project := filepath.Join(realRoot, "pkg")
  configDir := filepath.Join(realRoot, "config")
  if err := os.MkdirAll(project, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.MkdirAll(configDir, 0o755); err != nil {
    t.Fatal(err)
  }
  shared := filepath.Join(realRoot, "shared.ts")
  config := filepath.Join(configDir, "tsconfig.json")
  if err := os.WriteFile(shared, []byte("export const shared = true;\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(config, []byte("{}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  alias := filepath.Join(root, "project-link")
  if err := os.Symlink(project, alias); err != nil {
    t.Skipf("host cannot create directory symlink: %v", err)
  }
  if err := os.Symlink(config, filepath.Join(project, "tsconfig.json")); err != nil {
    t.Skipf("host cannot create file symlink: %v", err)
  }

  mapper := newDumpPathMapper(alias)
  if wire := mapper.mapPath(shared); wire != "../shared.ts" {
    t.Fatalf("sibling wire path = %q, want ../shared.ts", wire)
  }
  if wire := mapper.mapPath(filepath.Join(alias, "src", "new.ts")); wire != "src/new.ts" {
    t.Fatalf("missing-root wire path = %q, want src/new.ts", wire)
  }
  if wire := mapper.mapPath("tsconfig.json"); wire != "../config/tsconfig.json" {
    t.Fatalf("relative config wire path = %q, want ../config/tsconfig.json", wire)
  }
  dump, err := NewDump(&Graph{Nodes: map[string]*Node{}}, alias, "tsconfig.json", nil, nil, DumpOrigin{})
  if err != nil {
    t.Fatal(err)
  }
  physicalProject, err := filepath.EvalSymlinks(alias)
  if err != nil {
    t.Fatal(err)
  }
  if filepath.Clean(filepath.FromSlash(dump.Project)) != filepath.Clean(physicalProject) {
    t.Fatalf("published project = %q, want %q", dump.Project, physicalProject)
  }
  resolvedSibling := filepath.Clean(filepath.Join(filepath.FromSlash(dump.Project), filepath.FromSlash("../shared.ts")))
  resolvedSiblingInfo, err := os.Stat(resolvedSibling)
  if err != nil {
    t.Fatal(err)
  }
  sharedInfo, err := os.Stat(shared)
  if err != nil {
    t.Fatal(err)
  }
  if !os.SameFile(resolvedSiblingInfo, sharedInfo) {
    t.Fatalf("published base resolves sibling to %q, want %q", resolvedSibling, shared)
  }
  if dump.Tsconfig != "../config/tsconfig.json" {
    t.Fatalf("published tsconfig = %q, want ../config/tsconfig.json", dump.Tsconfig)
  }
}
