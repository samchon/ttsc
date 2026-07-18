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

// serveVerbDiagnostics and serveVerbCodeActions are the only verbs routed to the
// resident daemon. lsp-command-ids / lsp-code-action-kinds run once at startup
// and never load a Program (routing them would spawn the daemon on the
// initialize path); lsp-execute-command is user-initiated and keeps its
// spawn-per-verb path.
const (
  serveVerbDiagnostics = "lsp-diagnostics"
  serveVerbCodeActions = "lsp-code-actions"
)

// serveClientRequest mirrors linthost's serveLSPRequest: the base project
// options travel as the daemon's argv, only the per-verb fields per request.
type serveClientRequest struct {
  Verb        string `json:"verb"`
  URI         string `json:"uri,omitempty"`
  RangeJSON   string `json:"rangeJson,omitempty"`
  ContextJSON string `json:"contextJson,omitempty"`
  Invalidate  bool   `json:"invalidate,omitempty"`
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
  // invalidate piggybacks a "drop the warm Program" onto the next request, set
  // when the editor signals a document changed on disk.
  invalidate bool
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
  s.residentMu.Lock()
  if s.serveUnsupported[plugin.Binary] {
    s.residentMu.Unlock()
    return nil, false, nil
  }
  sc := s.residents[plugin.Binary]
  if sc == nil {
    sc = &residentSidecar{}
    if s.residents == nil {
      s.residents = map[string]*residentSidecar{}
    }
    s.residents[plugin.Binary] = sc
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
      s.serveUnsupported[plugin.Binary] = true
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

// InvalidateResidentPrograms tells every live resident daemon to drop its warm
// Program before the next request, because a document in the project changed on
// disk. It is the resident analog of rebuilding a fresh Program per verb, and
// mirrors how the proxy already invalidates the symbol provider on the same
// editor signals.
func (s *NativePluginSource) InvalidateResidentPrograms() {
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
    sc.invalidate = true
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
