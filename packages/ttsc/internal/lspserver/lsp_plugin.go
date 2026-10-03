package lspserver

import "encoding/json"

// LSPPosition identifies a zero-based line and UTF-16 code-unit column.
// ttscserver constrains position negotiation to UTF-16 for its plugin protocol.
//
// @evidence contracts/common.md#principled-implementation Two integers retain LSP coordinates under the session's fixed UTF-16 encoding.
// @evidence contracts/common.md#clear-and-simple-design A local wire value avoids a compiler AST dependency.
// @evidence contracts/common.md#prohibited-implementation-shortcuts UTF-16 is the negotiated protocol choice, not a consumer-specific offset correction.
// @evidence contracts/common.md#meaningful-documentation Native prose states zero-based coordinates and column units, following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPPosition struct {
  // Line is a zero-based line index; producers must supply a nonnegative value.
  Line int `json:"line"`

  // Character is a zero-based UTF-16 code-unit column, not a byte offset.
  Character int `json:"character"`
}

// LSPRange is the closed-open [start, end) interval LSP uses for ranges.
//
// @evidence contracts/common.md#principled-implementation Two positions retain the protocol's half-open interval.
// @evidence contracts/common.md#clear-and-simple-design Both endpoints reuse the same coordinate representation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Endpoints retain LSP semantics without fixture-specific adjustments.
// @evidence contracts/common.md#meaningful-documentation Native prose states interval closure, with acknowledgment separation required by the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPRange struct {
  Start LSPPosition `json:"start"`
  End   LSPPosition `json:"end"`
}

// LSPDiagnosticSeverity values match the LSP enum exactly so editors
// pick the right color/icon without translation.
//
// @evidence contracts/common.md#principled-implementation Integer values retain the LSP DiagnosticSeverity discriminants.
// @evidence contracts/common.md#clear-and-simple-design Producers share one severity representation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Named values are protocol-defined constants.
// @evidence contracts/common.md#meaningful-documentation Native declaration and constant comments explain severity mappings under the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
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
//
// @evidence contracts/common.md#principled-implementation Optional metadata distinguishes absence; raw Data preserves producer JSON and Code carries string-or-number values.
// @evidence contracts/common.md#clear-and-simple-design Diagnostic payload fields stay together while related locations and code links use reusable shapes.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Tags and Data come from producers rather than expected rule answers.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain re-encoding risks and opaque ownership; documented members follow the documentation skill's spacing rule.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPDiagnostic struct {
  Range           LSPRange              `json:"range"`
  Severity        LSPDiagnosticSeverity `json:"severity,omitempty"`
  Code            any                   `json:"code,omitempty"`
  CodeDescription *LSPCodeDescription   `json:"codeDescription,omitempty"`

  // Tags classify the diagnostic (1 = unnecessary, 2 = deprecated). Carried
  // through so a plugin's tag is not silently dropped when the proxy re-encodes
  // the diagnostic.
  Tags []int `json:"tags,omitempty"`

  // Data is opaque state the producer attaches to the diagnostic. The editor
  // preserves it and hands it back on a codeAction request whose context
  // includes this diagnostic, so a rule can recover what it computed without
  // recomputing it. Carried through unread — like the other optional fields, one
  // that did not round-trip would be a silent truncation.
  Data json.RawMessage `json:"data,omitempty"`

  // RelatedInformation are secondary locations the diagnostic points at, each
  // with its own message — the editor renders them as clickable lines under the
  // diagnostic. Carried through so a sidecar's related locations survive the
  // proxy's re-encode.
  RelatedInformation []LSPDiagnosticRelatedInformation `json:"relatedInformation,omitempty"`

  Source  string `json:"source,omitempty"`
  Message string `json:"message"`
}

// LSPDiagnosticRelatedInformation is one entry of a diagnostic's
// relatedInformation: a secondary location with a message. It reuses the
// package's LSPLocation (a URI plus a range). The proxy does not read it — it
// exists so the field is not dropped on re-encode.
//
// @evidence contracts/common.md#principled-implementation A location and message retain each secondary site's wire meaning.
// @evidence contracts/common.md#clear-and-simple-design LSPLocation owns the shared URI and range shape.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Producer locations survive without guessed replacements.
// @evidence contracts/common.md#meaningful-documentation Native prose explains why unread payload survives serialization, following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
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
//
// @evidence contracts/common.md#principled-implementation Href carries the producer's code-documentation URL.
// @evidence contracts/common.md#clear-and-simple-design A separate optional value distinguishes the link from the display code.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The host does not synthesize URLs from guessed rule names.
// @evidence contracts/common.md#meaningful-documentation Native prose explains producer ownership and editor use, following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPCodeDescription struct {
  Href string `json:"href"`
}

// LSPCodeAction is the minimal Code Action shape ttscserver returns from
// the textDocument/codeAction handler. Sidecar-backed NativePluginSource
// accepts only command-driven actions and drops non-null direct edits; custom
// in-process PluginSource implementations may still return Edit when they own
// that policy.
//
// @evidence contracts/common.md#principled-implementation Optional command and raw edit fields retain action alternatives; custom sources remain distinct from the native source's command-only policy.
// @evidence contracts/common.md#clear-and-simple-design Presentation and execution choices remain a wire value without dispatch behavior.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Native edit rejection follows explicit ownership rather than silently patching a foreign command.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes native and in-process edit policy, following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPCodeAction struct {
  Title       string          `json:"title"`
  Kind        string          `json:"kind,omitempty"`
  Command     *LSPCommand     `json:"command,omitempty"`
  Edit        json.RawMessage `json:"edit,omitempty"`
  IsPreferred bool            `json:"isPreferred,omitempty"`
}

// LSPCommand is the wire shape of a workspace/executeCommand target.
// Raw ordered arguments preserve producer JSON without floating-point conversion.
//
// @evidence contracts/common.md#principled-implementation Identity and raw arguments retain the target separately from its display title.
// @evidence contracts/common.md#clear-and-simple-design Actions and dispatch reuse this command value.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Arguments remain producer values rather than known-command substitutions.
// @evidence contracts/common.md#meaningful-documentation Native prose explains why arguments retain raw JSON, following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPCommand struct {
  Title     string            `json:"title"`
  Command   string            `json:"command"`
  Arguments []json.RawMessage `json:"arguments,omitempty"`
}

// LSPCodeActionContext mirrors the context object the editor sends with
// textDocument/codeAction. The proxy inspects Only to decide local routing, and
// plugin sources may inspect Diagnostics, Only, and TriggerKind when filtering
// their own actions.
//
// @evidence contracts/common.md#principled-implementation Diagnostics, kind filters and trigger kind retain distinct editor selection inputs.
// @evidence contracts/common.md#clear-and-simple-design Routing and producer filtering consume one context representation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Only is a client filter rather than a table of expected actions.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies field consumers, following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPCodeActionContext struct {
  Diagnostics []json.RawMessage `json:"diagnostics,omitempty"`
  Only        []string          `json:"only,omitempty"`
  TriggerKind int               `json:"triggerKind,omitempty"`
}

// LSPWorkspaceEdit is the wire shape ttscserver returns from custom
// executeCommand handlers. It maps URIs to ordered text edits.
// This protocol supports changes, not documentChanges or resource operations.
//
// @evidence contracts/common.md#principled-implementation The URI map represents ordered text edits in the supported changes form.
// @evidence contracts/common.md#clear-and-simple-design Map entries reuse LSPTextEdit without additional edit variants.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The restricted form follows the owned command protocol rather than a particular consumer's answer.
// @evidence contracts/common.md#meaningful-documentation Native prose states URI mapping and unsupported edit forms, following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPWorkspaceEdit struct {
  Changes map[string][]LSPTextEdit `json:"changes,omitempty"`
}

// LSPTextEdit is a single text edit in a workspace edit.
// NewText replaces Range, whose positions use session UTF-16 coordinates.
//
// @evidence contracts/common.md#principled-implementation A range and text represent insertion, replacement and deletion with the same value.
// @evidence contracts/common.md#clear-and-simple-design Formatting and command results reuse this edit shape.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Empty text and zero-width ranges retain protocol meaning.
// @evidence contracts/common.md#meaningful-documentation Native prose states replacement semantics and units, following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
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
//
// @evidence contracts/common.md#principled-implementation A pointer distinguishes an absent version from valid numeric zero.
// @evidence contracts/common.md#clear-and-simple-design URI and optional version travel together as diagnostic request identity.
// @evidence contracts/common.md#prohibited-implementation-shortcuts An unknown version is not replaced by an invented generation.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain stale-result use and nil meaning, following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPDocumentVersion struct {
  URI     string
  Version *int
}

// LSPProjectDiagnostics is one project-scoped diagnostic publication. URI is
// the logical selected config URI and Diagnostics use a zero-width start range.
//
// @evidence contracts/common.md#principled-implementation A distinct project URI keeps project findings off unrelated source documents; an empty slice can clear a publication.
// @evidence contracts/common.md#clear-and-simple-design Project publications reuse diagnostics while remaining separate from document results.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Project findings retain their own scope instead of being copied onto open files.
// @evidence contracts/common.md#meaningful-documentation Native prose states logical config identity and project range placement, following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPProjectDiagnostics struct {
  URI         string          `json:"uri"`
  Diagnostics []LSPDiagnostic `json:"diagnostics"`
}

// LSPDiagnosticsResult separates diagnostics for the requested document from
// the current project publication so the proxy never copies a project finding
// onto every open source document.
//
// @evidence contracts/common.md#principled-implementation Optional project state and fresh producer identities distinguish current contributions from retained aggregates.
// @evidence contracts/common.md#clear-and-simple-design Host-only refresh bookkeeping is separate from serialized result fields.
// @evidence contracts/common.md#prohibited-implementation-shortcuts A cached publication is not treated as newly computed merely because it is present.
// @evidence contracts/common.md#meaningful-documentation Native comments explain scope and the nonserialized producer set, following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPDiagnosticsResult struct {
  Document []LSPDiagnostic        `json:"document"`
  Project  *LSPProjectDiagnostics `json:"project,omitempty"`

  // projectUpdatedProducers names the sidecars that actually returned a
  // project publication during this call. It is deliberately not serialized:
  // the proxy uses it to distinguish a current computation from last-good
  // aggregate state retained for another producer.
  projectUpdatedProducers map[string]struct{}
}

// PluginSource is the seam between the LSP proxy and ttsc's plugin
// pipeline. Returning empty slices/nil is a valid "no contribution"
// answer; ttscserver still forwards the upstream tsgo response verbatim.
//
// The proxy never holds a PluginSource lock across upstream traffic, so
// implementations must be safe to call from multiple goroutines.
//
// @evidence contracts/common.md#principled-implementation Distinct diagnostic, action and command contributions permit empty upstream-only service.
// @evidence contracts/common.md#clear-and-simple-design This injection boundary hides native transport and compiler state.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Supported injection avoids replacing upstream methods or globals.
// @evidence contracts/common.md#meaningful-documentation Native prose states empty-result and concurrency contracts, following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type PluginSource interface {
  // Diagnostics returns ttsc plugin diagnostics for the document the
  // proxy is about to publish. doc.Version is nil when upstream omitted
  // the field. The proxy appends these to whatever upstream tsgo
  // published, so duplicates between ttsc and tsgo must be deduplicated
  // on the source side.
  //
  // @evidence contracts/common.md#principled-implementation Document identity and optional version support separately scoped findings.
  // @evidence contracts/common.md#clear-and-simple-design Production returns values while the proxy merges frames.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Contributions enter through the source boundary without altering upstream state.
  // @evidence contracts/common.md#meaningful-documentation Native prose documents unknown version and deduplication ownership, following the documentation skill.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Diagnostics declares a signature only; the implementation owns acquisition and release of resources.
  // @evidenceExclude contracts/performance.md#efficient-algorithms Diagnostics declares a signature only; the implementation owns the processing strategy.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work Diagnostics declares a signature only; the implementation owns any shared work.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation Diagnostics is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
  Diagnostics(doc LSPDocumentVersion) LSPDiagnosticsResult

  // CodeActions contributes additional actions for the given range. The
  // proxy appends them to upstream responses, or answers locally when
  // the request is plugin-only / upstream advertised no provider.
  //
  // @evidence contracts/common.md#principled-implementation URI, range and client context preserve action selection inputs.
  // @evidence contracts/common.md#clear-and-simple-design Capability routing remains separate from action production.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts The interface supplies actions without patching the upstream provider.
  // @evidence contracts/common.md#meaningful-documentation Native prose distinguishes augmentation from local replies, following the documentation skill.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources CodeActions declares a signature only; the implementation owns acquisition and release of resources.
  // @evidenceExclude contracts/performance.md#efficient-algorithms CodeActions declares a signature only; the implementation owns the processing strategy.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work CodeActions declares a signature only; the implementation owns any shared work.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation CodeActions is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
  CodeActions(uri string, rng LSPRange, ctx LSPCodeActionContext) []LSPCodeAction

  // ExecuteCommand handles workspace/executeCommand requests whose command id
  // appears in CommandIDs. A nil edit means the command ran but produced no
  // workspace changes; a non-nil error surfaces as an LSP error response.
  // Returning ErrCommandNotHandled for an advertised id is also treated as an
  // error by the proxy because advertised commands are owned locally.
  //
  // @evidence contracts/common.md#principled-implementation Nil edit, failure and unowned-command sentinel retain distinct outcomes.
  // @evidence contracts/common.md#clear-and-simple-design Dispatch consumes identity and ordered arguments; editor application remains with the caller.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts An advertised but unhandled command is an error instead of a success-shaped fallback.
  // @evidence contracts/common.md#meaningful-documentation Native prose explains nil, error and ownership states, following the documentation skill.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ExecuteCommand declares a signature only; the implementation owns acquisition and release of resources.
  // @evidenceExclude contracts/performance.md#efficient-algorithms ExecuteCommand declares a signature only; the implementation owns the processing strategy.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work ExecuteCommand declares a signature only; the implementation owns any shared work.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation ExecuteCommand is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
  ExecuteCommand(command string, args []json.RawMessage) (*LSPWorkspaceEdit, error)

  // CommandIDs lists the workspace command ids ttsc handles locally so
  // the proxy never forwards them to upstream tsgo.
  //
  // @evidence contracts/common.md#principled-implementation The returned identities define locally owned commands independently of display titles.
  // @evidence contracts/common.md#clear-and-simple-design Advertising and dispatch consume one producer identity list.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Ownership comes from the source contract rather than an editor-specific command table.
  // @evidence contracts/common.md#meaningful-documentation Native prose explains upstream forwarding consequences, following the documentation skill.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources CommandIDs declares a signature only; the implementation owns acquisition and release of resources.
  // @evidenceExclude contracts/performance.md#efficient-algorithms CommandIDs declares a signature only; the implementation owns the processing strategy.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work CommandIDs declares a signature only; the implementation owns any shared work.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation CommandIDs is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
  CommandIDs() []string
}

// LSPCompletionHint is one group of completion items a plugin offers, together
// with the declarative rule saying where they apply.
//
// The rule has to be data rather than a callback because the plugin that
// produced it is a subprocess that has already exited. Asking it per keystroke
// would mean a process spawn and a Program reload per character; the corpus
// therefore travels once and the proxy answers from memory.
//
// @evidence contracts/common.md#principled-implementation Scope and a literal trigger select an ordered corpus without executing callbacks in the editor path.
// @evidence contracts/common.md#clear-and-simple-design Declarative matching inputs and items form one transportable group.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Literal matching follows the supported protocol rather than guessed rule output.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain process separation, trigger precedence and item order, following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPCompletionHint struct {
  // Scope names the syntactic region the cursor must sit in.
  Scope string `json:"scope"`

  // After is a literal the line prefix must contain. The text following its
  // LAST occurrence is what the editor filters on and what Insert replaces.
  //
  // Deliberately a literal and not a pattern. A regex would be unvalidatable at
  // discovery time and a pathological one run per keystroke could hang the
  // editor. When several hints match one line, the occurrence nearest the
  // cursor wins; at that occurrence the longest After wins, and only the same
  // trigger merges. That is enough to layer a corpus without hiding a later
  // trigger behind an earlier one.
  After string `json:"after"`

  // Items are offered in slice order; the proxy derives the sort key from it.
  Items []LSPCompletionItem `json:"items"`
}

// LSPCompletionItem is one plugin-contributed completion.
//
// Fully resolved on arrival: the producer is never asked again, because it
// answers once with its whole corpus. The proxy answers an editor's
// completionItem/resolve for such an item itself, by echoing it back.
//
// @evidence contracts/common.md#principled-implementation Required Insert and optional display fields retain completion insertion and presentation distinctions.
// @evidence contracts/common.md#clear-and-simple-design Fully resolved data avoids a second producer request.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The eager shape follows the subprocess corpus protocol rather than faking a resolve response.
// @evidence contracts/common.md#meaningful-documentation Native prose explains why no resolve round trip exists, following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPCompletionItem struct {
  Insert string `json:"insert"`
  Label  string `json:"label,omitempty"`
  Detail string `json:"detail,omitempty"`
}

// NullPluginSource contributes no plugin diagnostics, actions or commands.
// The proxy can use it when a session has no configured native plugin pipeline.
//
// @evidence contracts/common.md#principled-implementation A stateless source consistently represents absence of plugin contributions.
// @evidence contracts/common.md#clear-and-simple-design One implementation satisfies the normal interface without another proxy mode.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No-plugin service is supported production behavior rather than test-only logic.
// @evidence contracts/common.md#meaningful-documentation Native prose describes no-plugin use, following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type NullPluginSource struct{}

// Diagnostics returns no plugin diagnostics.
//
// @evidence contracts/common.md#principled-implementation The zero result contains neither document nor project contributions.
// @evidence contracts/common.md#clear-and-simple-design This method directly returns the interface's empty result.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Every document receives the legitimate no-plugin result.
// @evidence contracts/common.md#meaningful-documentation Native prose states the observable contribution, following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Diagnostics acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms Diagnostics performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This empty-source Diagnostics method returns a fixed zero value without coordinating a computation, cache or in-flight work.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Diagnostics computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func (NullPluginSource) Diagnostics(LSPDocumentVersion) LSPDiagnosticsResult {
  return LSPDiagnosticsResult{}
}

// CodeActions returns no plugin code actions.
//
// @evidence contracts/common.md#principled-implementation Nil adds no action to local or augmented replies.
// @evidence contracts/common.md#clear-and-simple-design An empty source needs no action state or factory.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Selection inputs do not activate fixture-specific actions.
// @evidence contracts/common.md#meaningful-documentation Native prose states empty action behavior, following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources CodeActions acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms CodeActions performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This empty-source CodeActions method returns nil without coordinating a computation, cache or in-flight work.
// @evidenceExclude contracts/portability.md#os-neutral-implementation CodeActions computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func (NullPluginSource) CodeActions(string, LSPRange, LSPCodeActionContext) []LSPCodeAction {
  return nil
}

// ExecuteCommand reports that the command is not handled.
//
// @evidence contracts/common.md#principled-implementation The shared sentinel reports unowned execution rather than success.
// @evidence contracts/common.md#clear-and-simple-design It uses the same ownership outcome as other sources.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown commands are not successful no-op edits.
// @evidence contracts/common.md#meaningful-documentation Native prose states the failure outcome, following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Acquires and retains nothing.
// @evidenceExclude contracts/performance.md#efficient-algorithms Returns immediately with ErrCommandNotHandled.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Performs no computation, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Returns a fixed error without touching any path or file.
func (NullPluginSource) ExecuteCommand(string, []json.RawMessage) (*LSPWorkspaceEdit, error) {
  return nil, ErrCommandNotHandled
}

// CommandIDs advertises no locally owned commands. The proxy's source-ownership
// check therefore leaves requests to its upstream routing path.
//
// @evidence contracts/common.md#principled-implementation Nil advertises no locally owned identity.
// @evidence contracts/common.md#clear-and-simple-design The empty source requires no command storage.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Empty ownership reflects the supported no-plugin state.
// @evidence contracts/common.md#meaningful-documentation Native prose explains upstream forwarding, following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources CommandIDs acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms CommandIDs performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This empty-source CommandIDs method returns nil without coordinating a computation, cache or in-flight work.
// @evidenceExclude contracts/portability.md#os-neutral-implementation CommandIDs computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func (NullPluginSource) CommandIDs() []string { return nil }
