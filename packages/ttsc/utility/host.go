package utility

import (
  "encoding/json"
  "flag"
  "fmt"
  "io"
  "os"
  "path/filepath"
  "strings"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
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
  stdout         io.Writer
  stderr         io.Writer

  // provenanceJSON is a caller-owned absolute private build-result path.
  provenanceJSON string

  // checkObservationsJSON is the caller-owned absolute check input result path.
  checkObservationsJSON string

  // observationsIncomplete points to the resident host's committed generation
  // state. It is nil for non-resident calls and updated only after success.
  observationsIncomplete *bool

  // fs overrides the filesystem the program loads from. Only the resident serve
  // host sets it (to an OverlayFS), so build/check/transform leave it nil and
  // LoadProgram falls back to the default filesystem.
  fs vfs.FS
}

// transformResult is the JSON envelope written to stdout by RunTransform.
// TypeScript maps relative output key → printer output. Failed transforms
// retain diagnostics and recovery inputs without publishing partial output.
// Graph carries the host-owned reference graph (direct resolved reference
// edges, global-scope files, tsconfig extends chain) keyed like TypeScript,
// so cache layers can register every file whose content can influence a
// transformed module without per-plugin reporting. SourceMaps carries, keyed
// like TypeScript, a version 3 source map from each printed file whose text
// differs from its source back to that source.
type transformResult struct {
  // Dependencies and DependenciesComplete carry what the linked plugins
  // declared about their own contribution to each file; the host prints the
  // parsed AST syntactically, so it adds nothing of its own to either. See
  // driver.Program.TransformDependenciesFor.
  Dependencies map[string][]string `json:"dependencies,omitempty"`

  DependenciesComplete []string               `json:"dependenciesComplete,omitempty"`
  Diagnostics          []transformDiagnostic  `json:"diagnostics,omitempty"`
  Graph                *driver.TransformGraph `json:"graph,omitempty"`
  HostInputs           []string               `json:"hostInputs,omitempty"`
  HostInputHashes      map[string]*string     `json:"hostInputHashes,omitempty"`
  HostInputRealpaths   map[string]*string     `json:"hostInputRealpaths,omitempty"`

  // ObservationsComplete is present only as false when a linked hook explicitly
  // could not observe its input population. Absence is not completeness proof.
  ObservationsComplete *bool `json:"observationsComplete,omitempty"`

  SourceMaps map[string]json.RawMessage `json:"sourceMaps,omitempty"`
  TypeScript map[string]string          `json:"typescript"`
}

// transformDiagnostic matches the public JavaScript compiler diagnostic shape.
type transformDiagnostic struct {
  File        *string `json:"file"`
  Category    string  `json:"category"`
  Code        int32   `json:"code"`
  Start       *int    `json:"start,omitempty"`
  Length      *int    `json:"length,omitempty"`
  Line        int     `json:"line,omitempty"`
  Character   int     `json:"character,omitempty"`
  MessageText string  `json:"messageText"`
}

// RunCheck validates the project and linked plugin configuration without
// emitting output.
//
// @evidence contracts/common.md#principled-implementation The CLI entry uses the same project and plugin validation as invocation-owned stream callers.
// @evidence contracts/common.md#clear-and-simple-design One delegation supplies the process standard streams without another check implementation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The default-stream entry does not bypass validation or change flags for test cases.
// @evidence contracts/common.md#meaningful-documentation Native prose states validation without output emission following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Process output uses os.Stdout and os.Stderr; native loading belongs to the delegated operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms RunCheckWithIO owns processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The delegated check owns its program generation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The wrapper borrows process streams and acquires no independent resource.
func RunCheck(args []string) int {
  return RunCheckWithIO(args, os.Stdout, os.Stderr)
}

// RunCheckWithIO runs check with invocation-owned output streams.
// It returns 2 when flag parsing, project loading, or a linked hook fails.
// Requested metadata publication failure adds a diagnostic and changes an
// otherwise successful check to status 3; an existing check failure is retained.
//
// After successful flag admission, requested metadata is attempted on both
// successful and failed checks and belongs to that check generation. A missing
// generation is explicitly incomplete; rejected flag admission installs no
// publication defer. Input authority does not erase status or diagnostics.
// Callers own the metadata artifact's removal and supplied-stream lifetime.
// Diagnostic/report writes are best-effort and are not delivery receipts.
//
// @evidence contracts/common.md#principled-implementation A no-emit generation validates linked configuration and hook failures; requested observation metadata comes from that generation even on diagnostics, and missing generation authority is explicitly incomplete.
// @evidence contracts/common.md#clear-and-simple-design Parse, load, and apply are ordered phases with one deferred Program close.
// @evidence contracts/common.md#prohibited-implementation-shortcuts A failed load or hook returns failure instead of manufacturing an empty successful program.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish flag admission from deferred metadata publication, describe statuses and missing-generation meaning, and state artifact/stream ownership and best-effort reporting.
// @evidence contracts/portability.md#os-neutral-implementation Native cwd and config paths flow through driver loading; streams remain invocation-owned without globally swapping standard descriptors.
// @evidence contracts/performance.md#efficient-algorithms One admitted invocation loads and diagnoses a no-emit program and applies its linked hooks; argument/manifest parsing and delegated native project work depend on reached inputs. Optional publication collects that generation's host observations and encodes/writes their JSON, adding input/path/hash bytes and reporting costs; orchestration is not fixed work merely because it calls each phase once.
// @evidence contracts/performance.md#reuse-equivalent-work The loaded generation's latched hooks are used once instead of loading separate check and plugin programs.
// @evidence contracts/performance.md#bound-retention-and-release-resources After flag admission one defer attempts requested observations before returning an acquired Program's checker lease on success, diagnostics or hook failure. Program graphs and temporary observation/JSON state lose local ownership after return; Close is not immediate destruction of all memory. Supplied streams and any written private artifact remain caller-owned, without an invocation-enforced byte cap.
func RunCheckWithIO(args []string, stdout, stderr io.Writer) (status int) {
  opts, ok := parseHostOptions("check", args, stdout, stderr)
  if !ok {
    return 2
  }
  opts.noEmit = true
  var prog *driver.Program
  defer func() {
    if opts.checkObservationsJSON != "" {
      if err := driver.WriteCheckObservationsJSON(opts.checkObservationsJSON, prog); err != nil {
        fmt.Fprintf(opts.stderr, "ttsc utility: check observations write failed: %v\n", err)
        if status == 0 {
          status = 3
        }
      }
    }
    if prog != nil {
      _ = prog.Close()
    }
  }()
  prog, _, diags, ok := loadUtilityProgramWithDiagnostics(opts)
  if !ok {
    return 2
  }
  if len(diags) != 0 {
    driver.WritePrettyDiagnostics(opts.stderr, diags, opts.cwd)
    return 2
  }
  if err := prog.ApplyLinkedPlugins(); err != nil {
    fmt.Fprintln(opts.stderr, err)
    return 2
  }
  return 0
}

// RunBuild uses the linked-program build phases with process output streams.
// The delegated operation dispatches linked emit transforms on its build path and
// returns without emission for an admitted analysis-only invocation.
//
// @evidence contracts/common.md#principled-implementation Process-stream build delegates to the same linked-program emission owner as embedding callers.
// @evidence contracts/common.md#clear-and-simple-design One delegation supplies the standard streams without duplicating build policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The wrapper adds no package-name or fixture-specific build path.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies process streams and distinguishes delegated linked emission from analysis-only completion.
// @evidence contracts/portability.md#os-neutral-implementation Standard streams come from os; the delegated build owns native project paths and writes.
// @evidenceExclude contracts/performance.md#efficient-algorithms The delegated build owns emit orchestration.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The wrapper owns no shared-work coordinator.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The wrapper borrows streams without acquiring a program lease.
func RunBuild(args []string) int {
  return RunBuildWithIO(args, os.Stdout, os.Stderr)
}

// RunBuildWithIO runs build with invocation-owned output streams.
// It returns 2 for project/compiler failure and 3 for driver emission or private
// metadata publication failure.
//
// A loaded project's diagnostics retain failing status without preempting the
// compiler's noEmitOnError policy. False/default can therefore write the whole
// project despite diagnostics; true withholds output in the emitter. Invalid
// configuration without a Program and analysis-only diagnostic failure emit
// nothing. Check, transform and serve retain their separate rejection policy.
//
// An absolute private provenance path receives the raw output-to-source map after
// completed emission, including successful writes from a build with emit
// diagnostics. Analysis-only success writes an empty map. The original build
// status remains authoritative; absent or invalid metadata supplies no ownership
// proof. Callers own the artifact's removal.
// Program.Close returns its checker lease; it does not remove emitted files or
// private metadata. Summary and diagnostic stream writes are best-effort here,
// so a zero status does not certify delivery to the supplied io.Writer values.
//
// @evidence contracts/common.md#principled-implementation A loaded build delegates withholding to native noEmitOnError while retaining project and emit diagnostics with status two. Completed emission publishes the same generation's successful writer ownership even when another output failed; failed metadata alone returns three, and successful noEmit publishes an empty map.
// @evidence contracts/common.md#clear-and-simple-design One loaded program delegates linked emission and shared diagnostic classification; successful writer keys supply the verbose count.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Compiler error output is not converted into success; banner handling follows the source-preamble contract rather than expected fixture output.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs identify stream ownership, failure statuses, private metadata admission and caller artifact removal following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Driver loading and DefaultWriteFile own native paths and filesystem APIs; output streams are not replaced globally.
// @evidence contracts/performance.md#efficient-algorithms Admission and loading include argument/plugin-manifest parsing, native project and diagnostic work. Emission dispatches linked AST transforms through the driver, which owns native generation and one authored-coordinate correction. The final writer indexes compiler carrier/map paths and shifts generated map coordinates only when it inserts missing preamble text, including JSON/base64/VLQ and output-byte work. Optional provenance adds output-path candidate collection, successful-write bookkeeping, source-proof checks, owner sorting and JSON/file publication; costs depend on source/graph, output and metadata bytes rather than only the number of emit calls.
// @evidence contracts/performance.md#reuse-equivalent-work The same loaded compiler generation validates and emits; linked program hooks remain latched rather than independently reexecuted for output files.
// @evidence contracts/performance.md#bound-retention-and-release-resources Successful loading transfers one Program checker lease to a deferred Close on analysis-only, normal and failure returns. The final writer retains output-path decisions and maps awaiting their carrier without a byte cap, releases pending map entries as their carrier arrives, and reports unfinished pairs at emit completion. Facade graphs, provenance maps, writer closures and serialization buffers lose local ownership when the invocation ends; Close does not destroy all program memory, supplied-stream state or emitted disk artifacts. Callers own stream lifetime and metadata/output removal, with no invocation-enforced byte cap.
func RunBuildWithIO(args []string, stdout, stderr io.Writer) int {
  opts, ok := parseHostOptions("build", args, stdout, stderr)
  if !ok {
    return 2
  }
  prog, entries, diags, ok := loadUtilityProgramWithDiagnostics(opts)
  if !ok || prog == nil {
    driver.WritePrettyDiagnostics(opts.stderr, diags, opts.cwd)
    return 2
  }
  defer prog.Close()
  driver.WritePrettyDiagnostics(opts.stderr, diags, opts.cwd)
  if opts.noEmit {
    if len(diags) != 0 {
      return 2
    }
    if opts.provenanceJSON != "" {
      if err := driver.WriteEmitProvenanceJSON(opts.provenanceJSON, map[string][]string{}); err != nil {
        fmt.Fprintf(opts.stderr, "ttsc utility: provenance write failed: %v\n", err)
        return 3
      }
    }
    return 0
  }
  if opts.verbose {
    opts.quiet = false // --verbose overrides the default --quiet=true
  }
  if !opts.quiet {
    fmt.Fprintf(opts.stdout, "// ttsc utility: plugins=%d emit=%v\n", len(entries), !opts.noEmit)
  }
  writeFile, finishPreamble := makeSourcePreambleWriteFile(prog)
  var snapshot func() map[string][]string
  if opts.provenanceJSON != "" {
    var err error
    writeFile, snapshot, err = prog.NewEmitProvenanceRecorder(writeFile)
    if err != nil {
      fmt.Fprintf(opts.stderr, "ttsc utility: provenance failed: %v\n", err)
      return 3
    }
  }
  emittedFiles := map[string]struct{}{}
  finalWriteFile := writeFile
  eDiags, err := prog.EmitWithPluginTransformers(nil, func(fileName shimtspath.RootedFilePath, text string, data *shimcompiler.WriteFileData) error {
    var err error
    if finalWriteFile != nil {
      err = finalWriteFile(fileName, text, data)
    } else {
      err = driver.DefaultWriteFile(fileName.AsString(), text)
    }
    if err == nil && (data == nil || !data.SkippedDtsWrite) {
      emittedFiles[fileName.AsString()] = struct{}{}
    }
    return err
  })
  if finishErr := finishPreamble(); err == nil {
    err = finishErr
  }
  if err != nil && driver.CountErrors(eDiags) == 0 {
    fmt.Fprintf(opts.stderr, "ttsc utility: emit failed: %v\n", err)
    return 3
  }
  var provenanceErr error
  if snapshot != nil {
    provenanceErr = driver.WriteEmitProvenanceJSON(opts.provenanceJSON, snapshot())
  }
  driver.WritePrettyDiagnostics(opts.stderr, eDiags, opts.cwd)
  if provenanceErr != nil {
    fmt.Fprintf(opts.stderr, "ttsc utility: provenance write failed: %v\n", provenanceErr)
  }
  if driver.CountErrors(diags) > 0 || driver.CountErrors(eDiags) > 0 {
    fmt.Fprintln(opts.stderr, "ttsc utility: emit failed; build output is incomplete")
    return 2
  }
  if provenanceErr != nil {
    return 3
  }
  if !opts.quiet {
    fmt.Fprintf(opts.stdout, "// ttsc utility: emitted=%d files\n", len(emittedFiles))
  }
  return 0
}

// RunTransform returns the project TypeScript text after linked source
// mutations.
//
// @evidence contracts/common.md#principled-implementation The default-stream entry preserves the embedding transform's structured envelope and failure policy.
// @evidence contracts/common.md#clear-and-simple-design One call supplies process streams without implementing a second transform.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The CLI wrapper has no alternate fixture or named-plugin output logic.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies post-plugin TypeScript output following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation The wrapper obtains process streams from os and delegates native project behavior.
// @evidenceExclude contracts/performance.md#efficient-algorithms RunTransformWithIO owns transformation and envelope construction.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The wrapper coordinates no shared computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Process streams are borrowed; the delegated operation owns Program acquisition and release.
func RunTransform(args []string) int {
  return RunTransformWithIO(args, os.Stdout, os.Stderr)
}

// RunTransformWithIO runs transform with invocation-owned output streams.
// Failed projects retain diagnostics and recovery inputs but publish no partial
// TypeScript. Encoding or response-write failure returns 3; project failure
// returns 2.
// Recovery envelopes require a loaded generation; flag admission or load failure
// returns before response construction. A loaded generation's graph is captured
// before linked program hooks mutate its ASTs. Diagnostic stream reporting is
// best-effort; response encoding and returned write errors determine delivery
// status. Callers own the supplied stream lifetimes.
//
// @evidence contracts/common.md#principled-implementation After admission and loading, the current generation's graph is observed before linked program hooks mutate its ASTs; returned project diagnostics or hook failure leave TypeScript empty while preserving available recovery inputs. Response encoding or returned write errors cannot report successful delivery.
// @evidence contracts/common.md#clear-and-simple-design Loading, pre-mutation graph capture, syntactic printing, and envelope encoding are distinct ordered phases.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Maps are omitted when exact correction fails; partial mutations are not published as successful TypeScript and missing dependencies are not guessed.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain stream ownership, recovery output, and response failure status following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation TypeScript, source-map, dependency and graph coordinates use their shared cwd-relative/absolute-fallback TransformOutputKey presentation; reported host-input hashes and realpaths retain their separate native path identities. Native compiler/observer owners supply case and filesystem semantics rather than one universal key policy for every envelope field; supplied streams require no global descriptor replacement.
// @evidence contracts/performance.md#efficient-algorithms Admission/loading, pre-hook graph construction and linked mutation precede one text/map print per resident source on success. Costs include native resolution/proof collection and sorting, printer trivia/handlers, mapping/JSON serialization and authored-region correction, contributor/dependency aggregation, host-observation copies and diagnostic conversion. One final envelope encoding still adds output-sized bytes/string storage and stream work; neither a single encode nor direct adjacency bounds the whole invocation to one cheap pass.
// @evidence contracts/performance.md#reuse-equivalent-work One compiler generation supplies original observations, transformed ASTs, host inputs, and latched plugin declarations, preserving their shared producer identity.
// @evidence contracts/performance.md#bound-retention-and-release-resources A loaded Program's checker lease is returned by defer on response success and failure. Recovery graph/proof maps, transformed strings, corrected maps and JSON bytes can overlap until local references leave scope; Close does not immediately destroy all Program or observer state. Caller streams can retain delivered output, and this response path enforces no source, graph or output-byte cap.
func RunTransformWithIO(args []string, stdout, stderr io.Writer) int {
  opts, ok := parseHostOptions("transform", args, stdout, stderr)
  if !ok {
    return 2
  }
  prog, _, diags, ok := loadUtilityProgramWithDiagnostics(opts)
  if !ok {
    return 2
  }
  out := transformResult{TypeScript: map[string]string{}}
  if prog != nil {
    defer prog.Close()
    // The same failed Program owns the missing resolution candidates needed
    // for recovery. Capture them before closing it or applying mutations.
    out.Graph = driver.NewTransformGraph(prog, opts.cwd)
  }
  if len(diags) != 0 {
    driver.WritePrettyDiagnostics(opts.stderr, diags, opts.cwd)
  } else if prog != nil {
    if err := prog.ApplyLinkedPlugins(); err != nil {
      fmt.Fprintln(opts.stderr, err)
      diags = append(diags, driver.Diagnostic{Message: err.Error()})
    } else {
      out.SourceMaps = map[string]json.RawMessage{}
      for _, file := range prog.SourceFiles() {
        // The map carries the source text it was generated from, so a
        // consumer can tell whether it describes the text it was handed.
        text, sourceMap := shimprinter.EmitSourceFileWithSourceMap(
          shimprinter.PrinterOptions{InlineSources: true},
          shimprinter.PrintHandlers{},
          nil,
          file,
        )
        key := apiOutputKey(opts.cwd, file.FileName().AsString())
        out.TypeScript[key] = text
        // A source preamble sits in the parsed text, not in the author's
        // file, so both the comparison and the map use the authored text.
        authored, corrected, ok := prog.AuthoredSourceMap(file, sourceMap)
        if ok && text != authored {
          out.SourceMaps[key] = json.RawMessage(corrected)
        }
      }
      dependencies := prog.TransformDependenciesFor(opts.cwd)
      out.Dependencies = dependencies.Dependencies
      out.DependenciesComplete = dependencies.Complete
    }
  }
  if prog != nil {
    out.HostInputs = prog.PluginHostInputs()
    out.HostInputHashes = prog.PluginHostInputHashes()
    out.HostInputRealpaths = prog.PluginHostInputRealpaths()
    if prog.PluginObservationsIncomplete() {
      incomplete := false
      out.ObservationsComplete = &incomplete
    }
  }
  for _, diag := range diags {
    var file *string
    if diag.File != "" {
      value := diag.File
      file = &value
    }
    category := "error"
    if diag.Severity == driver.SeverityWarning {
      category = "warning"
    }
    out.Diagnostics = append(out.Diagnostics, transformDiagnostic{
      File: file, Category: category, Code: diag.Code,
      Start: diag.Start, Length: diag.Length, Line: diag.Line,
      Character: diag.Column, MessageText: diag.Message,
    })
  }
  data, err := json.Marshal(out)
  if err != nil {
    fmt.Fprintf(opts.stderr, "ttsc utility: transform response encoding failed: %v\n", err)
    return 3
  }
  if _, err := fmt.Fprintln(opts.stdout, string(data)); err != nil {
    fmt.Fprintf(opts.stderr, "ttsc utility: transform response write failed: %v\n", err)
    return 3
  }
  if len(diags) != 0 {
    return 2
  }
  return 0
}

// parseHostOptions parses the standard flag set for the given subcommand name.
// Unknown flags forwarded from the JS launcher are stripped by filterHostArgs
// before flag.FlagSet sees them, so spurious "flag provided but not defined"
// errors are avoided. Returns (zero, false) on any parse or validation error.
func parseHostOptions(command string, args []string, stdout, stderr io.Writer) (hostOptions, bool) {
  if stdout == nil {
    stdout = io.Discard
  }
  if stderr == nil {
    stderr = io.Discard
  }
  fs := flag.NewFlagSet(command, flag.ContinueOnError)
  fs.SetOutput(stderr)
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
  provenanceJSON := ""
  checkObservationsJSON := ""
  if command == "build" {
    fs.StringVar(&provenanceJSON, "emit-provenance-json", "", "private absolute emit provenance result path")
  }
  if command == "check" {
    fs.StringVar(&checkObservationsJSON, "check-observations-json", "", "private absolute check input result path")
  }
  if err := fs.Parse(filterDeclaredHostArgs(args, fs)); err != nil {
    return hostOptions{}, false
  }
  if provenanceJSON != "" && !filepath.IsAbs(provenanceJSON) {
    fmt.Fprintln(stderr, "ttsc utility: emit provenance path must be absolute")
    return hostOptions{}, false
  }
  if checkObservationsJSON != "" && !filepath.IsAbs(checkObservationsJSON) {
    fmt.Fprintln(stderr, "ttsc utility: check observations path must be absolute")
    return hostOptions{}, false
  }
  var tsgoArgs []string
  if *tsgoArgsRaw != "" {
    if err := json.Unmarshal([]byte(*tsgoArgsRaw), &tsgoArgs); err != nil {
      fmt.Fprintf(stderr, "ttsc utility: invalid --tsgo-args: %v\n", err)
      return hostOptions{}, false
    }
  }
  if *emit && *noEmit {
    fmt.Fprintln(stderr, "ttsc utility: --emit and --noEmit are mutually exclusive")
    return hostOptions{}, false
  }
  resolvedCwd := *cwd
  if resolvedCwd == "" {
    var err error
    resolvedCwd, err = os.Getwd()
    if err != nil {
      fmt.Fprintf(stderr, "ttsc utility: cwd: %v\n", err)
      return hostOptions{}, false
    }
  }
  if !filepath.IsAbs(resolvedCwd) {
    abs, err := filepath.Abs(resolvedCwd)
    if err != nil {
      fmt.Fprintf(stderr, "ttsc utility: cwd: %v\n", err)
      return hostOptions{}, false
    }
    resolvedCwd = abs
  }
  return hostOptions{
    cwd:                   filepath.Clean(resolvedCwd),
    emit:                  *emit,
    noEmit:                *noEmit,
    outDir:                *outDir,
    pluginsJSON:           *pluginsJSON,
    quiet:                 *quiet,
    tsconfig:              *tsconfig,
    verbose:               *verbose,
    singleThreaded:        *singleThreaded,
    checkers:              *checkers,
    tsgoArgs:              tsgoArgs,
    stdout:                stdout,
    stderr:                stderr,
    provenanceJSON:        provenanceJSON,
    checkObservationsJSON: checkObservationsJSON,
  }, true
}

// filterHostArgs strips flags that the Go flag set does not declare so that
// flags forwarded from the JS launcher (e.g. tsgo-specific options) do not
// cause flag.FlagSet to error. Flags not in the known set are consumed together
// with their value argument when they clearly take one (no inline "=" and the
// next token does not start with "-").
//
// The allow-list itself is generated from packages/ttsc/src/flags/FLAG_SCHEMA.ts
// (see flags_gen.go); editing it means editing the schema and re-running
// `pnpm format`, not patching this file.
func filterHostArgs(args []string) []string {
  return filterDeclaredHostArgs(args, nil)
}

// filterDeclaredHostArgs supplements unknown names with actual local flags.
// Public flags retain the generated schema's established filtering semantics;
// nil preserves the legacy filter's declaration and invocation contract.
func filterDeclaredHostArgs(args []string, local *flag.FlagSet) []string {
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
    if !ok && local != nil {
      if declared := local.Lookup(name); declared != nil {
        boolean, isBoolean := declared.Value.(interface{ IsBoolFlag() bool })
        takesValue = !isBoolean || !boolean.IsBoolFlag()
        ok = true
      }
    }
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

// flagName strips the leading "--" from a flag argument, lower-cases the
// result, and reports whether the flag carries an inline value (i.e. the
// argument contains "=").
//
// Lower-casing is the same normalization `normalizeFlagToken` in
// packages/ttsc/src/flags/FLAG_SCHEMA.ts applies, and the generated
// HostFlagAllowList keys are produced by it, so this layer recognises exactly
// the spellings the launcher and the compiler do.
func flagName(arg string) (string, bool) {
  name := strings.TrimPrefix(arg, "--")
  before, _, found := strings.Cut(name, "=")
  return strings.ToLower(before), found
}

// loadUtilityProgram parses plugins JSON, sets the linked-plugin environment
// variable for the duration of LoadProgram, and returns a fully initialized
// Program along with the decoded plugin entries. Returns (nil, nil, false) and
// prints diagnostics to stderr on any error.
func loadUtilityProgram(opts hostOptions) (*driver.Program, []driver.PluginEntry, bool) {
  prog, entries, diags, ok := loadUtilityProgramWithDiagnostics(opts)
  if !ok {
    return nil, nil, false
  }
  if len(diags) != 0 {
    driver.WritePrettyDiagnostics(opts.stderr, diags, opts.cwd)
    if prog != nil {
      _ = prog.Close()
    }
    return nil, nil, false
  }
  return prog, entries, true
}

// loadUtilityProgramWithDiagnostics leaves a loaded Program owned by its caller,
// even on compiler diagnostics. Transform must publish its recovery graph;
// check/serve retain their rejection boundary in the wrapper. Build delegates
// output withholding to the compiler's noEmitOnError policy, but retains the
// diagnostics and failing status even when that policy permits output.
func loadUtilityProgramWithDiagnostics(opts hostOptions) (*driver.Program, []driver.PluginEntry, []driver.Diagnostic, bool) {
  entries, err := parsePluginEntries(opts.pluginsJSON)
  if err != nil {
    fmt.Fprintln(opts.stderr, err)
    return nil, nil, nil, false
  }
  restoreEnv := setLinkedPluginManifest(opts.pluginsJSON)
  defer restoreEnv()

  prog, diags, err := driver.LoadProgram(opts.cwd, opts.tsconfig, driver.LoadProgramOptions{
    ForceEmit:          opts.emit,
    ForceNoEmit:        opts.noEmit,
    OutDir:             opts.outDir,
    SemanticConfigPath: os.Getenv(driver.SemanticConfigPathEnv),
    SingleThreaded:     opts.singleThreaded,
    Checkers:           opts.checkers,
    TsgoArgs:           opts.tsgoArgs,
    FS:                 opts.fs,
  })
  if err != nil {
    fmt.Fprintf(opts.stderr, "ttsc utility: %v\n", err)
    return nil, nil, nil, false
  }
  if prog != nil {
    diags = append(diags, prog.Diagnostics()...)
  }
  return prog, entries, diags, true
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
// before TypeScript-Go parses). EmitWithPluginTransformers already corrects
// external and inline source maps against authored source coordinates, so this
// writer must not correct original coordinates a second time. When it restores
// missing preamble text, it moves generated coordinates by that exact insertion.
// External maps are paired through compiler output paths, not guessed siblings.
// A map arriving before its carrier waits for that carrier's insertion decision.
// RemoveComments leaves text and generated coordinates unchanged.
//
// The writer is nil only when there is no preamble (nil program or empty
// preamble); the always-present finish operation then does nothing.
func makeSourcePreambleWriteFile(prog *driver.Program) (shimcompiler.WriteFile, func() error) {
  if prog == nil || prog.SourcePreamble == "" {
    return nil, func() error { return nil }
  }
  return newPreambleOutputWriter(prog)
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
// absolute path when the file lives outside the project root. Delegates to
// the driver so every envelope section (typescript, graph) shares one key
// implementation and consumers can join sections by key.
func apiOutputKey(cwd, fileName string) string {
  return driver.TransformOutputKey(cwd, fileName)
}
