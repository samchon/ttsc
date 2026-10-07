package linthost

import (
  "testing"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestProjectIdentityMintsDistinctProgramLifecycles verifies lifecycle state is
// host-owned per loaded Program rather than transported or cached by path.
//
// Two loads of the same logical and physical project must receive different
// opaque ids, while every caller-selected identity channel stays unchanged.
// This is the boundary that keeps watch reloads and two in-process projects
// from reusing contributor state.
//
//  1. Normalize the same fully populated identity twice.
//  2. Assert the stale caller id was replaced with two distinct host ids.
//  3. Assert explicit project-root and plugin-origin channels were preserved.
//
// @evidence contracts/testing.md#behavioral-verification Two normalizations of one fully populated identity replace the stale caller lifecycle with nonempty distinct host ids while preserving every other identity channel in both complete records.
// @evidence contracts/testing.md#independent-expectations The authored eight-field ProjectIdentity is the independent preservation oracle; resetting only each observed lifecycle for complete struct comparison cannot mask a change to invocation, logical/physical paths, explicit root or plugin origin.
// @evidence contracts/testing.md#distinguishing-cases The same project inputs normalized twice distinguish Program lifecycle freshness from path-keyed reuse, while the supplied stale id distinguishes host minting from transporting a caller identifier.
// @evidence contracts/testing.md#execution-ownership The Go identity normalizer runs directly with fully populated string channels so fallback filesystem resolution is not invoked; no compiler boot, external plugin, process or platform kernel fixture is required.
func TestProjectIdentityMintsDistinctProgramLifecycles(t *testing.T) {
  input := publicrule.ProjectIdentity{
    LifecycleID:         "caller-owned-id",
    InvocationCwd:       "/logical/invocation",
    LogicalConfigPath:   "/logical/project/tsconfig.json",
    LogicalProjectRoot:  "/logical/project",
    PhysicalConfigPath:  "/physical/project/tsconfig.json",
    PhysicalProjectRoot: "/physical/project",
    ExplicitProjectRoot: "/explicit/root",
    PluginConfigOrigin:  "/plugin/config/origin",
  }
  first := normalizeProjectIdentity(input, "/physical/project", input.PhysicalConfigPath)
  second := normalizeProjectIdentity(input, "/physical/project", input.PhysicalConfigPath)

  if first.LifecycleID == "" || first.LifecycleID == input.LifecycleID || second.LifecycleID == "" || second.LifecycleID == input.LifecycleID || first.LifecycleID == second.LifecycleID {
    t.Fatalf("host should mint a distinct lifecycle for every Program: first=%q second=%q", first.LifecycleID, second.LifecycleID)
  }
  if first.ExplicitProjectRoot != input.ExplicitProjectRoot || first.PluginConfigOrigin != input.PluginConfigOrigin {
    t.Fatalf("normalization changed explicit identity channels: %#v", first)
  }
  for _, normalized := range []publicrule.ProjectIdentity{first, second} {
    normalized.LifecycleID = input.LifecycleID
    if normalized != input {
      t.Fatalf("normalization changed a caller identity channel: got %#v want %#v", normalized, input)
    }
  }
}
