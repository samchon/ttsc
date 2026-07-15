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
// SelectionRange the name (LSP requires SelectionRange to be contained in
// Range). Children nest members (a class's methods) under their owner.
type LSPDocumentSymbol struct {
  Name           string              `json:"name"`
  Kind           LSPSymbolKind       `json:"kind"`
  Range          LSPRange            `json:"range"`
  SelectionRange LSPRange            `json:"selectionRange"`
  Children       []LSPDocumentSymbol `json:"children,omitempty"`
}

// LSPLocation is the wire shape of an LSP Location: a range inside a document,
// returned by textDocument/references for each usage site.
type LSPLocation struct {
  URI   string   `json:"uri"`
  Range LSPRange `json:"range"`
}

// SymbolProvider computes documentSymbol and references locally from ttsc's
// compiler-backed code graph. tsgo implements both methods too, so the proxy
// consults a provider only as a fallback or when a consumer opts into the graph
// answers; see shouldAnswerDocumentSymbolLocally / shouldAnswerReferencesLocally.
//
// Implementations may load a compiler Program lazily and must be safe to call
// from multiple goroutines: the proxy invokes them off its pump goroutine so a
// slow program load never blocks other traffic.
type SymbolProvider interface {
  // DocumentSymbols returns the declarations in the document identified by uri
  // as a hierarchy of LSPDocumentSymbol. A document with no declarations
  // yields an empty (non-nil) slice.
  DocumentSymbols(uri string) ([]LSPDocumentSymbol, error)

  // References returns the usage locations of the symbol at pos in the document
  // identified by uri. includeDeclaration adds the symbol's own declaration to
  // the result. A position that resolves to no symbol yields an empty slice.
  References(uri string, pos LSPPosition, includeDeclaration bool) ([]LSPLocation, error)

  // Invalidate discards any cached compiler state so the next DocumentSymbols or
  // References call reflects the current sources. The proxy calls it on
  // didChange/didSave; a provider that recomputes on every call may no-op.
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
