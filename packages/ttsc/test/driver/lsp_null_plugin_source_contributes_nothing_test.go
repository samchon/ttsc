package driver_test

import (
  "errors"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPNullPluginSourceContributesNothing pins the zero-value
// PluginSource. Every method must return an empty / not-handled answer
// so RunLSPServer can drop in NullPluginSource when callers do not
// supply one and the proxy still exercises its forwarding paths.
//
// 1. Call each method on a NullPluginSource value.
// 2. Assert Diagnostics, CodeActions, and CommandIDs return nil.
// 3. Assert ExecuteCommand reports ErrCommandNotHandled with no edit.
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
