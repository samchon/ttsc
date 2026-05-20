package lspserver

import "encoding/json"

// LSPRange / LSPPosition mirror the wire shape of LSP Range/Position. The
// proxy keeps these local rather than importing lsproto so the shim
// surface stays narrow; the merger marshals them straight into the array
// the editor already expects.
type LSPPosition struct {
  Line      int `json:"line"`
  Character int `json:"character"`
}

// LSPRange is the closed-open [start, end) interval LSP uses for ranges.
type LSPRange struct {
  Start LSPPosition `json:"start"`
  End   LSPPosition `json:"end"`
}

// LSPDiagnosticSeverity values match the LSP enum exactly so editors
// pick the right color/icon without translation.
type LSPDiagnosticSeverity int

const (
  // LSPDiagnosticSeverityError is the most prominent severity; ttsc maps
  // build-blocking findings (lint errors, parse errors) to it.
  LSPDiagnosticSeverityError LSPDiagnosticSeverity = 1
  // LSPDiagnosticSeverityWarning is rendered as a yellow squiggle in
  // typical editor themes; ttsc maps lint warnings to it.
  LSPDiagnosticSeverityWarning LSPDiagnosticSeverity = 2
  // LSPDiagnosticSeverityInformation is rendered as a blue squiggle.
  LSPDiagnosticSeverityInformation LSPDiagnosticSeverity = 3
  // LSPDiagnosticSeverityHint is rendered as a faint underline or dots.
  LSPDiagnosticSeverityHint LSPDiagnosticSeverity = 4
)

// LSPDiagnostic is the minimal subset of the LSP Diagnostic type
// ttscserver injects into outgoing publishDiagnostics. omitempty is set
// on optional fields so the merged JSON stays close to what tsgo emits.
type LSPDiagnostic struct {
  Range    LSPRange              `json:"range"`
  Severity LSPDiagnosticSeverity `json:"severity,omitempty"`
  Code     any                   `json:"code,omitempty"`
  Source   string                `json:"source,omitempty"`
  Message  string                `json:"message"`
}

// LSPCodeAction is the minimal Code Action shape ttscserver returns from
// the textDocument/codeAction handler. ttsc actions are always command-
// driven (the server side does the heavy lifting) so Edit stays nil.
type LSPCodeAction struct {
  Title       string          `json:"title"`
  Kind        string          `json:"kind,omitempty"`
  Command     *LSPCommand     `json:"command,omitempty"`
  Edit        json.RawMessage `json:"edit,omitempty"`
  IsPreferred bool            `json:"isPreferred,omitempty"`
}

// LSPCommand is the wire shape of a workspace/executeCommand target.
type LSPCommand struct {
  Title     string            `json:"title"`
  Command   string            `json:"command"`
  Arguments []json.RawMessage `json:"arguments,omitempty"`
}

// LSPCodeActionContext mirrors the context object the editor sends with
// textDocument/codeAction. Only the diagnostics slice is consumed by
// ttsc; the rest is opaque and forwarded by Proxy verbatim.
type LSPCodeActionContext struct {
  Diagnostics []json.RawMessage `json:"diagnostics,omitempty"`
  Only        []string          `json:"only,omitempty"`
  TriggerKind int               `json:"triggerKind,omitempty"`
}

// LSPWorkspaceEdit is the wire shape ttscserver returns from custom
// executeCommand handlers. It maps URIs to ordered text edits.
type LSPWorkspaceEdit struct {
  Changes map[string][]LSPTextEdit `json:"changes,omitempty"`
}

// LSPTextEdit is a single text edit in a workspace edit.
type LSPTextEdit struct {
  Range   LSPRange `json:"range"`
  NewText string   `json:"newText"`
}

// LSPDocumentVersion carries the LSP textDocument version associated
// with a publishDiagnostics notification. Plugin sources use it to drop
// stale findings (LSP guarantees that diagnostics whose version does
// not match the current document are discarded by the editor anyway,
// but plugins that cache work-in-progress benefit from seeing it).
//
// Version is nil when upstream omitted the field — that is legal in
// LSP and the plugin source should treat it as "version unknown".
type LSPDocumentVersion struct {
  URI     string
  Version *int
}

// PluginSource is the seam between the LSP proxy and ttsc's plugin
// pipeline. Returning empty slices/nil is a valid "no contribution"
// answer; ttscserver still forwards the upstream tsgo response verbatim.
//
// The proxy never holds a PluginSource lock across upstream traffic, so
// implementations must be safe to call from multiple goroutines.
type PluginSource interface {
  // Diagnostics returns ttsc plugin diagnostics for the document the
  // proxy is about to publish. doc.Version is nil when upstream omitted
  // the field. The proxy appends these to whatever upstream tsgo
  // published, so duplicates between ttsc and tsgo must be deduplicated
  // on the source side.
  Diagnostics(doc LSPDocumentVersion) []LSPDiagnostic

  // CodeActions contributes additional actions for the given range. The
  // proxy appends them to the upstream tsgo response.
  CodeActions(uri string, rng LSPRange, ctx LSPCodeActionContext) []LSPCodeAction

  // ExecuteCommand handles workspace/executeCommand requests whose
  // command id appears in CommandIDs. A nil edit
  // means the command ran but produced no workspace changes; a non-nil
  // error surfaces as an LSP error response.
  ExecuteCommand(command string, args []json.RawMessage) (*LSPWorkspaceEdit, error)

  // CommandIDs lists the workspace command ids ttsc handles locally so
  // the proxy never forwards them to upstream tsgo.
  CommandIDs() []string
}

// NullPluginSource is the zero-contribution PluginSource used when the
// LSP server is hosted without any ttsc plugin pipeline (smoke tests,
// docs build). Every method returns an empty result so the proxy still
// exercises its merge paths even with no plugin activity.
type NullPluginSource struct{}

// Diagnostics returns no plugin diagnostics.
func (NullPluginSource) Diagnostics(LSPDocumentVersion) []LSPDiagnostic { return nil }

// CodeActions returns no plugin code actions.
func (NullPluginSource) CodeActions(string, LSPRange, LSPCodeActionContext) []LSPCodeAction {
  return nil
}

// ExecuteCommand reports that the command is not handled.
func (NullPluginSource) ExecuteCommand(string, []json.RawMessage) (*LSPWorkspaceEdit, error) {
  return nil, ErrCommandNotHandled
}

// CommandIDs returns an empty slice so the proxy forwards every command
// to upstream tsgo.
func (NullPluginSource) CommandIDs() []string { return nil }
