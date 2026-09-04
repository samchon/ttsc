// Subcommand orchestration for the `@ttsc/lint` native binary.
//
// The plugin host shells out to this binary with one of three project
// commands (`check`, `build`, `transform`). Each shares the same setup:
// parse flags, bootstrap a Program + Checker (see host.go), run the lint
// engine alongside tsgo's typecheck diagnostics, and render through
// shim/diagnosticwriter so the output matches `tsgo --noEmit`.
//
// The split between this file and `engine.go` is deliberate: the engine
// is pure (rules + AST traversal), and this file owns every side effect
// (process flags, stderr/stdout, emit, exit codes).
package linthost

import (
  "context"
  "crypto/sha256"
  "encoding/json"
  "errors"
  "flag"
  "fmt"
  "io"
  "os"
  "path/filepath"
  "strings"
  "sync"
  "time"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimdw "github.com/microsoft/typescript-go/shim/diagnosticwriter"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// RunCheck implements `@ttsc/lint check` — typecheck + lint, no emit.
func RunCheck(args []string) int {
  return RunCheckWithIO(args, os.Stdout, os.Stderr)
}

// RunCheckWithIO runs check with invocation-owned output streams.
func RunCheckWithIO(args []string, stdout, stderr io.Writer) int {
  opts, err := parseSubcommandFlagsWithIO("check", args, stdout, stderr)
  if err != nil {
    fmt.Fprintln(stderr, err)
    return 2
  }
  opts.noEmit = true
  return runProject(opts)
}

// RunBuild implements `@ttsc/lint build` — same diagnostic flow as
// `check`, plus the tsgo emit pipeline when emit is requested.
func RunBuild(args []string) int {
  return RunBuildWithIO(args, os.Stdout, os.Stderr)
}

// RunBuildWithIO runs build with invocation-owned output streams.
func RunBuildWithIO(args []string, stdout, stderr io.Writer) int {
  opts, err := parseSubcommandFlagsWithIO("build", args, stdout, stderr)
  if err != nil {
    fmt.Fprintln(stderr, err)
    return 2
  }
  return runProject(opts)
}

// RunTransform implements `@ttsc/lint transform --file=PATH`. Lint rules
// still run for the whole program (lint quality depends on context), but
// emit is restricted to the requested file's JS output.
func RunTransform(args []string) int {
  return RunTransformWithIO(args, os.Stdout, os.Stderr)
}

// RunTransformWithIO runs transform with invocation-owned output streams.
func RunTransformWithIO(args []string, stdout, stderr io.Writer) int {
  semanticConfigPath := os.Getenv(semanticConfigPathEnv)
  fs := flag.NewFlagSet("transform", flag.ContinueOnError)
  fs.SetOutput(stderr)
  file := fs.String("file", "", "absolute or cwd-relative path of the .ts file to transform")
  out := fs.String("out", "", "write output JS to PATH (default: stdout)")
  tsconfig := fs.String("tsconfig", "tsconfig.json", "tsconfig owning --file")
  cwd := fs.String("cwd", "", "override the working directory")
  pluginsJSON := fs.String("plugins-json", "", "ttsc plugin manifest JSON")
  projectContextJSON := fs.String("project-context-json", "", "ttsc project identity JSON")
  singleThreaded := fs.Bool("singleThreaded", false, "run TypeScript-Go single-threaded")
  checkers := fs.Int("checkers", 0, "type-checker pool size (0 = TypeScript-Go default)")
  tsgoArgsRaw := fs.String("tsgo-args", "", "JSON array of forwarded tsgo CLI flags")
  _ = fs.Bool("diagnostics", false, "print @ttsc/lint diagnostics timing")
  _ = fs.Bool("extendedDiagnostics", false, "print @ttsc/lint diagnostics timing")
  if err := fs.Parse(filterKnownFlags(args, LintFlagAllowList)); err != nil {
    return 2
  }
  if *file == "" {
    fmt.Fprintln(stderr, "@ttsc/lint transform: --file is required")
    return 2
  }
  tsgoArgs, err := decodeTsgoArgs(*tsgoArgsRaw)
  if err != nil {
    fmt.Fprintln(stderr, err)
    return 2
  }
  resolvedCwd, err := resolveCwd(*cwd)
  if err != nil {
    fmt.Fprintln(stderr, err)
    return 2
  }
  projectIdentity, err := decodeProjectIdentity(*projectContextJSON)
  if err != nil {
    fmt.Fprintln(stderr, err)
    return 2
  }
  rules, err := loadRules(*pluginsJSON, resolvedCwd, *tsconfig)
  if err != nil {
    fmt.Fprintln(stderr, err)
    return 2
  }
  engine := NewEngineWithResolver(rules)
  if err := engine.ConfigError(); err != nil {
    fmt.Fprintln(stderr, err)
    return 2
  }
  engine.SetSerial(*singleThreaded)

  prog, parseDiags, err := loadProgram(resolvedCwd, *tsconfig, loadProgramOptions{
    forceEmit:          true,
    semanticConfigPath: semanticConfigPath,
    needsRuleChecker:   engine.NeedsTypeChecker(),
    singleThreaded:     *singleThreaded,
    checkers:           *checkers,
    tsgoArgs:           tsgoArgs,
    projectIdentity:    projectIdentity,
  })
  if err != nil {
    fmt.Fprintf(stderr, "@ttsc/lint: %v\n", err)
    return 2
  }
  if len(parseDiags) > 0 {
    shimdw.FormatASTDiagnosticsWithColorAndContext(stderr, parseDiags, resolvedCwd)
    return 2
  }
  defer prog.close()

  astDiags, lintDiags, err := collectDiagnostics(prog, engine)
  if err != nil {
    fmt.Fprintln(stderr, err)
    return 2
  }
  warnUnknownRules(stderr, engine.UnknownRules())
  if errors := shimdw.FormatMixedDiagnostics(stderr, astDiags, lintDiags, resolvedCwd); errors > 0 {
    return 2
  }

  // tsgo normalizes SourceFile.FileName() through tspath, resolving "."/".."
  // segments as well as separators. findSourceFile's comparison only swaps
  // separators, so an absolute --file value carrying an unresolved "."/".."
  // round-trip (or, on a POSIX host, backslash separators) could name the
  // right file and still miss (samchon/ttsc#319 is this same gap in ttsc's
  // resident serve host).
  absFile := shimtspath.ResolvePath(resolvedCwd, *file)
  target := prog.findSourceFile(absFile)
  if target == nil {
    fmt.Fprintf(stderr, "@ttsc/lint transform: source file not in program: %s\n", absFile)
    return 2
  }

  var captured string
  capture := func(name, text string, _ *shimcompiler.WriteFileData) error {
    if !isJavaScriptOutput(name) {
      return nil
    }
    captured = text
    return nil
  }
  result := prog.tsProgram.Emit(context.Background(), shimcompiler.EmitOptions{
    TargetSourceFile: target,
    WriteFile:        shimcompiler.WriteFile(capture),
  })
  if result == nil {
    fmt.Fprintln(stderr, "@ttsc/lint transform: Emit returned nil")
    return 3
  }
  if len(result.Diagnostics) > 0 {
    shimdw.FormatASTDiagnosticsWithColorAndContext(stderr, result.Diagnostics, resolvedCwd)
  }
  if captured == "" {
    fmt.Fprintf(stderr, "@ttsc/lint transform: no output produced for %s\n", absFile)
    return 3
  }
  if *out == "" {
    fmt.Fprint(stdout, captured)
    return 0
  }
  if err := os.MkdirAll(filepath.Dir(*out), 0o755); err != nil {
    fmt.Fprintf(stderr, "@ttsc/lint transform: mkdir: %v\n", err)
    return 3
  }
  if err := os.WriteFile(*out, []byte(captured), 0o644); err != nil {
    fmt.Fprintf(stderr, "@ttsc/lint transform: write: %v\n", err)
    return 3
  }
  return 0
}

type subcommandOpts struct {
  cwd                string
  tsconfig           string
  pluginsJSON        string
  emit               bool
  noEmit             bool
  quiet              bool
  verbose            bool
  diagnostics        bool
  outDir             string
  semanticConfigPath string
  singleThreaded     bool
  checkers           int
  tsgoArgs           []string
  projectIdentity    publicrule.ProjectIdentity
  stdout             io.Writer
  stderr             io.Writer
}

// parseSubcommandFlags parses the shared flag set used by the `check`,
// `build`, and `fix`/`format` subcommands. Unknown flags are silently
// stripped by `filterKnownFlags` before the standard FlagSet sees them.
func parseSubcommandFlags(name string, args []string) (*subcommandOpts, error) {
  return parseSubcommandFlagsWithIO(name, args, os.Stdout, os.Stderr)
}

func parseSubcommandFlagsWithIO(name string, args []string, stdout, stderr io.Writer) (*subcommandOpts, error) {
  semanticConfigPath := os.Getenv(semanticConfigPathEnv)
  if stdout == nil {
    stdout = io.Discard
  }
  if stderr == nil {
    stderr = io.Discard
  }
  fs := flag.NewFlagSet(name, flag.ContinueOnError)
  fs.SetOutput(stderr)
  cwd := fs.String("cwd", "", "")
  tsconfig := fs.String("tsconfig", "tsconfig.json", "")
  pluginsJSON := fs.String("plugins-json", "", "")
  projectContextJSON := fs.String("project-context-json", "", "")
  emit := fs.Bool("emit", false, "")
  noEmit := fs.Bool("noEmit", false, "")
  quiet := fs.Bool("quiet", false, "")
  verbose := fs.Bool("verbose", false, "")
  diagnostics := fs.Bool("diagnostics", false, "")
  extendedDiagnostics := fs.Bool("extendedDiagnostics", false, "")
  outDir := fs.String("outDir", "", "")
  singleThreaded := fs.Bool("singleThreaded", false, "")
  checkers := fs.Int("checkers", 0, "")
  tsgoArgsRaw := fs.String("tsgo-args", "", "")
  if err := fs.Parse(filterKnownFlags(args, LintFlagAllowList)); err != nil {
    return nil, err
  }
  if *emit && *noEmit {
    return nil, errors.New("@ttsc/lint: --emit and --noEmit are mutually exclusive")
  }
  tsgoArgs, err := decodeTsgoArgs(*tsgoArgsRaw)
  if err != nil {
    return nil, err
  }
  resolvedCwd, err := resolveCwd(*cwd)
  if err != nil {
    return nil, err
  }
  projectIdentity, err := decodeProjectIdentity(*projectContextJSON)
  if err != nil {
    return nil, err
  }
  return &subcommandOpts{
    cwd:                resolvedCwd,
    tsconfig:           *tsconfig,
    pluginsJSON:        *pluginsJSON,
    emit:               *emit,
    noEmit:             *noEmit,
    quiet:              *quiet,
    verbose:            *verbose,
    diagnostics:        *diagnostics || *extendedDiagnostics,
    outDir:             *outDir,
    semanticConfigPath: semanticConfigPath,
    singleThreaded:     *singleThreaded,
    checkers:           *checkers,
    tsgoArgs:           tsgoArgs,
    projectIdentity:    projectIdentity,
    stdout:             stdout,
    stderr:             stderr,
  }, nil
}

// tsgoArgsEnv mirrors `driver.TsgoArgsEnv`: the environment channel the ttsc
// launcher publishes forwarded tsgo argv on. The name is duplicated rather
// than imported because this host deliberately does not depend on the ttsc
// driver module (see host.go).
const tsgoArgsEnv = "TTSC_TSGO_ARGS"

// decodeTsgoArgs decodes the JSON-array value of the `--tsgo-args` flag — the
// tsgo CLI flags the `ttsc` launcher forwarded — into a string slice.
//
// When the flag is absent the value is read from `TTSC_TSGO_ARGS` instead. The
// launcher moved the payload to the environment because a `--tsgo-args` flag
// is fatal to any sidecar whose `flag.FlagSet` predates it (issue #1188); the
// flag stays accepted so an older launcher paired with this host still works.
// An absent flag and an absent variable yield a nil slice.
func decodeTsgoArgs(raw string) ([]string, error) {
  source := "--tsgo-args"
  if raw == "" {
    raw = strings.TrimSpace(os.Getenv(tsgoArgsEnv))
    source = tsgoArgsEnv
  }
  if raw == "" {
    return nil, nil
  }
  var args []string
  if err := json.Unmarshal([]byte(raw), &args); err != nil {
    return nil, fmt.Errorf("@ttsc/lint: invalid %s: %w", source, err)
  }
  return args, nil
}

// runProject is the shared body of RunCheck and RunBuild. It loads the
// program, collects diagnostics, renders them, and optionally emits
// JavaScript output when the config allows it.
func runProject(opts *subcommandOpts) int {
  rules, err := loadRules(opts.pluginsJSON, opts.cwd, opts.tsconfig)
  if err != nil {
    fmt.Fprintln(opts.stderr, err)
    return 2
  }
  engine := NewEngineWithResolver(rules)
  if err := engine.ConfigError(); err != nil {
    fmt.Fprintln(opts.stderr, err)
    return 2
  }
  engine.SetSerial(opts.singleThreaded)

  prog, parseDiags, err := loadProgram(opts.cwd, opts.tsconfig, loadProgramOptions{
    forceEmit:          opts.emit,
    forceNoEmit:        opts.noEmit,
    outDir:             opts.outDir,
    semanticConfigPath: opts.semanticConfigPath,
    needsRuleChecker:   engine.NeedsTypeChecker(),
    singleThreaded:     opts.singleThreaded,
    checkers:           opts.checkers,
    tsgoArgs:           opts.tsgoArgs,
    projectIdentity:    opts.projectIdentity,
  })
  if err != nil {
    fmt.Fprintf(opts.stderr, "@ttsc/lint: %v\n", err)
    return 2
  }
  if len(parseDiags) > 0 {
    shimdw.FormatASTDiagnosticsWithColorAndContext(opts.stderr, parseDiags, opts.cwd)
    return 2
  }
  defer prog.close()

  astDiags, lintDiags, diagnosticsTiming, err := collectDiagnosticsTimed(prog, engine)
  if err != nil {
    fmt.Fprintln(opts.stderr, err)
    return 2
  }
  printLintDiagnosticsTiming(opts.stdout, opts.diagnostics, diagnosticsTiming)
  warnUnknownRules(opts.stderr, engine.UnknownRules())
  if errCount := shimdw.FormatMixedDiagnostics(opts.stderr, astDiags, lintDiags, opts.cwd); errCount > 0 {
    return 2
  }

  if opts.noEmit || prog.parsed.ParsedConfig.CompilerOptions.NoEmit.IsTrue() {
    return 0
  }

  result := prog.tsProgram.Emit(context.Background(), shimcompiler.EmitOptions{
    WriteFile: shimcompiler.WriteFile(func(fileName, text string, data *shimcompiler.WriteFileData) error {
      return defaultWriteFile(fileName, text)
    }),
  })
  if result == nil {
    fmt.Fprintln(opts.stderr, "@ttsc/lint: Emit returned nil")
    return 3
  }
  if len(result.Diagnostics) > 0 {
    errCount := shimdw.FormatMixedDiagnostics(opts.stderr, result.Diagnostics, nil, opts.cwd)
    if errCount > 0 {
      return 2
    }
  }
  if opts.verbose && result.EmittedFiles != nil {
    fmt.Fprintf(opts.stdout, "@ttsc/lint: emitted=%d files\n", len(result.EmittedFiles))
    for _, f := range result.EmittedFiles {
      fmt.Fprintln(opts.stdout, "  +", f)
    }
  }
  return 0
}

// residentRules is the resident daemon's memo of one project's loaded rule
// configuration, installed by RunLSPServe and nil in every one-shot process.
//
// Loading rules evaluates the project's `lint.config.ts`, which means standing
// up a JavaScript runtime — the dominant cost of a verb that builds no Program
// at all. A one-shot pays it once and exits; the daemon was paying it per
// request, which is per document edit for a consumer that asks again whenever a
// file it watches moves.
var residentRules *residentRuleCache

type residentRuleCache struct {
  mu       sync.Mutex
  key      string
  resolver RuleResolver
  configs  *residentRuleConfigSnapshot
  // loads counts the resolver loads this memo did not avoid.
  //
  // It exists because a reuse is otherwise unobservable: a RuleResolver holds
  // maps, so it is not a comparable type and two of them cannot be asked
  // whether they are the same one. Without a count, a memo that silently never
  // hit would satisfy every other property asked of it.
  loads int
}

// residentRuleConfigState is the resolver-owned description of every input a
// resident answer depends on. Files are native JSON configs; dependencies are
// the executable loader's full fingerprints, including cache-only package
// files that deliberately stay out of ConfigPaths and external watch lists.
type residentRuleConfigState struct {
  dependencies []configDependencyFingerprint
  files        []string
}

type residentRuleConfigSnapshot struct {
  dependencies []configDependencyFingerprint
  files        map[string][sha256.Size]byte
}

// acquireRules returns the loaded rule configuration, reusing the daemon's memo
// while the complete state it was loaded from is unchanged.
//
// Native JSON configs are validated against their files. Executable configs
// retain the loader's complete dependency fingerprints, including missing
// resolution candidates and cache-only package files. The latter must remain
// outside public project watch lists without becoming invisible to the resident
// memo: an imported package edit can change the resolved rules just as surely
// as an edit to lint.config.ts itself.
func acquireRules(pluginsJSON, cwd, tsconfigPath string) (RuleResolver, error) {
  cache := residentRules
  if cache == nil {
    return loadRules(pluginsJSON, cwd, tsconfigPath)
  }
  key := strings.Join([]string{pluginsJSON, cwd, tsconfigPath}, "\x00")
  cache.mu.Lock()
  defer cache.mu.Unlock()
  if cache.resolver != nil &&
    cache.key == key &&
    ruleConfigsUnchanged(cache.configs) {
    return cache.resolver, nil
  }
  cache.loads++
  // Noted before the load, because the load is what the recorded state has to
  // describe. Evaluating a configuration stands up a JavaScript runtime and
  // takes seconds, which is ample room for an author's next save to land, and
  // a state read afterwards would describe that save rather than the resolver
  // built from what came before it.
  started := time.Now()
  resolver, err := loadRules(pluginsJSON, cwd, tsconfigPath)
  if err != nil {
    // A failed load clears the memo rather than leaving the previous answer
    // reachable: the next request has to see the same failure, not a rule set
    // from before the edit that broke it.
    cache.resolver = nil
    cache.configs = nil
    return nil, err
  }
  cache.key = key
  cache.resolver = resolver
  cache.configs = hashRuleConfigs(resolver, started)
  return resolver, nil
}

// hashRuleConfigs records the complete state the resolver was built from. JSON
// configs contribute file digests. Executable configs contribute the loader's
// full dependency fingerprints, including missing resolution candidates,
// directories, and cache-only package files that are not public watch inputs.
// A resolver naming no state records nothing, and a memo with no proof is never
// reused.
//
// A native JSON file written after the load began is recorded as nothing at
// all. Which bytes the resolver was built from is unknowable once an edit lands
// inside the evaluation window, and recording the ones readable now is the one
// wrong answer that never corrects itself: the memo would agree with a file the
// resolver does not match, and every later request would pass the reuse test
// until some further edit happened to disagree. Executable configs carry the
// loader's own pre/post dependency proof instead. Declining costs one reload.
//
// After, and not "not before". A filesystem timestamp and the instant the load
// began are read from the same clock, whose tick is coarse on Windows, so the
// save an author made just before asking shares its tick with the load start
// far more often than not — and rejecting equality there rejects every
// recording the memo could ever make. The write that equality could also mean
// is one the load's own read, hundreds of milliseconds later behind a
// JavaScript runtime start, would have picked up regardless; the edit this
// guard is for lands well inside the evaluation and is well past the tick.
//
// Read first and stated second, in that order. A write landing between the two
// moves the modification time forward and is caught; stating it first would
// leave the window the check exists to close.
func hashRuleConfigs(resolver RuleResolver, started time.Time) *residentRuleConfigSnapshot {
  if configCacheDisabled() {
    return nil
  }
  source, ok := resolver.(interface {
    residentRuleConfigState() residentRuleConfigState
  })
  if !ok {
    return nil
  }
  state := source.residentRuleConfigState()
  if len(state.files) == 0 && len(state.dependencies) == 0 {
    return nil
  }
  if !configDependencyDigestsAreCurrent(state.dependencies) {
    return nil
  }
  configs := make(map[string][sha256.Size]byte, len(state.files))
  for _, location := range state.files {
    contents, err := os.ReadFile(location)
    if err != nil {
      return nil
    }
    info, err := os.Stat(location)
    if err != nil || info.ModTime().After(started) {
      return nil
    }
    configs[location] = sha256.Sum256(contents)
  }
  return &residentRuleConfigSnapshot{
    dependencies: state.dependencies,
    files:        configs,
  }
}

func ruleConfigsUnchanged(configs *residentRuleConfigSnapshot) bool {
  if configCacheDisabled() ||
    configs == nil ||
    (len(configs.files) == 0 && len(configs.dependencies) == 0) ||
    !configDependencyDigestsAreCurrent(configs.dependencies) {
    return false
  }
  for location, recorded := range configs.files {
    contents, err := os.ReadFile(location)
    if err != nil || sha256.Sum256(contents) != recorded {
      return false
    }
  }
  return true
}

// loadRules decodes `--plugins-json`, locates the `@ttsc/lint` entry, and
// returns its resolved RuleResolver. Returns an empty RuleConfig (no rules
// enabled) when the lint entry is absent from the plugin manifest.
func loadRules(pluginsJSON, cwd, tsconfigPath string) (RuleResolver, error) {
  entries, err := ParsePlugins(pluginsJSON)
  if err != nil {
    return nil, err
  }
  entry, err := FindLintEntry(entries)
  if err != nil {
    return nil, err
  }
  if entry == nil {
    return bindProjectRuleResolver(RuleConfig{})
  }
  resolver, err := LoadConfigResolver(entry, cwd, tsconfigPath)
  if err != nil {
    return nil, err
  }
  return bindProjectRuleResolver(resolver)
}

func decodeProjectIdentity(raw string) (publicrule.ProjectIdentity, error) {
  if strings.TrimSpace(raw) == "" {
    return publicrule.ProjectIdentity{}, nil
  }
  var identity publicrule.ProjectIdentity
  if err := json.Unmarshal([]byte(raw), &identity); err != nil {
    return publicrule.ProjectIdentity{}, fmt.Errorf("@ttsc/lint: invalid --project-context-json: %w", err)
  }
  return identity, nil
}

// warnUnknownRules writes one warning line per name in `unknown` to `w`.
// Called after engine construction so a config that names a rule the native
// engine does not implement surfaces a loud warning instead of silently
// linting nothing for that rule.
func warnUnknownRules(w io.Writer, unknown []string) {
  for _, name := range unknown {
    fmt.Fprintf(w, "@ttsc/lint: ignoring unknown rule %q\n", name)
  }
}

// filterKnownFlags strips flags from `args` that are not present in `known`.
// The `known` map value is true when the flag takes a separate value token
// (e.g. `--tsconfig tsconfig.json`) and false for boolean flags. Unknown
// flags are silently dropped along with their value token when present.
// This lets the host forward a superset of flags without confusing the
// standard library's FlagSet.
func filterKnownFlags(args []string, known map[string]bool) []string {
  out := make([]string, 0, len(args))
  for i := 0; i < len(args); i++ {
    arg := args[i]
    if !strings.HasPrefix(arg, "-") || arg == "-" {
      out = append(out, arg)
      continue
    }
    name := strings.TrimLeft(arg, "-")
    hasValue := strings.Contains(name, "=")
    if index := strings.Index(name, "="); index >= 0 {
      name = name[:index]
    }
    // Lower-cased to match the one normalization the schema uses when it
    // generates this allow-list (`normalizeFlagToken` in
    // packages/ttsc/src/flags/schema.ts): TypeScript's option parser matches
    // names case-insensitively, so an exact-spelling lookup here would stop
    // recognising a flag the launcher already resolved.
    needsValue, ok := known[strings.ToLower(name)]
    if !ok {
      if !hasValue && i+1 < len(args) && !strings.HasPrefix(args[i+1], "-") {
        i++
      }
      continue
    }
    out = append(out, arg)
    if needsValue && !hasValue && i+1 < len(args) {
      i++
      out = append(out, args[i])
    }
  }
  return out
}

// collectDiagnostics collects tsgo typecheck diagnostics and lint findings
// for the shared renderer. FormatMixedDiagnostics establishes one source
// order across those independent producer slices.
func collectDiagnostics(prog *program, engine *Engine) ([]*shimast.Diagnostic, []*shimdw.LintDiagnostic, error) {
  astDiags, lintDiags, _, err := collectDiagnosticsTimed(prog, engine)
  return astDiags, lintDiags, err
}

type lintDiagnosticsTiming struct {
  lint time.Duration
}

func collectDiagnosticsTimed(prog *program, engine *Engine) ([]*shimast.Diagnostic, []*shimdw.LintDiagnostic, lintDiagnosticsTiming, error) {
  timing := lintDiagnosticsTiming{}
  astDiags := prog.programDiagnostics()
  lintStarted := time.Now()
  findings := prog.runLintCycle(engine)
  timing.lint = time.Since(lintStarted)
  nativeDiags := make([]*shimdw.LintDiagnostic, 0, len(findings))
  for _, finding := range findings {
    category := shimdw.LintCategoryError
    if finding.Severity == SeverityWarn {
      category = shimdw.LintCategoryWarning
    }
    nativeDiags = append(nativeDiags, shimdw.NewLintDiagnostic(
      finding.File,
      finding.Pos,
      finding.End,
      ruleCode(finding.Rule),
      category,
      fmt.Sprintf("[%s] %s", finding.Rule, finding.Message),
    ))
  }
  return astDiags, nativeDiags, timing, nil
}

func printLintDiagnosticsTiming(w io.Writer, enabled bool, timing lintDiagnosticsTiming) {
  if !enabled {
    return
  }
  fmt.Fprintf(w, "@ttsc/lint time: %s\n", formatTimingSeconds(timing.lint))
}

func formatTimingSeconds(duration time.Duration) string {
  return fmt.Sprintf("%.3fs", duration.Seconds())
}

// resolveCwd returns an absolute working directory. When `override` is
// non-empty it is made absolute; otherwise the process working directory
// is returned.
func resolveCwd(override string) (string, error) {
  if override != "" {
    abs, err := filepath.Abs(override)
    if err != nil {
      return "", fmt.Errorf("@ttsc/lint: --cwd: %w", err)
    }
    return abs, nil
  }
  wd, err := os.Getwd()
  if err != nil {
    return "", fmt.Errorf("@ttsc/lint: cwd: %w", err)
  }
  return wd, nil
}

// isJavaScriptOutput reports whether `name` has a JavaScript output
// extension (.js, .mjs, or .cjs). Used to filter the emit callback so
// that `RunTransform` captures only the JS output for the target file.
func isJavaScriptOutput(name string) bool {
  switch strings.ToLower(filepath.Ext(name)) {
  case ".js", ".mjs", ".cjs":
    return true
  default:
    return false
  }
}

// defaultWriteFile creates all parent directories and writes `text` to
// `name` with mode 0644. Used as the WriteFile callback in `runProject`
// when the user requested emit.
func defaultWriteFile(name string, text string) error {
  if err := os.MkdirAll(filepath.Dir(name), 0o755); err != nil {
    return err
  }
  return os.WriteFile(name, []byte(text), 0o644)
}
