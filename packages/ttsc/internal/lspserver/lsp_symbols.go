package lspserver

// lsp_symbols.go lets the proxy answer two language methods from a local
// SymbolProvider computed off ttsc's compiler-backed code graph (see
// internal/graphsymbols): textDocument/documentSymbol and
// textDocument/references. The wrapped tsgo LSP implements both itself, so the
// proxy forwards to tsgo whenever it advertises the capability and only answers
// locally as a fallback or when a consumer opts into the graph answers (see
// shouldAnswerDocumentSymbolLocally / shouldAnswerReferencesLocally).

import "encoding/json"

// LSPSymbolKind mirrors the LSP SymbolKind enum. Only the members the graph's
// node kinds map onto are named here; the numeric values are the wire contract.
//
// @evidence contracts/common.md#principled-implementation Integer discriminants retain LSP SymbolKind values while naming the graph-supported subset.
// @evidence contracts/common.md#clear-and-simple-design One enum serves hierarchy and usage results without compiler node dependencies.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Named values are protocol constants rather than guessed graph outputs.
// @evidence contracts/common.md#meaningful-documentation Native prose explains the supported subset and numeric wire meaning, following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPSymbolKind int

const (
  LSPSymbolKindClass     LSPSymbolKind = 5
  LSPSymbolKindMethod    LSPSymbolKind = 6
  LSPSymbolKindEnum      LSPSymbolKind = 10
  LSPSymbolKindInterface LSPSymbolKind = 11
  LSPSymbolKindFunction  LSPSymbolKind = 12
  LSPSymbolKindVariable  LSPSymbolKind = 13
  LSPSymbolKindStruct    LSPSymbolKind = 23
)

// LSPDocumentSymbol is the hierarchical shape returned by
// textDocument/documentSymbol. Range spans the whole declaration and
// SelectionRange identifies the contained navigation span. The graph provider
// uses the whole declaration span for both because it lacks a separate name
// span. Children nest members (a class's methods) under their owner.
//
// @evidence contracts/common.md#principled-implementation Whole and selection ranges remain distinct while recursive Children represent declaration ownership.
// @evidence contracts/common.md#clear-and-simple-design The hierarchical result reuses ranges and kinds without mixing query state into nodes.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The graph supplies actual names and ranges; the shape does not encode expected declarations.
// @evidence contracts/common.md#meaningful-documentation Native prose documents selection containment and child ownership, following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPDocumentSymbol struct {
  // Name is the declaration's display name.
  Name string `json:"name"`

  // Kind classifies the declaration using LSP SymbolKind discriminants.
  Kind LSPSymbolKind `json:"kind"`

  // Range covers the declaration in session UTF-16 coordinates.
  Range LSPRange `json:"range"`

  // SelectionRange is contained in Range and need not isolate the name.
  SelectionRange LSPRange `json:"selectionRange"`

  // Children nest owned declarations; an empty list is omitted.
  Children []LSPDocumentSymbol `json:"children,omitempty"`
}

// LSPLocation is the wire shape of an LSP Location: a range inside a document,
// returned by textDocument/references for each usage site.
//
// @evidence contracts/common.md#principled-implementation URI plus range identifies a usage independently of the document currently open in the editor.
// @evidence contracts/common.md#clear-and-simple-design Reference results and related diagnostics share this location value.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Locations are producer values rather than guessed local filenames.
// @evidence contracts/common.md#meaningful-documentation Native prose describes document usage sites, following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LSPLocation struct {
  // URI identifies the target document using protocol spelling.
  URI string `json:"uri"`

  // Range locates the site in that document's session UTF-16 coordinates.
  Range LSPRange `json:"range"`
}

// SymbolProvider computes documentSymbol and references locally from ttsc's
// compiler-backed code graph. tsgo implements both methods too, so the proxy
// consults a provider only as a fallback or when a consumer opts into the graph
// answers; see shouldAnswerDocumentSymbolLocally / shouldAnswerReferencesLocally.
//
// Implementations may load a compiler Program lazily and must be safe to call
// from multiple goroutines. DocumentSymbols and References run in separate
// query goroutines rather than on the editor pump. Their replies still share
// frame serialization, and this does not bound custom provider work or the
// synchronous invalidation call.
//
// @evidence contracts/common.md#principled-implementation Hierarchy, usage lookup and invalidation are separate operations over the provider's compiler-backed state.
// @evidence contracts/common.md#clear-and-simple-design The proxy depends on semantic queries without exposing graph construction or program storage.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Supported injection supplies local answers without replacing upstream symbol methods.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs document fallback selection and concurrent invocation, following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type SymbolProvider interface {
  // DocumentSymbols returns the declarations in the document identified by uri
  // as a hierarchy of LSPDocumentSymbol. A document with no declarations
  // yields an empty (non-nil) slice.
  //
  // @evidence contracts/common.md#principled-implementation URI selects one document whose declarations form an ownership hierarchy.
  // @evidence contracts/common.md#clear-and-simple-design This query returns wire nodes while the implementation owns compiler loading.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Results come through the provider boundary instead of patched upstream methods.
  // @evidence contracts/common.md#meaningful-documentation Native prose states hierarchy and empty-result meaning, following the documentation skill.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources DocumentSymbols declares a signature only; the implementation owns acquisition and release of resources.
  // @evidenceExclude contracts/performance.md#efficient-algorithms DocumentSymbols declares a signature only; the implementation owns the processing strategy.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work DocumentSymbols declares a signature only; the implementation owns any shared work.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation DocumentSymbols is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
  DocumentSymbols(uri string) ([]LSPDocumentSymbol, error)

  // References returns the usage locations of the symbol at pos in the document
  // identified by uri. includeDeclaration adds the symbol's own declaration to
  // the result. A position that resolves to no symbol yields an empty slice.
  //
  // @evidence contracts/common.md#principled-implementation URI and UTF-16 position select a symbol; includeDeclaration distinguishes declaration sites from usages.
  // @evidence contracts/common.md#clear-and-simple-design The query returns shared location values without exposing symbol identity internals.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts A missing symbol yields no usages instead of guessed same-name matches.
  // @evidence contracts/common.md#meaningful-documentation Native prose explains declaration inclusion and empty results, following the documentation skill.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources References declares a signature only; the implementation owns acquisition and release of resources.
  // @evidenceExclude contracts/performance.md#efficient-algorithms References declares a signature only; the implementation owns the processing strategy.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work References declares a signature only; the implementation owns any shared work.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation References is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
  References(uri string, pos LSPPosition, includeDeclaration bool) ([]LSPLocation, error)

  // Invalidate withdraws published cached compiler state from later queries.
  // The proxy calls it on didChange/didSave; an uncached provider may no-op.
  // In-flight queries may still hold an earlier snapshot, and invalidation alone
  // does not certify a new native capture or cancel that work.
  //
  // @evidence contracts/common.md#principled-implementation Invalidation withdraws compiler-backed state before later queries use it.
  // @evidence contracts/common.md#clear-and-simple-design Cache policy stays with the provider that owns the state.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts An uncached provider may legitimately do nothing; a cached provider cannot fake freshness by retaining disproven state.
  // @evidence contracts/common.md#meaningful-documentation Native prose documents triggers and the uncached exception, following the documentation skill.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Invalidate declares a signature only; the implementation owns acquisition and release of resources.
  // @evidenceExclude contracts/performance.md#efficient-algorithms Invalidate declares a signature only; the implementation owns the processing strategy.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work Invalidate declares a signature only; the implementation owns any shared work.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation Invalidate is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
  Invalidate()
}

// handleDocumentSymbolRequest answers textDocument/documentSymbol from the local
// SymbolProvider only when shouldAnswerDocumentSymbolLocally says to (no
// provider wired, upstream tsgo did not advertise the capability, or a consumer
// forced the local provider). Otherwise it returns false so the request flows to
// upstream tsgo's compiler-exact handler. The computation runs on its own
// goroutine (a program load can be slow) so the editor->upstream pump keeps
// servicing other traffic.
func (p *Proxy) handleDocumentSymbolRequest(env Envelope) (bool, error) {
  if !p.shouldAnswerDocumentSymbolLocally() {
    return false, nil
  }
  var params struct {
    TextDocument struct {
      URI string `json:"uri"`
    } `json:"textDocument"`
  }
  if err := json.Unmarshal(env.Params, &params); err != nil || params.TextDocument.URI == "" {
    return false, nil
  }
  go p.completeDocumentSymbolRequest(env, params.TextDocument.URI)
  return true, nil
}

func (p *Proxy) completeDocumentSymbolRequest(env Envelope, uri string) {
  symbols, err := p.symbolProvider.DocumentSymbols(uri)
  if err != nil || symbols == nil {
    // A provider failure must not surface as an LSP error to a graph
    // consumer mid-index; reply with an empty result so the client moves on.
    symbols = []LSPDocumentSymbol{}
  }
  p.reportAsyncError(p.writeResult(env.ID, symbols))
}

// handleReferencesRequest answers textDocument/references from the local
// SymbolProvider, mirroring handleDocumentSymbolRequest's gating (via
// shouldAnswerReferencesLocally) and off-pump-goroutine behavior.
func (p *Proxy) handleReferencesRequest(env Envelope) (bool, error) {
  if !p.shouldAnswerReferencesLocally() {
    return false, nil
  }
  var params struct {
    TextDocument struct {
      URI string `json:"uri"`
    } `json:"textDocument"`
    Position LSPPosition `json:"position"`
    Context  struct {
      IncludeDeclaration bool `json:"includeDeclaration"`
    } `json:"context"`
  }
  if err := json.Unmarshal(env.Params, &params); err != nil || params.TextDocument.URI == "" {
    return false, nil
  }
  go p.completeReferencesRequest(env, params.TextDocument.URI, params.Position, params.Context.IncludeDeclaration)
  return true, nil
}

func (p *Proxy) completeReferencesRequest(env Envelope, uri string, pos LSPPosition, includeDeclaration bool) {
  locations, err := p.symbolProvider.References(uri, pos, includeDeclaration)
  if err != nil || locations == nil {
    locations = []LSPLocation{}
  }
  p.reportAsyncError(p.writeResult(env.ID, locations))
}
