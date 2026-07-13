// Package graphsymbols answers the two graph-oriented LSP methods
// (textDocument/documentSymbol and textDocument/references) from ttsc's
// compiler-backed code graph. It is the lspserver.SymbolProvider implementation
// ttscserver wires in so a raw-LSP graph consumer such as @samchon/graph gets
// compiler-complete declarations (graph nodes) and usages (graph edges) instead
// of the empty answers tsgo's native LSP returns for these methods.
//
// It lives in its own package rather than in internal/lspserver because it
// imports internal/graph and driver, and driver already imports lspserver;
// putting the compiler-facing logic here keeps lspserver free of that
// dependency cycle. Only cmd/ttscserver imports this package.
package graphsymbols

import (
  "fmt"
  "net/url"
  "os"
  "path/filepath"
  "sort"
  "strings"
  "sync"
  "unicode/utf16"
  "unicode/utf8"

  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph"
  "github.com/samchon/ttsc/packages/ttsc/internal/lspserver"
)

// Provider computes documentSymbol/references from a code graph built for one
// project (tsconfig). The graph is loaded lazily on the first request and
// cached for the process lifetime: the graph-indexing use case walks a project
// once, so a single compiler load keeps indexing fast without re-checking on
// every request. It is safe for concurrent use.
type Provider struct {
  cwd      string
  tsconfig string

  mu      sync.Mutex
  loaded  bool
  graph   *graph.Graph
  sources map[string]string
  loadErr error
}

// NewProvider returns a Provider that builds the graph for the project rooted at
// cwd using tsconfig (defaulting to "tsconfig.json").
func NewProvider(cwd, tsconfig string) *Provider {
  tsconfig = strings.TrimSpace(tsconfig)
  if tsconfig == "" {
    tsconfig = "tsconfig.json"
  }
  return &Provider{cwd: cwd, tsconfig: tsconfig}
}

// load builds (once) and returns the cached graph and per-file source texts,
// mirroring how cmd/ttscgraph/dump.go resolves the project and drives the graph
// package.
func (pr *Provider) load() (*graph.Graph, map[string]string, error) {
  pr.mu.Lock()
  defer pr.mu.Unlock()
  if pr.loaded {
    return pr.graph, pr.sources, pr.loadErr
  }
  pr.loaded = true

  cwd := pr.cwd
  if abs, err := filepath.Abs(cwd); err == nil {
    cwd = abs
  }
  cwd = shimtspath.ResolvePath(cwd)

  prog, _, err := driver.LoadProgram(cwd, pr.tsconfig, driver.LoadProgramOptions{})
  if err != nil {
    pr.loadErr = err
    return nil, nil, err
  }
  if prog == nil {
    pr.loadErr = fmt.Errorf("graphsymbols: could not load %s/%s", cwd, pr.tsconfig)
    return nil, nil, pr.loadErr
  }
  defer func() { _ = prog.Close() }()

  pr.graph = graph.Build(prog)
  pr.sources = graph.SourceTexts(prog)
  return pr.graph, pr.sources, nil
}

// DocumentSymbols returns the declarations in uri as a hierarchy: top-level
// declarations at the root, class/interface members nested under their owner.
func (pr *Provider) DocumentSymbols(uri string) ([]lspserver.LSPDocumentSymbol, error) {
  g, sources, err := pr.load()
  if err != nil {
    return nil, err
  }
  file, ok := fileFromURI(uri, sources)
  if !ok {
    return []lspserver.LSPDocumentSymbol{}, nil
  }
  text := sources[file]

  var fileNodes []*graph.Node
  for _, n := range g.Nodes {
    if n.External {
      continue
    }
    if pathsEqual(n.File, file) {
      fileNodes = append(fileNodes, n)
    }
  }
  return buildDocumentSymbols(fileNodes, text), nil
}

// References returns the usage locations of the symbol at pos in uri. When
// includeDeclaration is set the symbol's own declaration is added to the result.
func (pr *Provider) References(uri string, pos lspserver.LSPPosition, includeDeclaration bool) ([]lspserver.LSPLocation, error) {
  g, sources, err := pr.load()
  if err != nil {
    return nil, err
  }
  file, ok := fileFromURI(uri, sources)
  if !ok {
    return []lspserver.LSPLocation{}, nil
  }
  text := sources[file]
  offset, ok := lspPositionToOffset(text, pos)
  if !ok {
    return []lspserver.LSPLocation{}, nil
  }
  target := targetNodeAt(g, file, offset)
  if target == nil {
    return []lspserver.LSPLocation{}, nil
  }

  locations := []lspserver.LSPLocation{}
  seen := map[string]struct{}{}
  add := func(f string, start, end int) {
    t, ok := sources[f]
    if !ok {
      return
    }
    if end < start {
      end = start
    }
    loc := lspserver.LSPLocation{
      URI: uriFromFile(f),
      Range: lspserver.LSPRange{
        Start: offsetToPosition(t, start),
        End:   offsetToPosition(t, end),
      },
    }
    key := fmt.Sprintf("%s:%d:%d", loc.URI, start, end)
    if _, dup := seen[key]; dup {
      return
    }
    seen[key] = struct{}{}
    locations = append(locations, loc)
  }

  // Edges are directed From a using declaration To the referenced symbol, so an
  // edge whose To is the target node is one usage site; its span lives in the
  // From node's file (graph's edge-evidence contract).
  //
  // A structural edge is not a usage. A module's `exports` edge says the symbol
  // stands on that module's public surface — a fact about the declaration, not a
  // place it is used — and it carries no span, so counting it as a usage puts a
  // phantom reference at the top of the file.
  for _, e := range g.Edges {
    if e.To != target.ID || isStructuralEdge(e.Kind) {
      continue
    }
    f := nodeFile(e.From)
    if f == "" {
      continue
    }
    add(f, e.Pos, e.End)
  }
  if includeDeclaration {
    declText := sources[target.File]
    add(target.File, firstCodeOffset(declText, target.Pos), target.End)
  }
  return locations, nil
}

// buildDocumentSymbols turns a file's graph nodes into a DocumentSymbol forest.
// A node whose owner (its qualified name minus its simple name) is another node
// in the file nests under that owner; everything else is a root.
func buildDocumentSymbols(nodes []*graph.Node, text string) []lspserver.LSPDocumentSymbol {
  names := make(map[string]bool, len(nodes))
  for _, n := range nodes {
    names[n.Name] = true
  }
  childrenOf := map[string][]*graph.Node{}
  var roots []*graph.Node
  for _, n := range nodes {
    owner := ownerName(n)
    if owner != "" && names[owner] {
      childrenOf[owner] = append(childrenOf[owner], n)
    } else {
      roots = append(roots, n)
    }
  }
  sortNodes(roots)
  out := make([]lspserver.LSPDocumentSymbol, 0, len(roots))
  for _, r := range roots {
    out = append(out, buildSymbol(r, childrenOf, text))
  }
  return out
}

// buildSymbol materializes one node (and, recursively, the nodes owned by it)
// as an LSPDocumentSymbol. The owner relation is a strict name-prefix, so the
// recursion terminates (no cycles).
func buildSymbol(n *graph.Node, childrenOf map[string][]*graph.Node, text string) lspserver.LSPDocumentSymbol {
  sym := nodeToSymbol(n, text)
  kids := childrenOf[n.Name]
  sortNodes(kids)
  for _, k := range kids {
    sym.Children = append(sym.Children, buildSymbol(k, childrenOf, text))
  }
  return sym
}

func nodeToSymbol(n *graph.Node, text string) lspserver.LSPDocumentSymbol {
  start := firstCodeOffset(text, n.Pos)
  end := n.End
  if end < start {
    end = start
  }
  rng := lspserver.LSPRange{
    Start: offsetToPosition(text, start),
    End:   offsetToPosition(text, end),
  }
  name := n.Simple
  if name == "" {
    name = n.Name
  }
  return lspserver.LSPDocumentSymbol{
    Name:  name,
    Kind:  symbolKind(n.Kind),
    Range: rng,
    // The graph does not record the identifier's own span separately, so the
    // selection range reuses the declaration range. LSP only requires it to be
    // contained in Range, which this trivially satisfies.
    SelectionRange: rng,
  }
}

// ownerName is the qualified name of a node's owner (a class/interface/namespace),
// or "" for a top-level declaration. It strips the trailing ".<simple>" using the
// node's recorded simple name so a quoted member whose name contains a dot splits
// exactly.
func ownerName(n *graph.Node) string {
  if n.Simple == "" || n.Name == n.Simple {
    return ""
  }
  suffix := "." + n.Simple
  if strings.HasSuffix(n.Name, suffix) {
    return n.Name[:len(n.Name)-len(suffix)]
  }
  return ""
}

// symbolKind maps a graph node kind onto the closest LSP SymbolKind. LSP has no
// dedicated kind for a type alias; Struct keeps it in the named-type bucket
// without reporting it as a runtime class.
func symbolKind(k graph.NodeKind) lspserver.LSPSymbolKind {
  switch k {
  case graph.NodeFunction:
    return lspserver.LSPSymbolKindFunction
  case graph.NodeClass:
    return lspserver.LSPSymbolKindClass
  case graph.NodeInterface:
    return lspserver.LSPSymbolKindInterface
  case graph.NodeEnum:
    return lspserver.LSPSymbolKindEnum
  case graph.NodeMethod:
    return lspserver.LSPSymbolKindMethod
  case graph.NodeTypeAlias:
    return lspserver.LSPSymbolKindStruct
  case graph.NodeVariable:
    return lspserver.LSPSymbolKindVariable
  default:
    return lspserver.LSPSymbolKindVariable
  }
}

// targetNodeAt resolves the symbol the cursor addresses: the smallest
// declaration whose span contains offset (so a method wins over its enclosing
// class), or, when the cursor sits on a usage rather than a declaration, the
// node an edge whose source expression covers the offset points to.
func targetNodeAt(g *graph.Graph, file string, offset int) *graph.Node {
  var best *graph.Node
  for _, n := range g.Nodes {
    if n.External || !pathsEqual(n.File, file) {
      continue
    }
    if offset >= n.Pos && offset < n.End {
      if best == nil || (n.End-n.Pos) < (best.End-best.Pos) {
        best = n
      }
    }
  }
  if best != nil {
    return best
  }
  for _, e := range g.Edges {
    if !pathsEqual(nodeFile(e.From), file) {
      continue
    }
    if offset >= e.Pos && offset < e.End {
      if n, ok := g.Nodes[e.To]; ok {
        return n
      }
    }
  }
  return nil
}

// isStructuralEdge reports an edge that records where a symbol stands rather than
// a place it is used.
func isStructuralEdge(kind graph.EdgeKind) bool {
  return kind == graph.EdgeExports
}

func sortNodes(nodes []*graph.Node) {
  sort.Slice(nodes, func(i, j int) bool {
    if nodes[i].Pos != nodes[j].Pos {
      return nodes[i].Pos < nodes[j].Pos
    }
    return nodes[i].Name < nodes[j].Name
  })
}

// nodeFile recovers the source file path embedded in a node id
// ("path#name:kind"); "" for an id without a path.
func nodeFile(id string) string {
  if hash := strings.Index(id, "#"); hash >= 0 {
    return id[:hash]
  }
  return ""
}

// fileFromURI maps a file:// uri onto the source map key for the same file,
// returning that key so text lookups by it succeed. Paths are compared
// case-insensitively so a Windows drive-letter case mismatch between the
// editor's uri and tsgo's normalized path still resolves.
func fileFromURI(uri string, sources map[string]string) (string, bool) {
  path, ok := filePathFromURI(uri)
  if !ok {
    return "", false
  }
  resolved := shimtspath.ResolvePath(path)
  for key := range sources {
    if pathsEqual(key, resolved) || pathsEqual(key, path) {
      return key, true
    }
  }
  return "", false
}

func pathsEqual(a, b string) bool {
  return strings.EqualFold(filepath.ToSlash(a), filepath.ToSlash(b))
}

// filePathFromURI decodes a file:// uri to an absolute OS path. It mirrors the
// proxy's own unexported converter so this package stays self-contained.
func filePathFromURI(raw string) (string, bool) {
  parsed, err := url.Parse(raw)
  if err != nil || parsed.Scheme != "file" {
    return "", false
  }
  path := parsed.Path
  if parsed.Host != "" {
    path = "//" + parsed.Host + path
  }
  if path == "" {
    return "", false
  }
  if os.PathSeparator == '\\' && strings.HasPrefix(path, "/") && len(path) >= 3 && path[2] == ':' {
    path = path[1:]
  }
  abs, err := filepath.Abs(path)
  if err != nil {
    return "", false
  }
  return abs, true
}

// uriFromFile encodes an OS path as a file:// uri.
func uriFromFile(path string) string {
  slashed := filepath.ToSlash(path)
  if !strings.HasPrefix(slashed, "/") {
    slashed = "/" + slashed
  }
  return (&url.URL{Scheme: "file", Path: slashed}).String()
}

// firstCodeOffset advances past leading trivia (whitespace, // and /* */
// comments) so a declaration span starts at the keyword rather than its doc
// comment or indentation. It mirrors the graph dump's own trivia skip.
func firstCodeOffset(text string, pos int) int {
  if pos < 0 {
    return 0
  }
  i := pos
  for i < len(text) {
    switch {
    case text[i] == ' ' || text[i] == '\t' || text[i] == '\r' || text[i] == '\n':
      i++
    case text[i] == '/' && i+1 < len(text) && text[i+1] == '/':
      i += 2
      for i < len(text) && text[i] != '\n' {
        i++
      }
    case text[i] == '/' && i+1 < len(text) && text[i+1] == '*':
      i += 2
      for i+1 < len(text) && !(text[i] == '*' && text[i+1] == '/') {
        i++
      }
      if i+1 < len(text) {
        i += 2
      } else {
        i = len(text)
      }
    default:
      return i
    }
  }
  return i
}

// offsetToPosition converts a byte offset into an LSP Position (0-based line,
// UTF-16 code-unit column).
func offsetToPosition(text string, offset int) lspserver.LSPPosition {
  if offset < 0 {
    offset = 0
  }
  if offset > len(text) {
    offset = len(text)
  }
  line := 0
  lineStart := 0
  for i := 0; i < offset; {
    r, size := utf8.DecodeRuneInString(text[i:])
    if size == 0 {
      break
    }
    if r == '\n' {
      line++
      lineStart = i + size
    }
    i += size
  }
  character := 0
  for i := lineStart; i < offset; {
    r, size := utf8.DecodeRuneInString(text[i:])
    if size == 0 {
      break
    }
    if n := utf16.RuneLen(r); n > 0 {
      character += n
    } else {
      character++
    }
    i += size
  }
  return lspserver.LSPPosition{Line: line, Character: character}
}

// lspPositionToOffset converts an LSP Position (0-based line, UTF-16 column)
// into a byte offset. It returns (offset, false) when the position points past
// the end of the text so the caller can treat it as "no symbol here".
func lspPositionToOffset(text string, pos lspserver.LSPPosition) (int, bool) {
  if pos.Line < 0 || pos.Character < 0 {
    return 0, false
  }
  i := 0
  line := 0
  for line < pos.Line {
    if i >= len(text) {
      return len(text), false
    }
    r, size := utf8.DecodeRuneInString(text[i:])
    if size == 0 {
      return len(text), false
    }
    if r == '\r' {
      i += size
      if i < len(text) && text[i] == '\n' {
        i++
      }
      line++
      continue
    }
    if r == '\n' {
      i += size
      line++
      continue
    }
    i += size
  }
  units := 0
  for units < pos.Character {
    if i >= len(text) {
      return len(text), false
    }
    r, size := utf8.DecodeRuneInString(text[i:])
    if size == 0 {
      return len(text), false
    }
    if r == '\n' || r == '\r' {
      return i, false
    }
    n := utf16.RuneLen(r)
    if n <= 0 {
      n = 1
    }
    units += n
    i += size
  }
  return i, true
}
