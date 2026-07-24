package linthost

import (
  "bufio"
  "bytes"
  "encoding/json"
  "fmt"
  "io"
  "os"
  "path/filepath"
  "strings"

  shimdw "github.com/microsoft/typescript-go/shim/diagnosticwriter"
)

// serveCheckRequest is one check-watch cycle. Base compiler, project, plugin,
// and threading options are fixed in RunCheckServe's argv; only filesystem
// state transitions travel over the resident line protocol.
type serveCheckRequest struct {
  Invalidate bool     `json:"invalidate,omitempty"`
  Changed    []string `json:"changed,omitempty"`
  External   []string `json:"external,omitempty"`
}

// serveCheckTelemetry makes residency observable without benchmark-only hooks.
// The launcher exposes it only through the ordinary diagnostics flag.
type serveCheckTelemetry struct {
  PID            int  `json:"pid"`
  ProgramLoads   int  `json:"programLoads"`
  ProgramUpdates int  `json:"programUpdates"`
  Reused         bool `json:"reused"`
}

type serveCheckResponse struct {
  Status    int                 `json:"status"`
  Stdout    string              `json:"stdout"`
  Stderr    string              `json:"stderr"`
  Telemetry serveCheckTelemetry `json:"telemetry"`
}

// residentCheckState owns the one warm Program in a check-serve process.
// Engines, project cycles, diagnostics writers, and output buffers remain
// request-scoped so no rule or reporter state leaks between watch cycles.
type residentCheckState struct {
  program        *program
  programLoads   int
  programUpdates int
}

func (s *residentCheckState) close() {
  if s.program != nil {
    s.program.close()
    s.program = nil
  }
}

// apply translates a compatible filesystem transition into incremental Program
// updates. An unknown non-external path changes the selected compiler topology
// and therefore drops the Program; a declared data input never does.
func (s *residentCheckState) apply(req serveCheckRequest) {
  if req.Invalidate {
    s.close()
  }
  if s.program == nil || len(req.Changed) == 0 {
    return
  }
  external := make(map[string]struct{}, len(req.External))
  for _, location := range req.External {
    if resolved, ok := residentCheckPath(location); ok {
      external[canonicalProjectPath("", realProjectPath(resolved))] = struct{}{}
    }
  }
  changed := make([]string, 0, len(req.Changed))
  for _, location := range req.Changed {
    resolved, ok := residentCheckPath(location)
    if !ok {
      s.close()
      return
    }
    if s.program.sourceFileByPath(resolved) == nil {
      key := canonicalProjectPath("", realProjectPath(resolved))
      if _, ok := external[key]; ok {
        continue
      }
      s.close()
      return
    }
    changed = append(changed, resolved)
  }
  for _, location := range changed {
    s.program.applyChange(location)
    s.programUpdates++
  }
}

func residentCheckPath(location string) (string, bool) {
  if strings.HasPrefix(strings.ToLower(location), "file:") {
    resolved, err := filePathFromURI(location)
    return resolved, err == nil
  }
  if strings.TrimSpace(location) == "" {
    return "", false
  }
  resolved, err := filepath.Abs(location)
  return resolved, err == nil
}

// RunCheckServe runs the check-stage watch daemon. It accepts the same base
// arguments as `check`, reads one JSON request per line, and emits one response
// per request until stdin closes.
func RunCheckServe(in io.Reader, out io.Writer, args []string) int {
  var startup bytes.Buffer
  base, err := parseSubcommandFlagsWithIO(
    "check-serve",
    args,
    io.Discard,
    &startup,
  )
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  base.noEmit = true
  state := &residentCheckState{}
  defer state.close()

  encoder := json.NewEncoder(out)
  reader := bufio.NewReader(in)
  for {
    raw, readErr := reader.ReadString('\n')
    if line := strings.TrimSpace(raw); line != "" {
      handleServeCheckLine(line, base, state, encoder)
    }
    if readErr != nil {
      if readErr != io.EOF {
        fmt.Fprintf(os.Stderr, "@ttsc/lint check-serve: read error: %v\n", readErr)
        return 2
      }
      return 0
    }
  }
}

func handleServeCheckLine(
  line string,
  base *subcommandOpts,
  state *residentCheckState,
  encoder *json.Encoder,
) {
  response := serveCheckResponse{Status: 2}
  defer func() {
    if recovered := recover(); recovered != nil {
      state.close()
      response.Stderr = fmt.Sprintf(
        "@ttsc/lint check-serve: request panicked: %v\n",
        recovered,
      )
    }
    response.Telemetry = serveCheckTelemetry{
      PID:            os.Getpid(),
      ProgramLoads:   state.programLoads,
      ProgramUpdates: state.programUpdates,
      Reused:         response.Telemetry.Reused,
    }
    _ = encoder.Encode(response)
  }()

  var req serveCheckRequest
  if err := json.Unmarshal([]byte(line), &req); err != nil {
    response.Stderr = fmt.Sprintf(
      "@ttsc/lint check-serve: invalid request: %v\n",
      err,
    )
    return
  }
  state.apply(req)
  response = state.run(base)
}

func (s *residentCheckState) run(base *subcommandOpts) serveCheckResponse {
  var stdout bytes.Buffer
  var stderr bytes.Buffer
  opts := *base
  opts.stdout = &stdout
  opts.stderr = &stderr
  opts.noEmit = true

  rules, err := loadRules(opts.pluginsJSON, opts.cwd, opts.tsconfig)
  if err != nil {
    fmt.Fprintln(&stderr, err)
    return s.response(2, stdout, stderr, false)
  }
  engine := NewEngineWithResolver(rules)
  if err := engine.ConfigError(); err != nil {
    fmt.Fprintln(&stderr, err)
    return s.response(2, stdout, stderr, false)
  }
  engine.SetSerial(opts.singleThreaded)

  reused := s.program != nil
  if s.program == nil || (engine.NeedsTypeChecker() && s.program.checker == nil) {
    if s.program != nil {
      s.close()
      reused = false
    }
    prog, parseDiags, err := loadProgram(
      opts.cwd,
      opts.tsconfig,
      loadProgramOptions{
        forceNoEmit:      true,
        needsRuleChecker: engine.NeedsTypeChecker(),
        singleThreaded:   opts.singleThreaded,
        checkers:         opts.checkers,
        tsgoArgs:         opts.tsgoArgs,
        projectIdentity:  opts.projectIdentity,
      },
    )
    if err != nil {
      fmt.Fprintf(&stderr, "@ttsc/lint: %v\n", err)
      return s.response(2, stdout, stderr, false)
    }
    if len(parseDiags) > 0 {
      shimdw.FormatASTDiagnosticsWithColorAndContext(
        &stderr,
        parseDiags,
        opts.cwd,
      )
      if prog != nil {
        prog.close()
      }
      return s.response(2, stdout, stderr, false)
    }
    if prog == nil {
      fmt.Fprintln(&stderr, "@ttsc/lint: Program load returned nil")
      return s.response(2, stdout, stderr, false)
    }
    s.program = prog
    s.programLoads++
  } else {
    // The previous request's ProjectRule memo belongs to its Engine.
    s.program.projectCycle = nil
  }

  astDiags, lintDiags, timing, err := collectDiagnosticsTimed(
    s.program,
    engine,
  )
  if err != nil {
    fmt.Fprintln(&stderr, err)
    return s.response(2, stdout, stderr, reused)
  }
  printLintDiagnosticsTiming(&stdout, opts.diagnostics, timing)
  if opts.diagnostics {
    fmt.Fprintf(
      &stdout,
      "@ttsc/lint resident check: pid=%d programLoads=%d programUpdates=%d reused=%t\n",
      os.Getpid(),
      s.programLoads,
      s.programUpdates,
      reused,
    )
  }
  warnUnknownRules(&stderr, engine.UnknownRules())
  if count := shimdw.FormatMixedDiagnostics(
    &stderr,
    astDiags,
    lintDiags,
    opts.cwd,
  ); count > 0 {
    return s.response(2, stdout, stderr, reused)
  }
  return s.response(0, stdout, stderr, reused)
}

func (s *residentCheckState) response(
  status int,
  stdout bytes.Buffer,
  stderr bytes.Buffer,
  reused bool,
) serveCheckResponse {
  return serveCheckResponse{
    Status: status,
    Stdout: stdout.String(),
    Stderr: stderr.String(),
    Telemetry: serveCheckTelemetry{
      PID:            os.Getpid(),
      ProgramLoads:   s.programLoads,
      ProgramUpdates: s.programUpdates,
      Reused:         reused,
    },
  }
}
