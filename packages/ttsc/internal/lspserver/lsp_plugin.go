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

// LSPDiagnostic is the subset of the LSP Diagnostic type ttscserver injects
// into outgoing publishDiagnostics. omitempty is set on optional fields so the
// merged JSON stays close to what tsgo emits.
//
// The proxy decodes each sidecar diagnostic into this struct and re-encodes it,
// so a field absent here is silently dropped on the way to the editor. Every
// LSP Diagnostic field a producer might set must therefore appear, or the proxy
// truncates it.
type LSPDiagnostic struct {
  Range           LSPRange              `json:"range"`
  Severity        LSPDiagnosticSeverity `json:"severity,omitempty"`
  Code            any                   `json:"code,omitempty"`
  CodeDescription *LSPCodeDescription   `json:"codeDescription,omitempty"`
  // Tags classify the diagnostic (1 = unnecessary, 2 = deprecated). Carried
  // through so a plugin's tag is not silently dropped when the proxy re-encodes
  // the diagnostic — the same truncation codeDescription had to be rescued from.
  Tags []int `json:"tags,omitempty"`
  // Data is opaque state the producer attaches to the diagnostic. The editor
  // preserves it and hands it back on a codeAction request whose context
  // includes this diagnostic, so a rule can recover what it computed without
  // recomputing it. Carried through unread — like the other optional fields, an
  // absent one it did not round-trip would be a silent truncation.
  Data json.RawMessage `json:"data,omitempty"`
  // RelatedInformation are secondary locations the diagnostic points at, each
  // with its own message — the editor renders them as clickable lines under the
  // diagnostic. Carried through so a sidecar's related locations survive the
  // proxy's re-encode, the same truncation the other optional fields had to be
  // rescued from.
  RelatedInformation []LSPDiagnosticRelatedInformation `json:"relatedInformation,omitempty"`
  Source             string                            `json:"source,omitempty"`
  Message            string                            `json:"message"`
}

// LSPDiagnosticRelatedInformation is one entry of a diagnostic's
// relatedInformation: a secondary location with a message. It reuses the
// package's LSPLocation (a URI plus a range). The proxy does not read it — it
// exists so the field is not dropped on re-encode.
type LSPDiagnosticRelatedInformation struct {
  Location LSPLocation `json:"location"`
  Message  string      `json:"message"`
}

// LSPCodeDescription is the LSP CodeDescription type: a documentation URL for a
// diagnostic's Code. Editors render the Code as a link to Href, so a rule name
// in the Problems panel can lead to the rule's docs. The proxy carries whatever
// a sidecar supplies; it does not synthesize the URL, because only the producer
// knows what its own Code values mean. @ttsc/lint derives one per rule family
// in packages/lint/linthost/rule_docs.go and leaves it unset where no vetted
// page exists.
type LSPCodeDescription struct {
  Href string `json:"href"`
}

// LSPCodeAction is the minimal Code Action shape ttscserver returns from
// the textDocument/codeAction handler. Sidecar-backed NativePluginSource
// accepts only command-driven actions and drops non-null direct edits; custom
// in-process PluginSource implementations may still return Edit when they own
// that policy.
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
// textDocument/codeAction. The proxy inspects Only to decide local routing, and
// plugin sources may inspect Diagnostics, Only, and TriggerKind when filtering
// their own actions.
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

// LSPProjectDiagnostics is one project-scoped diagnostic publication. URI is
// the logical selected config URI and Diagnostics use a zero-width start range.
type LSPProjectDiagnostics struct {
  URI         string          `json:"uri"`
  Diagnostics []LSPDiagnostic `json:"diagnostics"`
}

// LSPDiagnosticsResult separates diagnostics for the requested document from
// the current project publication so the proxy never copies a project finding
// onto every open source document.
type LSPDiagnosticsResult struct {
  Document []LSPDiagnostic        `json:"document"`
  Project  *LSPProjectDiagnostics `json:"project,omitempty"`
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
  Diagnostics(doc LSPDocumentVersion) LSPDiagnosticsResult

  // CodeActions contributes additional actions for the given range. The
  // proxy appends them to upstream responses, or answers locally when
  // the request is plugin-only / upstream advertised no provider.
  CodeActions(uri string, rng LSPRange, ctx LSPCodeActionContext) []LSPCodeAction

  // ExecuteCommand handles workspace/executeCommand requests whose command id
  // appears in CommandIDs. A nil edit means the command ran but produced no
  // workspace changes; a non-nil error surfaces as an LSP error response.
  // Returning ErrCommandNotHandled for an advertised id is also treated as an
  // error by the proxy because advertised commands are owned locally.
  ExecuteCommand(command string, args []json.RawMessage) (*LSPWorkspaceEdit, error)

  // CommandIDs lists the workspace command ids ttsc handles locally so
  // the proxy never forwards them to upstream tsgo.
  CommandIDs() []string
}

// NullPluginSource is the zero-contribution PluginSource used when the
// LSP server is hosted without any ttsc plugin pipeline (smoke tests,
// docs build). It returns no diagnostics/actions and no command ids so the
// proxy still exercises its merge paths even with no plugin activity.
// LSPCompletionHint is one group of completion items a plugin offers, together
// with the declarative rule saying where they apply.
//
// The rule has to be data rather than a callback because the plugin that
// produced it is a subprocess that has already exited. Asking it per keystroke
// would mean a process spawn and a Program reload per character; the corpus
// therefore travels once and the proxy answers from memory.
type LSPCompletionHint struct {
  // Scope names the syntactic region the cursor must sit in.
  Scope string `json:"scope"`
  // After is a literal the line prefix must contain. The text following its
  // LAST occurrence is what the editor filters on and what Insert replaces.
  //
  // Deliberately a literal and not a pattern. A regex would be unvalidatable at
  // discovery time, and the one shipped example of plugin-supplied regex driving
  // completion — Tailwind's experimental.classRegex — is a documented source of
  // editor hangs. When several hints match one line, the occurrence nearest the
  // cursor wins; at that occurrence the longest After wins, and only the same
  // trigger merges. That is enough to layer a corpus without hiding a later
  // trigger behind an earlier one.
  After string `json:"after"`
  // Items are offered in slice order; the proxy derives the sort key from it.
  Items []LSPCompletionItem `json:"items"`
}

// LSPCompletionItem is one plugin-contributed completion.
//
// Fully resolved on arrival: there is no completionItem/resolve round trip,
// because resolving would require asking a rule that no longer exists.
type LSPCompletionItem struct {
  Insert string `json:"insert"`
  Label  string `json:"label,omitempty"`
  Detail string `json:"detail,omitempty"`
}

type NullPluginSource struct{}

// Diagnostics returns no plugin diagnostics.
func (NullPluginSource) Diagnostics(LSPDocumentVersion) LSPDiagnosticsResult {
  return LSPDiagnosticsResult{}
}

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
