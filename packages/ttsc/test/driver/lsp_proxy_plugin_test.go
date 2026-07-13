package driver_test

import (
  "encoding/json"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// stubSource is a controllable PluginSource for proxy tests. Each method
// is wired to a slice / function field so individual tests configure
// only what they care about.
type stubSource struct {
  diagnostics          map[string][]driver.LSPDiagnostic
  diagnosticsFor       func(driver.LSPDocumentVersion) []driver.LSPDiagnostic
  diagnosticsResultFor func(driver.LSPDocumentVersion) driver.LSPDiagnosticsResult
  actions              []driver.LSPCodeAction
  actionsFor           func(uri string) []driver.LSPCodeAction
  actionsWithContext   func(uri string, ctx driver.LSPCodeActionContext) []driver.LSPCodeAction
  commands             []string
  codeActionKinds      []string
  execute              func(command string, args []json.RawMessage) (*driver.LSPWorkspaceEdit, error)
  executeWithContent   func(command string, args []json.RawMessage, content string, hasContent bool) (*driver.LSPWorkspaceEdit, error)
}

func (s *stubSource) Diagnostics(doc driver.LSPDocumentVersion) driver.LSPDiagnosticsResult {
  if s == nil {
    return driver.LSPDiagnosticsResult{}
  }
  if s.diagnosticsResultFor != nil {
    return s.diagnosticsResultFor(doc)
  }
  if s.diagnosticsFor != nil {
    return driver.LSPDiagnosticsResult{Document: s.diagnosticsFor(doc)}
  }
  return driver.LSPDiagnosticsResult{Document: s.diagnostics[doc.URI]}
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

// ExecuteCommandWithContent satisfies the proxy's optional contentExecutor
// capability used by the textDocument/formatting handler. When the test wires
// executeWithContent it observes the piped buffer text; otherwise it falls back
// to the plain execute hook so disk-path behavior stays exercised.
func (s *stubSource) ExecuteCommandWithContent(command string, args []json.RawMessage, content string, hasContent bool) (*driver.LSPWorkspaceEdit, error) {
  if s == nil {
    return nil, driver.ErrCommandNotHandled
  }
  if s.executeWithContent != nil {
    return s.executeWithContent(command, args, content, hasContent)
  }
  if s.execute != nil {
    return s.execute(command, args)
  }
  return nil, driver.ErrCommandNotHandled
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
