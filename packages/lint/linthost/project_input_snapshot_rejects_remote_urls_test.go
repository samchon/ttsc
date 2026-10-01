package linthost

import (
  "strings"
  "testing"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

type remoteProjectInputRule struct{}

func (remoteProjectInputRule) Name() string                     { return "test/remote-project-input" }
func (remoteProjectInputRule) Check(*publicrule.ProjectContext) {}
func (remoteProjectInputRule) ProjectInputs(*publicrule.ProjectInputContext) []publicrule.ProjectInput {
  return []publicrule.ProjectInput{{
    Kind:    publicrule.ProjectInputFile,
    Pattern: "https://example.com/openapi.json",
  }}
}

// TestProjectInputSnapshotRejectsRemoteURLs verifies filesystem invalidation
// never pretends an HTTP resource is a local path.
//
// Remote inputs require polling or conditional revalidation. Accepting a URL
// here would create a platform-dependent pseudo-path that neither CLI nor LSP
// filesystem events can observe.
//
//  1. Enable a rule that publishes an HTTPS input as an exact file.
//  2. Collect its project-input snapshot.
//  3. Assert collection fails with the remote-filesystem boundary.
//
// @evidence contracts/testing.md#behavioral-verification Actual configured project input publication rejects an authored HTTPS exact-file declaration with the is not a filesystem dependency diagnostic instead of manufacturing a local pseudo-path.
// @evidence contracts/testing.md#independent-expectations Literal https://example.com/openapi.json identifies a network resource independently of platform path conversion; the contextual error is required by the filesystem-only invalidation contract.
// @evidence contracts/testing.md#distinguishing-cases An enabled publisher with explicit project root isolates remote input rejection from absent registration or root; sibling missing local paths and unmatched globs provide allowed-filesystem controls.
// @evidence contracts/testing.md#execution-ownership Real collector calls a registered public project input publisher directly in-process with restored registration and temporary cwd; no HTTP request, installed native plugin or watcher process runs.
func TestProjectInputSnapshotRejectsRemoteURLs(t *testing.T) {
  root := t.TempDir()
  name := "test/remote-project-input"
  previous, existed := registeredProjectRules[name]
  registeredProjectRules[name] = projectRuleAdapter{
    inner:          remoteProjectInputRule{},
    name:           name,
    acceptsOptions: true,
  }
  t.Cleanup(func() {
    if existed {
      registeredProjectRules[name] = previous
    } else {
      delete(registeredProjectRules, name)
    }
  })
  _, err := collectProjectInputs(RuleConfig{name: SeverityError}, publicrule.ProjectIdentity{
    InvocationCwd:       root,
    PhysicalProjectRoot: root,
  })
  if err == nil || !strings.Contains(err.Error(), "is not a filesystem dependency") {
    t.Fatalf("remote dependency error = %v", err)
  }
}
