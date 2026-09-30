package linthost

import (
  "path/filepath"
  "testing"
)

// TestResolveConfigTsgoPrefersTheConfigAnchorOverTheProjectRoot verifies the
// config file's own install outranks the resolution root's.
//
// Anchor order is the whole policy, and it is shared with the JS evaluator's
// `resolveConfigTsgo`: the config file decides, because its imports were
// written against the toolchain its own installation carries. In a monorepo
// where a workspace pins a different `typescript` than the root, taking the
// root would type-check the config against the wrong compiler.
//
//  1. Seed two resolvable installs, one beside the config and one at the root.
//  2. Shed both tool variables.
//  3. Assert the config's install is the one chosen.
//
// @evidence contracts/testing.md#behavioral-verification resolveConfigTsgo selects the config workspace compiler rather than the separately seeded root compiler.
// @evidence contracts/testing.md#independent-expectations Config imports own their local toolchain before project fallback; two independent installed fixture paths establish which location must win.
// @evidence contracts/testing.md#distinguishing-cases Owns both anchors populated with different compilers; sibling-tree fallback and explicit environment pinning remain separate cases.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. Two authored temporary compiler fixtures reach configToolAnchors and resolveConfigTsgo in-process; exact workspace-versus-root selection requires no native execution or package installation.
func TestResolveConfigTsgoPrefersTheConfigAnchorOverTheProjectRoot(t *testing.T) {
  shedConfigToolEnvironment(t)
  root := realpathIfPossible(t.TempDir())
  workspace := filepath.Join(root, "packages", "app")
  rootBinary := seedProjectTypeScript(t, root)
  workspaceBinary := seedProjectTypeScript(t, workspace)
  config := filepath.Join(workspace, "lint.config.ts")
  writeFile(t, config, "export default {};\n")

  got := resolveConfigTsgo(configToolAnchors(config, root))
  if got == rootBinary {
    t.Fatalf("resolveConfigTsgo took the root compiler %q over the config's %q", rootBinary, workspaceBinary)
  }
  if got != workspaceBinary {
    t.Fatalf("resolveConfigTsgo = %q, want the config's compiler %q", got, workspaceBinary)
  }
}
