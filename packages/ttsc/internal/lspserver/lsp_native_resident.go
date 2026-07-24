package lspserver

import (
  "bufio"
  "encoding/json"
  "fmt"
  "io"
  "os"
  "os/exec"
  "strings"
  "sync"
  "time"
)

// residentRequestTimeout bounds one resident verb round trip, mirroring the
// spawn-per-verb path's nativePluginCommandTimeout. A rule that hangs must not
// wedge the daemon's request mutex forever; on timeout the sidecar is killed and
// the caller falls back to a fresh spawn.
const residentRequestTimeout = nativePluginCommandTimeout

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
  mu         sync.Mutex
  cmd        *exec.Cmd
  stdin      io.WriteCloser
  stdout     *bufio.Reader
  everServed bool
  // invalidate piggybacks a full "drop the warm Program" onto the next request,
  // set for a change the proxy cannot localize.
  invalidate bool
  // changed piggybacks the document URIs that changed on disk onto the next
  // request, so the daemon updates the warm Program incrementally rather than
  // rebuilding it.
  changed []string
  // external identifies changed entries that are declared ProjectRule inputs,
  // allowing an unknown non-Program path to retain the warm Program.
  external []string
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
    if !sc.everServed {
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
// to the single pipe. It spawns the child on first use or after a death, and
// enforces a per-request timeout so a hung rule cannot wedge the mutex.
func (sc *residentSidecar) call(s *NativePluginSource, plugin NativeLSPPluginEntry, req serveClientRequest) ([]byte, int, error) {
  sc.mu.Lock()
  defer sc.mu.Unlock()
  if sc.cmd == nil {
    if err := sc.spawn(s, plugin); err != nil {
      return nil, 0, err
    }
  }
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
  line, err := json.Marshal(req)
  if err != nil {
    return nil, 0, err
  }
  line = append(line, '\n')
  if _, err := sc.stdin.Write(line); err != nil {
    sc.kill()
    return nil, 0, err
  }

  type readResult struct {
    line []byte
    err  error
  }
  done := make(chan readResult, 1)
  go func() {
    raw, err := sc.stdout.ReadBytes('\n')
    done <- readResult{line: raw, err: err}
  }()
  select {
  case <-time.After(residentRequestTimeout):
    sc.kill()
    return nil, 0, fmt.Errorf("ttscserver: %s %s (resident) timed out", pluginLabel(plugin), req.Verb)
  case res := <-done:
    if res.err != nil {
      sc.kill()
      return nil, 0, res.err
    }
    var resp serveClientResponse
    if err := json.Unmarshal(res.line, &resp); err != nil {
      sc.kill()
      return nil, 0, err
    }
    sc.everServed = true
    return resp.Result, resp.Code, nil
  }
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
  cmd := exec.Command(plugin.Binary, allArgs...)
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
  if err := cmd.Start(); err != nil {
    _ = stdin.Close()
    return err
  }
  sc.cmd = cmd
  sc.stdin = stdin
  sc.stdout = bufio.NewReader(stdout)
  return nil
}

// kill terminates the child and clears its handles so the next call respawns.
// The caller holds sc.mu.
func (sc *residentSidecar) kill() {
  if sc.stdin != nil {
    _ = sc.stdin.Close()
  }
  if sc.cmd != nil && sc.cmd.Process != nil {
    _ = sc.cmd.Process.Kill()
    _ = sc.cmd.Wait()
  }
  sc.cmd = nil
  sc.stdin = nil
  sc.stdout = nil
}

// InvalidateResidentPrograms tells every live resident daemon that documents
// changed on disk, so the next request refreshes the warm Program before
// serving. Given the changed URIs, the daemon updates those files incrementally;
// given none, it drops the whole Program (a change the proxy could not
// localize). It mirrors how the proxy already invalidates the symbol provider on
// the same editor signals.
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
    sc.mu.Lock()
    if len(changedURIs) > 0 {
      sc.changed = append(sc.changed, changedURIs...)
    } else {
      sc.invalidate = true
    }
    sc.mu.Unlock()
  }
}

// InvalidateResidentProgramsForWatchedChanges distinguishes declared external
// inputs from ordinary watched files so the sidecar can retain its Program for
// data-only changes while still rebuilding fresh ProjectRule state.
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
    sc.mu.Lock()
    sc.changed = append(sc.changed, changed...)
    sc.external = append(sc.external, selectedExternal...)
    sc.mu.Unlock()
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
  residents := s.residents
  s.residents = map[string]*residentSidecar{}
  s.residentMu.Unlock()
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
