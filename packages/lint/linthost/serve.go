package linthost

import (
  "bufio"
  "encoding/json"
  "fmt"
  "io"
  "os"
  "strings"
  "sync"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// residentPrograms is the warm-Program cache the resident lsp-serve loop
// installs for the life of the daemon. It is nil in every one-shot verb
// invocation, so acquireProgram falls straight through to loadProgram and the
// spawn-per-verb path behaves byte-identically to before. Only RunLSPServe sets
// it, and the serve loop is single-threaded, but the mutex keeps the invariant
// explicit and cheap.
var residentPrograms *residentProgramCache

// residentProgramCache holds one loaded Program per (cwd, tsconfig, checker)
// key. A resident daemon pays the cold NewProgram parse+bind and the standalone
// checker build once, then reuses them across LSP verbs until a document change
// invalidates the cache. The expensive work is the parse+bind+checker; the
// per-verb rule walk is re-run each time (see acquire) because different verbs
// resolve different rule sets.
type residentProgramCache struct {
  mu      sync.Mutex
  entries map[string]*program
}

func newResidentProgramCache() *residentProgramCache {
  return &residentProgramCache{entries: map[string]*program{}}
}

// acquire returns a warm Program for the key, building and caching it on a miss.
// On a hit it resets the memoized project cycle so the caller's engine — which
// may differ from the engine that first warmed this Program (a lint verb versus
// a format verb) — re-evaluates its own project and file rules over the reused
// ASTs and checker. The returned close func is a no-op: a cached Program
// outlives the verb and is released only by invalidate or daemon exit.
func (c *residentProgramCache) acquire(
  opts *lspCommandOptions,
  needsChecker bool,
) (*program, []*shimast.Diagnostic, func(), error) {
  key := opts.cwd + "\x00" + opts.tsconfig + "\x00"
  if needsChecker {
    key += "checker"
  }
  c.mu.Lock()
  defer c.mu.Unlock()
  if prog, ok := c.entries[key]; ok {
    // Drop the prior verb's project-cycle memo so this verb's engine re-runs.
    prog.projectCycle = nil
    return prog, nil, noopClose, nil
  }
  prog, diags, err := loadProgram(opts.cwd, opts.tsconfig, loadProgramOptions{
    forceNoEmit:      true,
    needsRuleChecker: needsChecker,
    projectIdentity:  opts.projectIdentity,
  })
  if err != nil {
    return nil, nil, noopClose, err
  }
  if len(diags) > 0 || prog == nil {
    // A project that does not parse right now (a save mid-edit) is not cached —
    // the next verb rebuilds. tsgo owns these diagnostics upstream anyway.
    return prog, diags, noopClose, nil
  }
  c.entries[key] = prog
  return prog, nil, noopClose, nil
}

// invalidate releases every cached Program. Called when the editor signals that
// a document in the project changed on disk (didSave) or opened, so the next
// verb rebuilds against current source.
func (c *residentProgramCache) invalidate() {
  c.mu.Lock()
  defer c.mu.Unlock()
  for key, prog := range c.entries {
    prog.close()
    delete(c.entries, key)
  }
}

func noopClose() {}

// applyChanges incrementally updates every cached Program for the changed files,
// or drops an entry for a full reload when a changed path is not one of its
// source files — a config edit, or a new or removed file, which tsgo's
// per-file UpdateProgram cannot express and a fresh load handles correctly.
func (c *residentProgramCache) applyChanges(paths []string) {
  if len(paths) == 0 {
    return
  }
  c.mu.Lock()
  defer c.mu.Unlock()
  for key, prog := range c.entries {
    fullReload := false
    for _, path := range paths {
      if prog.sourceFileByPath(path) == nil {
        fullReload = true
        break
      }
    }
    if fullReload {
      prog.close()
      delete(c.entries, key)
      continue
    }
    for _, path := range paths {
      prog.applyChange(path)
    }
  }
}

// acquireProgram returns the Program an LSP verb should lint over, plus the
// close func the verb must defer. Outside a resident daemon (residentPrograms
// nil) it builds a fresh Program exactly as before and returns its real close,
// so the spawn-per-verb path is unchanged. Inside a daemon it returns the warm
// cached Program and a no-op close.
func acquireProgram(
  opts *lspCommandOptions,
  needsChecker bool,
) (*program, []*shimast.Diagnostic, func(), error) {
  if residentPrograms != nil {
    return residentPrograms.acquire(opts, needsChecker)
  }
  prog, diags, err := loadProgram(opts.cwd, opts.tsconfig, loadProgramOptions{
    forceNoEmit:      true,
    needsRuleChecker: needsChecker,
    projectIdentity:  opts.projectIdentity,
  })
  if prog == nil {
    return prog, diags, noopClose, err
  }
  return prog, diags, prog.close, err
}

// serveLSPRequest is one newline-delimited request the resident daemon reads.
// The base project options (cwd, tsconfig, plugins-json, project-context) are
// fixed for the daemon's life and arrive as RunLSPServe's argv; only the
// per-verb fields travel per request.
type serveLSPRequest struct {
  Verb        string `json:"verb"`
  URI         string `json:"uri,omitempty"`
  RangeJSON   string `json:"rangeJson,omitempty"`
  ContextJSON string `json:"contextJson,omitempty"`
  // Invalidate drops the warm Program before serving. The client sends it for a
  // change it cannot localize, so the request that carries it rebuilds.
  Invalidate bool `json:"invalidate,omitempty"`
  // Changed carries document URIs that changed on disk (a didSave), so the warm
  // Program is updated incrementally — re-parsing only those files — before
  // serving, instead of rebuilt from scratch. The sidecar owns the URI-to-path
  // conversion so the spelling matches its own source-file names. A file the
  // Program does not already hold as a source (a config edit, a new or removed
  // file) drops the entry for a full reload instead.
  Changed []string `json:"changed,omitempty"`
}

// serveLSPResponse is the reply to one request: the verb's JSON result verbatim
// (the same bytes the one-shot verb would print) and the exit code that verb
// would have returned. A nonzero code with a null result means the verb failed;
// the client falls back rather than treating it as an empty answer.
type serveLSPResponse struct {
  Result json.RawMessage `json:"result"`
  Code   int             `json:"code"`
}

// RunLSPServe is the resident @ttsc/lint LSP daemon. It installs a warm-Program
// cache and answers newline-delimited verb requests read from in by writing one
// JSON reply per line to out, until in reaches EOF.
//
// Only the read verbs run resident here: lsp-diagnostics and lsp-code-actions
// (the hot path, one per save and one per cursor) reuse the warm Program;
// lsp-command-ids and lsp-code-action-kinds answer their static lists; an
// invalidate control drops the Program. lsp-execute-command is deliberately
// left to the spawn-per-verb path — it is user-initiated and its temp-workspace
// fix cascade does not fit the resident cache.
//
// in and out are explicit so the loop is testable; dispatch wires them to
// os.Stdin and os.Stdout.
func RunLSPServe(in io.Reader, out io.Writer, args []string) int {
  base, ok := parseLSPCommandOptions("lsp-serve", args)
  if !ok {
    return 2
  }
  residentPrograms = newResidentProgramCache()
  defer func() {
    residentPrograms.invalidate()
    residentPrograms = nil
  }()
  encoder := json.NewEncoder(out)
  // ReadString imposes no line-length limit: a request is small, but keeping the
  // same reader shape as utility/serve.go avoids an arbitrary ceiling if a
  // future field carries buffer text.
  reader := bufio.NewReader(in)
  for {
    raw, err := reader.ReadString('\n')
    if line := strings.TrimSpace(raw); line != "" {
      handleServeLSPLine(line, base, encoder)
    }
    if err != nil {
      if err != io.EOF {
        fmt.Fprintf(os.Stderr, "@ttsc/lint lsp-serve: read error: %v\n", err)
        return 2
      }
      return 0
    }
  }
}

// handleServeLSPLine answers one request line. A panic inside a rule cycle is
// contained so one bad request drops to a nonzero code rather than taking down
// the daemon and every document with it — the resident analog of the one-shot
// process's isolation.
func handleServeLSPLine(line string, base *lspCommandOptions, encoder *json.Encoder) {
  defer func() {
    if recovered := recover(); recovered != nil {
      fmt.Fprintf(os.Stderr, "@ttsc/lint lsp-serve: request panicked: %v\n", recovered)
      _ = encoder.Encode(serveLSPResponse{Code: 2})
    }
  }()
  var req serveLSPRequest
  if err := json.Unmarshal([]byte(line), &req); err != nil {
    _ = encoder.Encode(serveLSPResponse{Code: 2})
    return
  }
  if req.Invalidate {
    residentPrograms.invalidate()
  }
  if len(req.Changed) > 0 {
    paths := make([]string, 0, len(req.Changed))
    for _, uri := range req.Changed {
      if path, err := filePathFromURI(uri); err == nil {
        paths = append(paths, path)
      }
    }
    residentPrograms.applyChanges(paths)
  }
  opts := *base
  opts.uri = req.URI
  opts.rangeJSON = req.RangeJSON
  opts.contextJSON = req.ContextJSON
  switch req.Verb {
  case "lsp-diagnostics":
    result, code := computeLSPDiagnostics(&opts)
    encodeServeResult(encoder, result, code)
  case "lsp-code-actions":
    result, code := computeLSPCodeActions(&opts)
    encodeServeResult(encoder, result, code)
  case "lsp-command-ids":
    encodeServeResult(encoder, lspCommandIDs(), 0)
  case "lsp-code-action-kinds":
    encodeServeResult(encoder, lspCodeActionKinds(), 0)
  case "":
    // A bare invalidate carries no verb; acknowledge it.
    _ = encoder.Encode(serveLSPResponse{Code: 0})
  default:
    fmt.Fprintf(os.Stderr, "@ttsc/lint lsp-serve: unknown verb %q\n", req.Verb)
    _ = encoder.Encode(serveLSPResponse{Code: 2})
  }
}

// encodeServeResult marshals a verb result and writes it with its code. A
// marshal failure degrades to a nonzero code rather than a malformed line.
func encodeServeResult(encoder *json.Encoder, result any, code int) {
  if code != 0 {
    _ = encoder.Encode(serveLSPResponse{Code: code})
    return
  }
  raw, err := json.Marshal(result)
  if err != nil {
    _ = encoder.Encode(serveLSPResponse{Code: 2})
    return
  }
  _ = encoder.Encode(serveLSPResponse{Result: raw, Code: 0})
}
