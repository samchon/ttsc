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
// per-node panic barrier cannot protect Name or Visits. inspectContributor owns
// that earlier boundary and must return an actionable error without panicking.
//
//  1. Construct a public contributor whose Name method panics.
//  2. Inspect its metadata through the host adapter.
//  3. Assert the panic becomes an error naming the contributor failure.
func TestContributorMetadataPanicIsRejected(t *testing.T) {
  _, err := inspectContributor(metadataPanickingContributor{})
  if err == nil {
    t.Fatal("expected contributor metadata panic to be rejected")
  }
  if !strings.Contains(err.Error(), "metadata panicked: metadata boom") {
    t.Fatalf("unexpected contributor metadata error: %v", err)
  }
}

type metadataPanickingContributor struct{}

func (metadataPanickingContributor) Name() string { panic("metadata boom") }
func (metadataPanickingContributor) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (metadataPanickingContributor) Check(_ *publicrule.Context, _ *shimast.Node) {}
