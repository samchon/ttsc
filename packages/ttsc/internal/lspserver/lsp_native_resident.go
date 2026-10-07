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
  return nativeResidentResult(plugin, verb, body, code)
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
  body, code, err := decodeNativeResidentReply(reply)
  if err != nil {
    sc.kill()
    return nil, 0, err
  }
  sc.everServed.Store(true)
  return body, code, nil
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

// InvalidateResidentPrograms queues supplied changed URIs for existing residents,
// or queues full invalidation when no URI was supplied. The next serialized
// request carries this state; daemon processing determines whether updates apply.
// This method sends no immediate message and does not certify URI validity,
// saved bytes, a successful reload or notifications for every changed input.
//
// @evidence contracts/common.md#principled-implementation Supplied URIs queue incremental notifications; no supplied URI queues the full-invalidation flag for the next serialized request. These transitions do not independently validate URI contents, saved bytes or successful daemon updates.
// @evidence contracts/common.md#clear-and-simple-design A pending-state lock lets notifications queue invalidation independently of the serialized request stream.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Absent localization explicitly selects full invalidation instead of inventing a changed-file list. Callers and daemon processing still determine whether supplied URIs describe topology changes requiring a reload.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain empty versus localized invalidation, following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Protocol URIs pass to the native daemon unchanged; daemon processing owns native file updates and executable argv remains platform-neutral exec input.
// @evidence contracts/performance.md#efficient-algorithms The resident table is copied once, then every resident examines the supplied URI list under its pending lock. Hashing depends on URI bytes even for repeated entries; absent dedup maps can also reindex existing queue contents. Full invalidation clears a fixed set of fields per resident and neither branch waits on the rule-execution lock.
// @evidence contracts/performance.md#reuse-equivalent-work Pending notifications piggyback on a later read; exact URI-string deduplication is not physical alias merging or proof of fresh Program state. Caller notification coverage and daemon update semantics authorize any retained Program reuse.
// @evidence contracts/performance.md#bound-retention-and-release-resources Lists/sets are detached when a request is prepared, not after an acknowledged update, or cleared by full invalidation. Unique URI bytes/count have no independent cap; repeated entries are still processed without accumulating duplicate keys. Detached requests can retain their strings while waiting. Close requests cancellation and resident cleanup rather than certifying all work has terminated.
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
// @evidence contracts/performance.md#efficient-algorithms The wrapper builds and hashes an external-URI-to-nil-owner map, then performs the owner-aware delegate's descriptor/URI/resident routing and queue work. Delegation does not remove string-byte, copied-list or lock costs.
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
// changes to existing transports selected by the supplied owner map; missing or
// nil owners select all, and an empty owner list selects none. Recognized source
// and JSON extensions override narrower ownership and reach every resident.
// Selection does not certify physical snapshot ownership or successful updates;
// each daemon decides how the queued change affects its own Program.
//
// @evidence contracts/common.md#principled-implementation Supplied owner keys scope external data notifications; missing/nil keys select all and empty lists select none. Source/JSON extension heuristics broaden routing across all residents rather than certifying actual compiler membership or snapshot ownership.
// @evidence contracts/common.md#clear-and-simple-design External URI and transport sets separate ownership filtering from each resident's serialized update queue.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Conservative extension-based routing does not use expected producer answers. It is a notification policy, not an independently complete measurement of every compiler input kind.
// @evidence contracts/common.md#meaningful-documentation Native prose explains why Program inputs override narrower external ownership, following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation file URI parsing and native extension APIs classify inputs while the daemon resolves filesystem identity; no blind OS-based path folding is used.
// @evidence contracts/performance.md#efficient-algorithms Costs include descriptor/context-mode keys, URI/owner string hashing, URI parsing/extension scans, resident-map copies and per-resident ordinary-list copies plus external routing scans. queueChanges reprocesses selected URI bytes even when duplicate keys are already retained; the method uses pending locks rather than the native rule-execution lock.
// @evidence contracts/performance.md#reuse-equivalent-work Unselected external notifications leave unrelated queues untouched; selected lists are transmitted with a later read. Native freshness still depends on complete caller notifications and daemon processing, not merely on owner-map membership or equal URI strings.
// @evidence contracts/performance.md#bound-retention-and-release-resources Local owner/routing maps and copied lists grow with descriptors, URI bytes, owner pairs and resident count. Pending unique URI bytes have no independent cap and are detached before an update is acknowledged; in-flight requests can retain them. Source.Close requests cancellation and resident cleanup without an overall join of all callers or descendants.
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
// rule. A queued full invalidation supersedes incremental notifications; actual
// disk capture and reload success belong to the daemon handling that request.
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

// shutdownResidents revokes starts and requests cancellation before attempting
// each detached resident's cleanup. Closing protocol pipes does not certify
// completion of one-shot work, refresh tasks or descendant processes.
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
