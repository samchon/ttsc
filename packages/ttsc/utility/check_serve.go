package utility

import (
  "bufio"
  "bytes"
  "encoding/json"
  "fmt"
  "io"
  "os"
  "path/filepath"
  "strings"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/driver/diagnosticcompletion"
)

// checkServeRequest is one analysis watch cycle: the filesystem transitions
// since the previous cycle. Project, plugin and compiler options are fixed by
// the command line the host was started with.
type checkServeRequest struct {
  Invalidate bool     `json:"invalidate,omitempty"`
  Changed    []string `json:"changed,omitempty"`
  External   []string `json:"external,omitempty"`
}

// checkServeTelemetry reports how the resident Program served the cycle.
type checkServeTelemetry struct {
  PID            int  `json:"pid"`
  ProgramLoads   int  `json:"programLoads"`
  ProgramUpdates int  `json:"programUpdates"`
  Reused         bool `json:"reused"`
}

// checkServeResponse is one cycle's answer, the same shape `@ttsc/lint`'s
// check-serve speaks, so the launcher drives both through one transport.
type checkServeResponse struct {
  Status    int                 `json:"status"`
  Stdout    string              `json:"stdout"`
  Stderr    string              `json:"stderr"`
  Telemetry checkServeTelemetry `json:"telemetry"`

  // ProgramFiles names the checked Program's files, default libraries under
  // their `bundled:///libs/` names, so the launcher needs no listing (#1865).
  ProgramFiles []string `json:"programFiles,omitempty"`

  // TypeScriptDiagnosticsReported acknowledges that Stderr holds the loaded
  // Program's complete diagnostic batch (#1869). Absent when loading failed.
  TypeScriptDiagnosticsReported bool `json:"typeScriptDiagnosticsReported,omitempty"`
}

// checkServeState owns at most one resident Program. A Program is never kept
// while a linked ProgramPlugin lacks CheckProgram: that hook can only answer by
// mutating the parsed ASTs, so each cycle loads a fresh Program, as one-shot
// check does.
type checkServeState struct {
  base    hostOptions
  session *driver.Session
  loads   int
  updates int
}

// RunCheckServe is the linked utility host's resident analysis check for
// `ttsc --noEmit --watch` (#1864). It accepts check's arguments, reads one JSON
// request per line from in and writes one JSON response per request to out
// until in reaches EOF.
//
// Each request answers what `check` answers: the Program's diagnostics, then
// the linked plugins' program-hook outcome, through CheckProgram where a plugin
// implements it. When no linked ProgramPlugin lacks CheckProgram the Program
// stays resident and a known changed source is applied incrementally through
// driver.Session; an unknown path, an unreadable change or an invalidation
// loads it again. Exit status 2 reports a startup, read or response-write
// failure; check failures travel in each response.
//
// @evidence contracts/common.md#principled-implementation Every request reports the current generation's diagnostics and hook outcome with check's status policy; residency is limited to Programs whose linked ProgramPlugins all answer through the non-mutating CheckProgram, and unknown or unreadable paths reload rather than guess.
// @evidence contracts/common.md#clear-and-simple-design The loop owns the stream protocol while checkServeState owns the one resident Program and its reload policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Incremental updates use the upstream UpdateProgram through driver.Session; hooks that mutate ASTs never see a reused Program.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs state the request semantics, the residency limit and the exit statuses.
// @evidence contracts/portability.md#os-neutral-implementation Request paths are made absolute with filepath.Abs and read with os.ReadFile; Program file names pass through as the compiler spells them.
// @evidence contracts/performance.md#efficient-algorithms A resident cycle re-parses each changed member and re-checks through the compiler's updated Program; diagnostics and file listing are linear in Program files. A reload costs one full load.
// @evidence contracts/performance.md#reuse-equivalent-work One loaded Program serves every compatible cycle of a watch session.
// @evidence contracts/performance.md#bound-retention-and-release-resources The state holds at most one Program and its overlay of applied edits; invalidation, reload and stream end close it. Request and response buffers are per line, without a byte cap.
func RunCheckServe(in io.Reader, out io.Writer, args []string) int {
  base, ok := parseHostOptions("check-serve", args, io.Discard, os.Stderr)
  if !ok {
    return 2
  }
  base.noEmit = true
  state := &checkServeState{base: base}
  defer state.close()
  encoder := json.NewEncoder(out)
  reader := bufio.NewReader(in)
  for {
    raw, readErr := reader.ReadString('\n')
    if line := strings.TrimSpace(raw); line != "" {
      if err := encoder.Encode(state.handle(line)); err != nil {
        fmt.Fprintf(os.Stderr, "ttsc utility check-serve: write error: %v\n", err)
        return 2
      }
    }
    if readErr != nil {
      if readErr != io.EOF {
        fmt.Fprintf(os.Stderr, "ttsc utility check-serve: read error: %v\n", readErr)
        return 2
      }
      return 0
    }
  }
}

func (s *checkServeState) close() {
  if s.session != nil {
    _ = s.session.Close()
    s.session = nil
  }
}

// handle answers one request line; a panic drops the resident Program.
func (s *checkServeState) handle(line string) (response checkServeResponse) {
  response = checkServeResponse{Status: 2}
  defer func() {
    if recovered := recover(); recovered != nil {
      s.close()
      response = checkServeResponse{
        Status: 2,
        Stderr: fmt.Sprintf("ttsc utility check-serve: request panicked: %v\n", recovered),
      }
    }
    response.Telemetry.PID = os.Getpid()
    response.Telemetry.ProgramLoads = s.loads
    response.Telemetry.ProgramUpdates = s.updates
  }()
  var req checkServeRequest
  if err := json.Unmarshal([]byte(line), &req); err != nil {
    response.Stderr = fmt.Sprintf("ttsc utility check-serve: invalid request: %v\n", err)
    return response
  }
  reused := s.apply(req)
  return s.check(reused)
}

// apply moves the resident Program to the request's filesystem state, or drops
// it when only a fresh load can: an invalidation, a path that is not a Program
// member and not a declared external input, or a change that cannot be read.
func (s *checkServeState) apply(req checkServeRequest) bool {
  if req.Invalidate {
    s.close()
    return false
  }
  if s.session == nil {
    return false
  }
  external := map[string]struct{}{}
  for _, location := range req.External {
    if resolved, err := filepath.Abs(location); err == nil {
      external[filepath.Clean(resolved)] = struct{}{}
    }
  }
  reused := true
  for _, location := range req.Changed {
    resolved, err := filepath.Abs(location)
    if err != nil {
      s.close()
      return false
    }
    resolved = filepath.Clean(resolved)
    if !s.session.Contains(resolved) {
      if _, declared := external[resolved]; declared {
        continue
      }
      s.close()
      return false
    }
    content, err := os.ReadFile(resolved)
    if err != nil {
      s.close()
      return false
    }
    if s.session.Apply(resolved, string(content)) {
      s.updates++
    } else {
      // UpdateProgram reconstructed the Program: a real load, not a reuse.
      s.loads++
      reused = false
    }
  }
  return reused
}

// check reports the current Program as one-shot check does, loading it first
// when no resident Program survived apply.
func (s *checkServeState) check(reused bool) checkServeResponse {
  var stdout, stderr bytes.Buffer
  opts := s.base
  opts.stdout = &stdout
  opts.stderr = &stderr
  opts.diagnosticReport = diagnosticcompletion.Request{}
  var prog *driver.Program
  var diags []driver.Diagnostic
  if s.session == nil {
    overlay := driver.NewOverlayFS(driver.DefaultFS())
    opts.fs = overlay
    loaded, _, loadDiags, ok := loadUtilityProgramWithDiagnostics(opts)
    if !ok || loaded == nil {
      driver.WritePrettyDiagnostics(&stderr, loadDiags, opts.cwd)
      return checkServeResponse{Status: 2, Stdout: stdout.String(), Stderr: stderr.String()}
    }
    s.loads++
    reused = false
    prog = loaded
    diags = loadDiags
    if !loaded.HasMutatingLinkedCheckPlugins() {
      s.session = driver.NewSessionFromProgram(opts.cwd, overlay, loaded)
    } else {
      defer loaded.Close()
    }
  } else {
    prog = s.session.Program()
    diags = prog.Diagnostics()
  }
  response := checkServeResponse{
    Status:                        0,
    ProgramFiles:                  programFileNames(prog),
    TypeScriptDiagnosticsReported: true,
  }
  response.Telemetry.Reused = reused
  driver.WritePrettyDiagnostics(&stderr, diags, opts.cwd)
  if len(diags) != 0 {
    response.Status = 2
  } else if err := prog.CheckLinkedPlugins(); err != nil {
    fmt.Fprintln(&stderr, err)
    response.Status = 2
  }
  response.Stdout = stdout.String()
  response.Stderr = stderr.String()
  return response
}

// programFileNames lists a Program's files as the compiler names them.
func programFileNames(prog *driver.Program) []string {
  if prog == nil || prog.TSProgram == nil {
    return nil
  }
  files := prog.TSProgram.SourceFiles()
  names := make([]string, 0, len(files))
  for _, file := range files {
    if file != nil {
      names = append(names, string(file.FileName()))
    }
  }
  return names
}
