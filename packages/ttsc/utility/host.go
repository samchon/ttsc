package utility

import (
  "encoding/json"
  "flag"
  "fmt"
  "os"
  "path/filepath"
  "strings"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"
  "github.com/microsoft/typescript-go/shim/vfs"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// hostOptions is the parsed form of the flags accepted by the subcommands
// (check, build, transform, serve).
type hostOptions struct {
  cwd            string
  emit           bool
  noEmit         bool
  outDir         string
  pluginsJSON    string
  quiet          bool
  tsconfig       string
  verbose        bool
  singleThreaded bool
  checkers       int
  tsgoArgs       []string
  // fs overrides the filesystem the program loads from. Only the resident serve
  // host sets it (to an OverlayFS), so build/check/transform leave it nil and
  // LoadProgram falls back to the default filesystem.
  fs vfs.FS
}

// transformResult is the JSON envelope written to stdout by RunTransform.
// TypeScript maps relative output key → printer output; Diagnostics is
// reserved for future plugin diagnostics (currently always empty/omitted).
type transformResult struct {
  Diagnostics []any             `json:"diagnostics,omitempty"`
  TypeScript  map[string]string `json:"typescript"`
}

// RunCheck validates the project and linked plugin configuration without
// emitting output.
func RunCheck(args []string) int {
  opts, ok := parseHostOptions("check", args)
  if !ok {
    return 2
  }
  opts.noEmit = true
  prog, _, ok := loadUtilityProgram(opts)
  if !ok {
    return 2
  }
  defer prog.Close()
  if err := prog.ApplyLinkedPlugins(); err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  return 0
}

// RunBuild hosts linked transform packages inside one compiler emit.
func RunBuild(args []string) int {
  opts, ok := parseHostOptions("build", args)
  if !ok {
    return 2
  }
  prog, entries, ok := loadUtilityProgram(opts)
  if !ok {
    return 2
  }
  defer prog.Close()
  if opts.noEmit {
    return 0
  }
  if opts.verbose {
    opts.quiet = false // --verbose overrides the default --quiet=true
  }
  if !opts.quiet {
    fmt.Fprintf(os.Stdout, "// ttsc utility: plugins=%d emit=%v\n", len(entries), !opts.noEmit)
  }
  res, eDiags, err := prog.EmitAllRaw(makeSourcePreambleWriteFile(prog))
  if err != nil {
    fmt.Fprintf(os.Stderr, "ttsc utility: emit failed: %v\n", err)
    return 3
  }
  for _, d := range eDiags {
    fmt.Fprintln(os.Stderr, "  -", d.String())
  }
  if driver.CountErrors(eDiags) > 0 {
    return 2
  }
  if res != nil && !opts.quiet {
    fmt.Fprintf(os.Stdout, "// ttsc utility: emitted=%d files\n", len(res.EmittedFiles))
  }
  return 0
}

// RunTransform returns the project TypeScript text after linked source
// mutations.
func RunTransform(args []string) int {
  opts, ok := parseHostOptions("transform", args)
  if !ok {
    return 2
  }
  prog, _, ok := loadUtilityProgram(opts)
  if !ok {
    return 2
  }
  defer prog.Close()
  if err := prog.ApplyLinkedPlugins(); err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  printer := shimprinter.NewPrinter(shimprinter.PrinterOptions{}, shimprinter.PrintHandlers{}, nil)
  out := transformResult{TypeScript: map[string]string{}}
  for _, file := range prog.SourceFiles() {
    text := shimprinter.EmitSourceFile(printer, file)
    out.TypeScript[apiOutputKey(opts.cwd, file.FileName())] = text
  }
  data, _ := json.Marshal(out)
  fmt.Fprintln(os.Stdout, string(data))
  return 0
}

// parseHostOptions parses the standard flag set for the given subcommand name.
// Unknown flags forwarded from the JS launcher are stripped by filterHostArgs
// before flag.FlagSet sees them, so spurious "flag provided but not defined"
// errors are avoided. Returns (zero, false) on any parse or validation error.
func parseHostOptions(command string, args []string) (hostOptions, bool) {
  fs := flag.NewFlagSet(command, flag.ContinueOnError)
  fs.SetOutput(os.Stderr)
  cwd := fs.String("cwd", "", "project directory")
  emit := fs.Bool("emit", false, "force emit")
  noEmit := fs.Bool("noEmit", false, "force no emit")
  outDir := fs.String("outDir", "", "emit directory override")
  pluginsJSON := fs.String("plugins-json", "", "ttsc plugin manifest JSON")
  quiet := fs.Bool("quiet", true, "suppress summary")
  tsconfig := fs.String("tsconfig", "tsconfig.json", "project tsconfig")
  verbose := fs.Bool("verbose", false, "print summary")
  singleThreaded := fs.Bool("singleThreaded", false, "run TypeScript-Go single-threaded")
  checkers := fs.Int("checkers", 0, "type-checker pool size (0 = TypeScript-Go default)")
  tsgoArgsRaw := fs.String("tsgo-args", "", "JSON array of forwarded tsgo CLI flags")
  if err := fs.Parse(filterHostArgs(args)); err != nil {
    return hostOptions{}, false
  }
  var tsgoArgs []string
  if *tsgoArgsRaw != "" {
    if err := json.Unmarshal([]byte(*tsgoArgsRaw), &tsgoArgs); err != nil {
      fmt.Fprintf(os.Stderr, "ttsc utility: invalid --tsgo-args: %v\n", err)
      return hostOptions{}, false
    }
  }
  if *emit && *noEmit {
    fmt.Fprintln(os.Stderr, "ttsc utility: --emit and --noEmit are mutually exclusive")
    return hostOptions{}, false
  }
  resolvedCwd := *cwd
  if resolvedCwd == "" {
    var err error
    resolvedCwd, err = os.Getwd()
    if err != nil {
      fmt.Fprintf(os.Stderr, "ttsc utility: cwd: %v\n", err)
      return hostOptions{}, false
    }
  }
  if !filepath.IsAbs(resolvedCwd) {
    abs, err := filepath.Abs(resolvedCwd)
    if err != nil {
      fmt.Fprintf(os.Stderr, "ttsc utility: cwd: %v\n", err)
      return hostOptions{}, false
    }
    resolvedCwd = abs
  }
  return hostOptions{
    cwd:            filepath.Clean(resolvedCwd),
    emit:           *emit,
    noEmit:         *noEmit,
    outDir:         *outDir,
    pluginsJSON:    *pluginsJSON,
    quiet:          *quiet,
    tsconfig:       *tsconfig,
    verbose:        *verbose,
    singleThreaded: *singleThreaded,
    checkers:       *checkers,
    tsgoArgs:       tsgoArgs,
  }, true
}

// filterHostArgs strips flags that the Go flag set does not declare so that
// flags forwarded from the JS launcher (e.g. tsgo-specific options) do not
// cause flag.FlagSet to error. Flags not in the known set are consumed together
// with their value argument when they clearly take one (no inline "=" and the
// next token does not start with "-").
//
// The allow-list itself is generated from packages/ttsc/src/flags/schema.ts
// (see flags_gen.go); editing it means editing the schema and re-running
// `pnpm format`, not patching this file.
func filterHostArgs(args []string) []string {
  filtered := make([]string, 0, len(args))
  for i := 0; i < len(args); i++ {
    current := args[i]
    if current == "--" {
      break
    }
    if !strings.HasPrefix(current, "--") {
      filtered = append(filtered, current)
      continue
    }
    name, hasInlineValue := flagName(current)
    takesValue, ok := HostFlagAllowList[name]
    if ok {
      filtered = append(filtered, current)
      if takesValue && !hasInlineValue && i+1 < len(args) {
        i++
        filtered = append(filtered, args[i])
      }
      continue
    }
    if !hasInlineValue && i+1 < len(args) && !strings.HasPrefix(args[i+1], "-") {
      i++
    }
  }
  return filtered
}

// flagName strips the leading "--" from a flag argument and reports whether
// the flag carries an inline value (i.e. the argument contains "=").
func flagName(arg string) (string, bool) {
  name := strings.TrimPrefix(arg, "--")
  before, _, found := strings.Cut(name, "=")
  return before, found
}

// loadUtilityProgram parses plugins JSON, sets the linked-plugin environment
// variable for the duration of LoadProgram, and returns a fully initialized
// Program along with the decoded plugin entries. Returns (nil, nil, false) and
// prints diagnostics to stderr on any error.
func loadUtilityProgram(opts hostOptions) (*driver.Program, []driver.PluginEntry, bool) {
  entries, err := parsePluginEntries(opts.pluginsJSON)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, nil, false
  }
  restoreEnv := setLinkedPluginManifest(opts.pluginsJSON)
  defer restoreEnv()

  prog, diags, err := driver.LoadProgram(opts.cwd, opts.tsconfig, driver.LoadProgramOptions{
    ForceEmit:      opts.emit,
    ForceNoEmit:    opts.noEmit,
    OutDir:         opts.outDir,
    SingleThreaded: opts.singleThreaded,
    Checkers:       opts.checkers,
    TsgoArgs:       opts.tsgoArgs,
    FS:             opts.fs,
  })
  if err != nil {
    fmt.Fprintf(os.Stderr, "ttsc utility: %v\n", err)
    return nil, nil, false
  }
  if len(diags) > 0 {
    driver.WritePrettyDiagnostics(os.Stderr, diags, opts.cwd)
    return nil, nil, false
  }
  if diags := prog.Diagnostics(); len(diags) > 0 {
    driver.WritePrettyDiagnostics(os.Stderr, diags, opts.cwd)
    _ = prog.Close()
    return nil, nil, false
  }
  return prog, entries, true
}

// parsePluginEntries decodes the --plugins-json flag value into a slice of
// PluginEntry. An empty or whitespace-only string is treated as "no plugins"
// (returns nil, nil) rather than a JSON error.
func parsePluginEntries(input string) ([]driver.PluginEntry, error) {
  if strings.TrimSpace(input) == "" {
    return nil, nil
  }
  var entries []driver.PluginEntry
  if err := json.Unmarshal([]byte(input), &entries); err != nil {
    return nil, fmt.Errorf("ttsc utility: invalid --plugins-json: %w", err)
  }
  return entries, nil
}

// setLinkedPluginManifest writes input into the LinkedPluginsEnv environment
// variable (or clears it when input is blank) and returns a restore function
// that puts the variable back to its previous state. The restore function is
// intended to be called via defer immediately after setLinkedPluginManifest.
func setLinkedPluginManifest(input string) func() {
  previous, existed := os.LookupEnv(driver.LinkedPluginsEnv)
  if strings.TrimSpace(input) == "" {
    _ = os.Unsetenv(driver.LinkedPluginsEnv)
  } else {
    _ = os.Setenv(driver.LinkedPluginsEnv, input)
  }
  return func() {
    if existed {
      _ = os.Setenv(driver.LinkedPluginsEnv, previous)
    } else {
      _ = os.Unsetenv(driver.LinkedPluginsEnv)
    }
  }
}

// makeSourcePreambleWriteFile returns a WriteFile callback that keeps a source
// preamble (e.g. @ttsc/banner's copyright block) consistent in the output.
//
// The preamble is injected at the SOURCE level (sourcePreambleFS prepends it
// before TypeScript-Go parses), which has two output consequences this callback
// reconciles:
//
//   - The preamble shifts every recorded source coordinate down by its line
//     count, so emitted source maps (external `.js.map` / `.d.ts.map`, or inline
//     base64 maps embedded in the JS/d.ts) point past the real source.
//     AdjustEmittedSourceMap undoes that shift on every emitted file. It must run
//     even when RemoveComments strips the banner text from the JS/d.ts, because
//     the source is preamble-injected regardless of RemoveComments.
//   - The banner text itself is ensured in the `.js` / `.d.ts` output, only when
//     comments are kept; RemoveComments deliberately drops it. (For a banner
//     build the banner is already source-injected, so this is a no-op safety net;
//     it never runs on an inline map's JS that the line above already corrected,
//     because the banner is present there.)
//
// Returns nil only when there is no preamble at all (nil program or empty
// preamble), telling the caller to use the default writer.
func makeSourcePreambleWriteFile(prog *driver.Program) shimcompiler.WriteFile {
  if prog == nil || prog.SourcePreamble == "" {
    return nil
  }
  preamble := prog.SourcePreamble
  dropLines := strings.Count(preamble, "\n")
  injectBanner := !shouldRemoveComments(prog)
  return func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    if adjusted, ok := driver.AdjustEmittedSourceMap(fileName, text, dropLines); ok {
      text = adjusted
    }
    if injectBanner && shouldEnsureSourcePreamble(fileName, text, preamble) {
      text = driver.ApplySourcePreamble(text, preamble)
    }
    return driver.DefaultWriteFile(fileName, text)
  }
}

// shouldRemoveComments reports whether the compiler options ask tsgo to strip
// comments. When true the source preamble (which is itself a comment block) must
// not be injected because tsgo would then strip it, resulting in a no-op.
func shouldRemoveComments(prog *driver.Program) bool {
  if prog == nil || prog.ParsedConfig == nil || prog.ParsedConfig.ParsedConfig == nil || prog.ParsedConfig.ParsedConfig.CompilerOptions == nil {
    return false
  }
  return prog.ParsedConfig.ParsedConfig.CompilerOptions.RemoveComments.IsTrue()
}

// shouldEnsureSourcePreamble reports whether the preamble still needs to be
// injected into the output file. The idempotency check (strings.Contains)
// prevents double-injection on watch-mode rebuilds.
func shouldEnsureSourcePreamble(fileName, text, sourcePreamble string) bool {
  return isSourcePreambleOutputTarget(fileName) && !strings.Contains(text, sourcePreamble)
}

// isSourcePreambleOutputTarget reports whether fileName is a JS or declaration
// output file that should receive the source preamble. Declaration files
// (.d.ts/.d.mts/.d.cts) are included because plugins like @ttsc/banner inject
// a copyright header that must appear there as well.
func isSourcePreambleOutputTarget(fileName string) bool {
  lower := strings.ToLower(filepath.ToSlash(fileName))
  for _, suffix := range []string{".d.ts", ".d.mts", ".d.cts", ".js", ".jsx", ".mjs", ".cjs"} {
    if strings.HasSuffix(lower, suffix) {
      return true
    }
  }
  return false
}

// apiOutputKey converts an absolute fileName to a path relative to cwd for use
// as the JSON key in RunTransform output. Falls back to the slash-normalized
// absolute path when the file lives outside the project root.
func apiOutputKey(cwd, fileName string) string {
  rel, err := filepath.Rel(cwd, fileName)
  if err != nil || isOutsideRelativePath(rel) {
    return filepath.ToSlash(fileName)
  }
  return filepath.ToSlash(rel)
}

// isOutsideRelativePath reports whether rel escapes the project root (starts
// with ".." or is exactly "..").
func isOutsideRelativePath(rel string) bool {
  return rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator))
}
