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
  "slices"
  "sort"
  "strings"

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
  // serveModeRebuild is edits applied but the program could not be reused.
  serveModeRebuild = "rebuild"
  // serveModeError is a request that produced no snapshot. It is a transport
  // mode, not a computation mode: it exists so mode is never absent, because a
  // field that disappears on the error path cannot be relied on.
  serveModeError = "error"
)

// fullSnapshotCapabilities is what a snapshot from a resident compiler session
// proves. Both commands that own a real Program declare all three; the constant
// exists so the envelope's claim and the dump's claim cannot drift apart.
var fullSnapshotCapabilities = []string{
  graph.CapabilityUniverse,
  graph.CapabilitySourceDigests,
  graph.CapabilityDiskDigests,
  graph.CapabilityDiagnostics,
}

// serveCapabilities is what this server can prove, answered before a consumer
// has a dump to inspect — an `unchanged` response carries no dump, and a client
// negotiating on the first frame has not parsed one yet. It mirrors what every
// dump this server publishes declares for itself.
var serveCapabilities = fullSnapshotCapabilities

type serveRequest struct {
  ID int `json:"id"`
}

type serveResponse struct {
  Dump *graph.Dump `json:"dump,omitempty"`
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
  cwd          string
  tsconfig     string
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
  configDigests []graph.FileDigest
  roots         []graph.RootFile
  initialized   bool
}

func newGraphSession(cwd, tsconfig string) (*graphSession, error) {
  session := &graphSession{cwd: cwd, tsconfig: tsconfig}
  if err := session.reload(); err != nil {
    return nil, err
  }
  return session, nil
}

func (s *graphSession) Close() error {
  if s.compiler == nil {
    return nil
  }
  return s.compiler.Close()
}

func (s *graphSession) Snapshot() (*graph.Dump, string, bool, error) {
  if !s.initialized {
    dump := s.buildDump()
    s.initialized = true
    return &dump, serveModeInitial, true, nil
  }

  configChanged, err := hashesChanged(s.configHashes)
  if err != nil {
    return nil, "", false, err
  }
  if configChanged {
    if err := s.reload(); err != nil {
      return nil, "", false, err
    }
    dump := s.buildDump()
    return &dump, serveModeReload, true, nil
  }

  if diskStatesChanged(s.auxStates) {
    if err := s.reload(); err != nil {
      return nil, "", false, err
    }
    dump := s.buildDump()
    return &dump, serveModeReload, true, nil
  }

  roots, err := projectRootFiles(s.compiler.Program(), true)
  if err != nil {
    return nil, "", false, err
  }
  if !slices.Equal(s.rootFiles, roots) {
    if err := s.reload(); err != nil {
      return nil, "", false, err
    }
    dump := s.buildDump()
    return &dump, serveModeReload, true, nil
  }

  changed, deleted, err := changedSources(s.sourceHashes)
  if err != nil {
    return nil, "", false, err
  }
  if deleted {
    if err := s.reload(); err != nil {
      return nil, "", false, err
    }
    dump := s.buildDump()
    return &dump, serveModeReload, true, nil
  }
  if len(changed) == 0 {
    return nil, serveModeUnchanged, false, nil
  }
  if s.compiler.Program().HasLinkedProgramPlugins() {
    if err := s.reload(); err != nil {
      return nil, "", false, err
    }
    dump := s.buildDump()
    return &dump, serveModeReload, true, nil
  }

  mode := serveModeIncremental
  paths := make([]string, 0, len(changed))
  for path := range changed {
    paths = append(paths, path)
  }
  sort.Strings(paths)
  for _, path := range paths {
    if reused := s.compiler.Apply(path, changed[path]); !reused {
      mode = serveModeRebuild
    }
    current, exists := s.compiler.SourceText(path)
    expected := driver.ApplySourcePreambleToFile(path, changed[path], s.compiler.Program().SourcePreamble)
    if !exists || current != expected {
      if err := s.reload(); err != nil {
        return nil, "", false, err
      }
      dump := s.buildDump()
      return &dump, serveModeReload, true, nil
    }
  }
  if err := s.captureState(); err != nil {
    return nil, "", false, err
  }
  dump := s.buildDump()
  return &dump, mode, true, nil
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
  inputs := auxiliaryInputs(program, configs, s.cwd)
  inputs = append(inputs, missingRootInputs(configs, sourceHashes)...)
  s.configHashes = configHashes
  s.auxStates = captureDiskStates(compactSortedStrings(inputs))
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

func (s *graphSession) buildDump() graph.Dump {
  program := s.compiler.Program()
  built := graph.Build(program)
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
      Provenance: graph.NewProvenance(
        s.cwd,
        serveProducer(),
        fullSnapshotCapabilities,
        s.configDigests,
        s.roots,
        texts,
        s.diskDigests,
      ),
      Diagnostics: graph.NewDiagnostics(program, s.cwd),
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
  Hash   [sha256.Size]byte
  Exists bool
}

// captureDiskStates records the freshness state of speculative resolution
// candidates. Most candidates do not exist, and a module specifier can name a
// path the host OS cannot even parse (`./style.css?inline`, a `data:` URL on
// Windows), so any path that is neither a readable file nor a directory is
// recorded as absent instead of failing the snapshot: the recorded state only
// needs to flip when the candidate becomes resolvable.
func captureDiskStates(paths []string) map[string]diskState {
  states := make(map[string]diskState, len(paths))
  for _, path := range paths {
    content, err := os.ReadFile(path)
    if err != nil {
      if info, statErr := os.Stat(path); statErr == nil && info.IsDir() {
        states[path] = diskState{Exists: true}
      } else {
        states[path] = diskState{}
      }
      continue
    }
    states[path] = diskState{Hash: sha256.Sum256(content), Exists: true}
  }
  return states
}

func diskStatesChanged(previous map[string]diskState) bool {
  paths := make([]string, 0, len(previous))
  for path := range previous {
    paths = append(paths, path)
  }
  current := captureDiskStates(paths)
  for path, state := range previous {
    if current[path] != state {
      return true
    }
  }
  return false
}

func auxiliaryInputs(program *driver.Program, configs []*shimtsoptions.ParsedCommandLine, cwd string) []string {
  inputs := []string{
    filepath.Join(cwd, ".gitignore"),
    filepath.Join(cwd, ".git", "info", "exclude"),
    filepath.Join(cwd, "package.json"),
    filepath.Join(cwd, "package-lock.json"),
    filepath.Join(cwd, "pnpm-lock.yaml"),
    filepath.Join(cwd, "yarn.lock"),
    filepath.Join(cwd, "bun.lock"),
    filepath.Join(cwd, "bun.lockb"),
  }
  for _, source := range program.TSProgram.SourceFiles() {
    file := source.FileName()
    if file == "" || strings.HasPrefix(file, "bundled:///") {
      continue
    }
    directory := filepath.Dir(file)
    inputs = appendAncestorInputs(inputs, directory, cwd)
    for _, reference := range source.ReferencedFiles {
      inputs = append(inputs, driver.FileCandidates(filepath.Join(directory, filepath.FromSlash(reference.FileName)))...)
    }
    for _, reference := range source.TypeReferenceDirectives {
      inputs = append(inputs, driver.TypeReferenceCandidates(configs, directory, cwd, reference.FileName)...)
    }
    for _, specifier := range driver.SourceModuleSpecifiers(source) {
      resolved := program.TSProgram.GetResolvedModuleFromModuleSpecifier(source, specifier)
      if resolved != nil && resolved.IsResolved() {
        inputs = append(inputs, driver.ModuleResolutionPredecessors(
          configs,
          directory,
          cwd,
          specifier.Text(),
          resolved.ResolvedFileName,
          program.FS.UseCaseSensitiveFileNames(),
        )...)
        continue
      }
      inputs = append(inputs, driver.ModuleResolutionCandidates(configs, directory, cwd, specifier.Text())...)
    }
  }
  // Config `types` entries request type packages without any source syntax, so
  // a missing one (e.g. a generated typeRoots package) must contribute the same
  // candidates as a triple-slash type directive.
  for _, parsed := range configs {
    if parsed == nil || parsed.ParsedConfig == nil || parsed.ParsedConfig.CompilerOptions == nil {
      continue
    }
    for _, name := range parsed.ParsedConfig.CompilerOptions.Types {
      inputs = append(inputs, driver.TypeReferenceCandidates(configs, parsed.GetCurrentDirectory(), cwd, name)...)
    }
  }
  return compactSortedStrings(inputs)
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
  if err := fs.Parse(args); err != nil {
    return 2
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

  return serveSnapshots(os.Stdin, stdout, cwd, tsconfig)
}

func serveSnapshots(input io.Reader, output io.Writer, cwd, tsconfig string) int {
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
    if session == nil {
      created, err := newGraphSession(cwd, tsconfig)
      if err != nil {
        _ = encoder.Encode(errorResponse(request.ID, err.Error()))
        continue
      }
      session = created
    }
    dump, mode, changed, err := session.Snapshot()
    response := newServeResponse(request.ID)
    response.Dump = dump
    response.Mode = mode
    response.Changed = changed
    if err != nil {
      response.Error = err.Error()
      response.Dump = nil
      response.Mode = serveModeError
      response.Changed = false
    }
    if err := encoder.Encode(response); err != nil {
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
