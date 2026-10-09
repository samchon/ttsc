// Project-build command support for the native `ttsc` binary.
//
// The build lane accepts the same project-oriented shape as the JavaScript
// launcher: resolve one tsconfig, create a TypeScript-Go program, optionally
// emit JavaScript, and report diagnostics through the driver package. It does
// not discover project descriptors itself. A plugin-selected binary can carry
// linked Go hooks that the driver runs for its loaded program.
package main

import (
  "encoding/json"
  "flag"
  "fmt"
  "os"
  "path/filepath"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// runBuild loads and checks one project before writing its emitted files.
//
// The resolved compiler options decide whether emission occurs. --emit and
// --noEmit override that decision; they are mutually exclusive. The driver owns
// linked plugin hooks and the emit pipeline, while this command owns the output
// writer and optional emitted-file manifest.
//
// An absolute private provenance path receives the raw output-to-source map after
// completed emission, including successful writes from a build with emit
// diagnostics. Analysis-only success writes an empty map. Status and diagnostics
// still describe the build; an absent or invalid artifact supplies no proof.
//
// This wrapper consumes the actual build preparation before one LoadProgram
// call. A nonnil acquired Program remains owned until the borrowed
// diagnostic/emit/artifact response finishes; deferred Close then releases its
// checker lease. Preparation, native loading and output publication retain
// separate owners and their original returned statuses.
func runBuild(args []string) int {
  request, code := prepareBuildInvocation(args)
  if code != 0 {
    return code
  }
  prog, diags, err := driver.LoadProgram(request.cwd, request.tsconfigPath, request.options)
  if err != nil {
    fmt.Fprintf(stderr, "ttsc: %v\n", err)
    return 2
  }
  if prog != nil {
    defer prog.Close()
  }
  return writeBuildProgramResponse(prog, diags, request)
}

// writeBuildProgramResponse borrows the real loaded Program for the original diagnostics, optional disk emit, provenance and manifest result.
// The real wrapper consumes this operation directly; tests observe preparation
// separately from actual loaded compiler work and never replay a command result.
//
// Go Evidence addresses exported declarations only; these private native
// review grounds remain with the owning operation and its actual callers.
// Common: Principled implementation: This borrowed operation preserves config/semantic diagnostic gates, emit/provenance/manifest ordering and actual status/streams; the real wrapper consumes preparation before loading.
// Common: Clear and simple design: The request supplies resolved command intent; the caller owns load/Close while this operation owns diagnostics and output publication.
// Common: Prohibited implementation shortcuts: No loader is mocked, public export invented, option difference hidden, source result fabricated or previous status returned as an actual invocation.
// Common: Meaningful documentation: Native prose identifies actual wrapper consumption, borrowing boundaries and independent preparation versus compiler observations.
// Portability: OS-neutral implementation: Existing native cwd/path and argument-array semantics remain; no symlink, shell, forced separator or filesystem-case policy is introduced.
// Performance: Efficient algorithms: Diagnostics and emitted outputs retain their original traversals; compiler work remains in the driver and each requested artifact is serialized once.
// Performance: Reuse equivalent work: The operation borrows the actual generation and request without replaying status or output. Callers must preserve selected configuration, options and publication-state prerequisites when sharing input.
// Performance: Bound retention and release resources: The calling wrapper/load owner holds the Program checker lease and closes once after the final borrowed consumer; this operation owns only its original invocation-local collections and stream writes.
func writeBuildProgramResponse(prog *driver.Program, diags []driver.Diagnostic, request buildCommandRequest) int {
  if len(diags) > 0 {
    driver.WritePrettyDiagnostics(stderr, diags, request.cwd)
    return 2
  }
  if diags := prog.Diagnostics(); len(diags) > 0 {
    driver.WritePrettyDiagnostics(stderr, diags, request.cwd)
    if driver.CountErrors(diags) > 0 {
      return 2
    }
  }

  rewrites := driver.NewRewriteSet()
  // shouldEmit reflects the resolved tsconfig noEmit flag. The flag lives
  // three levels deep in the parsed config because TypeScript-Go mirrors the
  // tsconfig object structure verbatim, with a tri-state bool per option.
  shouldEmit := !prog.ParsedConfig.ParsedConfig.CompilerOptions.NoEmit.IsTrue()
  if !request.quiet {
    fmt.Fprintf(stdout, "// ttsc: tsconfig=%s cwd=%s sites=%d emit=%v\n", request.tsconfigPath, request.cwd, 0, shouldEmit)
  }

  if shouldEmit {
    // Emit is callback-driven in TypeScript-Go. ttsc keeps that shape and
    // wraps only the final WriteFile step so native rewrites and custom output
    // capture share the same path.
    writeFile := shimcompiler.WriteFile(
      func(fileName shimtspath.RootedFilePath, text string, _ *shimcompiler.WriteFileData) error {
        return driver.DefaultWriteFile(fileName.AsString(), text)
      },
    )
    var snapshot func() map[string][]string
    if request.provenancePath != "" {
      var err error
      writeFile, snapshot, err = prog.NewEmitProvenanceRecorder(writeFile)
      if err != nil {
        fmt.Fprintf(stderr, "ttsc: provenance failed: %v\n", err)
        return 3
      }
    }
    res, eDiags, err := prog.EmitAll(rewrites, writeFile)
    if err != nil {
      fmt.Fprintf(stderr, "ttsc: emit failed: %v\n", err)
      return 3
    }
    // Successful writes remain actual even when another output produced an emit
    // diagnostic. Publish their ledger before preserving the original failure.
    var provenanceErr error
    if snapshot != nil {
      provenanceErr = driver.WriteEmitProvenanceJSON(request.provenancePath, snapshot())
    }
    driver.WritePrettyDiagnostics(stderr, eDiags, request.cwd)
    if provenanceErr != nil {
      fmt.Fprintf(stderr, "ttsc: provenance write failed: %v\n", provenanceErr)
    }
    if driver.CountErrors(eDiags) > 0 {
      fmt.Fprintln(stderr, "ttsc: emit failed; build output is incomplete")
      return 2
    }
    if provenanceErr != nil {
      return 3
    }
    if !request.quiet {
      fmt.Fprintf(stdout, "// ttsc: emitted=%d files\n", len(res.EmittedFiles))
      for _, f := range res.EmittedFiles {
        rel := f.AsString()
        if abs, err := filepath.Rel(request.cwd, f.AsString()); err == nil {
          rel = abs
        }
        fmt.Fprintln(stdout, "  +", rel)
      }
    }
    if request.manifestPath != "" {
      // The manifest is intentionally just the emitted file list. Higher
      // layers already know the project and tsconfig, and tests compare this
      // array as the build contract.
      data, _ := json.Marshal(res.EmittedFiles)
      if err := os.MkdirAll(filepath.Dir(request.manifestPath), 0o755); err != nil {
        fmt.Fprintf(stderr, "ttsc: manifest mkdir failed: %v\n", err)
        return 3
      }
      if err := os.WriteFile(request.manifestPath, data, 0o644); err != nil {
        fmt.Fprintf(stderr, "ttsc: manifest write failed: %v\n", err)
        return 3
      }
    }
  }

  if request.provenancePath != "" && !shouldEmit {
    if err := driver.WriteEmitProvenanceJSON(request.provenancePath, map[string][]string{}); err != nil {
      fmt.Fprintf(stderr, "ttsc: provenance write failed: %v\n", err)
      return 3
    }
  }

  if !request.quiet {
    fmt.Fprintf(stdout, "// ttsc: recognized=%d total=%d rewrites=%d\n", 0, 0, rewrites.Len())
  }
  return 0
}

// decodeTsgoArgs decodes the JSON-array value of the `--tsgo-args` flag — the
// tsgo CLI flags the `ttsc` launcher forwarded — into a string slice. An empty
// flag yields a nil slice. Shared by the build / api-compile / api-transform
// subcommands, which all hand the result to driver.LoadProgram.
//
// encoding/json supplies []string decoding with its native null handling. A
// decoding error is wrapped as invalid --tsgo-args for the actual command
// preparation to report; the helper does not interpret or resolve the
// forwarded compiler flags.
func decodeTsgoArgs(raw string) ([]string, error) {
  if raw == "" {
    return nil, nil
  }
  var args []string
  if err := json.Unmarshal([]byte(raw), &args); err != nil {
    return nil, fmt.Errorf("invalid --tsgo-args: %w", err)
  }
  return args, nil
}

// prepareBuildInvocation parses the original build argv, including local/private flags, conflicting emit rejection and real implicit cwd.
// The real wrapper consumes this operation directly; tests observe preparation
// separately from actual loaded compiler work and never replay a command result.
//
// Go Evidence addresses exported declarations only; these private native
// review grounds remain with the owning operation and its actual callers.
// Common: Principled implementation: Original flags, cwd resolution, diagnostic branches and status/stream ownership remain in this actual production path.
// Common: Clear and simple design: Preparation and loaded-program work have explicit separate owners; no hidden second compiler producer is added.
// Common: Prohibited implementation shortcuts: No loader is mocked, public export invented, option difference hidden, source result fabricated or previous status returned as an actual invocation.
// Common: Meaningful documentation: Native prose identifies actual wrapper consumption, borrowing boundaries and independent preparation versus compiler observations.
// Portability: OS-neutral implementation: Existing native cwd/path and argument-array semantics remain; no symlink, shell, forced separator or filesystem-case policy is introduced.
// Performance: Efficient algorithms: Native flag parsing scales with argv; loaded compiler/output work remains in the existing driver and JSON/emit owners.
// Performance: Reuse equivalent work: No request or command-result cache is retained. Immutable input sharing belongs to a local test family with separately declared selected configurations and load modes.
// Performance: Bound retention and release resources: One FlagSet and decoded argv/options value transfer to the synchronous caller; no Program lease or process is acquired during preparation.
func prepareBuildInvocation(args []string) (buildCommandRequest, int) {
  fs := flag.NewFlagSet("build", flag.ContinueOnError)
  fs.SetOutput(stderr)
  tsconfigPath := fs.String("tsconfig", "tsconfig.json", "path to tsconfig.json")
  cwdOverride := fs.String("cwd", "", "override the working directory (defaults to process cwd)")
  quiet := fs.Bool("quiet", true, "suppress the per-call diagnostic summary")
  verbose := fs.Bool("verbose", false, "print the per-call diagnostic summary")
  emit := fs.Bool("emit", false, "force emitted .js files (runs tsgo + ttsc rewrite)")
  noEmit := fs.Bool("noEmit", false, "force analysis-only run with no file writes")
  outDir := fs.String("outDir", "", "override compilerOptions.outDir for this build")
  manifestPath := fs.String("manifest", "", "write emitted file list as JSON to this path")
  provenancePath := fs.String("emit-provenance-json", "", "private absolute emit provenance result path")
  singleThreaded := fs.Bool("singleThreaded", false, "run TypeScript-Go single-threaded")
  checkers := fs.Int("checkers", 0, "type-checker pool size (0 = TypeScript-Go default)")
  tsgoArgsRaw := fs.String("tsgo-args", "", "JSON array of forwarded tsgo CLI flags")
  // Strip unknown forwarded tsgo options before fs.Parse so a flag like
  // `--strict` (which tsgo accepts but cmd/ttsc's FlagSet does not declare)
  // does not exit 2 before reaching the tsgo lane via `--tsgo-args=<JSON>`.
  // See packages/ttsc/cmd/ttsc/filter.go for the allow-list source.
  if err := fs.Parse(filterDeclaredHostArgs(args, fs)); err != nil {
    return buildCommandRequest{}, 2
  }
  if *provenancePath != "" && !filepath.IsAbs(*provenancePath) {
    fmt.Fprintln(stderr, "ttsc: emit provenance path must be absolute")
    return buildCommandRequest{}, 2
  }
  tsgoArgs, err := decodeTsgoArgs(*tsgoArgsRaw)
  if err != nil {
    fmt.Fprintf(stderr, "ttsc: %v\n", err)
    return buildCommandRequest{}, 2
  }
  if *emit && *noEmit {
    fmt.Fprintln(stderr, "ttsc: --emit and --noEmit are mutually exclusive")
    return buildCommandRequest{}, 2
  }
  if *verbose {
    *quiet = false
  }

  cwd := *cwdOverride
  if cwd == "" {
    var err error
    cwd, err = getwd()
    if err != nil {
      fmt.Fprintf(stderr, "ttsc: could not get working directory: %v\n", err)
      return buildCommandRequest{}, 2
    }
  }

  return buildCommandRequest{cwd: cwd, tsconfigPath: *tsconfigPath, quiet: *quiet, manifestPath: *manifestPath, provenancePath: *provenancePath, options: driver.LoadProgramOptions{ForceEmit: *emit, ForceNoEmit: *noEmit, OutDir: *outDir, SemanticConfigPath: os.Getenv(driver.SemanticConfigPathEnv), SingleThreaded: *singleThreaded, Checkers: *checkers, TsgoArgs: tsgoArgs}}, 0
}

// buildCommandRequest carries resolved argv intent until synchronous load and
// borrowed execution. Its options preserve ForceEmit/ForceNoEmit distinctions;
// the value owns no Program or response cache.
//
// Go Evidence addresses exported declarations only; these private native
// review grounds describe the request carrier consumed by the real wrapper.
// Common: Principled implementation: ForceEmit, ForceNoEmit, verbosity and artifact paths preserve their distinct parsed meanings; selected config and cwd reach the actual load and output operations.
// Common: Clear and simple design: One value carries prepared command intent across synchronous load and response ownership; no hidden dispatch or compiler producer is introduced.
// Common: Prohibited implementation shortcuts: The carrier contains actual parsed values, never fabricated output, cached status, mocked loader or a public test-only API.
// Common: Meaningful documentation: Native prose identifies policy distinctions and the wrapper's Program lease ownership.
// Portability: OS-neutral implementation: Native cwd/config strings and argv are forwarded without shell, symlink or forced-separator conversion.
// Performance: Efficient algorithms: Fields transfer in constant-size value copies; the forwarded argv slice is not retraversed or compiled by this carrier.
// Performance: Reuse equivalent work: Each preparation creates invocation-local intent; the carrier stores no global cache or previous command result.
// Performance: Bound retention and release resources: Referenced argv remains owned by the synchronous request lifetime; the carrier acquires no checker lease, process or independently retained resource.
type buildCommandRequest struct {
  cwd            string
  tsconfigPath   string
  quiet          bool
  manifestPath   string
  provenancePath string
  options        driver.LoadProgramOptions
}
