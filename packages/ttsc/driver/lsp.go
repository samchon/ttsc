// lsp.go re-exports the public LSP surface from internal/lspserver so that
// downstream consumers (plugins, the VS Code extension, tests) import only the
// driver package rather than reaching into the internal package directly. All
// symbols are type aliases or var assignments so they are interchangeable with
// the originals at the call site.
package driver

import (
  "encoding/json"

  "github.com/samchon/ttsc/packages/ttsc/internal/lspserver"
)

// LSPPosition locates text using zero-based lines and UTF-16 character offsets.
//
// @evidence contracts/common.md#principled-implementation Go alias identity preserves the server's coordinate representation.
// @evidence contracts/common.md#clear-and-simple-design The driver exposes coordinates without maintaining another wire schema.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The alias performs no offset conversion or runtime substitution.
// @evidence contracts/common.md#meaningful-documentation Native prose states coordinate units; the documentation skill's concise paragraph guidance is applied.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPPosition = lspserver.LSPPosition

// LSPRange denotes the closed-open interval from Start to End in LSP positions.
//
// @evidence contracts/common.md#principled-implementation The alias preserves the server's paired coordinate type and interval meaning.
// @evidence contracts/common.md#clear-and-simple-design Range layout remains owned by lspserver rather than a driver conversion layer.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No fabricated bounds or client-specific range mapping is introduced.
// @evidence contracts/common.md#meaningful-documentation The comment explains endpoint interpretation in native prose following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPRange = lspserver.LSPRange

// LSPDiagnosticSeverity carries the LSP severity enum unchanged for editor display.
//
// @evidence contracts/common.md#principled-implementation Alias identity keeps the server's numeric severity values interchangeable.
// @evidence contracts/common.md#clear-and-simple-design The driver forwards the enum instead of defining a second severity policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Forwarded protocol constants are semantic values, not fixture-specific answers.
// @evidence contracts/common.md#meaningful-documentation The purpose of preserving editor severity is stated directly under documentation-skill guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPDiagnosticSeverity = lspserver.LSPDiagnosticSeverity

// LSP diagnostic severity constants forwarded from lspserver.
const (
  LSPDiagnosticSeverityError       = lspserver.LSPDiagnosticSeverityError
  LSPDiagnosticSeverityWarning     = lspserver.LSPDiagnosticSeverityWarning
  LSPDiagnosticSeverityInformation = lspserver.LSPDiagnosticSeverityInformation
  LSPDiagnosticSeverityHint        = lspserver.LSPDiagnosticSeverityHint
)

// LSPDiagnostic carries a plugin finding and its editor-facing range and metadata.
//
// @evidence contracts/common.md#principled-implementation Alias identity preserves the server's diagnostic fields and JSON behavior.
// @evidence contracts/common.md#clear-and-simple-design One server-owned diagnostic schema serves driver callers and proxy publications.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No metadata-synthesizing adapter or client-specific replacement is added.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the finding and editor metadata, following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPDiagnostic = lspserver.LSPDiagnostic

// LSPCodeAction is an editor action returned by a plugin source. Native sidecars
// use command-driven actions; in-process sources may supply their own edits.
//
// @evidence contracts/common.md#principled-implementation The alias keeps command and optional edit fields identical to the proxy schema.
// @evidence contracts/common.md#clear-and-simple-design Driver callers use the server's action type without duplicating routing policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Aliasing does not bypass the native source's edit acceptance policy.
// @evidence contracts/common.md#meaningful-documentation The comment distinguishes source-specific edit ownership in a separate native paragraph under documentation-skill guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPCodeAction = lspserver.LSPCodeAction

// LSPCommand names a workspace command and preserves its opaque JSON arguments.
//
// @evidence contracts/common.md#principled-implementation The server alias retains command IDs and RawMessage argument representation.
// @evidence contracts/common.md#clear-and-simple-design The driver shares the command wire shape with the dispatch owner.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No command ID rewrite or argument special case is performed here.
// @evidence contracts/common.md#meaningful-documentation Native prose states opaque argument ownership under the documentation skill's guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPCommand = lspserver.LSPCommand

// LSPCodeActionContext carries diagnostics and requested action kinds from the editor.
//
// @evidence contracts/common.md#principled-implementation The alias preserves the context fields that the server uses for action selection.
// @evidence contracts/common.md#clear-and-simple-design Context interpretation stays with the proxy and plugin source rather than a driver mapper.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The driver does not invent diagnostics or override the editor's selection.
// @evidence contracts/common.md#meaningful-documentation The comment identifies incoming context and selection purpose following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPCodeActionContext = lspserver.LSPCodeActionContext

// LSPWorkspaceEdit describes edits a handled workspace command returns to the editor.
//
// @evidence contracts/common.md#principled-implementation Alias identity preserves the server's document-edit representation.
// @evidence contracts/common.md#clear-and-simple-design The edit schema remains centralized with LSP response ownership.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The alias does not apply edits itself or fabricate command success.
// @evidence contracts/common.md#meaningful-documentation The comment identifies editor application of returned edits using documentation-skill prose guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPWorkspaceEdit = lspserver.LSPWorkspaceEdit

// LSPTextEdit replaces one LSP range with NewText in an editor-owned document.
//
// @evidence contracts/common.md#principled-implementation The alias retains the server's range and replacement-text fields unchanged.
// @evidence contracts/common.md#clear-and-simple-design There is one shared representation for individual text edits.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No source mutation or guessed range compensation occurs in the alias.
// @evidence contracts/common.md#meaningful-documentation Native prose states replacement semantics following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPTextEdit = lspserver.LSPTextEdit

// LSPDocumentVersion identifies the document revision presented to plugin diagnostics.
//
// @evidence contracts/common.md#principled-implementation Alias identity retains the server's revision and document data without conversion.
// @evidence contracts/common.md#clear-and-simple-design Version interpretation remains in the diagnostic producer and proxy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The alias cannot substitute disk contents for the supplied editor revision.
// @evidence contracts/common.md#meaningful-documentation The producer-facing revision purpose is stated in native prose under documentation-skill guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPDocumentVersion = lspserver.LSPDocumentVersion

// LSPProjectDiagnostics is the driver-level alias for a project publication.
//
// @evidence contracts/common.md#principled-implementation Alias identity retains the server's project-wide publication shape.
// @evidence contracts/common.md#clear-and-simple-design Project findings remain distinct from per-document findings without another transport type.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No document-only result is relabeled as a project publication.
// @evidence contracts/common.md#meaningful-documentation The comment names the publication scope following the documentation skill's concise prose guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPProjectDiagnostics = lspserver.LSPProjectDiagnostics

// LSPProjectInputSnapshot is the driver-level alias for the set of paths a
// producer declares its answers depend on.
//
// @evidence contracts/common.md#principled-implementation The alias preserves the input-snapshot fields used to validate project publications.
// @evidence contracts/common.md#clear-and-simple-design Server ownership keeps reload and input representations together.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The alias does not assert completeness or infer inputs for a producer.
// @evidence contracts/common.md#meaningful-documentation Native prose states dependency declaration ownership following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPProjectInputSnapshot = lspserver.LSPProjectInputSnapshot

// LSPDiagnosticsResult separates document and project plugin diagnostics.
//
// @evidence contracts/common.md#principled-implementation Alias identity retains both server result channels without collapsing their scopes.
// @evidence contracts/common.md#clear-and-simple-design One result type groups the outputs of a diagnostic invocation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The alias cannot manufacture a successful diagnostic publication.
// @evidence contracts/common.md#meaningful-documentation The distinct publication scopes are stated directly under documentation-skill prose guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPDiagnosticsResult = lspserver.LSPDiagnosticsResult

// LSPCompletionHint supplies literal trigger text and an ordered completion corpus.
//
// @evidence contracts/common.md#principled-implementation The alias retains the server's literal trigger and item ordering representation.
// @evidence contracts/common.md#clear-and-simple-design Completion matching policy remains in the proxy, with one corpus value type.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No dynamic regular-expression matcher or consumer-specific trigger is introduced.
// @evidence contracts/common.md#meaningful-documentation Native prose states trigger and ordering facts under documentation-skill guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPCompletionHint = lspserver.LSPCompletionHint

// LSPCompletionItem separates inserted text from its optional display label and detail.
//
// @evidence contracts/common.md#principled-implementation Alias identity preserves insertion and presentation as distinct server fields.
// @evidence contracts/common.md#clear-and-simple-design Driver callers share the existing completion value instead of adding a UI adapter.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No guessed label is substituted for the producer's insertion text.
// @evidence contracts/common.md#meaningful-documentation The insertion/display distinction is documented using the documentation skill's direct prose.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPCompletionItem = lspserver.LSPCompletionItem

// LSPSymbolKind carries LSP symbol classification values for editor outlines.
//
// @evidence contracts/common.md#principled-implementation The alias retains the server's protocol numeric classifications unchanged.
// @evidence contracts/common.md#clear-and-simple-design Outline classification remains one enum shared by provider and proxy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Protocol values are forwarded without source-name or consumer special cases.
// @evidence contracts/common.md#meaningful-documentation The enum's outline purpose is stated directly under documentation-skill guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPSymbolKind = lspserver.LSPSymbolKind

// LSPDocumentSymbol forms an outline hierarchy; SelectionRange locates the name
// within the declaration's Range and Children hold nested members.
//
// @evidence contracts/common.md#principled-implementation Alias identity keeps hierarchical symbols and their two range roles intact.
// @evidence contracts/common.md#clear-and-simple-design The provider and proxy share one nested outline representation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No flattening adapter or guessed member relationship is introduced.
// @evidence contracts/common.md#meaningful-documentation Native prose explains hierarchy and range roles following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPDocumentSymbol = lspserver.LSPDocumentSymbol

// LSPLocation identifies a reference range inside the document named by its URI.
//
// @evidence contracts/common.md#principled-implementation The alias preserves the server's URI and LSP coordinate pair.
// @evidence contracts/common.md#clear-and-simple-design References use the existing location schema instead of a filesystem-path adapter.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No OS path spelling is substituted for a protocol document URI.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes document identity and range using documentation-skill guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPLocation = lspserver.LSPLocation

// SymbolProvider is the driver-level alias for lspserver.SymbolProvider.
// It is the seam that answers textDocument/documentSymbol and
// textDocument/references from ttsc's compiler-backed code graph when upstream
// tsgo does not advertise them.
//
// @evidence contracts/common.md#principled-implementation The server interface alias preserves the method set required by local symbol routing.
// @evidence contracts/common.md#clear-and-simple-design Driver embedders implement the existing provider seam without another proxy layer.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The public extension does not replace upstream methods or patch compiler internals.
// @evidence contracts/common.md#meaningful-documentation Native prose names the two routed requests and owning graph under documentation-skill guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type SymbolProvider = lspserver.SymbolProvider

// PluginSource is the driver-level alias for lspserver.PluginSource.
// It is the public seam downstream pipelines implement to contribute
// diagnostics, code actions, and workspace commands to the LSP proxy.
//
// @evidence contracts/common.md#principled-implementation Alias identity keeps implementations compatible with the server's diagnostic and command dispatch contracts.
// @evidence contracts/common.md#clear-and-simple-design The driver exposes one supported extension seam with no transport conversion.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Custom behavior enters through an implemented interface rather than foreign mutation.
// @evidence contracts/common.md#meaningful-documentation The comment identifies supported contribution categories using the documentation skill's prose guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type PluginSource = lspserver.PluginSource

// CompletionHintSource is the optional extension a PluginSource implements to
// contribute editor completion hints to the LSP proxy.
//
// @evidence contracts/common.md#principled-implementation An optional method returns the same hint type the proxy consumes without changing PluginSource's base contract.
// @evidence contracts/common.md#clear-and-simple-design One narrow extension separates corpus provision from diagnostics and commands.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Completion is contributed through a supported interface, not a patched editor handler.
// @evidence contracts/common.md#meaningful-documentation Native prose states optional implementation and consumer purpose following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type CompletionHintSource interface {
  // CompletionHints returns the source's currently published hint corpus.
  //
  // @evidence contracts/common.md#principled-implementation Corpus access returns the same hint representation consumed by proxy completion.
  // @evidence contracts/common.md#clear-and-simple-design Retrieval is separate from source-owned refresh scheduling and publication notification.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts The supported source method replaces injected completion-handler mutations.
  // @evidence contracts/common.md#meaningful-documentation Native prose identifies currently published hints following the documentation skill.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources CompletionHints declares a signature only; the implementation owns acquisition and release of resources.
  // @evidenceExclude contracts/performance.md#efficient-algorithms CompletionHints declares a signature only; the implementation owns the processing strategy.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work CompletionHints declares a signature only; the implementation owns any shared work.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation CompletionHints is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
  CompletionHints() []LSPCompletionHint
}

// CompletionHintRefresher is the optional extension a CompletionHintSource
// implements when its corpus can change during a session. The proxy calls it
// after a saved document, a configuration change, or a watched-file change, and
// expects the call to return immediately: the source owns the scheduling and the
// staleness rules, and completion keeps reading the previous corpus until the
// new one is stored.
//
// @evidence contracts/common.md#principled-implementation The no-result notification models scheduling; corpus publication remains a separate source responsibility.
// @evidence contracts/common.md#clear-and-simple-design Refresh notification is isolated from retrieving the current completion corpus.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The seam does not force synchronous rebuilds or invent a completed refresh result.
// @evidence contracts/common.md#meaningful-documentation Native prose states event triggers, immediate return and stale-corpus ownership under documentation-skill guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type CompletionHintRefresher interface {
  // RefreshCompletionHints schedules a corpus refresh and returns immediately.
  //
  // @evidence contracts/common.md#principled-implementation Completion can read the previous corpus while the implementation schedules new source-owned work.
  // @evidence contracts/common.md#clear-and-simple-design A no-result notification excludes corpus retrieval from the scheduling operation.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts The interface does not disguise a synchronous rebuild as a finished refresh result.
  // @evidence contracts/common.md#meaningful-documentation Native prose states scheduling and immediate return following the documentation skill.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources RefreshCompletionHints declares a signature only; the implementation owns acquisition and release of resources.
  // @evidenceExclude contracts/performance.md#efficient-algorithms RefreshCompletionHints declares a signature only; the implementation owns the processing strategy.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work RefreshCompletionHints declares a signature only; the implementation owns any shared work.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation RefreshCompletionHints is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
  RefreshCompletionHints()
}

// CompletionHintObserverSource is the optional extension a CompletionHintSource
// implements to tell the proxy that a refresh finished. The proxy uses it to
// detect a completion trigger character that appeared after the initialize
// response was already sent.
//
// @evidence contracts/common.md#principled-implementation Registering a callback expresses completion of source-owned refresh work rather than polling guessed timing.
// @evidence contracts/common.md#clear-and-simple-design One observer extension separates refresh completion from source scheduling and corpus reads.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Notification uses a supported callback boundary without replacing the proxy's initialization logic.
// @evidence contracts/common.md#meaningful-documentation Native prose explains late trigger discovery and observer purpose following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type CompletionHintObserverSource interface {
  // SetCompletionHintsObserver registers notification after a refresh cycle.
  // The proxy re-reads the current corpus; notification alone does not certify
  // a successful changed publication, since a refresh may keep previous hints.
  //
  // @evidence contracts/common.md#principled-implementation Publication notification enables the proxy to refresh completion capabilities when hint triggers change.
  // @evidence contracts/common.md#clear-and-simple-design One callback reports refresh completion separately from scheduling and current-corpus retrieval, without carrying a publication-success result.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Supported notification replaces polling guessed refresh timing or modifying proxy initialization globally.
  // @evidence contracts/common.md#meaningful-documentation Native prose states observer registration and publication timing following the documentation skill.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources SetCompletionHintsObserver declares a signature only; the implementation owns acquisition and release of resources.
  // @evidenceExclude contracts/performance.md#efficient-algorithms SetCompletionHintsObserver declares a signature only; the implementation owns the processing strategy.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work SetCompletionHintsObserver declares a signature only; the implementation owns any shared work.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation SetCompletionHintsObserver is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
  SetCompletionHintsObserver(observer func())
}

// NullPluginSource contributes no diagnostics or actions and leaves commands unhandled.
//
// @evidence contracts/common.md#principled-implementation The alias keeps the server's empty-source method set and unhandled-command sentinel.
// @evidence contracts/common.md#clear-and-simple-design One explicit empty implementation represents absence of plugin contributions.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No fake successful edit or command result is substituted for missing behavior.
// @evidence contracts/common.md#meaningful-documentation Native prose states the empty contribution and command behavior under documentation-skill guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type NullPluginSource = lspserver.NullPluginSource

// NativePluginManifest describes configured plugins and built LSP sidecars for one host.
//
// @evidence contracts/common.md#principled-implementation The alias preserves the server manifest's sidecar capabilities and selection-input fields.
// @evidence contracts/common.md#clear-and-simple-design Driver callers share the manifest consumed by native plugin initialization.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The alias neither infers capabilities from names nor invents built binaries.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies configured entries and built sidecars following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type NativePluginManifest = lspserver.NativePluginManifest

// NativePluginConfigEntry carries name, stage and config in the compact sidecar protocol.
//
// @evidence contracts/common.md#principled-implementation Alias identity retains the protocol fields while host-only binary metadata stays outside this entry.
// @evidence contracts/common.md#clear-and-simple-design Configuration entries remain separate from built LSP sidecar descriptions.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No consumer-specific inline option or fabricated executable is introduced.
// @evidence contracts/common.md#meaningful-documentation Native prose names the compact entry fields under documentation-skill guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type NativePluginConfigEntry = lspserver.NativePluginConfigEntry

// NativeLSPPluginEntry names a built sidecar and its explicitly advertised LSP capabilities.
//
// @evidence contracts/common.md#principled-implementation The alias preserves binary identity and capability distinctions consumed by the server.
// @evidence contracts/common.md#clear-and-simple-design Sidecar execution metadata has one shared transport representation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Capability fields are producer declarations, not guesses derived from package identity.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes a built sidecar from an ordinary config entry following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type NativeLSPPluginEntry = lspserver.NativeLSPPluginEntry

// NativePluginSourceOptions supplies project anchoring, manifest JSON and a diagnostic sink.
//
// @evidence contracts/common.md#principled-implementation The alias retains the exact options accepted by the native source constructor.
// @evidence contracts/common.md#clear-and-simple-design Host configuration stays with construction instead of adding driver-global settings.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The type introduces no environment override or hidden source replacement.
// @evidence contracts/common.md#meaningful-documentation Native prose names the constructor input roles under documentation-skill guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type NativePluginSourceOptions = lspserver.NativePluginSourceOptions

// NativePluginSource delegates plugin contributions to sidecars that support the LSP protocol.
//
// @evidence contracts/common.md#principled-implementation Alias identity preserves the server implementation and its capability-gated method set.
// @evidence contracts/common.md#clear-and-simple-design The driver exposes native source ownership without a second lifecycle wrapper.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The alias does not bypass explicit sidecar capability declarations.
// @evidence contracts/common.md#meaningful-documentation Native prose states delegation and protocol eligibility following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type NativePluginSource = lspserver.NativePluginSource

// ProxyOptions supplies editor and upstream streams plus local contribution policy.
//
// @evidence contracts/common.md#principled-implementation The alias retains stream direction and local provider options consumed by NewProxy.
// @evidence contracts/common.md#clear-and-simple-design Proxy configuration remains one server-owned constructor value.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No stream swapping or foreign capability override is implemented by the alias.
// @evidence contracts/common.md#meaningful-documentation Native prose names transport and policy responsibilities under documentation-skill guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ProxyOptions = lspserver.ProxyOptions

// Proxy mediates editor and upstream JSON-RPC traffic while handling local plugin requests.
//
// @evidence contracts/common.md#principled-implementation The alias retains the server proxy's routing and synchronization implementation unchanged.
// @evidence contracts/common.md#clear-and-simple-design One transport owner serves driver embedders without a parallel proxy facade.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Alias exposure does not replace upstream methods or mutate editor internals.
// @evidence contracts/common.md#meaningful-documentation Native prose states mediation and local handling following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type Proxy = lspserver.Proxy

// FrameReader reads bounded LSP frames while preserving the original header block.
// It does not close its underlying reader.
//
// @evidence contracts/common.md#principled-implementation The alias retains the server reader's framing method and header preservation.
// @evidence contracts/common.md#clear-and-simple-design Framing has one implementation shared by the proxy and embedders.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No guessed delimiter or rewritten vendor header is introduced.
// @evidence contracts/common.md#meaningful-documentation Native prose states header retention and underlying-reader ownership under documentation-skill guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type FrameReader = lspserver.FrameReader

// Envelope exposes JSON-RPC routing fields while inner payloads remain raw JSON.
//
// @evidence contracts/common.md#principled-implementation Alias identity preserves RawMessage payloads instead of decoding unrelated protocol data.
// @evidence contracts/common.md#clear-and-simple-design Routing metadata and opaque bodies stay in the server's existing envelope type.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The alias performs no command-specific payload rewrite or synthesized response.
// @evidence contracts/common.md#meaningful-documentation Native prose explains the routing/payload boundary following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type Envelope = lspserver.Envelope

// LSPServerOptions wires editor streams, project configuration and the selected upstream runner.
//
// @evidence contracts/common.md#principled-implementation The alias preserves the options and upstream dependencies captured for one server invocation.
// @evidence contracts/common.md#clear-and-simple-design Invocation configuration stays in one constructor value instead of driver globals.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Runner injection is a supported dependency boundary, not replacement of foreign internals.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies invocation inputs under documentation-skill guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPServerOptions = lspserver.LSPServerOptions

// LSPUpstreamRunner runs one context-owned upstream using the supplied transport streams.
//
// @evidence contracts/common.md#principled-implementation Alias identity retains the runner's context, stream and error signature.
// @evidence contracts/common.md#clear-and-simple-design Upstream execution is one injectable function separate from prerequisite validation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts This documented dependency seam requires no patching of process launch internals.
// @evidence contracts/common.md#meaningful-documentation Native prose states context and transport responsibility following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPUpstreamRunner = lspserver.LSPUpstreamRunner

// LSPUpstreamValidator checks invocation prerequisites before runner and proxy tasks begin.
//
// @evidence contracts/common.md#principled-implementation The alias preserves the options-to-error validation contract used before server startup.
// @evidence contracts/common.md#clear-and-simple-design Validation is separate from upstream execution rather than buried in a replacement runner.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Preconditions enter through a supported dependency function, not a global hook.
// @evidence contracts/common.md#meaningful-documentation The native comment names startup ordering under documentation-skill guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPUpstreamValidator = lspserver.LSPUpstreamValidator

// LSPUpstream pairs a runner with its validation policy for one invocation.
// Its zero value selects the production upstream behavior.
//
// @evidence contracts/common.md#principled-implementation Alias identity preserves the server's immutable dependency pair and zero-value selection.
// @evidence contracts/common.md#clear-and-simple-design Execution and prerequisites travel together without separate mutable driver settings.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit dependency injection avoids test-only branches in production startup.
// @evidence contracts/common.md#meaningful-documentation Native prose explains pairing and zero-value behavior following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPUpstream = lspserver.LSPUpstream

// MaxFrameBytes is the maximum byte length of a single JSON-RPC frame
// the proxy will read without returning ErrFrameTooLarge.
const MaxFrameBytes = lspserver.MaxFrameBytes

// MaxHeaderBytes is the maximum byte length of a JSON-RPC frame header block
// the proxy will read without returning ErrFrameTooLarge.
const MaxHeaderBytes = lspserver.MaxHeaderBytes

// Sentinel errors forwarded from lspserver.
var ErrCommandNotHandled = lspserver.ErrCommandNotHandled
var ErrFrameClosed = lspserver.ErrFrameClosed
var ErrFrameTooLarge = lspserver.ErrFrameTooLarge
var ErrInvalidJSONRPC = lspserver.ErrInvalidJSONRPC
var ErrLSPUpstreamPanic = lspserver.ErrLSPUpstreamPanic
var ErrLSPUpstreamRunnerRequired = lspserver.ErrLSPUpstreamRunnerRequired
var ErrLSPCwdRequired = lspserver.ErrLSPCwdRequired
var ErrLSPTsgoBinaryRequired = lspserver.ErrLSPTsgoBinaryRequired
var ErrLSPExitWithoutShutdown = lspserver.ErrLSPExitWithoutShutdown

// Constructor and utility functions forwarded from lspserver.
var NewProxy = lspserver.NewProxy
var NewNativePluginSource = lspserver.NewNativePluginSource
var NewFrameReader = lspserver.NewFrameReader
var WriteFrame = lspserver.WriteFrame
var ParseEnvelope = lspserver.ParseEnvelope
var RecoverPanicAs = lspserver.RecoverPanicAs
var RunLSPServer = lspserver.RunLSPServer
var DenyNpmInstall = lspserver.DenyNpmInstall

// idKeyFromRaw normalizes a raw JSON-RPC id to a string map key. It is
// exposed here (unexported) so tests can access it via go:linkname without
// importing the internal package.
func idKeyFromRaw(raw json.RawMessage) string {
  return lspserver.IDKeyFromRaw(raw)
}
