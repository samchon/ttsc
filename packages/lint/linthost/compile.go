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
  "encoding/json"
  "errors"
  "flag"
  "fmt"
  "io"
  "os"
  "path/filepath"
  "strings"
  "time"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimdw "github.com/microsoft/typescript-go/shim/diagnosticwriter"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// RunCheck implements `@ttsc/lint check` — typecheck + lint, no emit.
func RunCheck(args []string) int {
  opts, err := parseSubcommandFlags("check", args)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  opts.noEmit = true
  return runProject(opts)
}

// RunBuild implements `@ttsc/lint build` — same diagnostic flow as
// `check`, plus the tsgo emit pipeline when emit is requested.
func RunBuild(args []string) int {
  opts, err := parseSubcommandFlags("build", args)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  return runProject(opts)
}

// RunTransform implements `@ttsc/lint transform --file=PATH`. Lint rules
// still run for the whole program (lint quality depends on context), but
// emit is restricted to the requested file's JS output.
func RunTransform(args []string) int {
  fs := flag.NewFlagSet("transform", flag.ContinueOnError)
  fs.SetOutput(os.Stderr)
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
    fmt.Fprintln(os.Stderr, "@ttsc/lint transform: --file is required")
    return 2
  }
  tsgoArgs, err := decodeTsgoArgs(*tsgoArgsRaw)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  resolvedCwd, err := resolveCwd(*cwd)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  projectIdentity, err := decodeProjectIdentity(*projectContextJSON)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  rules, err := loadRules(*pluginsJSON, resolvedCwd, *tsconfig)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  engine := NewEngineWithResolver(rules)
  if err := engine.ConfigError(); err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  engine.SetSerial(*singleThreaded)

  prog, parseDiags, err := loadProgram(resolvedCwd, *tsconfig, loadProgramOptions{
    forceEmit:        true,
    needsRuleChecker: engine.NeedsTypeChecker(),
    singleThreaded:   *singleThreaded,
    checkers:         *checkers,
    tsgoArgs:         tsgoArgs,
    projectIdentity:  projectIdentity,
  })
  if err != nil {
    fmt.Fprintf(os.Stderr, "@ttsc/lint: %v\n", err)
    return 2
  }
  if len(parseDiags) > 0 {
    shimdw.FormatASTDiagnosticsWithColorAndContext(os.Stderr, parseDiags, resolvedCwd)
    return 2
  }
  defer prog.close()

  astDiags, lintDiags, err := collectDiagnostics(prog, engine)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  warnUnknownRules(os.Stderr, engine.UnknownRules())
  if errors := shimdw.FormatMixedDiagnostics(os.Stderr, astDiags, lintDiags, resolvedCwd); errors > 0 {
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
    fmt.Fprintf(os.Stderr, "@ttsc/lint transform: source file not in program: %s\n", absFile)
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
    fmt.Fprintln(os.Stderr, "@ttsc/lint transform: Emit returned nil")
    return 3
  }
  if len(result.Diagnostics) > 0 {
    shimdw.FormatASTDiagnosticsWithColorAndContext(os.Stderr, result.Diagnostics, resolvedCwd)
  }
  if captured == "" {
    fmt.Fprintf(os.Stderr, "@ttsc/lint transform: no output produced for %s\n", absFile)
    return 3
  }
  if *out == "" {
    fmt.Fprint(os.Stdout, captured)
    return 0
  }
  if err := os.MkdirAll(filepath.Dir(*out), 0o755); err != nil {
    fmt.Fprintf(os.Stderr, "@ttsc/lint transform: mkdir: %v\n", err)
    return 3
  }
  if err := os.WriteFile(*out, []byte(captured), 0o644); err != nil {
    fmt.Fprintf(os.Stderr, "@ttsc/lint transform: write: %v\n", err)
    return 3
  }
  return 0
}

type subcommandOpts struct {
  cwd             string
  tsconfig        string
  pluginsJSON     string
  emit            bool
  noEmit          bool
  quiet           bool
  verbose         bool
  diagnostics     bool
  outDir          string
  singleThreaded  bool
  checkers        int
  tsgoArgs        []string
  projectIdentity publicrule.ProjectIdentity
}

// parseSubcommandFlags parses the shared flag set used by the `check`,
// `build`, and `fix`/`format` subcommands. Unknown flags are silently
// stripped by `filterKnownFlags` before the standard FlagSet sees them.
func parseSubcommandFlags(name string, args []string) (*subcommandOpts, error) {
  fs := flag.NewFlagSet(name, flag.ContinueOnError)
  fs.SetOutput(os.Stderr)
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
    cwd:             resolvedCwd,
    tsconfig:        *tsconfig,
    pluginsJSON:     *pluginsJSON,
    emit:            *emit,
    noEmit:          *noEmit,
    quiet:           *quiet,
    verbose:         *verbose,
    diagnostics:     *diagnostics || *extendedDiagnostics,
    outDir:          *outDir,
    singleThreaded:  *singleThreaded,
    checkers:        *checkers,
    tsgoArgs:        tsgoArgs,
    projectIdentity: projectIdentity,
  }, nil
}

// decodeTsgoArgs decodes the JSON-array value of the `--tsgo-args` flag — the
// tsgo CLI flags the `ttsc` launcher forwarded — into a string slice. An empty
// flag yields a nil slice.
func decodeTsgoArgs(raw string) ([]string, error) {
  if raw == "" {
    return nil, nil
  }
  var args []string
  if err := json.Unmarshal([]byte(raw), &args); err != nil {
    return nil, fmt.Errorf("@ttsc/lint: invalid --tsgo-args: %w", err)
  }
  return args, nil
}

// runProject is the shared body of RunCheck and RunBuild. It loads the
// program, collects diagnostics, renders them, and optionally emits
// JavaScript output when the config allows it.
func runProject(opts *subcommandOpts) int {
  rules, err := loadRules(opts.pluginsJSON, opts.cwd, opts.tsconfig)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  engine := NewEngineWithResolver(rules)
  if err := engine.ConfigError(); err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  engine.SetSerial(opts.singleThreaded)

  prog, parseDiags, err := loadProgram(opts.cwd, opts.tsconfig, loadProgramOptions{
    forceEmit:        opts.emit,
    forceNoEmit:      opts.noEmit,
    outDir:           opts.outDir,
    needsRuleChecker: engine.NeedsTypeChecker(),
    singleThreaded:   opts.singleThreaded,
    checkers:         opts.checkers,
    tsgoArgs:         opts.tsgoArgs,
    projectIdentity:  opts.projectIdentity,
  })
  if err != nil {
    fmt.Fprintf(os.Stderr, "@ttsc/lint: %v\n", err)
    return 2
  }
  if len(parseDiags) > 0 {
    shimdw.FormatASTDiagnosticsWithColorAndContext(os.Stderr, parseDiags, opts.cwd)
    return 2
  }
  defer prog.close()

  astDiags, lintDiags, diagnosticsTiming, err := collectDiagnosticsTimed(prog, engine)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  printLintDiagnosticsTiming(os.Stdout, opts.diagnostics, diagnosticsTiming)
  warnUnknownRules(os.Stderr, engine.UnknownRules())
  if errCount := shimdw.FormatMixedDiagnostics(os.Stderr, astDiags, lintDiags, opts.cwd); errCount > 0 {
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
    fmt.Fprintln(os.Stderr, "@ttsc/lint: Emit returned nil")
    return 3
  }
  if len(result.Diagnostics) > 0 {
    errCount := shimdw.FormatMixedDiagnostics(os.Stderr, result.Diagnostics, nil, opts.cwd)
    if errCount > 0 {
      return 2
    }
  }
  if opts.verbose && result.EmittedFiles != nil {
    fmt.Fprintf(os.Stdout, "@ttsc/lint: emitted=%d files\n", len(result.EmittedFiles))
    for _, f := range result.EmittedFiles {
      fmt.Fprintln(os.Stdout, "  +", f)
    }
  }
  return 0
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
    needsValue, ok := known[name]
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

// collectDiagnostics merges tsgo typecheck diagnostics with the lint
// engine's findings. The renderer takes the two slices and walks them in
// source order, so we don't need to interleave here.
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
