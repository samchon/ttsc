package main

import (
  "bytes"
  "encoding/json"
  "os/exec"
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/graph"
)

// TestGitIgnoreMembershipFlowsThroughNativeProjectionAdapters verifies actual
// Git membership reaches the default dump and resident publication adapters.
//
// One real worktree contains an ignored source with a space in its path and an
// authored peer. The source remains a graph endpoint while its ignored flag is
// preserved through full, partial, unchanged and repaired generations.
//
// 1. Initialize an owned Git worktree and query its real NUL-delimited membership.
// 2. Run the default dump and resident adapters over the same source corpus.
// 3. Edit, restore and repair the project, checking every published membership.
//
// @evidence contracts/testing.md#behavioral-verification Real Git processes initialize and evaluate an owned worktree; default dump and resident adapters publish its evaluated source membership rather than a supplied result.
// @evidence contracts/testing.md#independent-expectations The literal ignore rule selects Generated and excludes Visible. Restoring the exact prior config bytes preserves the committed program, so recovery is unchanged; private body edits require incremental publication.
// @evidence contracts/testing.md#distinguishing-cases A space-bearing ignored source, nonignored dependency, full and partial publications, byte restoration, unchanged requests and invalid-config recovery distinguish acquisition and publication paths.
// @evidence contracts/testing.md#execution-ownership This Go E2E entry calls the authored default native adapters and actually spawns Git; Git init uses CombinedOutput and membership uses Output; both join their children. The three sequential adapter subtests restore streams or close their compiler before fixture cleanup, and a failed adapter does not suppress the other independent adapters. It does not claim a built product CLI invocation.
// @evidence contracts/e2e.md#necessary-boundary Git's NUL-delimited child process must evaluate the real worktree and the default acquisition-to-projection connection; direct state units consume supplied membership and cannot prove that connection.
// @evidence contracts/e2e.md#shared-execution One owned worktree and compiler corpus serves the dump, shard and legacy adapters. The stateless command program, incremental shard owner and independently initial legacy owner need three distinct compiler lifetimes to exercise their different default compositions; no product binary is built or installed.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity Only this case owns its worktree. Exact project/source bytes are restored before recovery and the legacy initial request; deferred compiler closes run before t.TempDir cleanup, and each Git command joins synchronously.
// @evidence contracts/e2e.md#preserved-coverage The original 66 acquisition-dependent scenarios retain their assertions on real prepared projection/state owners. The constructor-only and unchanged-preamble cases retain their original direct calls. This boundary checks actual Git membership through top-level dump dispatch and command/full/partial/retry compositions; the three real kernel alias cases remain separate E2E entries.
func TestGitIgnoreMembershipFlowsThroughNativeProjectionAdapters(t *testing.T) {
  root := t.TempDir()
  config := `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true},"include":["src"]}`
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), config)
  writeGraphFile(t, filepath.Join(root, ".gitignore"), "src/generated code.ts\n")
  source := "export function Generated(): number { return 1; }\n"
  generated := filepath.Join(root, "src", "generated code.ts")
  writeGraphFile(t, generated, source)
  visible := filepath.Join(root, "src", "visible.ts")
  visibleSource := "import { Generated } from './generated code'; export function Visible(): number { return Generated(); }\n"
  writeGraphFile(t, visible, visibleSource)
  command := exec.Command("git", "init", "--quiet", root)
  if output, err := command.CombinedOutput(); err != nil { t.Fatalf("real Git worktree precondition: %v: %s", err, output) }

  checkNodes := func(t *testing.T, stage string, nodes []graph.DumpNode) {
    t.Helper()
    found := map[string]bool{}
    for _, node := range nodes {
      if node.Name != "Generated" && node.Name != "Visible" { continue }
      found[node.Name] = true
      if node.Ignored != (node.Name == "Generated") { t.Errorf("%s %s ignored=%v", stage, node.Name, node.Ignored) }
    }
    for _, name := range []string{"Generated", "Visible"} { if !found[name] { t.Errorf("%s missing %s", stage, name) } }
  }
  t.Run("default dump dispatch", func(t *testing.T) {
    var output, errors bytes.Buffer
    priorOut, priorErr := stdout, stderr
    defer func() { stdout, stderr = priorOut, priorErr }()
    stdout, stderr = &output, &errors
    code := run([]string{"dump", "--cwd", root, "--tsconfig", "tsconfig.json"})
    if code != 0 { t.Fatalf("default dump status=%d: %s", code, errors.String()) }
    var dump graph.Dump
    if err := json.Unmarshal(output.Bytes(), &dump); err != nil { t.Fatal(err) }
    checkNodes(t, "default dump", dump.Nodes)
  })

  t.Run("resident shards", func(t *testing.T) {
    session, err := newGraphSession(root, "tsconfig.json")
    if err != nil { t.Fatal(err) }
    defer session.Close()
    verify := func(stage, expectedMode string) {
      t.Helper()
      snapshot, mode, changed, err := session.SnapshotShards()
      if err != nil { t.Fatalf("%s: %v", stage, err) }
      if mode != expectedMode { t.Errorf("%s mode=%s want=%s", stage, mode, expectedMode) }
      if expectedMode == serveModeUnchanged {
        if snapshot != nil || changed { t.Errorf("%s unexpectedly published", stage) }
      } else if snapshot == nil || !changed { t.Errorf("%s failed to publish", stage) }
      if session.graphStore == nil { t.Fatal(stage + " has no committed store for dependent transitions") }
      var nodes []graph.DumpNode
      for _, shard := range session.graphStore.shards { nodes = append(nodes, shard.shard.Nodes...) }
      checkNodes(t, stage, nodes)
    }
    verify("full", serveModeInitial)
    verify("unchanged", serveModeUnchanged)
    writeGraphFile(t, generated, "export function Generated(): number { return 2; }\n")
    verify("partial", serveModeIncremental)
    writeGraphFile(t, generated, source)
    verify("restored", serveModeIncremental)
    verify("restored unchanged", serveModeUnchanged)
    writeGraphFile(t, filepath.Join(root, "tsconfig.json"), "{")
    if snapshot, _, changed, err := session.SnapshotShards(); err == nil || snapshot != nil || changed { t.Error("invalid config did not fail closed") }
    writeGraphFile(t, filepath.Join(root, "tsconfig.json"), config)
    verify("recovered prior config", serveModeUnchanged)
    writeGraphFile(t, visible, "import { Generated } from './generated code'; export function Visible(): number { return Generated() + 1; }\n")
    verify("post-recovery edit", serveModeIncremental)
  })

  // Independent adapters keep executing after another phase's failure. Restore
  // their common corpus even when a resident dependent transition stopped early.
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), config)
  writeGraphFile(t, generated, source)
  writeGraphFile(t, visible, visibleSource)
  t.Run("legacy resident dump", func(t *testing.T) {
    legacy, err := newGraphSession(root, "tsconfig.json")
    if err != nil { t.Fatal(err) }
    defer legacy.Close()
    full, mode, changed, err := legacy.Snapshot()
    if err != nil || full == nil || mode != serveModeInitial || !changed { t.Fatalf("legacy default: mode=%s changed=%v error=%v", mode, changed, err) }
    checkNodes(t, "legacy default", full.Nodes)
  })
}
