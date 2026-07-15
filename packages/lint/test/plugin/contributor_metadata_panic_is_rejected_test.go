package linthost

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestContributorMetadataPanicIsRejected verifies contributor metadata panics
// are converted to one rejected registration instead of escaping startup.
//
// Contributor methods run before the engine can dispatch Check, so the normal
// per-node panic barrier cannot protect Name, Visits, or optional capability
// methods. inspectContributor owns that earlier boundary and must return an
// actionable error without panicking.
//
//  1. Construct public contributors whose metadata methods panic in turn.
//  2. Inspect each contributor through the host adapter.
//  3. Assert every panic becomes an error naming the contributor failure.
func TestContributorMetadataPanicIsRejected(t *testing.T) {
  for _, method := range []string{
    "Name",
    "Visits",
    "IsFormat",
    "VisitsDeclarationFiles",
    "AcceptsTtscLintOptions",
  } {
    t.Run(method, func(t *testing.T) {
      _, err := inspectContributor(metadataPanickingContributor{method: method})
      if err == nil {
        t.Fatal("expected contributor metadata panic to be rejected")
      }
      if !strings.Contains(err.Error(), "metadata panicked: "+method+" boom") {
        t.Fatalf("unexpected contributor metadata error: %v", err)
      }
    })
  }
}

type metadataPanickingContributor struct{ method string }

func (r metadataPanickingContributor) Name() string {
  if r.method == "Name" {
    panic("Name boom")
  }
  return "test/metadata-panic"
}
func (r metadataPanickingContributor) Visits() []shimast.Kind {
  if r.method == "Visits" {
    panic("Visits boom")
  }
  return []shimast.Kind{shimast.KindSourceFile}
}
func (metadataPanickingContributor) Check(_ *publicrule.Context, _ *shimast.Node) {}
func (r metadataPanickingContributor) IsFormat() bool {
  if r.method == "IsFormat" {
    panic("IsFormat boom")
  }
  return false
}
func (r metadataPanickingContributor) VisitsDeclarationFiles() bool {
  if r.method == "VisitsDeclarationFiles" {
    panic("VisitsDeclarationFiles boom")
  }
  return true
}
func (r metadataPanickingContributor) AcceptsTtscLintOptions() bool {
  if r.method == "AcceptsTtscLintOptions" {
    panic("AcceptsTtscLintOptions boom")
  }
  return true
}
