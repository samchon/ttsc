package main

import (
  "bufio"
  "crypto/sha256"
  "encoding/json"
  "errors"
  "flag"
  "fmt"
  "io"
  "os"
  "path/filepath"
  "runtime"
  "slices"
  "sort"
  "strings"
  "time"

  shimtsoptions "github.com/microsoft/typescript-go/shim/tsoptions"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph"
)

// serveProtocolVersion is the version of the newline-delimited serve envelope.
// It moves when a field is added, removed, or given a new meaning.
//
// Every response carries it, rather than a handshake establishing it once. The
// binary and the npm package version independently — @ttsc/graph resolves
// whichever ttscgraph the target project installed — so a mismatched pair is
// reachable, and a per-response version lets the client fail fast on the first
// frame it reads without spending a round-trip to learn the version it is about
// to be told anyway. It also keeps the protocol stateless: a response is
// self-describing even when read from a log.
const serveProtocolVersion = 1

// serveModes are the computation modes Snapshot can report, plus the error mode
// the transport adds. A consumer branches on these to report honestly what the
// producer did rather than inferring it from a generation counter.
const (
  // serveModeInitial is the first snapshot of a session.
  serveModeInitial = "initial"
  // serveModeReload is a full program reload: the build universe moved.
  serveModeReload = "reload"
  // serveModeUnchanged is no change since the last snapshot; no dump rides it.
  serveModeUnchanged = "unchanged"
  // serveModeIncremental is edits applied onto the reused resident program.
  serveModeIncremental = "incremental"
  // serveModeRebuild is edits applied but graph projection requires a complete
  // rebuild, either because the program could not be reused or because a
  // declaration-file boundary has no authored source shard of its own.
  serveModeRebuild = "rebuild"
  // serveModeError is a request that produced no snapshot. It is a transport
  // mode, not a computation mode: it exists so mode is never absent, because a
  // field that disappears on the error path cannot be relied on.
  serveModeError = "error"
)

// fullSnapshotCapabilities is what a snapshot from a resident compiler session
// proves. Both commands that own a real Program declare every one of them; the
// constant exists so the envelope's claim and the dump's claim cannot drift
// apart.
var fullSnapshotCapabilities = []string{
  graph.CapabilityUniverse,
  graph.CapabilitySourceDigests,
  graph.CapabilityDiskDigests,
  graph.CapabilityDiagnostics,
  graph.CapabilityDocTags,
}

// serveCapabilities is what this server can prove before a session exists —
// the frame a client reads when the project could not even be loaded. Once a
// session exists its own capabilities answer, because those depend on what a
// plugin published and this list cannot know it.
var serveCapabilities = fullSnapshotCapabilities

// capabilities is what THIS session proves, which is the shared list plus the
// artifact claim when a plugin published one.
//
// The claim has to be conditional for the same reason it is on the dump command:
// a project that publishes no artifacts and a session that was never handed any
// are the same absent nodes, and only the claim separates them.
func (s *graphSession) capabilities() []string {
  if len(s.artifacts) == 0 {
    return fullSnapshotCapabilities
  }
  return append(
    append([]string{}, fullSnapshotCapabilities...),
    graph.CapabilityArtifactNodes,
  )
}

// artifactProducer names the second producer behind this session's artifact
// nodes, and is nil when it has none.
// provenance is this session's published origin for one generation.
func (s *graphSession) provenance(texts map[string]string) graph.Provenance {
  built := graph.NewProvenance(
    serveProducer(),
    s.capabilities(),
    s.configDigests,
    s.roots,
    texts,
    s.diskDigests,
  )
  built.ArtifactProducer = s.artifactProducer()
  return built
}

func (s *graphSession) artifactProducer() *graph.Producer {
  if len(s.artifacts) == 0 {
    return nil
  }
  return &graph.Producer{Tool: "@ttsc/lint graph-nodes"}
}

type serveRequest struct {
  ID int `json:"id"`
  // GraphSnapshotVersion opts into the incremental shard protocol. Omitted
  // requests retain the full-dump response for existing @ttsc/graph clients.
  GraphSnapshotVersion int `json:"graphSnapshotVersion,omitempty"`
  // Artifacts is the path to the set a plugin published for this request, which
  // the client re-derives when the documents or lint configuration behind it
  // moved. It rides every request rather than only the changed ones: the client
  // is the only side that can see those inputs, and the server is the only side
  // that knows what it last applied, so the honest exchange is the client
  // stating what it currently has and the server comparing it with its own.
  //
  // Three states, which is why it is a pointer. Absent is a client with no
  // opinion — one predating this field, or one driving a session through the
  // startup flag — and the set already applied stands. Empty is a client
  // stating it now has none, which withdraws that set: a project whose
  // publisher was removed must stop being answered with its artifacts, and
  // without a way to say so it would be answered with them until the editor
  // restarted. A path is the set to apply.
  Artifacts *string `json:"artifacts,omitempty"`
}

type serveResponse struct {
  Dump     *graph.Dump         `json:"dump,omitempty"`
  Snapshot *serveGraphSnapshot `json:"snapshot,omitempty"`
  // Error is set when the request produced no snapshot; Mode is then
  // serveModeError.
  Error string `json:"error,omitempty"`
  ID    int    `json:"id"`
  // ProtocolVersion is serveProtocolVersion on every response, including error
  // responses: a client that cannot parse the rest still learns why.
  ProtocolVersion int `json:"protocolVersion"`
  // Mode is always present. It was omitempty, which meant the one field that
  // distinguishes a reuse from a full rebuild silently vanished exactly when a
  // consumer most wanted to report what happened.
  Mode         string   `json:"mode"`
  Capabilities []string `json:"capabilities"`
  Changed      bool     `json:"changed"`
}

const graphPhaseTraceEnvironment = "SAMCHON_GRAPH_TTSC_PHASE_TRACE"

// newServeResponse stamps the fields every response owes the client, so no exit
// from the serve loop can forget one.
func newServeResponse(id int) serveResponse {
  return serveResponse{
    ID:              id,
    ProtocolVersion: serveProtocolVersion,
    Capabilities:    serveCapabilities,
  }
}

// errorResponse is a response that carries no snapshot.
func errorResponse(id int, message string) serveResponse {
  response := newServeResponse(id)
  response.Mode = serveModeError
  response.Error = message
  return response
}

type graphSession struct {
  cwd      string
  tsconfig string
  // artifacts is the set a plugin published: a second producer's facts about
  // documents this Program never read. Refreshing it is therefore not a refresh
  // of the graph — editing a Markdown heading moves the artifact and not one
  // compiler fact — so the two invalidations stay separate questions, and this
  // one is answered by adoptArtifacts rather than by the build universe.
  artifacts []graph.Artifact
  // artifactsDigest is the content of the set currently applied. Content, and
  // not the path or its modification time: the client overwrites one file per
  // process and project, so the path never moves for a given session, and a
  // republish triggered by a document whose headings did not actually change
  // writes the same bytes and must therefore cost nothing.
  artifactsDigest [sha256.Size]byte
  // artifactsFile and artifactsStat are what the digest was taken from, kept so
  // an unchanged file need not be read at all. The set is one entry per
  // document section, model field, and operation, so it is bounded by the
  // project's documentation rather than by anything small — and this comparison
  // runs before every graph request, where reading and hashing that whole file
  // to learn it did not move is the kind of cost a resident session pays
  // forever.
  artifactsFile string
  artifactsStat artifactsFileState

  compiler     *driver.Session
  configHashes map[string][sha256.Size]byte
  auxStates    map[string]diskState
  sourceHashes map[string][sha256.Size]byte
  rootFiles    []string
  // diskDigests is the published disk evidence for the current generation, kept
  // beside sourceHashes because the two answer different questions: one decides
  // whether to invalidate, the other is what the snapshot tells a consumer.
  diskDigests map[string]string
  // configDigests and roots are the build-universe fingerprint for the current
  // generation, captured from the same parse that produced configHashes and
  // rootFiles so the published evidence and the invalidation state can never
  // describe different loads.
  configDigests           []graph.FileDigest
  roots                   []graph.RootFile
  initialized             bool
  graphStore              *serveGraphStore
  requestProtocol         int
  requestProtocolSelected bool
  // pending remembers work the next request owes regardless of what the build
  // universe says: a generation whose state was captured but whose selected
  // projection failed, or an artifact set adopted after the graph carrying the
  // previous one was built. Until it is discharged, an otherwise unchanged
  // request retries the recorded invalidation instead of falsely confirming the
  // older client graph.
  pending *graphChange
}

func newGraphSession(cwd, tsconfig string) (*graphSession, error) {
  return newGraphSessionWithArtifacts(cwd, tsconfig, nil)
}

// newGraphSessionWithArtifacts is the constructor the serve command uses, and
// the plain one above is it with nothing published. The artifacts are read once
// and held for the session: they are a second producer's facts about documents
// this Program never read, so refreshing them is a different question from
// refreshing the graph, and only the first answer is wired today.
func newGraphSessionWithArtifacts(
  cwd, tsconfig string,
  artifacts []graph.Artifact,
) (*graphSession, error) {
  session := &graphSession{cwd: cwd, tsconfig: tsconfig, artifacts: artifacts}
  if err := session.reload(); err != nil {
    return nil, err
  }
  return session, nil
}

// adoptArtifacts makes what the request states the set this session applies,
// and reports whether that replaced a set some already-built graph carries.
//
// A nil statement is a client with no opinion, and the set already applied
// stands: dropping it on the say-so of a client that never mentioned artifacts
// would delete them from the graph of every session driven through the startup
// flag alone.
//
// A read failure is returned rather than swallowed. The client wrote this file
// moments ago and named it in the same request, so a file that cannot be read
// is a broken exchange, not a project without artifacts — and answering with a
// silently artifact-free graph would look exactly like a correct answer.
func (s *graphSession) adoptArtifacts(named *string) (bool, error) {
  if named == nil {
    return false, nil
  }
  path := strings.TrimSpace(*named)
  if path == "" {
    return s.applyArtifacts(nil, withdrawnArtifactsDigest), nil
  }
  stat, err := os.Stat(path)
  if err != nil {
    return false, err
  }
  state := artifactsFileState{size: stat.Size(), modTime: stat.ModTime().UnixNano()}
  if path == s.artifactsFile && state == s.artifactsStat {
    return false, nil
  }
  // One read, hashed and decoded from the same bytes. Reading twice would let
  // an overwrite land between them and leave this session recording an identity
  // for a set it is not holding — after which a later request naming the file
  // it recorded would be answered as unchanged.
  contents, err := os.ReadFile(path)
  if err != nil {
    return false, err
  }
  next, err := graph.ParseArtifacts(contents)
  if err != nil {
    return false, err
  }
  s.artifactsFile = path
  s.artifactsStat = state
  return s.applyArtifacts(next, sha256.Sum256(contents)), nil
}

// artifactsFileState is what an unchanged published file looks like from the
// outside: size and modification time, never contents. It exists only to decide
// whether the file is worth reading, and the digest taken from those contents is
// still what decides whether the set is worth applying.
type artifactsFileState struct {
  size int64
  // modTime is nanoseconds since the epoch rather than a time.Time, so the
  // struct compares with == and means it. A time.Time carries a location
  // pointer and an optional monotonic reading, and comparing two of those with
  // == is a well-known way to get a false inequality that reads as a changed
  // file forever.
  modTime int64
}

// applyArtifacts installs a set and reports whether it differs from the applied
// one. The first application of a session reports a change like any other and
// costs nothing: no graph has been projected yet, so the invalidation it
// records is discharged by the initial projection that was going to happen
// regardless.
func (s *graphSession) applyArtifacts(next []graph.Artifact, digest [sha256.Size]byte) bool {
  if digest == s.artifactsDigest {
    return false
  }
  s.artifacts = next
  s.artifactsDigest = digest
  return true
}

// withdrawnArtifactsDigest stands for "the client states it has none".
//
// A constant rather than the hash of an empty file, so that the withdrawn state
// and a file whose contents happen to hash to the same value cannot be confused
// — and domain-separated so it is not the digest of anything a producer writes.
var withdrawnArtifactsDigest = sha256.Sum256([]byte("ttscgraph:artifacts:none"))

// invalidateArtifacts records that the next projection must be a full one.
//
// Full, because replacing the published set is not a per-file delta: it moves
// the artifact nodes and every citation edge into them at once, and the
// incremental path is built to answer a different question — which sources
// changed. It happens to reach the same answer here, through the closure
// expansion that pulls a citing source back in, but that is a property of
// machinery aimed elsewhere and not a guarantee this depends on.
//
// Full, but not a reload: the Program is reused untouched, because no compiler
// input moved. That is the whole point of keeping documents out of the build
// universe — a Markdown edit costs one projection, never one typecheck.
func (s *graphSession) invalidateArtifacts() {
  if s.pending != nil && s.pending.full {
    return
  }
  s.pending = &graphChange{mode: serveModeRebuild, full: true}
}

func (s *graphSession) Close() error {
  if s.compiler == nil {
    return nil
  }
  return s.compiler.Close()
}

func (s *graphSession) Snapshot() (*graph.Dump, string, bool, error) {
  change, err := s.nextChange(false)
  if err != nil {
    return nil, "", false, err
  }
  if change == nil {
    return nil, serveModeUnchanged, false, nil
  }
  dump, err := s.buildDump()
  if err != nil {
    s.pending = change
    return nil, "", false, err
  }
  s.pending = nil
  return &dump, change.mode, true, nil
}

type graphChange struct {
  mode        string
  files       []string
  publicFiles []string
  full        bool
}

// nextChange advances only the resident compiler and its captured input state.
// Projection is deliberately outside this method so the legacy full-dump and
// incremental shard protocols share exactly one invalidation decision without
// forcing either representation onto the other.
func (s *graphSession) nextChange(trackPublicShape bool) (*graphChange, error) {
  if !s.initialized {
    // The captured compiler state is initialized even when its first dump is
    // not publishable. Mark the attempt before building so a later request can
    // observe a config/source edit that repairs the path error instead of
    // retrying the stale Program forever.
    s.initialized = true
    return &graphChange{mode: serveModeInitial, full: true}, nil
  }

  configChanged, err := hashesChanged(s.configHashes)
  if err != nil {
    return nil, err
  }
  if configChanged {
    if err := s.reload(); err != nil {
      return nil, err
    }
    return &graphChange{mode: serveModeReload, full: true}, nil
  }

  if diskStatesChanged(s.auxStates) {
    if err := s.reload(); err != nil {
      return nil, err
    }
    return &graphChange{mode: serveModeReload, full: true}, nil
  }

  roots, err := projectRootFiles(s.compiler.Program(), true)
  if err != nil {
    return nil, err
  }
  if !slices.Equal(s.rootFiles, roots) {
    if err := s.reload(); err != nil {
      return nil, err
    }
    return &graphChange{mode: serveModeReload, full: true}, nil
  }

  changed, deleted, err := changedSources(s.sourceHashes)
  if err != nil {
    return nil, err
  }
  if deleted {
    if err := s.reload(); err != nil {
      return nil, err
    }
    return &graphChange{mode: serveModeReload, full: true}, nil
  }
  if len(changed) == 0 {
    if s.pending != nil {
      return s.pending, nil
    }
    return nil, nil
  }
  if s.compiler.Program().HasLinkedProgramPlugins() {
    if err := s.reload(); err != nil {
      return nil, err
    }
    return &graphChange{mode: serveModeReload, full: true}, nil
  }

  mode := serveModeIncremental
  full := false
  paths := make([]string, 0, len(changed))
  for path := range changed {
    paths = append(paths, path)
  }
  sort.Strings(paths)
  oldShapes := make(map[string]string, len(paths))
  for _, path := range paths {
    source := s.compiler.Program().SourceFile(path)
    if source == nil {
      if err := s.reload(); err != nil {
        return nil, err
      }
      return &graphChange{mode: serveModeReload, full: true}, nil
    }
    if source.IsDeclarationFile {
      mode = serveModeRebuild
      full = true
      continue
    }
    if trackPublicShape {
      shape, err := s.compiler.Program().DeclarationShapeDigest(source)
      if err != nil {
        return nil, err
      }
      oldShapes[path] = shape
    }
  }
  for _, path := range paths {
    if reused := s.compiler.Apply(path, changed[path]); !reused {
      mode = serveModeRebuild
      full = true
    }
    current, exists := s.compiler.SourceText(path)
    expected := driver.ApplySourcePreambleToFile(path, changed[path], s.compiler.Program().SourcePreamble)
    if !exists || current != expected {
      if err := s.reload(); err != nil {
        return nil, err
      }
      return &graphChange{mode: serveModeReload, full: true}, nil
    }
    source := s.compiler.Program().SourceFile(path)
    if source == nil {
      if err := s.reload(); err != nil {
        return nil, err
      }
      return &graphChange{mode: serveModeReload, full: true}, nil
    }
    if source.IsDeclarationFile {
      mode = serveModeRebuild
      full = true
    }
  }
  if err := s.captureState(); err != nil {
    // The compiler already accepted the edit. Preserve a full retry marker so
    // a transient hashing/input failure cannot make the next request compare
    // public shape against the uncommitted compiler generation and publish an
    // incomplete closure.
    s.pending = &graphChange{mode: serveModeRebuild, full: true}
    return nil, err
  }
  publicFiles := []string{}
  if trackPublicShape && !full {
    for _, path := range paths {
      source := s.compiler.Program().SourceFile(path)
      if source == nil {
        return &graphChange{mode: serveModeRebuild, full: true}, nil
      }
      shape, err := s.compiler.Program().DeclarationShapeDigest(source)
      if err != nil {
        mode = serveModeRebuild
        full = true
        publicFiles = nil
        break
      }
      if shape != oldShapes[path] {
        publicFiles = append(publicFiles, path)
      }
    }
  }
  if s.pending != nil {
    if s.pending.full {
      mode = s.pending.mode
      full = true
      paths = nil
    } else if !full {
      paths = compactSortedStrings(append(paths, s.pending.files...))
      publicFiles = compactSortedStrings(append(publicFiles, s.pending.publicFiles...))
    }
  }
  return &graphChange{mode: mode, files: paths, publicFiles: publicFiles, full: full}, nil
}

func (s *graphSession) reload() error {
  next, diags, err := driver.NewSession(s.cwd, s.tsconfig, driver.LoadProgramOptions{})
  if err != nil {
    return err
  }
  if next == nil {
    if len(diags) == 0 {
      return errors.New("ttscgraph: compiler session was not created")
    }
    return invalidProjectError(diags)
  }
  previous := s.compiler
  s.compiler = next
  if err := s.captureState(); err != nil {
    _ = next.Close()
    s.compiler = previous
    return err
  }
  if previous != nil {
    _ = previous.Close()
  }
  return nil
}

func (s *graphSession) captureState() error {
  program := s.compiler.Program()
  configs, err := parsedConfigs(program)
  if err != nil {
    return err
  }
  configHashes, err := hashFiles(configFiles(configs))
  if err != nil {
    return err
  }
  sourceHashes, diskDigests, err := hashProgramSources(program)
  if err != nil {
    return err
  }
  inputs := auxiliaryInputs(program, s.cwd)
  for _, path := range missingRootInputs(configs, sourceHashes) {
    inputs = append(inputs, auxiliaryInput{path: path})
  }
  s.configHashes = configHashes
  s.auxStates = captureDiskStates(compactAuxiliaryInputs(inputs))
  s.sourceHashes = sourceHashes
  s.diskDigests = diskDigests
  s.rootFiles = projectRootFilesFromConfigs(configs, false)
  s.configDigests = fileDigests(configHashes)
  s.roots = rootFileEntries(s.rootFiles)
  return nil
}

// fileDigests projects a path-to-hash map onto the wire's file/digest pairs.
func fileDigests(hashes map[string][sha256.Size]byte) []graph.FileDigest {
  out := make([]graph.FileDigest, 0, len(hashes))
  for path, hash := range hashes {
    out = append(out, graph.FileDigest{File: path, Digest: graph.Digest(hash)})
  }
  return out
}

// rootFileEntries splits the internal config\x00file root encoding back into the
// pair it stands for. The joined form exists only so the root set compares with
// slices.Equal; it is not a shape to publish.
func rootFileEntries(roots []string) []graph.RootFile {
  out := make([]graph.RootFile, 0, len(roots))
  for _, root := range roots {
    config, file, found := strings.Cut(root, "\x00")
    if !found {
      continue
    }
    out = append(out, graph.RootFile{Config: config, File: file})
  }
  return out
}

// missingRootInputs returns config root files absent from the loaded program.
// A literal `files` entry keeps its name whether or not the file exists, so
// neither the root-set comparison nor source hashing notices when such a root
// is created later; tracking the missing path as a freshness input does.
func missingRootInputs(configs []*shimtsoptions.ParsedCommandLine, sourceHashes map[string][sha256.Size]byte) []string {
  missing := []string{}
  for _, parsed := range configs {
    for _, file := range parsed.FileNames() {
      if _, tracked := sourceHashes[file]; !tracked {
        missing = append(missing, file)
      }
    }
  }
  return missing
}

func (s *graphSession) buildDump() (graph.Dump, error) {
  program := s.compiler.Program()
  built := graph.Build(program)
  graph.ApplyArtifacts(built, s.artifacts)
  // One texts map feeds both the spans and the manifest digests, so the bytes a
  // span points into are provably the bytes the manifest attests to.
  texts := graph.SourceTexts(program)
  return graph.NewDump(
    built,
    s.cwd,
    s.tsconfig,
    graph.GitIgnoredFiles(s.cwd, built),
    texts,
    graph.DumpOrigin{
      Provenance:  s.provenance(texts),
      Diagnostics: graph.NewDiagnostics(program),
    },
  )
}

// serveProducer names this binary and the checker it links.
func serveProducer() graph.Producer {
  return graph.Producer{
    Tool:       "ttscgraph",
    Version:    version,
    Typescript: graph.TypescriptVersion(),
  }
}

func configFiles(configs []*shimtsoptions.ParsedCommandLine) []string {
  files := []string{}
  for _, parsed := range configs {
    files = append(files, parsed.ConfigName())
    files = append(files, parsed.ExtendedSourceFiles()...)
  }
  return compactSortedStrings(files)
}

func projectRootFiles(program *driver.Program, reload bool) ([]string, error) {
  configs, err := parsedConfigs(program)
  if err != nil {
    return nil, err
  }
  return projectRootFilesFromConfigs(configs, reload), nil
}

func projectRootFilesFromConfigs(configs []*shimtsoptions.ParsedCommandLine, reload bool) []string {
  roots := []string{}
  for _, parsed := range configs {
    current := parsed
    if reload {
      current = parsed.ReloadFileNamesOfParsedCommandLine(driver.DefaultFS())
    }
    config := current.ConfigName()
    for _, file := range current.FileNames() {
      roots = append(roots, config+"\x00"+file)
    }
  }
  return compactSortedStrings(roots)
}

func parsedConfigs(program *driver.Program) ([]*shimtsoptions.ParsedCommandLine, error) {
  if program == nil || program.ParsedConfig == nil {
    return nil, errors.New("ttscgraph: compiler program omitted its parsed config")
  }
  resolved := make(map[string]*shimtsoptions.ParsedCommandLine)
  for _, parsed := range program.TSProgram.GetResolvedProjectReferences() {
    if parsed != nil {
      resolved[shimtspath.ResolvePath(parsed.ConfigName())] = parsed
    }
  }
  configs := []*shimtsoptions.ParsedCommandLine{}
  pending := []*shimtsoptions.ParsedCommandLine{program.ParsedConfig}
  seen := make(map[string]struct{})
  for len(pending) > 0 {
    parsed := pending[0]
    pending = pending[1:]
    config := shimtspath.ResolvePath(parsed.ConfigName())
    if _, exists := seen[config]; exists {
      continue
    }
    seen[config] = struct{}{}
    configs = append(configs, parsed)
    for _, reference := range parsed.ResolvedProjectReferencePaths() {
      reference = shimtspath.ResolvePath(reference)
      child := resolved[reference]
      if child == nil {
        fs := program.FS
        cwd := filepath.Dir(reference)
        var diags []driver.Diagnostic
        var err error
        child, diags, err = driver.ParseTSConfig(fs, cwd, reference, driver.DefaultHost(cwd, fs), nil)
        if err != nil {
          return nil, err
        }
        if child == nil {
          if len(diags) == 0 {
            return nil, fmt.Errorf("ttscgraph: project reference was not parsed: %s", reference)
          }
          return nil, invalidProjectError(diags)
        }
        resolved[reference] = child
      }
      pending = append(pending, child)
    }
  }
  return configs, nil
}

func invalidProjectError(diags []driver.Diagnostic) error {
  messages := make([]string, len(diags))
  for i, diag := range diags {
    messages[i] = diag.String()
  }
  return fmt.Errorf("ttscgraph: invalid project: %s", strings.Join(messages, "; "))
}

// hashProgramSources returns two maps keyed by absolute source path.
//
// The first is the invalidation state: the hash the next snapshot compares
// against to decide whether a file moved. It is deliberately not always the
// file's disk hash — a file that raced the load is recorded under its resident
// text so the comparison is guaranteed to miss and force a revisit.
//
// The second is the source manifest's disk evidence: the hex digest of the bytes
// actually read from disk, present only when the read succeeded. These are
// separate values because the first is a sentinel chosen to control the next
// comparison and the second is a fact published to a consumer. Publishing the
// sentinel would tell a consumer that a file it is about to read hashes to
// something it can never reproduce.
func hashProgramSources(program *driver.Program) (map[string][sha256.Size]byte, map[string]string, error) {
  hashes := make(map[string][sha256.Size]byte)
  digests := make(map[string]string)
  for _, source := range program.TSProgram.SourceFiles() {
    // Virtual sources (tsgo's `bundled:///` libs) have no on-disk identity;
    // real project files always carry an absolute path.
    if source == nil || !filepath.IsAbs(source.FileName()) {
      continue
    }
    info, err := os.Stat(source.FileName())
    if err != nil {
      if errors.Is(err, os.ErrNotExist) {
        // The file vanished while the compiler session was loading. Hash the
        // resident text so the next snapshot revisits the path, observes the
        // deletion, and reloads instead of serving the vanished file forever.
        hashes[source.FileName()] = sha256.Sum256([]byte(source.Text()))
      }
      continue
    }
    if info.IsDir() {
      continue
    }
    content, err := os.ReadFile(source.FileName())
    if err != nil {
      return nil, nil, fmt.Errorf("ttscgraph: read %s: %w", source.FileName(), err)
    }
    rawHash := sha256.Sum256(content)
    // The bytes were read, so their digest is a fact regardless of whether they
    // match what the checker holds. When they do not, the manifest's text and
    // disk digests disagree, which is precisely what a consumer needs to see.
    digests[source.FileName()] = graph.Digest(rawHash)
    expected := driver.ApplySourcePreambleToFile(source.FileName(), string(content), program.SourcePreamble)
    if source.Text() == expected {
      hashes[source.FileName()] = rawHash
    } else {
      // Force the next snapshot to revisit a file that changed while the
      // compiler session was loading instead of blessing mismatched disk text.
      hashes[source.FileName()] = sha256.Sum256([]byte(source.Text()))
    }
  }
  return hashes, digests, nil
}

func hashFiles(paths []string) (map[string][sha256.Size]byte, error) {
  hashes := make(map[string][sha256.Size]byte, len(paths))
  for _, path := range paths {
    content, err := os.ReadFile(path)
    if err != nil {
      return nil, fmt.Errorf("ttscgraph: read %s: %w", path, err)
    }
    hashes[path] = sha256.Sum256(content)
  }
  return hashes, nil
}

func hashesChanged(previous map[string][sha256.Size]byte) (bool, error) {
  for path, oldHash := range previous {
    content, err := os.ReadFile(path)
    if err != nil {
      if errors.Is(err, os.ErrNotExist) {
        return true, nil
      }
      return false, fmt.Errorf("ttscgraph: read %s: %w", path, err)
    }
    if sha256.Sum256(content) != oldHash {
      return true, nil
    }
  }
  return false, nil
}

func changedSources(previous map[string][sha256.Size]byte) (map[string]string, bool, error) {
  changed := map[string]string{}
  for path, oldHash := range previous {
    content, err := os.ReadFile(path)
    if err != nil {
      if errors.Is(err, os.ErrNotExist) {
        return nil, true, nil
      }
      return nil, false, fmt.Errorf("ttscgraph: read %s: %w", path, err)
    }
    if sha256.Sum256(content) != oldHash {
      changed[path] = string(content)
    }
  }
  return changed, false, nil
}

type diskState struct {
  DirectoryEntries bool
  Hash             [sha256.Size]byte
  Exists           bool
  Realpath         string
  IdentityOnly     bool
}

// auxiliaryInput distinguishes resolver inputs whose contents select the
// build universe from the lexical spelling of the source the compiler already
// selected. The resident source hash owns the latter's contents; this input
// owns only whether the spelling still reaches the same physical file.
type auxiliaryInput struct {
  directoryEntries bool
  path             string
  identityOnly     bool
}

// captureDiskStates records the freshness state of resolver inputs. Many do
// not exist, and a module specifier can name a
// path the host OS cannot even parse (`./style.css?inline`, a `data:` URL on
// Windows), so any path that is neither a readable file nor a directory is
// recorded as absent instead of failing the snapshot: the recorded state only
// needs to flip when the candidate becomes resolvable.
func captureDiskStates(inputs []auxiliaryInput) map[string]diskState {
  states := make(map[string]diskState, len(inputs))
  for _, input := range inputs {
    state := diskState{
      DirectoryEntries: input.directoryEntries,
      IdentityOnly:     input.identityOnly,
    }
    content, err := os.ReadFile(input.path)
    if err != nil {
      if info, statErr := os.Stat(input.path); statErr == nil && info.IsDir() {
        state.Exists = true
        state.Realpath = diskRealpath(input.path)
        if input.directoryEntries {
          state.Hash = accessibleDirectoryEntriesHash(input.path)
        }
      }
      states[input.path] = state
      continue
    }
    state.Exists = true
    state.Realpath = diskRealpath(input.path)
    if !input.identityOnly {
      state.Hash = sha256.Sum256(content)
    }
    states[input.path] = state
  }
  return states
}

func diskStatesChanged(previous map[string]diskState) bool {
  inputs := make([]auxiliaryInput, 0, len(previous))
  for path, state := range previous {
    inputs = append(inputs, auxiliaryInput{
      directoryEntries: state.DirectoryEntries,
      identityOnly:     state.IdentityOnly,
      path:             path,
    })
  }
  current := captureDiskStates(inputs)
  for path, state := range previous {
    if current[path] != state {
      return true
    }
  }
  return false
}

func auxiliaryInputs(program *driver.Program, cwd string) []auxiliaryInput {
  inputs := []auxiliaryInput{
    {path: filepath.Join(cwd, ".gitignore")},
    {path: filepath.Join(cwd, ".git", "info", "exclude")},
    {path: filepath.Join(cwd, "package.json")},
    {path: filepath.Join(cwd, "package-lock.json")},
    {path: filepath.Join(cwd, "pnpm-lock.yaml")},
    {path: filepath.Join(cwd, "yarn.lock")},
    {path: filepath.Join(cwd, "bun.lock")},
    {path: filepath.Join(cwd, "bun.lockb")},
  }
  for _, source := range program.TSProgram.SourceFiles() {
    file := source.FileName()
    if file == "" || strings.HasPrefix(file, "bundled:///") {
      continue
    }
    directory := filepath.Dir(file)
    for _, path := range appendAncestorInputs(nil, directory, cwd) {
      inputs = append(inputs, auxiliaryInput{path: path})
    }
  }
  for _, input := range driver.ObserveProgramResolutions(program, cwd).Inputs {
    inputs = append(inputs, auxiliaryInput{
      directoryEntries: input.DirectoryEntries,
      identityOnly:     input.IdentityOnly,
      path:             input.Path,
    })
  }
  return compactAuxiliaryInputs(inputs)
}

func compactAuxiliaryInputs(inputs []auxiliaryInput) []auxiliaryInput {
  byPath := make(map[string]auxiliaryInput, len(inputs))
  for _, input := range inputs {
    if strings.TrimSpace(input.path) == "" {
      continue
    }
    if previous, exists := byPath[input.path]; exists {
      input.directoryEntries = previous.directoryEntries || input.directoryEntries
      // A path that also participates as a manifest or other content-bearing
      // input keeps the stronger content-sensitive contract.
      input.identityOnly = previous.identityOnly && input.identityOnly
    }
    byPath[input.path] = input
  }
  paths := make([]string, 0, len(byPath))
  for path := range byPath {
    paths = append(paths, path)
  }
  sort.Strings(paths)
  output := make([]auxiliaryInput, 0, len(paths))
  for _, path := range paths {
    output = append(output, byPath[path])
  }
  return output
}

// accessibleDirectoryEntriesHash mirrors TypeScript-Go's accessible-entry
// classification and sorted name order for a directory enumeration input.
func accessibleDirectoryEntriesHash(directory string) [sha256.Size]byte {
  hash := sha256.New()
  entries, err := os.ReadDir(directory)
  if err == nil {
    for _, entry := range entries {
      kind := byte(0)
      switch {
      case entry.Type().IsDir():
        kind = 'D'
      case entry.Type().IsRegular():
        kind = 'F'
      case entry.Type()&os.ModeSymlink != 0 || (runtime.GOOS == "windows" && entry.Type()&os.ModeIrregular != 0):
        if info, statErr := os.Stat(filepath.Join(directory, entry.Name())); statErr == nil {
          if info.IsDir() {
            kind = 'D'
          } else if info.Mode().IsRegular() {
            kind = 'F'
          }
        }
      default:
        continue
      }
      if kind == 0 {
        continue
      }
      _, _ = hash.Write([]byte{kind})
      _, _ = hash.Write([]byte(entry.Name()))
      _, _ = hash.Write([]byte{0})
    }
  }
  var digest [sha256.Size]byte
  copy(digest[:], hash.Sum(nil))
  return digest
}

func appendAncestorInputs(inputs []string, directory, stop string) []string {
  stop = filepath.Clean(stop)
  for current := filepath.Clean(directory); ; current = filepath.Dir(current) {
    inputs = append(inputs, filepath.Join(current, "package.json"), filepath.Join(current, ".gitignore"))
    if current == stop || filepath.Dir(current) == current {
      return inputs
    }
  }
}

func compactSortedStrings(input []string) []string {
  out := make([]string, 0, len(input))
  for _, value := range input {
    if strings.TrimSpace(value) != "" {
      out = append(out, value)
    }
  }
  sort.Strings(out)
  return slices.Compact(out)
}

func runServe(args []string) int {
  fs := flag.NewFlagSet("ttscgraph serve", flag.ContinueOnError)
  fs.SetOutput(stderr)
  cwdFlag := fs.String("cwd", "", "project root (defaults to process cwd)")
  tsconfigFlag := fs.String("tsconfig", "tsconfig.json", "project tsconfig path")
  artifactsFlag := fs.String(
    "artifacts",
    "",
    "path to the artifacts a plugin published (JSON); absent or missing means none",
  )
  if err := fs.Parse(args); err != nil {
    return 2
  }
  artifacts, artifactsErr := graph.LoadArtifacts(strings.TrimSpace(*artifactsFlag))
  if artifactsErr != nil {
    fmt.Fprintf(
      stderr,
      "ttscgraph: could not read the published artifacts: %v\n",
      artifactsErr,
    )
    return 1
  }

  cwd := strings.TrimSpace(*cwdFlag)
  if cwd == "" {
    resolved, err := getwd()
    if err != nil {
      fmt.Fprintf(stderr, "ttscgraph: could not resolve working directory: %v\n", err)
      return 2
    }
    cwd = resolved
  }
  if abs, err := filepath.Abs(cwd); err == nil {
    cwd = abs
  }
  cwd = shimtspath.ResolvePath(cwd)
  tsconfig := strings.TrimSpace(*tsconfigFlag)

  return serveSnapshotsWithArtifacts(os.Stdin, stdout, cwd, tsconfig, artifacts)
}

func serveSnapshots(input io.Reader, output io.Writer, cwd, tsconfig string) int {
  return serveSnapshotsWithArtifacts(input, output, cwd, tsconfig, nil)
}

// serveSnapshotsWithArtifacts is the loop the serve command runs, and
// serveSnapshots is it with nothing published — the shape every existing case
// drives, unchanged.
func serveSnapshotsWithArtifacts(
  input io.Reader,
  output io.Writer,
  cwd, tsconfig string,
  artifacts []graph.Artifact,
) int {
  scanner := bufio.NewScanner(input)
  scanner.Buffer(make([]byte, 64*1024), 1024*1024)
  encoder := json.NewEncoder(output)
  var session *graphSession
  defer func() {
    if session != nil {
      _ = session.Close()
    }
  }()

  for scanner.Scan() {
    line := strings.TrimSpace(scanner.Text())
    if line == "" {
      continue
    }
    var request serveRequest
    if err := json.Unmarshal([]byte(line), &request); err != nil {
      // A response is addressed by id, and an unparseable line has no id to
      // address it to. Replying with the zero id answered nobody: the client
      // drops a frame matching no pending request, so the caller's promise
      // never settled and the graph call hung forever.
      //
      // There is no recoverable reading of this. The client is the only writer
      // and it writes nothing but {"id":N}, so a line it cannot produce means
      // the stream is not the protocol. Fail it: the exit carries this stderr
      // to the client, which rejects every pending request with it — an
      // outcome, where the dropped frame was silence.
      fmt.Fprintf(stderr, "ttscgraph: unaddressable serve request: %v\n", err)
      return 1
    }
    requestStarted := time.Now()
    if request.GraphSnapshotVersion != 0 && request.GraphSnapshotVersion != graphSnapshotProtocolVersion {
      if err := encodeServeResponseWithTrace(encoder, errorResponse(
        request.ID,
        fmt.Sprintf(
          "ttscgraph: unsupported graph snapshot protocol v%d (supported: v%d)",
          request.GraphSnapshotVersion,
          graphSnapshotProtocolVersion,
        ),
      ), requestStarted, 0, 0, 0); err != nil {
        fmt.Fprintf(stderr, "ttscgraph: write serve response: %v\n", err)
        return 1
      }
      continue
    }
    var loadDuration time.Duration
    if session == nil {
      loadStarted := time.Now()
      created, err := newGraphSessionWithArtifacts(cwd, tsconfig, artifacts)
      loadDuration = time.Since(loadStarted)
      if err != nil {
        if err := encodeServeResponseWithTrace(
          encoder,
          errorResponse(request.ID, err.Error()),
          requestStarted,
          loadDuration,
          0,
          0,
        ); err != nil {
          fmt.Fprintf(stderr, "ttscgraph: write serve response: %v\n", err)
          return 1
        }
        continue
      }
      session = created
    }
    if session.requestProtocolSelected && session.requestProtocol != request.GraphSnapshotVersion {
      if err := encodeServeResponseWithTrace(encoder, errorResponse(
        request.ID,
        "ttscgraph: graphSnapshotVersion cannot change within one resident session",
      ), requestStarted, loadDuration, 0, 0); err != nil {
        fmt.Fprintf(stderr, "ttscgraph: write serve response: %v\n", err)
        return 1
      }
      continue
    }
    session.requestProtocol = request.GraphSnapshotVersion
    session.requestProtocolSelected = true
    if replaced, err := session.adoptArtifacts(request.Artifacts); err != nil {
      if err := encodeServeResponseWithTrace(encoder, errorResponse(
        request.ID,
        fmt.Sprintf("ttscgraph: could not read the published artifacts: %v", err),
      ), requestStarted, loadDuration, 0, 0); err != nil {
        fmt.Fprintf(stderr, "ttscgraph: write serve response: %v\n", err)
        return 1
      }
      continue
    } else if replaced {
      session.invalidateArtifacts()
    }
    var dump *graph.Dump
    var snapshot *serveGraphSnapshot
    var mode string
    var changed bool
    var semanticDuration time.Duration
    var exportDuration time.Duration
    var err error
    if request.GraphSnapshotVersion == graphSnapshotProtocolVersion {
      snapshot, mode, changed, semanticDuration, exportDuration, err = session.snapshotShardsWithTiming()
    } else {
      dump, mode, changed, err = session.Snapshot()
    }
    response := newServeResponse(request.ID)
    // The envelope answers for THIS session, not for the command in general. An
    // `unchanged` response carries no dump, so the envelope is the only place a
    // client learns what this server proves — and a session holding artifacts
    // publishes a dump that claims them. Leaving the shared list here made the
    // envelope and the dump disagree on the one frame that has no dump to check.
    response.Capabilities = session.capabilities()
    response.Dump = dump
    response.Snapshot = snapshot
    response.Mode = mode
    response.Changed = changed
    if err != nil {
      response.Error = err.Error()
      response.Dump = nil
      response.Snapshot = nil
      response.Mode = serveModeError
      response.Changed = false
    }
    if err := encodeServeResponseWithTrace(
      encoder,
      response,
      requestStarted,
      loadDuration,
      semanticDuration,
      exportDuration,
    ); err != nil {
      fmt.Fprintf(stderr, "ttscgraph: write serve response: %v\n", err)
      return 1
    }
  }
  if err := scanner.Err(); err != nil {
    fmt.Fprintf(stderr, "ttscgraph: read serve request: %v\n", err)
    return 1
  }
  return 0
}

// encodeServeResponseWithTrace accounts for every addressed response, including
// failures that occur before a graph session exists.
func encodeServeResponseWithTrace(
  encoder *json.Encoder,
  response serveResponse,
  requestStarted time.Time,
  loadDuration time.Duration,
  semanticDuration time.Duration,
  exportDuration time.Duration,
) error {
  encodeStarted := time.Now()
  if err := encoder.Encode(response); err != nil {
    return err
  }
  writeServePhaseTrace(
    response.ID,
    response.Mode,
    loadDuration,
    semanticDuration,
    exportDuration,
    time.Since(encodeStarted),
    time.Since(requestStarted),
  )
  return nil
}

// writeServePhaseTrace emits opt-in timings without source paths or payloads.
func writeServePhaseTrace(
  request int,
  mode string,
  load time.Duration,
  semantic time.Duration,
  export time.Duration,
  encode time.Duration,
  total time.Duration,
) {
  if os.Getenv(graphPhaseTraceEnvironment) != "1" {
    return
  }
  phases := []struct {
    name     string
    duration time.Duration
  }{
    {name: "native-load", duration: load},
    {name: "semantic-refresh", duration: semantic},
    {name: "shard-export", duration: export},
    {name: "encode", duration: encode},
    {name: "producer-total", duration: total},
  }
  for _, phase := range phases {
    fmt.Fprintf(
      stderr,
      "@samchon/graph: ttscgraph-phase owner=producer request=%d mode=%s phase=%s durationMs=%.3f\n",
      request,
      mode,
      phase.name,
      float64(phase.duration)/float64(time.Millisecond),
    )
  }
}
