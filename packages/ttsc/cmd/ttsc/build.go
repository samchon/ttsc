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
func runBuild(args []string) int {
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
    return 2
  }
  if *provenancePath != "" && !filepath.IsAbs(*provenancePath) {
    fmt.Fprintln(stderr, "ttsc: emit provenance path must be absolute")
    return 2
  }
  tsgoArgs, err := decodeTsgoArgs(*tsgoArgsRaw)
  if err != nil {
    fmt.Fprintf(stderr, "ttsc: %v\n", err)
    return 2
  }
  if *emit && *noEmit {
    fmt.Fprintln(stderr, "ttsc: --emit and --noEmit are mutually exclusive")
    return 2
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
      return 2
    }
  }

  prog, diags, err := driver.LoadProgram(cwd, *tsconfigPath, driver.LoadProgramOptions{
    ForceEmit:          *emit,
    ForceNoEmit:        *noEmit,
    OutDir:             *outDir,
    SemanticConfigPath: os.Getenv(driver.SemanticConfigPathEnv),
    SingleThreaded:     *singleThreaded,
    Checkers:           *checkers,
    TsgoArgs:           tsgoArgs,
  })
  if err != nil {
    fmt.Fprintf(stderr, "ttsc: %v\n", err)
    return 2
  }
  if len(diags) > 0 {
    driver.WritePrettyDiagnostics(stderr, diags, cwd)
    return 2
  }
  defer prog.Close()
  if diags := prog.Diagnostics(); len(diags) > 0 {
    driver.WritePrettyDiagnostics(stderr, diags, cwd)
    if driver.CountErrors(diags) > 0 {
      return 2
    }
  }

  rewrites := driver.NewRewriteSet()
  // shouldEmit reflects the resolved tsconfig noEmit flag. The flag lives
  // three levels deep in the parsed config because TypeScript-Go mirrors the
  // tsconfig object structure verbatim, with a tri-state bool per option.
  shouldEmit := !prog.ParsedConfig.ParsedConfig.CompilerOptions.NoEmit.IsTrue()
  if !*quiet {
    fmt.Fprintf(stdout, "// ttsc: tsconfig=%s cwd=%s sites=%d emit=%v\n", *tsconfigPath, cwd, 0, shouldEmit)
  }

  if shouldEmit {
    // Emit is callback-driven in TypeScript-Go. ttsc keeps that shape and
    // wraps only the final WriteFile step so native rewrites and custom output
    // capture share the same path.
    writeFile := shimcompiler.WriteFile(
      func(fileName, text string, _ *shimcompiler.WriteFileData) error {
        return driver.DefaultWriteFile(fileName, text)
      },
    )
    var snapshot func() map[string][]string
    if *provenancePath != "" {
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
      provenanceErr = driver.WriteEmitProvenanceJSON(*provenancePath, snapshot())
    }
    driver.WritePrettyDiagnostics(stderr, eDiags, cwd)
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
    if !*quiet {
      fmt.Fprintf(stdout, "// ttsc: emitted=%d files\n", len(res.EmittedFiles))
      for _, f := range res.EmittedFiles {
        rel := f
        if abs, err := filepath.Rel(cwd, f); err == nil {
          rel = abs
        }
        fmt.Fprintln(stdout, "  +", rel)
      }
    }
    if *manifestPath != "" {
      // The manifest is intentionally just the emitted file list. Higher
      // layers already know the project and tsconfig, and tests compare this
      // array as the build contract.
      data, _ := json.Marshal(res.EmittedFiles)
      if err := os.MkdirAll(filepath.Dir(*manifestPath), 0o755); err != nil {
        fmt.Fprintf(stderr, "ttsc: manifest mkdir failed: %v\n", err)
        return 3
      }
      if err := os.WriteFile(*manifestPath, data, 0o644); err != nil {
        fmt.Fprintf(stderr, "ttsc: manifest write failed: %v\n", err)
        return 3
      }
    }
  }

  if *provenancePath != "" && !shouldEmit {
    if err := driver.WriteEmitProvenanceJSON(*provenancePath, map[string][]string{}); err != nil {
      fmt.Fprintf(stderr, "ttsc: provenance write failed: %v\n", err)
      return 3
    }
  }

  if !*quiet {
    fmt.Fprintf(stdout, "// ttsc: recognized=%d total=%d rewrites=%d\n", 0, 0, rewrites.Len())
  }
  return 0
}

// decodeTsgoArgs decodes the JSON-array value of the `--tsgo-args` flag — the
// tsgo CLI flags the `ttsc` launcher forwarded — into a string slice. An empty
// flag yields a nil slice. Shared by the build / api-compile / api-transform
// subcommands, which all hand the result to driver.LoadProgram.
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
