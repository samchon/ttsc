package driver_test

import (
  "encoding/json"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// stubSource is a controllable PluginSource for proxy tests. Each method
// is wired to a slice / function field so individual tests configure
// only what they care about.
type stubSource struct {
  diagnostics        map[string][]driver.LSPDiagnostic
  diagnosticsFor     func(driver.LSPDocumentVersion) []driver.LSPDiagnostic
  actions            []driver.LSPCodeAction
  actionsFor         func(uri string) []driver.LSPCodeAction
  actionsWithContext func(uri string, ctx driver.LSPCodeActionContext) []driver.LSPCodeAction
  commands           []string
  codeActionKinds    []string
  execute            func(command string, args []json.RawMessage) (*driver.LSPWorkspaceEdit, error)
}

func (s *stubSource) Diagnostics(doc driver.LSPDocumentVersion) []driver.LSPDiagnostic {
  if s == nil {
    return nil
  }
  if s.diagnosticsFor != nil {
    return s.diagnosticsFor(doc)
  }
  return s.diagnostics[doc.URI]
}

func (s *stubSource) CodeActions(uri string, _ driver.LSPRange, ctx driver.LSPCodeActionContext) []driver.LSPCodeAction {
  if s == nil {
    return nil
  }
  if s.actionsWithContext != nil {
    return s.actionsWithContext(uri, ctx)
  }
  if s.actionsFor != nil {
    return s.actionsFor(uri)
  }
  return s.actions
}

func (s *stubSource) ExecuteCommand(command string, args []json.RawMessage) (*driver.LSPWorkspaceEdit, error) {
  if s == nil || s.execute == nil {
    return nil, driver.ErrCommandNotHandled
  }
  return s.execute(command, args)
}

func (s *stubSource) CommandIDs() []string {
  if s == nil {
    return nil
  }
  return s.commands
}

func (s *stubSource) CodeActionKinds() []string {
  if s == nil {
    return nil
  }
  return s.codeActionKinds
}
