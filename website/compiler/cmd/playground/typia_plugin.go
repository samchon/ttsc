// typia plugin wiring for the website's playground wasm.
//
// Mirrors the dispatch flow of typia's `cmd/ttsc-typia/{build,transform}.go`,
// but reframes it as a host.Plugin so the playground wasm can run typia's
// real transform inline. Its stdout and stderr belong to one invocation.
//
// As of typia 13.0.0-dev the native backend is AST-integrated: typia's
// per-file node transformer runs inside tsgo's emit pipeline (sharing the
// EmitContext) via `driver.EmitWithPluginTransformers`, and the injected
// namespace imports are aliased by tsgo's own module transform. There is no
// text-splice RewriteSet / `CleanupTransformedText` step anymore.
//
// Public surface this delegates into (all live under
// `node_modules/typia/native/`):
//
//   - `adapter`   — plugin-option reader + `TransformOptions()`.
//   - `transform` — the per-file AST transformer factory.
//   - `core/context` — the `ITypiaContext_Extras` diagnostic sink.
package main

import (
  "encoding/json"
  "flag"
  "fmt"
  "io"
  "os"
  "path/filepath"
  "regexp"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/wasm/host"
  typiaadapter "github.com/samchon/typia/packages/typia/native/adapter"
  nativecontext "github.com/samchon/typia/packages/typia/native/core/context"
  nativetransform "github.com/samchon/typia/packages/typia/native/transform"
)

type typiaPlugin struct{}

func newTypiaPlugin() typiaPlugin { return typiaPlugin{} }

func (typiaPlugin) Name() string { return "typia" }

// Run dispatches the typia subcommands. The verb defaults to `transform` —
// the playground's TypeScript view is what users see, so an unspecified
// command should return the rewritten TS rather than spawn an emit pass.
func (typiaPlugin) Run(invocation *host.PluginInvocation) int {
  command := invocation.Command
  if command == "" {
    command = "transform"
  }
  switch command {
  case "build":
    return runTypiaBuild(invocation.Args, invocation.Stdout, invocation.Stderr)
  case "check":
    // `check` is `build --noEmit` in typia's CLI; mirror that here.
    return runTypiaBuild(append([]string{"--noEmit"}, invocation.Args...), invocation.Stdout, invocation.Stderr)
  case "transform":
    return runTypiaTransform(invocation.Args, invocation.Stdout, invocation.Stderr)
  case "-v", "--version", "version":
    fmt.Fprintln(invocation.Stdout, "typia (playground-wasm bundled)")
    return 0
  default:
    fmt.Fprintf(invocation.Stderr, "typia: unknown command %q\n", command)
    return 2
  }
}

// typiaTransformDiag mirrors `cmd/ttsc-typia/build.go::typiaTransformDiagnostic`
// for the playground. We can't import the upstream type because it lives in
// `package main`.
type typiaTransformDiag struct {
  File    string
  Line    int
  Column  int
  Code    string
  Message string
}

func (d typiaTransformDiag) String(cwd string) string {
  file := d.File
  if rel, err := filepath.Rel(cwd, file); err == nil {
    file = rel
  }
  if d.Line > 0 {
    return fmt.Sprintf("%s:%d:%d - error TS(%s): %s", file, d.Line, d.Column, d.Code, d.Message)
  }
  return fmt.Sprintf("%s - error TS(%s): %s", file, d.Code, d.Message)
}

func writeTypiaTransformDiagnostics(w io.Writer, diagnostics []typiaTransformDiag, cwd string) {
  for _, diag := range diagnostics {
    fmt.Fprintln(w, diag.String(cwd))
  }
}

// buildTypiaTransform assembles the per-file AST transformer the way typia's
// CLI does: read the plugin options off tsconfig, turn them into transform
// options, and wire a diagnostic sink. The returned closure is a
// `driver.PluginTransform` the emit pipeline (or a standalone EmitContext for
// the TS view) drives once per source file.
func buildTypiaTransform(prog *driver.Program, cwd, tsconfigPath string) (driver.PluginTransform, *[]typiaTransformDiag) {
  diags := &[]typiaTransformDiag{}
  pluginOptions := readTypiaPluginOptions(cwd, tsconfigPath)
  transformOptions := pluginOptions.TransformOptions()
  extras := nativecontext.ITypiaContext_Extras{
    AddDiagnostic: func(_ *nativecontext.ITypiaDiagnostic) int {
      *diags = append(*diags, typiaTransformDiag{Message: "typia transform error"})
      return len(*diags)
    },
  }
  transform := func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    return nativetransform.Transform(prog, &transformOptions, extras, ec)(sf)
  }
  return transform, diags
}

// runTypiaBuild is a stripped-down port of typia's `cmd/ttsc-typia/build.go`
// runBuild. Differences from the upstream:
//
//   - writes through invocation-owned stdout and stderr
//   - omits the manifest output (the playground has no use for it)
func runTypiaBuild(args []string, stdout, stderr io.Writer) int {
  fs := flag.NewFlagSet("build", flag.ContinueOnError)
  fs.SetOutput(stderr)
  tsconfigPath := fs.String("tsconfig", "tsconfig.json", "path to tsconfig.json")
  cwdOverride := fs.String("cwd", "", "override the working directory")
  quiet := fs.Bool("quiet", true, "suppress the per-call diagnostic summary")
  verbose := fs.Bool("verbose", false, "print the per-call diagnostic summary")
  emit := fs.Bool("emit", false, "force emitted .js files")
  noEmit := fs.Bool("noEmit", false, "force analysis-only run with no file writes")
  outDir := fs.String("outDir", "", "override compilerOptions.outDir")
  _ = fs.String("plugins-json", "", "ordered ttsc plugin payload")
  if err := fs.Parse(args); err != nil {
    return 2
  }
  if *emit && *noEmit {
    fmt.Fprintln(stderr, "typia build: --emit and --noEmit are mutually exclusive")
    return 2
  }
  if *verbose {
    *quiet = false
  }

  cwd := *cwdOverride
  if cwd == "" {
    var err error
    cwd, err = os.Getwd()
    if err != nil {
      fmt.Fprintf(stderr, "typia build: cwd: %v\n", err)
      return 2
    }
  }
  prog, diags, err := driver.LoadProgram(cwd, *tsconfigPath, driver.LoadProgramOptions{
    ForceEmit:   *emit,
    ForceNoEmit: *noEmit,
    OutDir:      *outDir,
  })
  if err != nil {
    fmt.Fprintf(stderr, "typia build: %v\n", err)
    return 2
  }
  if len(diags) > 0 {
    driver.WritePrettyDiagnostics(stderr, diags, cwd)
    return 2
  }
  defer prog.Close()
  if pdiags := prog.Diagnostics(); len(pdiags) > 0 {
    driver.WritePrettyDiagnostics(stderr, pdiags, cwd)
    return 2
  }

  shouldEmit := !prog.ParsedConfig.ParsedConfig.CompilerOptions.NoEmit.IsTrue()
  typiaTransform, transformDiags := buildTypiaTransform(prog, cwd, *tsconfigPath)
  if !*quiet {
    fmt.Fprintf(stdout, "// typia build: tsconfig=%s cwd=%s emit=%v\n", *tsconfigPath, cwd, shouldEmit)
  }
  if shouldEmit {
    emitted := 0
    writeFile := shimcompiler.WriteFile(func(fileName, text string, _ *shimcompiler.WriteFileData) error {
      emitted++
      return driver.DefaultWriteFile(fileName, text)
    })
    eDiags, err := prog.EmitWithPluginTransformers([]driver.PluginTransform{typiaTransform}, writeFile)
    if err != nil {
      fmt.Fprintf(stderr, "typia build: emit failed: %v\n", err)
      return 3
    }
    for _, d := range eDiags {
      fmt.Fprintln(stderr, "  -", d.String())
    }
    if !*quiet {
      fmt.Fprintf(stdout, "// typia build: emitted=%d files\n", emitted)
    }
  }
  if len(*transformDiags) > 0 {
    writeTypiaTransformDiagnostics(stderr, *transformDiags, cwd)
    return 3
  }
  return 0
}

// runTypiaTransform is the port of typia's `cmd/ttsc-typia/transform.go`
// runTransform. The playground only needs the project-wide TS rewrite mode
// (the JSON-shaped output that maps file path → rewritten source); we keep
// the single-file emit branch so command-line smoke tests stay close to the
// CLI flow.
func runTypiaTransform(args []string, stdout, stderr io.Writer) int {
  fs := flag.NewFlagSet("transform", flag.ContinueOnError)
  fs.SetOutput(stderr)
  file := fs.String("file", "", "absolute or cwd-relative path of the .ts file to transform")
  tsconfigPath := fs.String("tsconfig", "tsconfig.json", "tsconfig.json owning --file")
  cwdOverride := fs.String("cwd", "", "override the working directory")
  out := fs.String("out", "", "write output to PATH")
  output := fs.String("output", "ts", "transform output kind: js or ts")
  _ = fs.String("plugins-json", "", "ordered ttsc plugin payload")
  if err := fs.Parse(args); err != nil {
    return 2
  }
  if *output != "js" && *output != "ts" {
    fmt.Fprintf(stderr, "typia transform: unknown --output value %q\n", *output)
    return 2
  }
  cwd := *cwdOverride
  if cwd == "" {
    var err error
    cwd, err = os.Getwd()
    if err != nil {
      fmt.Fprintf(stderr, "typia transform: cwd: %v\n", err)
      return 2
    }
  }

  prog, diags, err := driver.LoadProgram(cwd, *tsconfigPath, driver.LoadProgramOptions{
    ForceEmit: true,
  })
  if err != nil {
    fmt.Fprintf(stderr, "typia transform: %v\n", err)
    return 2
  }
  if len(diags) > 0 {
    driver.WritePrettyDiagnostics(stderr, diags, cwd)
    return 2
  }
  defer prog.Close()

  typiaTransform, transformDiags := buildTypiaTransform(prog, cwd, *tsconfigPath)

  if *file == "" {
    if *out != "" {
      fmt.Fprintln(stderr, "typia transform: --out requires --file")
      return 2
    }
    return runTypiaTransformProject(prog, cwd, typiaTransform, transformDiags, stdout, stderr)
  }

  absFile := *file
  if !filepath.IsAbs(absFile) {
    absFile = filepath.Join(cwd, absFile)
  }
  absFile = filepath.ToSlash(absFile)
  target := prog.SourceFile(absFile)
  if target == nil {
    fmt.Fprintf(stderr, "typia transform: source file is not in program: %s\n", absFile)
    return 2
  }

  if *output == "js" {
    return runTypiaTransformSingleJS(prog, typiaTransform, absFile, *out, stdout, stderr)
  }
  text := transformFileToTypeScript(prog, typiaTransform, target)
  return writeSingleOutput(text, *out, stdout, stderr)
}

// runTypiaTransformProject walks every project source file and writes a JSON
// envelope keyed by cwd-relative path. Same shape the standalone `ttsc-typia`
// binary returns so the playground UI can consume either source.
func runTypiaTransformProject(
  prog *driver.Program,
  cwd string,
  typiaTransform driver.PluginTransform,
  transformDiags *[]typiaTransformDiag,
  stdout io.Writer,
  stderr io.Writer,
) int {
  type compilerDiag struct {
    File        *string `json:"file"`
    Category    string  `json:"category"`
    Code        string  `json:"code"`
    Line        int     `json:"line,omitempty"`
    Character   int     `json:"character,omitempty"`
    MessageText string  `json:"messageText"`
  }
  type out struct {
    Diagnostics []compilerDiag    `json:"diagnostics,omitempty"`
    TypeScript  map[string]string `json:"typescript"`
  }
  res := out{TypeScript: map[string]string{}}
  for _, sf := range prog.SourceFiles() {
    if sf.IsDeclarationFile {
      continue
    }
    key := typiaSourceFileKey(cwd, filepath.ToSlash(sf.FileName()))
    if filepath.IsAbs(key) || key == ".." || strings.HasPrefix(key, "../") {
      continue
    }
    res.TypeScript[key] = transformFileToTypeScript(prog, typiaTransform, sf)
  }
  for _, diag := range *transformDiags {
    var fp *string
    if diag.File != "" {
      normalized := filepath.ToSlash(diag.File)
      fp = &normalized
    }
    res.Diagnostics = append(res.Diagnostics, compilerDiag{
      File:        fp,
      Category:    "error",
      Code:        diag.Code,
      Line:        diag.Line,
      Character:   diag.Column,
      MessageText: diag.Message,
    })
  }
  if err := json.NewEncoder(stdout).Encode(res); err != nil {
    fmt.Fprintf(stderr, "typia transform: encode output: %v\n", err)
    return 3
  }
  if len(res.Diagnostics) > 0 {
    return 3
  }
  return 0
}

// transformFileToTypeScript runs typia's node transformer on one source file in
// a fresh EmitContext and prints the result as TypeScript. It deliberately skips
// the JS script transformers (type-erase, module-transform): the caller wants TS.
func transformFileToTypeScript(
  prog *driver.Program,
  typiaTransform driver.PluginTransform,
  sf *shimast.SourceFile,
) string {
  options := prog.TSProgram.Options()
  ec := shimprinter.NewEmitContext()
  result := sf
  if next := typiaTransform(ec, result); next != nil {
    result = next
  }
  shimast.SetParentInChildrenUnset(result.AsNode())
  writer := shimprinter.NewTextWriter(options.NewLine.GetNewLineCharacter(), 0)
  printer := shimprinter.NewPrinter(shimprinter.PrinterOptions{NewLine: options.NewLine}, shimprinter.PrintHandlers{}, ec)
  printer.Write(result.AsNode(), result, writer, nil)
  return writer.String()
}

// runTypiaTransformSingleJS emits a single file's JS through the full node-path
// emit pipeline and writes it to stdout or --out.
func runTypiaTransformSingleJS(
  prog *driver.Program,
  typiaTransform driver.PluginTransform,
  absFile string,
  outPath string,
  stdout io.Writer,
  stderr io.Writer,
) int {
  var captured string
  found := false
  targetKey := filepath.ToSlash(absFile)
  writeFile := shimcompiler.WriteFile(func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    if sameSourceStem(targetKey, fileName) {
      captured = text
      found = true
    }
    return nil
  })
  if _, err := prog.EmitWithPluginTransformers([]driver.PluginTransform{typiaTransform}, writeFile); err != nil {
    fmt.Fprintf(stderr, "typia transform: emit: %v\n", err)
    return 3
  }
  if !found {
    fmt.Fprintf(stderr, "typia transform: no output produced for %s\n", absFile)
    return 3
  }
  return writeSingleOutput(captured, outPath, stdout, stderr)
}

// sameSourceStem reports whether an emitted .js path corresponds to a .ts source
// path by comparing their extension-stripped values. The full-path compare wins
// when no outDir relocates the emit; otherwise we fall back to the basename stem
// so `dist/main.js` still matches `src/main.ts`.
func sameSourceStem(tsPath, jsPath string) bool {
  jsStem := strings.TrimSuffix(filepath.ToSlash(jsPath), filepath.Ext(jsPath))
  tsStem := strings.TrimSuffix(filepath.ToSlash(tsPath), filepath.Ext(tsPath))
  if jsStem == tsStem {
    return true
  }
  return filepath.Base(jsStem) == filepath.Base(tsStem)
}

func writeSingleOutput(text, outPath string, stdout, stderr io.Writer) int {
  if outPath == "" {
    fmt.Fprint(stdout, text)
    return 0
  }
  if dir := filepath.Dir(outPath); dir != "" {
    if err := os.MkdirAll(dir, 0o755); err != nil {
      fmt.Fprintf(stderr, "typia transform: mkdir: %v\n", err)
      return 3
    }
  }
  if err := os.WriteFile(outPath, []byte(text), 0o644); err != nil {
    fmt.Fprintf(stderr, "typia transform: write %s: %v\n", outPath, err)
    return 3
  }
  return 0
}

func typiaSourceFileKey(cwd, file string) string {
  rel, err := filepath.Rel(cwd, filepath.FromSlash(file))
  if err != nil {
    return filepath.ToSlash(file)
  }
  return filepath.ToSlash(rel)
}

// readTypiaPluginOptions mirrors typia's CLI flag-reading helper: it scans
// tsconfig.json for the typia plugin entry and toggles per-feature options.
// Returns the zero value when the project doesn't list typia/lib/transform.
func readTypiaPluginOptions(cwd, tsconfigPath string) typiaadapter.PluginOptions {
  path := tsconfigPath
  if !filepath.IsAbs(path) {
    path = filepath.Join(cwd, path)
  }
  data, err := os.ReadFile(path)
  if err != nil {
    return typiaadapter.PluginOptions{}
  }
  text := string(data)
  if !regexp.MustCompile(`(?s)"transform"\s*:\s*"typia/lib/transform"`).MatchString(text) {
    return typiaadapter.PluginOptions{}
  }
  undefined := regexp.MustCompile(`(?s)"undefined"\s*:\s*true`).MatchString(text)
  return typiaadapter.PluginOptions{
    Functional: regexp.MustCompile(`(?s)"functional"\s*:\s*true`).MatchString(text),
    Numeric:    regexp.MustCompile(`(?s)"numeric"\s*:\s*true`).MatchString(text),
    Finite:     regexp.MustCompile(`(?s)"finite"\s*:\s*true`).MatchString(text),
    Undefined:  &undefined,
  }
}
