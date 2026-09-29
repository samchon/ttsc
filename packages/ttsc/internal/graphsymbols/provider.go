// Package graphsymbols answers the two graph-oriented LSP methods
// (textDocument/documentSymbol and textDocument/references) from ttsc's
// compiler-backed code graph. It is the lspserver.SymbolProvider implementation
// ttscserver wires in so a raw-LSP graph consumer such as @samchon/graph can get
// declarations (graph nodes) and usages (graph edges) computed from that graph.
//
// tsgo's own LSP implements both methods with its compiler-exact language
// service, so the proxy forwards to tsgo by default and falls back to this
// provider only when tsgo does not advertise the capability, or when a consumer
// explicitly opts into graph-derived answers (see lspserver.Proxy).
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
  "strconv"
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
// cached until Invalidate is called. Queries use on-disk sources, not unsaved
// editor buffers; the proxy invalidates on source and project-state changes.
// It is safe for concurrent use. A request already holding an immutable
// snapshot may finish on it while the next request loads a replacement.
//
// @evidence contracts/common.md#principled-implementation The provider combines a compiler-backed graph, its source texts and the compiler filesystem's case policy in one snapshot; UTF-16 LSP positions are converted against those exact bytes.
// @evidence contracts/common.md#clear-and-simple-design The project anchor and mutex own snapshot publication. Private indexes answer graph queries without coupling the LSP wire types to mutable compiler objects.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The graph comes from the supported driver and checker rather than source-pattern inference or replaced language-server methods. This fallback explicitly answers from saved files, not an invented live-buffer snapshot.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain lazy loading, saved-source semantics, invalidation and concurrent snapshot ownership under the documentation skill's state and limitation guidance.
// @evidence contracts/portability.md#os-neutral-implementation Native project anchors remain separate from file URIs. Source identity uses the loaded compiler's case policy, not unconditional case folding or the host OS name.
// @evidenceExclude contracts/performance.md#efficient-algorithms The representation groups snapshot ownership; its load and query operations choose the processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The load operation authorizes sharing and invalidation; this type defines the state it protects.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Acquisition and snapshot replacement belong to load and Invalidate rather than this representation independently.
type Provider struct {
  // cwd anchors the compiler project independently of request URI spelling.
  cwd string

  // tsconfig selects the project rebuilt after invalidation.
  tsconfig string

  // mu protects short publication and invalidation transitions.
  mu sync.Mutex

  // buildMu permits one native compilation without blocking invalidation.
  buildMu sync.Mutex

  // loading identifies the flight authorized to publish the current generation.
  loading *providerLoad

  // loaded records either a published snapshot or a cached load failure.
  loaded bool

  // snapshot is the current immutable saved-project generation.
  snapshot *providerSnapshot

  // loadErr is retried after the same invalidation that revokes a snapshot.
  loadErr error
}

// providerLoad shares one generation's result. Closing done publishes its
// immutable result to waiters even when invalidation revoked global retention.
type providerLoad struct {
  done chan struct{}

  snapshot *providerSnapshot

  err error
}

// providerSnapshot keeps the compiler's source identities with the graph that
// resolved them. An in-flight request may finish on its snapshot after a later
// invalidation without observing half of the replacement state.
type providerSnapshot struct {
  graph *graph.Graph

  sources map[string]string

  caseSensitive bool

  files map[string]string

  nodesByFile map[string][]*graph.Node

  edgesByFile map[string][]*graph.Edge

  incoming map[string][]*graph.Edge
}

func (s *providerSnapshot) fileKey(path string) string {
  return shimtspath.GetCanonicalFileName(shimtspath.NormalizePath(path), s.caseSensitive)
}

func (s *providerSnapshot) fileFromURI(uri string) (string, bool) {
  path, ok := filePathFromURI(uri)
  if !ok {
    return "", false
  }
  file, ok := s.files[s.fileKey(shimtspath.ResolvePath(path))]
  return file, ok
}

// NewProvider returns a Provider that builds the graph for the project rooted at
// cwd using tsconfig (defaulting to "tsconfig.json").
// It acquires no compiler or file handle; the first query loads saved sources.
// The caller keeps the provider for one project and invalidates it when that
// project's source or configuration state changes.
//
// @evidence contracts/common.md#principled-implementation The constructor preserves the project anchor and selects the documented default only for a blank config selector; loading is deferred until a query needs compiler facts.
// @evidence contracts/common.md#clear-and-simple-design Construction initializes identity only. The shared load path owns compilation, errors and snapshot indexes for both query methods.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The default config name is the CLI contract; no consumer identity or expected graph affects it, and no foreign server is patched.
// @evidence contracts/common.md#meaningful-documentation Native prose states lazy acquisition, saved-source semantics and the caller's invalidation responsibility under the documentation skill's ownership guidance.
// @evidence contracts/portability.md#os-neutral-implementation cwd and tsconfig retain native path spelling for the driver to resolve; URI decoding and actual compiler case policy belong to the loaded snapshot.
// @evidence contracts/performance.md#efficient-algorithms Construction trims only the config selector and allocates one provider; it does not eagerly scan sources or build a graph no request needs.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The constructor creates one project owner; the common load operation coordinates its later requests.
// @evidence contracts/performance.md#bound-retention-and-release-resources The caller receives ownership of one provider with no open handle. Lazy snapshots live until invalidation or the last provider/request reference is dropped; no global history retains past projects.
func NewProvider(cwd, tsconfig string) *Provider {
  tsconfig = strings.TrimSpace(tsconfig)
  if tsconfig == "" {
    tsconfig = "tsconfig.json"
  }
  return &Provider{cwd: cwd, tsconfig: tsconfig}
}

// load shares one flight per invalidation generation. Native compilation runs
// outside the publication mutex so editor notifications can revoke a flight
// without waiting for parsing or graph construction. Revoked flights may answer
// their existing requests but cannot republish into the current generation.
func (pr *Provider) load() (*providerSnapshot, error) {
  pr.mu.Lock()
  if pr.loaded {
    snapshot, err := pr.snapshot, pr.loadErr
    pr.mu.Unlock()
    return snapshot, err
  }
  if pr.loading != nil {
    flight := pr.loading
    pr.mu.Unlock()
    <-flight.done
    return flight.snapshot, flight.err
  }
  flight := &providerLoad{done: make(chan struct{})}
  pr.loading = flight
  pr.mu.Unlock()

  snapshot, err := pr.buildSnapshot()
  pr.mu.Lock()
  flight.snapshot, flight.err = snapshot, err
  if pr.loading == flight {
    pr.snapshot, pr.loadErr = snapshot, err
    pr.loaded = true
    pr.loading = nil
  }
  close(flight.done)
  pr.mu.Unlock()
  return snapshot, err
}

// buildSnapshot serializes native acquisition separately from publication.
// Repeated invalidations can leave old callers waiting, but only one Program
// is built at a time and every acquired Program closes before this returns.
func (pr *Provider) buildSnapshot() (*providerSnapshot, error) {
  pr.buildMu.Lock()
  defer pr.buildMu.Unlock()

  cwd := pr.cwd
  if abs, err := filepath.Abs(cwd); err == nil {
    cwd = abs
  }
  cwd = shimtspath.ResolvePath(cwd)

  prog, _, err := driver.LoadProgram(cwd, pr.tsconfig, driver.LoadProgramOptions{})
  if err != nil {
    return nil, err
  }
  if prog == nil {
    return nil, fmt.Errorf("graphsymbols: could not load %s/%s", cwd, pr.tsconfig)
  }
  defer func() { _ = prog.Close() }()

  snapshot := &providerSnapshot{
    graph:         graph.Build(prog),
    sources:       graph.SourceTexts(prog),
    caseSensitive: prog.TSProgram.UseCaseSensitiveFileNames(),
    files:         map[string]string{},
    nodesByFile:   map[string][]*graph.Node{},
    edgesByFile:   map[string][]*graph.Edge{},
    incoming:      map[string][]*graph.Edge{},
  }
  for file := range snapshot.sources {
    snapshot.files[snapshot.fileKey(file)] = file
  }
  for _, node := range snapshot.graph.Nodes {
    if surfaceableNode(node) {
      key := snapshot.fileKey(node.File)
      snapshot.nodesByFile[key] = append(snapshot.nodesByFile[key], node)
    }
  }
  for _, edge := range snapshot.graph.Edges {
    file := edgeSourceFile(edge)
    if file != "" {
      key := snapshot.fileKey(file)
      snapshot.edgesByFile[key] = append(snapshot.edgesByFile[key], edge)
    }
    if !isStructuralEdge(edge.Kind) {
      snapshot.incoming[edge.To] = append(snapshot.incoming[edge.To], edge)
    }
  }
  return snapshot, nil
}

// Invalidate discards the cached graph so the next DocumentSymbols/References
// call rebuilds it against the current on-disk sources. The proxy calls this on
// didChange/didSave; without it the first request's snapshot would answer every
// later request for the process lifetime.
// Already-running requests retain their immutable snapshot until they return.
// This transition never waits for native compilation; a revoked flight may
// finish its existing requests but cannot publish over the replacement state.
//
// @evidence contracts/common.md#principled-implementation The same mutex that publishes a snapshot clears both it and a cached load error, so the next query rebuilds one coherent saved-project state.
// @evidence contracts/common.md#clear-and-simple-design One transition resets loaded state and snapshot ownership; each query uses a single captured snapshot rather than separately mutable graph and source fields.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Invalidation responds to the caller's actual project-state notifications; it does not fabricate fresh facts from a quiet watcher or suppress a retained load failure.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes future requests from in-flight readers and names the saved-source rebuild boundary under documentation-skill guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This state transition performs no filesystem, path comparison or process operation; load retains the native project boundary.
// @evidence contracts/performance.md#efficient-algorithms Resetting the owner clears a constant number of references without walking graph entries or copying retained source bytes.
// @evidence contracts/performance.md#reuse-equivalent-work Clearing loaded state, errors and the authorized flight revokes reuse for subsequent queries. Publication checks exact flight identity under the mutex, so a revoked load cannot overwrite newer state; its existing callers can still finish on its own result.
// @evidence contracts/performance.md#bound-retention-and-release-resources Old graph, source and index references are dropped together. In-flight requests may temporarily retain an older snapshot; reclamation occurs after those requests release their local references.
func (pr *Provider) Invalidate() {
  pr.mu.Lock()
  defer pr.mu.Unlock()
  pr.loaded = false
  pr.loading = nil
  pr.snapshot = nil
  pr.loadErr = nil
}

// DocumentSymbols returns the declarations in uri as a hierarchy: top-level
// declarations at the root, class/interface members nested under their owner.
// Unknown files return an empty list; project-load failures return an error.
// Declaration ranges also serve as selection ranges because the graph does
// not separately record identifier spans. The result uses saved UTF-8 source
// converted to LSP's negotiated UTF-16 coordinates.
//
// @evidence contracts/common.md#principled-implementation Compiler graph nodes are grouped by qualified owner, excluding file-module and external leaves. Strict owner prefixes terminate nesting; saved bytes supply valid UTF-16 ranges, with declaration spans used for selection as documented.
// @evidence contracts/common.md#clear-and-simple-design The method selects a snapshot and file, then delegates hierarchy and range construction to focused helpers. It does not reproduce compiler declaration discovery.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Actual graph declarations determine the outline; source strings are not searched for expected names and foreign LSP methods remain unchanged.
// @evidence contracts/common.md#meaningful-documentation Native prose specifies empty-file handling, load failure, saved-source coordinates and the selection-range limitation under the documentation skill's units and absence guidance.
// @evidence contracts/portability.md#os-neutral-implementation File URIs are decoded to native paths and looked up using the snapshot's compiler case policy. The provider preserves the compiler's identity decisions rather than claiming to measure every directory's native case capability independently.
// @evidence contracts/performance.md#efficient-algorithms Snapshot file/node indexes avoid scanning every project node per query. For N nodes in the selected file, hierarchy construction is O(N) plus sibling sorting bounded by O(N log N); one O(B) line index is shared across all ranges instead of rescanning B source bytes per node.
// @evidence contracts/performance.md#reuse-equivalent-work load shares one flight, graph, source set and indexes per invalidation generation, including a load error. Native builds are serialized separately from short publication/invalidation transitions; exact flight identity prevents revoked loads from republishing. Actual caller invalidation remains required on changed project state.
// @evidence contracts/performance.md#bound-retention-and-release-resources The provider retains its current snapshot and closes the acquired Program after graph extraction. Query-local hierarchy and line indexes transfer only rendered values to the caller; no per-query history is retained.
func (pr *Provider) DocumentSymbols(uri string) ([]lspserver.LSPDocumentSymbol, error) {
  snapshot, err := pr.load()
  if err != nil {
    return nil, err
  }
  file, ok := snapshot.fileFromURI(uri)
  if !ok {
    return []lspserver.LSPDocumentSymbol{}, nil
  }
  text := snapshot.sources[file]

  fileNodes := snapshot.nodesByFile[snapshot.fileKey(file)]
  return buildDocumentSymbols(fileNodes, text), nil
}

// References returns the usage locations of the symbol at pos in uri. When
// includeDeclaration is set the symbol's own declaration is added to the result.
// A covering usage expression takes precedence over its enclosing declaration
// body. Non-addressable files or positions return an empty list, and load
// failures return an error. Each edge retains its explicit source-file provenance
// when an assigned implementation lives outside the owning declaration's file.
//
// @evidence contracts/common.md#principled-implementation UTF-16 positions select the narrowest covering usage expression before a declaration. Incoming non-export edges provide uses, explicit edge files preserve assigned-implementation provenance, and exact URI/byte-span keys remove duplicate locations.
// @evidence contracts/common.md#clear-and-simple-design Snapshot indexes select the file, candidate symbol and incoming edges. One location builder owns source lookup, byte-to-UTF-16 conversion and deduplication for both uses and the optional declaration.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Checker-resolved edges supply target identity; neither the containing function nor a guessed textual match substitutes for a recorded usage. Structural exports are excluded because they are publication facts without use spans.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs describe cursor precedence, declaration inclusion, empty/error outcomes and cross-file edge provenance under documentation-skill guidance.
// @evidence contracts/portability.md#os-neutral-implementation URI resolution uses compiler case-aware snapshot keys. Locations preserve the actual recorded file and encode URI spelling separately from native filesystem identity.
// @evidence contracts/performance.md#efficient-algorithms File-local node and edge indexes restrict target search to that file, and the incoming index avoids rescanning all project edges. Each returned file's line starts are computed once per response; binary line lookup and UTF-16 conversion inspect only the relevant line prefix for each position.
// @evidence contracts/performance.md#reuse-equivalent-work Both query methods share the mutex-published graph and its source/index generation until invalidation. Within a response, immutable source text authorizes sharing each file's line index across all its locations.
// @evidence contracts/performance.md#bound-retention-and-release-resources The current provider snapshot owns O(nodes + edges + source bytes) retained data and drops it on invalidation. Request-local deduplication, ranges and line indexes grow with returned uses/files and become reclaimable when the response completes.
func (pr *Provider) References(uri string, pos lspserver.LSPPosition, includeDeclaration bool) ([]lspserver.LSPLocation, error) {
  snapshot, err := pr.load()
  if err != nil {
    return nil, err
  }
  file, ok := snapshot.fileFromURI(uri)
  if !ok {
    return []lspserver.LSPLocation{}, nil
  }
  text := snapshot.sources[file]
  offset, ok := lspPositionToOffset(text, pos)
  if !ok {
    return []lspserver.LSPLocation{}, nil
  }
  target := targetNodeAt(snapshot, file, offset)
  if target == nil {
    return []lspserver.LSPLocation{}, nil
  }

  locations := []lspserver.LSPLocation{}
  seen := map[string]struct{}{}
  lineStarts := map[string][]int{}
  add := func(f string, start, end int) {
    t, ok := snapshot.sources[f]
    if !ok {
      return
    }
    if end < start {
      end = start
    }
    starts := lineStarts[f]
    if starts == nil {
      starts = graph.ECMALineStarts(t)
      lineStarts[f] = starts
    }
    loc := lspserver.LSPLocation{
      URI: uriFromFile(f),
      Range: lspserver.LSPRange{
        Start: offsetToPositionAt(t, starts, start),
        End:   offsetToPositionAt(t, starts, end),
      },
    }
    key := fmt.Sprintf("%s:%d:%d", loc.URI, start, end)
    if _, dup := seen[key]; dup {
      return
    }
    seen[key] = struct{}{}
    locations = append(locations, loc)
  }

  // Edges point from a using declaration to the referenced symbol. Assigned
  // implementations may carry an explicit File different from that declaration.
  //
  // A structural edge is not a usage. A module's `exports` edge says the symbol
  // stands on that module's public surface — a fact about the declaration, not a
  // place it is used — and it carries no span, so counting it as a usage puts a
  // phantom reference at the top of the file.
  for _, e := range snapshot.incoming[target.ID] {
    f := edgeSourceFile(e)
    if f == "" {
      continue
    }
    add(f, e.Pos, e.End)
  }
  if includeDeclaration {
    declText := snapshot.sources[target.File]
    add(target.File, graph.FirstCodeOffset(declText, target.Pos), target.End)
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
  starts := graph.ECMALineStarts(text)
  out := make([]lspserver.LSPDocumentSymbol, 0, len(roots))
  for _, r := range roots {
    out = append(out, buildSymbol(r, childrenOf, text, starts))
  }
  return out
}

// buildSymbol materializes one node (and, recursively, the nodes owned by it)
// as an LSPDocumentSymbol. The owner relation is a strict name-prefix, so the
// recursion terminates (no cycles).
func buildSymbol(n *graph.Node, childrenOf map[string][]*graph.Node, text string, starts []int) lspserver.LSPDocumentSymbol {
  sym := nodeToSymbol(n, text, starts)
  kids := childrenOf[n.Name]
  sortNodes(kids)
  for _, k := range kids {
    sym.Children = append(sym.Children, buildSymbol(k, childrenOf, text, starts))
  }
  return sym
}

func nodeToSymbol(n *graph.Node, text string, starts []int) lspserver.LSPDocumentSymbol {
  start := graph.FirstCodeOffset(text, n.Pos)
  end := n.End
  if end < start {
    end = start
  }
  rng := lspserver.LSPRange{
    Start: offsetToPositionAt(text, starts, start),
    End:   offsetToPositionAt(text, starts, end),
  }
  // A quoted member can have an empty or whitespace-only semantic name. Keep
  // that graph identity, but quote its display label because LSP symbol names
  // must contain a visible character.
  name := n.Simple
  if strings.TrimSpace(name) == "" {
    name = strconv.Quote(name)
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
  if (n.Simple == "" && !n.HasSimple) || n.Name == n.Simple {
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

// targetNodeAt prefers the narrowest usage expression at the cursor, then the
// narrowest declaration. Declaration spans include bodies, so selecting them
// first would resolve every call in a function body to the containing function.
func targetNodeAt(snapshot *providerSnapshot, file string, offset int) *graph.Node {
  key := snapshot.fileKey(file)
  var usage *graph.Edge
  for _, edge := range snapshot.edgesByFile[key] {
    if isStructuralEdge(edge.Kind) || offset < edge.Pos || offset >= edge.End {
      continue
    }
    if snapshot.graph.Nodes[edge.To] == nil {
      continue
    }
    if usage == nil || edge.End-edge.Pos < usage.End-usage.Pos {
      usage = edge
    }
  }
  if usage != nil {
    return snapshot.graph.Nodes[usage.To]
  }
  var best *graph.Node
  for _, n := range snapshot.nodesByFile[key] {
    if offset >= n.Pos && offset < n.End {
      if best == nil || (n.End-n.Pos) < (best.End-best.Pos) {
        best = n
      }
    }
  }
  return best
}

// edgeSourceFile respects the graph's assigned-implementation provenance.
func edgeSourceFile(edge *graph.Edge) string {
  if edge.File != "" {
    return edge.File
  }
  return graph.NodeFile(edge.From)
}

// isStructuralEdge reports an edge that records where a symbol stands rather than
// a place it is used.
func isStructuralEdge(kind graph.EdgeKind) bool {
  return kind == graph.EdgeExports
}

// surfaceableNode reports whether a graph node should appear as a user-facing
// LSP outline entry or declaration fallback. A per-file module node (NodeModule) carries
// the source file path as its name and spans the whole file, so surfacing it
// would put the absolute path in the outline and swallow whole-file reference
// queries. External boundary leaves and nodes without a recorded member name
// are likewise omitted from declaration candidates. A recorded usage edge can
// still identify an external reference target. HasSimple preserves valid empty
// string names rather than treating them as absence.
func surfaceableNode(n *graph.Node) bool {
  return !n.External && n.Kind != graph.NodeModule && (n.Simple != "" || n.HasSimple)
}

func sortNodes(nodes []*graph.Node) {
  sort.Slice(nodes, func(i, j int) bool {
    if nodes[i].Pos != nodes[j].Pos {
      return nodes[i].Pos < nodes[j].Pos
    }
    return nodes[i].Name < nodes[j].Name
  })
}

// filePathFromURI decodes a file:// uri to an absolute OS path. It mirrors the
// proxy's own unexported converter so this package stays self-contained.
func filePathFromURI(raw string) (string, bool) {
  parsed, err := url.Parse(raw)
  if err != nil || parsed.Scheme != "file" {
    return "", false
  }
  path := parsed.Path
  // RFC 8089 gives localhost the same local meaning as an absent authority.
  if parsed.Host != "" && !strings.EqualFold(parsed.Host, "localhost") {
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

// offsetToPosition converts a byte offset into an LSP Position (0-based line,
// UTF-16 code-unit column). The column unit is the session's negotiated
// PositionEncodingKind, which the proxy's constrainInitializePositionEncoding
// pins to UTF-16 for every ttscserver session.
func offsetToPosition(text string, offset int) lspserver.LSPPosition {
  return offsetToPositionAt(text, graph.ECMALineStarts(text), offset)
}

// offsetToPositionAt shares a source's line index across all ranges in a
// response. The index and text must come from the same immutable snapshot.
func offsetToPositionAt(text string, starts []int, offset int) lspserver.LSPPosition {
  if offset < 0 {
    offset = 0
  }
  if offset > len(text) {
    offset = len(text)
  }
  line := sort.Search(len(starts), func(i int) bool { return starts[i] > offset }) - 1
  if line < 0 {
    line = 0
  }
  lineStart := starts[line]
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

// lspPositionToOffset converts an LSP Position (0-based line, UTF-16 column —
// the encoding the proxy's constrainInitializePositionEncoding pins for every
// ttscserver session) into a byte offset. It returns (offset, false) when the
// position points past the end of the text so the caller can treat it as "no
// symbol here".
func lspPositionToOffset(text string, pos lspserver.LSPPosition) (int, bool) {
  if pos.Line < 0 || pos.Character < 0 {
    return 0, false
  }
  starts := graph.ECMALineStarts(text)
  if pos.Line >= len(starts) {
    return len(text), false
  }
  i := starts[pos.Line]
  lineEnd := graph.LineEnd(text, starts, pos.Line)
  units := 0
  for units < pos.Character {
    if i >= lineEnd {
      return len(text), false
    }
    r, size := utf8.DecodeRuneInString(text[i:])
    if size == 0 {
      return len(text), false
    }
    n := utf16.RuneLen(r)
    if n <= 0 {
      n = 1
    }
    if units+n > pos.Character {
      return i, false
    }
    units += n
    i += size
  }
  return i, true
}
