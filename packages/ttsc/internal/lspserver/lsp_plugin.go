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
  // Start is the inclusive endpoint in session UTF-16 coordinates.
  Start LSPPosition `json:"start"`

  // End is the exclusive endpoint; equal endpoints represent an empty range.
  End LSPPosition `json:"end"`
}

// LSPDiagnosticSeverity uses the LSP integer discriminants without translation.
// Rendering remains the editor's policy.
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
  // LSPDiagnosticSeverityWarning represents a warning finding.
  LSPDiagnosticSeverityWarning LSPDiagnosticSeverity = 2
  // LSPDiagnosticSeverityInformation represents an informational finding.
  LSPDiagnosticSeverityInformation LSPDiagnosticSeverity = 3
  // LSPDiagnosticSeverityHint represents a hint finding.
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
  // Range identifies the finding using the session's UTF-16 coordinates.
  Range LSPRange `json:"range"`

  // Severity carries the producer's severity code; zero omits the field.
  Severity LSPDiagnosticSeverity `json:"severity,omitempty"`

  // Code carries the producer's code value, normally a string or number.
  // This representation does not validate that semantic restriction.
  Code any `json:"code,omitempty"`

  // CodeDescription optionally supplies the producer's documentation link.
  CodeDescription *LSPCodeDescription `json:"codeDescription,omitempty"`

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

  // Source is an optional producer label, independent of Code.
  Source string `json:"source,omitempty"`

  // Message is the diagnostic's required display text.
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
  // Location is the secondary site's protocol URI and UTF-16 range.
  Location LSPLocation `json:"location"`

  // Message explains that secondary site independently of the main finding.
  Message string `json:"message"`
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
  // Title is the action's editor-visible label, not its dispatch identity.
  Title string `json:"title"`

  // Kind is an optional action category used by client selection filters.
  Kind string `json:"kind,omitempty"`

  // Command names the command-backed action; nil omits that alternative.
  Command *LSPCommand `json:"command,omitempty"`

  // Edit carries opaque edit JSON for sources that own direct-edit policy.
  // The native sidecar source rejects a non-null edit instead of applying it.
  Edit json.RawMessage `json:"edit,omitempty"`

  // IsPreferred marks the producer's preferred action; false is omitted.
  IsPreferred bool `json:"isPreferred,omitempty"`
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
  // Title is the editor-visible command label; it does not select the owner.
  Title string `json:"title"`

  // Command is the source-advertised identity used by execution dispatch.
  Command string `json:"command"`

  // Arguments preserves ordered raw JSON values without numeric decoding;
  // an empty list is omitted from the wire value.
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
  // Diagnostics retains the editor's diagnostic objects as raw JSON values.
  Diagnostics []json.RawMessage `json:"diagnostics,omitempty"`

  // Only contains requested action categories; an empty list is unrestricted
  // by this field, and the proxy uses it when selecting local routing.
  Only []string `json:"only,omitempty"`

  // TriggerKind carries the editor's trigger code; zero omits the field.
  TriggerKind int `json:"triggerKind,omitempty"`
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
// with a publishDiagnostics notification. Plugin sources can use the supplied
// version when deciding whether cached findings still apply; this value alone
// does not enforce editor-side rejection or authenticate current source bytes.
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
  // URI identifies the document whose findings are requested.
  URI string

  // Version is the supplied document version; nil means unknown, not zero.
  Version *int
}

// LSPProjectDiagnostics is one separately scoped diagnostic publication.
// Producers use the selected config URI and start-of-config ranges for project
// findings. The representation itself does not validate URI ownership or force
// zero-width ranges; the host can restate a matching selected config URI.
//
// @evidence contracts/common.md#principled-implementation A separate publication URI avoids copying project findings onto each open document. The producer supplies that URI and diagnostic ranges; the shape does not authenticate their scope. An empty slice can clear the selected publication.
// @evidence contracts/common.md#clear-and-simple-design Project publications reuse diagnostics while remaining separate from document results.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Project findings retain their own scope instead of being copied onto open files.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes producer config/range convention from representation validation, and members describe publication identity and empty clearing under the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPProjectDiagnostics struct {
  // URI selects the publication's protocol document, normally the config.
  URI string `json:"uri"`

  // Diagnostics contains its findings; an empty list represents clearing.
  Diagnostics []LSPDiagnostic `json:"diagnostics"`
}

// LSPDiagnosticsResult separates diagnostics for the requested document from
// the current project publication so the proxy never copies a project finding
// onto every open source document.
//
// @evidence contracts/common.md#principled-implementation Document and optional project lanes remain separate. The host-only producer set records receipt of a project publication, not acceptance of its generation or authentication of a fresh native capture; Project can be a mixed-generation retained aggregate.
// @evidence contracts/common.md#clear-and-simple-design Host-only refresh bookkeeping is separate from serialized result fields.
// @evidence contracts/common.md#prohibited-implementation-shortcuts A cached publication is not treated as newly computed merely because it is present.
// @evidence contracts/common.md#meaningful-documentation Native comments explain scope and the nonserialized producer set, following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPDiagnosticsResult struct {
  // Document contributes findings for the requested source document.
  Document []LSPDiagnostic `json:"document"`

  // Project optionally carries the separately scoped retained publication.
  Project *LSPProjectDiagnostics `json:"project,omitempty"`

  // projectUpdatedProducers names the sidecars that actually returned a
  // project publication during this call. It is deliberately not serialized:
  // a receipt can still have been rejected by the generation-guarded store.
  // It does not certify accepted current state or a common capture across the
  // aggregate's retained producers.
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
// The rule travels as data across the plugin protocol. Completion requests
// match a retained corpus without another producer query; explicit refreshes
// may replace it. Acquisition can use a resident or direct transport, so this
// shape does not imply that the producer exited or loaded a Program per request.
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
  // Scope names the syntactic region the cursor must sit in. This host admits
  // only "jsdoc"; an unknown scope produces no matching items.
  Scope string `json:"scope"`

  // After is a literal the line prefix must contain. The text following its
  // LAST occurrence is what the editor filters on and what Insert replaces.
  //
  // Matching is literal, without a regex dialect or callback. When several
  // hints match one line, the occurrence nearest the cursor wins; at that
  // occurrence the longest After wins, and only the same
  // trigger merges. That is enough to layer a corpus without hiding a later
  // trigger behind an earlier one.
  After string `json:"after"`

  // Items are offered in slice order; the proxy derives the sort key from it.
  Items []LSPCompletionItem `json:"items"`
}

// LSPCompletionItem is one plugin-contributed completion.
//
// Its supported fields are resolved on arrival. The proxy echoes a marked
// plugin item's completionItem/resolve payload locally rather than querying
// the producer. A later corpus refresh can still acquire replacement items.
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
  // Insert supplies plain insertion and filter text; the proxy uses it as the
  // label too when Label is empty.
  Insert string `json:"insert"`

  // Label optionally replaces Insert as the editor-visible label.
  Label string `json:"label,omitempty"`

  // Detail is optional display context included only when nonempty.
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
