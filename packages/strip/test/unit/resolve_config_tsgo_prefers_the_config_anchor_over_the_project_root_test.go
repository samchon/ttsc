package strip_test

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
// @evidence contracts/testing.md#behavioral-verification Seeds root and nested workspace compilers, then asserts stripResolveConfigTsgo chooses the config-local compiler and rejects the root compiler as its answer.
// @evidence contracts/testing.md#independent-expectations Config-first tool lookup gives the config its own toolchain. Distinct seeded executable paths expose reversed anchor order.
// @evidence contracts/testing.md#distinguishing-cases Owns two successful competing anchors; root fallback after an unresolved config anchor and explicit override are separate cases.
// @evidence contracts/testing.md#execution-ownership Unit entry TestResolveConfigTsgoPrefersTheConfigAnchorOverTheProjectRoot is selected from test/unit by the utility runner unit overlay. Runs stripConfigToolAnchors and stripResolveConfigTsgo in the Go process over manifest/stat fixtures; no compiler executes.
func TestResolveConfigTsgoPrefersTheConfigAnchorOverTheProjectRoot(t *testing.T) {
  shedConfigToolEnvironment(t)
  root := stripRealpathIfPossible(t.TempDir())
  workspace := filepath.Join(root, "packages", "app")
  rootBinary := seedProjectTypeScript(t, root)
  workspaceBinary := seedProjectTypeScript(t, workspace)
  config := filepath.Join(workspace, "strip.config.ts")
  writeFile(t, config, "export default {};\n")

  got := stripResolveConfigTsgo(stripConfigToolAnchors(config, root))
  if got == rootBinary {
    t.Fatalf("stripResolveConfigTsgo took the root compiler %q over the config's %q", rootBinary, workspaceBinary)
  }
  if got != workspaceBinary {
    t.Fatalf("stripResolveConfigTsgo = %q, want the config's compiler %q", got, workspaceBinary)
  }
}
