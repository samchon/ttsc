package lspserver

import (
  "bufio"
  "context"
  "encoding/json"
  "fmt"
  "io"
  "os"
  "os/exec"
  "strings"
  "sync"
  "sync/atomic"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/internal/e2etrace"
)

// The serve verbs below are routed to the resident daemon because they load a
// Program.
// lsp-command-ids / lsp-code-action-kinds run once at startup and never load one
// (routing them would spawn the daemon on the initialize path);
// lsp-execute-command is user-initiated and keeps its spawn-per-verb path.
const (
  serveVerbDiagnostics        = "lsp-diagnostics"
  serveVerbProjectDiagnostics = "lsp-project-diagnostics"
  serveVerbCodeActions        = "lsp-code-actions"
  serveVerbHints              = "lsp-hints"
)

// serveClientRequest mirrors linthost's serveLSPRequest: the base project
// options travel as the daemon's argv, only the per-verb fields per request.
type serveClientRequest struct {
  Verb        string   `json:"verb"`
  URI         string   `json:"uri,omitempty"`
  RangeJSON   string   `json:"rangeJson,omitempty"`
  ContextJSON string   `json:"contextJson,omitempty"`
  Invalidate  bool     `json:"invalidate,omitempty"`
  Changed     []string `json:"changed,omitempty"`
  External    []string `json:"external,omitempty"`
}

// serveClientResponse mirrors linthost's serveLSPResponse: the verb's JSON
// result verbatim and the exit code the one-shot verb would have returned.
type serveClientResponse struct {
  Result json.RawMessage `json:"result"`
  Code   int             `json:"code"`
}

// residentSidecar is one long-lived `@ttsc/lint lsp-serve` child. It answers a
// serialized stream of verb requests over stdin/stdout, holding a warm Program
// across them, instead of the source respawning the sidecar per verb.
type residentSidecar struct {
  mu               sync.Mutex
  pendingMu        sync.Mutex
  cmd              *exec.Cmd
  stdin            io.WriteCloser
  stdout           *bufio.Reader
  everServed       atomic.Bool
  output           io.ReadCloser
  stopClosingPipes func() bool
  observation      *e2etrace.Command

  // invalidate piggybacks a full "drop the warm Program" onto the next request,
  // set for a change the proxy cannot localize.
  invalidate bool

  // changed piggybacks the document URIs that changed on disk onto the next
  // request, so the daemon updates the warm Program incrementally rather than
  // rebuilding it.
  changed    []string
  changedSet map[string]struct{}

  // external identifies changed entries that are declared ProjectRule inputs,
  // allowing an unknown non-Program path to retain the warm Program.
  external    []string
  externalSet map[string]struct{}
}

// serveRun routes a serve-able verb through the plugin's resident daemon.
// It returns served=false to tell the caller to fall back to the spawn-per-verb
// path: a sidecar that predates lsp-serve, a spawn failure, or a pipe that broke
// mid-session all degrade to exec rather than losing the verb. served=true with
// an error mirrors a nonzero one-shot exit — the daemon answered and the verb
// failed — so the caller logs and skips exactly as it does for exec.
func (s *NativePluginSource) serveRun(plugin NativeLSPPluginEntry, verb string, args []string) ([]byte, bool, error) {
  if s == nil || strings.TrimSpace(plugin.Binary) == "" {
    return nil, false, nil
  }
  key := pluginKey(plugin, s.projectContextJSON)
  s.residentMu.Lock()
  if s.closed {
    s.residentMu.Unlock()
    return nil, true, context.Canceled
  }
  if s.serveUnsupported[key] {
    s.residentMu.Unlock()
    return nil, false, nil
  }
  sc := s.residents[key]
  if sc == nil {
    sc = &residentSidecar{}
    if s.residents == nil {
      s.residents = map[string]*residentSidecar{}
    }
    s.residents[key] = sc
  }
  s.residentMu.Unlock()

  body, code, err := sc.call(s, plugin, serveRequestFromArgs(verb, args))
  if err != nil {
    // Could not talk to the daemon. If it never once answered, treat lsp-serve
    // as unsupported and stop trying — every sidecar built before this verb
    // rejects it, and retrying would spawn-and-fail per request forever. If it
    // had been answering, the pipe broke; leave it eligible to respawn next
    // call. Either way this call falls back to a fresh spawn so the verb still
    // works.
    s.residentMu.Lock()
    if !sc.everServed.Load() {
      if s.serveUnsupported == nil {
        s.serveUnsupported = map[string]bool{}
      }
      s.serveUnsupported[key] = true
    }
    s.residentMu.Unlock()
    return nil, false, nil
  }
  if code != 0 {
    return nil, true, fmt.Errorf("ttscserver: %s %s (resident) exit %d", pluginLabel(plugin), verb, code)
  }
  return body, true, nil
}

// call sends one request to the daemon and reads its reply, serializing access
// to the single pipe. It spawns the child on first use or after a death. The
// computation has no deadline, but replies have a byte limit and session
// cancellation closes the pipes independently of this mutex.
func (sc *residentSidecar) call(s *NativePluginSource, plugin NativeLSPPluginEntry, req serveClientRequest) ([]byte, int, error) {
  sc.mu.Lock()
  defer sc.mu.Unlock()
  if sc.cmd == nil {
    if err := sc.spawn(s, plugin); err != nil {
      return nil, 0, err
    }
  }
  sc.pendingMu.Lock()
  if sc.invalidate {
    req.Invalidate = true
    sc.invalidate = false
  }
  if len(sc.changed) > 0 {
    req.Changed = sc.changed
    sc.changed = nil
  }
  if len(sc.external) > 0 {
    req.External = sc.external
    sc.external = nil
  }
  sc.changedSet = nil
  sc.externalSet = nil
  sc.pendingMu.Unlock()
  line, err := json.Marshal(req)
  if err != nil {
    return nil, 0, err
  }
  line = append(line, '\n')
  if _, err := sc.stdin.Write(line); err != nil {
    sc.kill()
    return nil, 0, err
  }

  // Include a bounded envelope allowance around the one-shot result limit.
  // ReadSlice avoids retaining arbitrary output from a malformed daemon.
  const replyLimit = nativePluginCommandStdoutLimit + 1024
  var reply []byte
  for {
    fragment, readErr := sc.stdout.ReadSlice('\n')
    if len(reply)+len(fragment) > replyLimit {
      sc.kill()
      return nil, 0, fmt.Errorf("resident reply exceeds %d bytes", replyLimit)
    }
    reply = append(reply, fragment...)
    if readErr == bufio.ErrBufferFull {
      continue
    }
    if readErr != nil {
      sc.kill()
      return nil, 0, readErr
    }
    break
  }
  var resp serveClientResponse
  if err := json.Unmarshal(reply, &resp); err != nil {
    sc.kill()
    return nil, 0, err
  }
  if len(resp.Result) > nativePluginCommandStdoutLimit {
    sc.kill()
    return nil, 0, fmt.Errorf("resident result exceeds %d bytes", nativePluginCommandStdoutLimit)
  }
  sc.everServed.Store(true)
  return resp.Result, resp.Code, nil
}

// spawn starts the resident child with the base project args and the lsp-serve
// verb; per-verb fields travel per request. The caller holds sc.mu.
func (sc *residentSidecar) spawn(s *NativePluginSource, plugin NativeLSPPluginEntry) error {
  allArgs := []string{
    "lsp-serve",
    "--cwd=" + s.cwd,
    "--tsconfig=" + s.tsconfig,
    "--plugins-json=" + s.pluginsJSON,
  }
  if plugin.ProjectContextArgs && strings.TrimSpace(s.projectContextJSON) != "" {
    allArgs = append(allArgs, "--project-context-json="+s.projectContextJSON)
  }
  ctx := s.commandContext()
  cmd := exec.CommandContext(ctx, plugin.Binary, allArgs...)
  cmd.WaitDelay = time.Second
  cmd.Dir = s.cwd
  cmd.Env = os.Environ()
  // Drain the child's stderr to the source log so its pipe cannot fill and block
  // the child, and so a resident rule panic is still visible.
  cmd.Stderr = residentStderr{s: s, label: pluginLabel(plugin)}
  stdin, err := cmd.StdinPipe()
  if err != nil {
    return err
  }
  stdout, err := cmd.StdoutPipe()
  if err != nil {
    _ = stdin.Close()
    return err
  }
  observation := e2etrace.BeginCommand(cmd, "Start")
  err = cmd.Start()
  observation.Result(err)
  if err != nil {
    _ = stdin.Close()
    _ = stdout.Close()
    return err
  }
  sc.cmd = cmd
  sc.observation = observation
  sc.stdin = stdin
  sc.stdout = bufio.NewReader(stdout)
  sc.output = stdout
  sc.stopClosingPipes = context.AfterFunc(ctx, func() {
    _ = stdin.Close()
    _ = stdout.Close()
  })
  return nil
}

// kill terminates the child and clears its handles so the next call respawns.
// The caller holds sc.mu.
func (sc *residentSidecar) kill() {
  if sc.stopClosingPipes != nil {
    sc.stopClosingPipes()
    sc.stopClosingPipes = nil
  }
  if sc.stdin != nil {
    _ = sc.stdin.Close()
  }
  if sc.output != nil {
    _ = sc.output.Close()
  }
  if sc.cmd != nil && sc.cmd.Process != nil {
    _ = sc.cmd.Process.Kill()
    sc.observation.BeginWait()
    waitErr := sc.cmd.Wait()
    sc.observation.Result(waitErr)
  }
  sc.cmd = nil
  sc.observation = nil
  sc.stdin = nil
  sc.stdout = nil
  sc.output = nil
}

// InvalidateResidentPrograms tells every live resident daemon that documents
// changed on disk, so the next request refreshes the warm Program before
// serving. Given the changed URIs, the daemon updates those files incrementally;
// given none, it drops the whole Program (a change the proxy could not
// localize). It mirrors how the proxy already invalidates the symbol provider on
// the same editor signals.
//
// @evidence contracts/common.md#principled-implementation Known disk changes queue incremental URI updates; absent localization queues a complete warm Program invalidation before the next serialized request.
// @evidence contracts/common.md#clear-and-simple-design A pending-state lock lets notifications queue invalidation independently of the serialized request stream.
// @evidence contracts/common.md#prohibited-implementation-shortcuts A topology change is not disguised as an incremental update to preserve stale compiler state.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain empty versus localized invalidation, following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Protocol URIs pass to the native daemon unchanged; daemon processing owns native file updates and executable argv remains platform-neutral exec input.
// @evidence contracts/performance.md#efficient-algorithms The resident table is copied once; first-seen URI sets deduplicate queue additions in expected constant time without waiting for rule execution.
// @evidence contracts/performance.md#reuse-equivalent-work Invalidations piggyback on the next read request so valid unchanged Program work remains reusable.
// @evidence contracts/performance.md#bound-retention-and-release-resources Pending URI slices and sets are consumed by the next request or cleared by full invalidation. Unique URI population has no separate cap, but repeated events do not add entries. Close cancels children independently of their request lock.
func (s *NativePluginSource) InvalidateResidentPrograms(changedURIs ...string) {
  if s == nil {
    return
  }
  s.residentMu.Lock()
  residents := make([]*residentSidecar, 0, len(s.residents))
  for _, sc := range s.residents {
    residents = append(residents, sc)
  }
  s.residentMu.Unlock()
  for _, sc := range residents {
    if len(changedURIs) > 0 {
      sc.queueChanges(changedURIs, nil)
    } else {
      sc.pendingMu.Lock()
      sc.invalidate = true
      sc.changed = nil
      sc.external = nil
      sc.changedSet = nil
      sc.externalSet = nil
      sc.pendingMu.Unlock()
    }
  }
}

// InvalidateResidentProgramsForWatchedChanges distinguishes declared external
// inputs from ordinary watched files so the sidecar can retain its Program for
// data-only changes while still rebuilding fresh ProjectRule state.
//
// @evidence contracts/common.md#principled-implementation Nil ownership for each external URI preserves the legacy all-transport invalidation meaning.
// @evidence contracts/common.md#clear-and-simple-design The owner-aware operation implements routing for both legacy and scoped entries.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Missing owner information is treated conservatively rather than guessed from a filename.
// @evidence contracts/common.md#meaningful-documentation Native prose explains external versus Program input meaning, following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation The delegated operation keeps protocol URIs separate from daemon-native path resolution.
// @evidenceExclude contracts/performance.md#efficient-algorithms Owner-aware invalidation owns processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The delegated operation owns warm Program validity.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Resident queues belong to the delegated operation.
func (s *NativePluginSource) InvalidateResidentProgramsForWatchedChanges(
  changedURIs []string,
  externalURIs []string,
) {
  externalOwners := make(map[string][]string, len(externalURIs))
  for _, uri := range externalURIs {
    externalOwners[uri] = nil
  }
  s.InvalidateResidentProgramsForOwnedWatchedChanges(
    changedURIs,
    externalURIs,
    externalOwners,
  )
}

// InvalidateResidentProgramsForOwnedWatchedChanges sends data-only external
// changes only to resident binaries that own the matching snapshot. A path that
// can also belong to the Program reaches every resident, because each daemon
// must decide whether its own Program contains that source.
//
// @evidence contracts/common.md#principled-implementation Data-only external edits reach matching owners; compiler-recognized input extensions reach all residents because each owns a potentially different Program population.
// @evidence contracts/common.md#clear-and-simple-design External URI and transport sets separate ownership filtering from each resident's serialized update queue.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Conservative Program-input invalidation follows supported compiler extensions rather than known producer output.
// @evidence contracts/common.md#meaningful-documentation Native prose explains why Program inputs override narrower external ownership, following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation file URI parsing and native extension APIs classify inputs while the daemon resolves filesystem identity; no blind OS-based path folding is used.
// @evidence contracts/performance.md#efficient-algorithms Sets avoid repeated owner searches; processing scales with descriptors, URI-owner pairs and resident-by-external routing checks.
// @evidence contracts/performance.md#reuse-equivalent-work Scoped data changes preserve unrelated residents' Programs; selected changed/external lists are piggybacked before the next read.
// @evidence contracts/performance.md#bound-retention-and-release-resources Pending lists and deduplication sets are consumed with a request or cleared by full invalidation; unique queued URI population has no separate byte cap and resident children terminate on Close.
func (s *NativePluginSource) InvalidateResidentProgramsForOwnedWatchedChanges(
  changedURIs []string,
  externalURIs []string,
  externalOwners map[string][]string,
) {
  if s == nil {
    return
  }
  external := make(map[string]struct{}, len(externalURIs))
  for _, uri := range externalURIs {
    external[uri] = struct{}{}
  }
  ordinary := make([]string, 0, len(changedURIs))
  for _, uri := range changedURIs {
    if _, ok := external[uri]; !ok {
      ordinary = append(ordinary, uri)
    }
  }
  ownerTransports := make(map[string]map[string]struct{}, len(externalURIs))
  allTransports := make(map[string]bool, len(externalURIs))
  pluginsByKey := make(map[string]NativeLSPPluginEntry, len(s.plugins))
  for _, plugin := range s.plugins {
    pluginsByKey[pluginKey(plugin, s.projectContextJSON)] = plugin
  }
  for _, uri := range externalURIs {
    if watchedURIHasProgramInputExtension(uri) {
      allTransports[uri] = true
      continue
    }
    owners, scoped := externalOwners[uri]
    if !scoped || owners == nil {
      allTransports[uri] = true
      continue
    }
    transports := map[string]struct{}{}
    for _, owner := range owners {
      if plugin, ok := pluginsByKey[owner]; ok {
        transports[pluginKey(plugin, s.projectContextJSON)] = struct{}{}
      }
    }
    ownerTransports[uri] = transports
  }
  s.residentMu.Lock()
  residents := make(map[string]*residentSidecar, len(s.residents))
  for key, sc := range s.residents {
    residents[key] = sc
  }
  s.residentMu.Unlock()
  for key, sc := range residents {
    changed := append([]string(nil), ordinary...)
    selectedExternal := []string{}
    for _, uri := range externalURIs {
      _, owned := ownerTransports[uri][key]
      if !allTransports[uri] && !owned {
        continue
      }
      changed = append(changed, uri)
      selectedExternal = append(selectedExternal, uri)
    }
    if len(changed) == 0 {
      continue
    }
    sc.queueChanges(changed, selectedExternal)
  }
}

// queueChanges records first-seen URI order without blocking on an executing
// rule. A full invalidation already observes every disk change on reload.
func (sc *residentSidecar) queueChanges(changed, external []string) {
  sc.pendingMu.Lock()
  defer sc.pendingMu.Unlock()
  if sc.invalidate {
    return
  }
  if sc.changedSet == nil {
    sc.changedSet = make(map[string]struct{}, len(sc.changed)+len(changed))
    for _, uri := range sc.changed {
      sc.changedSet[uri] = struct{}{}
    }
  }
  if sc.externalSet == nil {
    sc.externalSet = make(map[string]struct{}, len(sc.external)+len(external))
    for _, uri := range sc.external {
      sc.externalSet[uri] = struct{}{}
    }
  }
  for _, uri := range changed {
    if _, exists := sc.changedSet[uri]; !exists {
      sc.changedSet[uri] = struct{}{}
      sc.changed = append(sc.changed, uri)
    }
  }
  for _, uri := range external {
    if _, exists := sc.externalSet[uri]; !exists {
      sc.externalSet[uri] = struct{}{}
      sc.external = append(sc.external, uri)
    }
  }
}

// shutdownResidents kills every resident child. Called on server teardown; the
// children also exit on their own when the parent closes their stdin at process
// exit, so this is the graceful path, not the only one.
func (s *NativePluginSource) shutdownResidents() {
  if s == nil {
    return
  }
  s.residentMu.Lock()
  s.closed = true
  if s.cancelProcesses != nil {
    s.cancelProcesses()
  }
  residents := s.residents
  s.residents = map[string]*residentSidecar{}
  s.residentMu.Unlock()
  s.hintsRefresh.close()
  s.projectInputsRefresh.close()
  for _, sc := range residents {
    sc.mu.Lock()
    sc.kill()
    sc.mu.Unlock()
  }
}

// serveRequestFromArgs rebuilds a serve request from the same `--flag=value`
// argv the spawn-per-verb path passes, so the two transports share one call
// shape at the source's verb methods.
func serveRequestFromArgs(verb string, args []string) serveClientRequest {
  req := serveClientRequest{Verb: verb}
  for _, arg := range args {
    switch {
    case strings.HasPrefix(arg, "--uri="):
      req.URI = strings.TrimPrefix(arg, "--uri=")
    case strings.HasPrefix(arg, "--range-json="):
      req.RangeJSON = strings.TrimPrefix(arg, "--range-json=")
    case strings.HasPrefix(arg, "--context-json="):
      req.ContextJSON = strings.TrimPrefix(arg, "--context-json=")
    }
  }
  return req
}

// residentStderr forwards a resident child's stderr to the source log line by
// line, so it interleaves cleanly with the source's own logging.
type residentStderr struct {
  s     *NativePluginSource
  label string
}

func (w residentStderr) Write(p []byte) (int, error) {
  for _, line := range strings.Split(strings.TrimRight(string(p), "\n"), "\n") {
    if strings.TrimSpace(line) == "" {
      continue
    }
    w.s.log("%s (resident): %s", w.label, line)
  }
  return len(p), nil
}
