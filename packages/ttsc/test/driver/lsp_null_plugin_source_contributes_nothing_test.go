package driver_test

import (
  "errors"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPNullPluginSourceContributesNothing Verifies that NullPluginSource returns empty diagnostics, nil actions and IDs, and ErrCommandNotHandled with no edit.
//
// All four source operations are checked; real upstream forwarding is not exercised.
//
// 1. Call all four operations on NullPluginSource.
// 2. Assert empty document/project diagnostics, nil actions and IDs, and ErrCommandNotHandled without an edit.
//
// @evidence contracts/testing.md#behavioral-verification NullPluginSource returns empty diagnostics, nil actions and IDs, and ErrCommandNotHandled with no edit.
// @evidence contracts/testing.md#independent-expectations The null-source contract contributes no findings and claims no commands.
// @evidence contracts/testing.md#distinguishing-cases All four source operations are checked; real upstream forwarding is not exercised.
// @evidence contracts/testing.md#execution-ownership The zero-value public source is invoked directly in Go. Go discovers TestLSPNullPluginSourceContributesNothing under ./test/driver.
func TestLSPNullPluginSourceContributesNothing(t *testing.T) {
  src := driver.NullPluginSource{}

  if got := src.Diagnostics(driver.LSPDocumentVersion{URI: "file:///x.ts"}); got.Document != nil || got.Project != nil {
    t.Fatalf("Diagnostics should be empty, got %#v", got)
  }
  if got := src.CodeActions("file:///x.ts", driver.LSPRange{}, driver.LSPCodeActionContext{}); got != nil {
    t.Fatalf("CodeActions should be nil, got %#v", got)
  }
  if got := src.CommandIDs(); got != nil {
    t.Fatalf("CommandIDs should be nil, got %#v", got)
  }
  edit, err := src.ExecuteCommand("ttsc.lint.fix", nil)
  if edit != nil {
    t.Fatalf("ExecuteCommand should return nil edit, got %#v", edit)
  }
  if !errors.Is(err, driver.ErrCommandNotHandled) {
    t.Fatalf("expected ErrCommandNotHandled, got %v", err)
  }
}
