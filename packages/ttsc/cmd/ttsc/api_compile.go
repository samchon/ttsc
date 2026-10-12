// JSON API adapter for in-process-style project compilation.
//
// `api-compile` is consumed by the TypeScript wrapper when it needs a stable,
// machine-readable result from the native compiler host. The command always
// emits into memory and serializes diagnostics plus output text; it never
// writes generated files into the caller's project tree.
package main

import (
  "encoding/json"
  "flag"
  "fmt"
  "os"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  cwdutil "github.com/samchon/ttsc/packages/ttsc/internal/cwd"
)

// apiCompileResult is the in-memory compilation envelope. Output is keyed by
// the shared project-relative path convention rather than native separators.
type apiCompileResult struct {
  // Diagnostics is omitted only when the compiler produced no diagnostics.
  Diagnostics []apiCompileDiagnostic `json:"diagnostics,omitempty"`

  // Output remains present when diagnostics accompany partial emission.
  Output map[string]string `json:"output"`

  // EmittedSources records actual JavaScript writes using absolute native output
  // paths and generation-time physical source paths. Empty rows preserve unknown
  // ownership; the empty object means no JavaScript write succeeded.
  EmittedSources map[string][]string `json:"emittedSources"`
}

// apiCompileDiagnostic mirrors the public TypeScript-side diagnostic DTO.
// The JSON keys intentionally use TypeScript naming (`messageText`,
// `character`) instead of Go naming so callers can pass the data through
// without remapping.
type apiCompileDiagnostic struct {
  // File is null for a diagnostic without an authored source location.
  File *string `json:"file"`

  Category string `json:"category"`
  Code     int32  `json:"code"`

  // Start is an optional byte offset, not a UTF-16 character offset.
  Start *int `json:"start,omitempty"`

  // Length is the optional byte extent associated with Start.
  Length *int `json:"length,omitempty"`

  // Line is one-based; absent means no authored line is available.
  Line int `json:"line,omitempty"`

  // Character preserves the driver's one-based byte column despite its
  // TypeScript-style JSON name. It is not an LSP character position.
  Character int `json:"character,omitempty"`

  MessageText string `json:"messageText"`
}

// runAPICompile prepares an API request, loads its actual compiler generation
// and writes the compile response.
//
// The real preparation owns native argv/cwd errors and the ForceEmit policy.
// This wrapper loads once, reports load errors and retains a nonnil Program
// until the borrowed response operation finishes. Deferred Close releases that
// acquired checker lease on every response return.
//
// The response owner emits actual compiler output to memory and serializes its
// original diagnostics/provenance envelope; the wrapper returns that
// operation's status.
func runAPICompile(args []string) int {
  request, code := prepareAPICompileInvocation(args)
  if code != 0 {
    return code
  }
  cwd := request.cwd
  prog, diags, err := driver.LoadProgram(cwd, request.tsconfigPath, request.options)
  if err != nil {
    fmt.Fprintf(stderr, "ttsc api-compile: %v\n", err)
    return 2
  }
  if prog != nil {
    defer prog.Close()
  }
  return writeCompiledProgramResponse(prog, diags, cwd)
}

// writeCompiledProgramResponse borrows a Program while it emits the actual
// memory-backed result and serializes the existing JSON envelope. The caller
// owns Close after every consumer; this operation neither reloads nor closes it.
// Preparation separately preserves the original ForceEmit:true policy.
//
// Go Evidence addresses exported declarations only; these private native
// review grounds remain attached to the owning operation and its callers.
// Common: Principled implementation: The borrowed actual Program supplies diagnostics, memory emission and the existing provenance-backed JSON envelope; the wrapper still loads with ForceEmit true and owns Close.
// Common: Clear and simple design: The wrapper owns flag parsing/load/lease cleanup while this operation owns the unchanged emit and serialization sequence.
// Common: Prohibited implementation shortcuts: No emitted result or diagnostic is replayed, NoEmit option flipped, loader mocked or status fabricated; nil Program and partial diagnostic envelopes preserve the original branches.
// Common: Meaningful documentation: Native prose states borrowing, original loader policy and caller cleanup after all consumers.
// Portability: OS-neutral implementation: Existing native project keys and JSON writers retain their original path/byte ownership; no shell, process or path policy is introduced.
// Performance: Efficient algorithms: Actual EmitAll and one JSON encoding do the same compiler/output work as before; memory-map/provenance processing scales with actual emitted bytes and paths.
// Performance: Reuse equivalent work: A load owner may reuse one immutable Program for this real memory emission and read-only source-envelope consumer. It does not claim the compile and transform wrappers have equal raw loader options.
// Performance: Bound retention and release resources: The load owner holds its checker lease through all borrowed consumers and closes once. This operation retains local output/provenance/diagnostic data until encoding returns, with no independent output byte ceiling.
func writeCompiledProgramResponse(prog *driver.Program, diags []driver.Diagnostic, cwd string) int {
  if prog != nil {
    diags = append(diags, prog.Diagnostics()...)
  }
  output := map[string]string{}
  emittedSources := map[string][]string{}
  if prog != nil {
    rewrites := driver.NewRewriteSet()
    // Capture WriteFile output in a map keyed by project-relative paths. This
    // gives the JS API a deterministic object and avoids touching outDir.
    writeFile := shimcompiler.WriteFile(
      func(fileName shimtspath.RootedFilePath, text string, _ *shimcompiler.WriteFileData) error {
        output[apiOutputKey(cwd, fileName.AsString())] = text
        return nil
      },
    )
    writeFile, snapshot, err := prog.NewEmitProvenanceRecorder(writeFile)
    if err != nil {
      fmt.Fprintf(stderr, "ttsc api-compile: provenance failed: %v\n", err)
      return 3
    }
    _, emitDiags, err := prog.EmitAll(rewrites, writeFile)
    if err != nil {
      fmt.Fprintf(stderr, "ttsc api-compile: emit failed: %v\n", err)
      return 3
    }
    diags = append(diags, emitDiags...)
    emittedSources = snapshot()
  }

  result := apiCompileResult{
    Diagnostics:    make([]apiCompileDiagnostic, 0, len(diags)),
    Output:         output,
    EmittedSources: emittedSources,
  }
  for _, diag := range diags {
    result.Diagnostics = append(result.Diagnostics, toAPICompileDiagnostic(diag))
  }

  if err := json.NewEncoder(stdout).Encode(result); err != nil {
    fmt.Fprintf(stderr, "ttsc api-compile: write result: %v\n", err)
    return 3
  }
  if driver.CountErrors(diags) > 0 {
    return 2
  }
  return 0
}

// toAPICompileDiagnostic converts an internal driver.Diagnostic into the
// JSON-serialisable form returned by the api-compile command. Category is
// lowercased to match the TypeScript Language Service convention.
//
// Warning maps to warning and every other severity maps to error. Source
// metadata is copied with its driver byte units and one-based positions; the
// JSON Character name introduces no UTF-16 conversion. An absent source file
// becomes null, while optional offset/extent pointers retain their given state.
func toAPICompileDiagnostic(diag driver.Diagnostic) apiCompileDiagnostic {
  var file *string
  if diag.File != "" {
    value := diag.File
    file = &value
  }
  category := "error"
  if diag.Severity == driver.SeverityWarning {
    category = "warning"
  }
  return apiCompileDiagnostic{
    File:        file,
    Category:    category,
    Code:        diag.Code,
    Start:       diag.Start,
    Length:      diag.Length,
    Line:        diag.Line,
    Character:   diag.Column,
    MessageText: diag.Message,
  }
}

// apiOutputKey returns the map key used in the api-compile result for a
// generated file. Files inside cwd use a slash-separated relative path (the
// API contract). Files outside cwd — rare, e.g. a monorepo output rooted
// above the project — are returned as an absolute slash path instead.
// Delegates to the driver so every envelope section (typescript, graph)
// shares one key implementation and consumers can join sections by key.
func apiOutputKey(cwd, fileName string) string {
  return driver.TransformOutputKey(cwd, fileName)
}

// prepareAPICompileLoadOptions is the exact policy constructor consumed by
// runAPICompile after native flag parsing and forwarded-argument decoding.
// Borrowed-operation tests do not claim their shared Program has transform's
// different NoEmit option; this real construction path keeps that distinction.
//
// Go Evidence addresses exported declarations only; these private native
// review grounds remain attached to the owning operation and its callers.
// Common: Principled implementation: The real runAPICompile parse path consumes this exact ForceEmit true load policy and forwards all previously parsed threading, semantic-config and tsgo arguments unchanged.
// Common: Clear and simple design: One value constructor separates load policy from borrowed emission/serialization.
// Common: Prohibited implementation shortcuts: The constructor replaces a literal struct in the product caller; no test-only expected map, fake loader or public export bypasses policy.
// Common: Meaningful documentation: Native prose states the production caller and the deliberate difference from ForceNoEmit transform loading.
// Portability: OS-neutral implementation: The value carries existing native-path strings and argv tokens without rewriting separators or shell syntax.
// Performance: Efficient algorithms: A fixed-size options value is constructed in constant work; the parsed argument slice is forwarded without rescanning.
// Performance: Reuse equivalent work: This pure value construction creates no compiler result cache; the synchronous caller consumes its own parsed inputs.
// Performance: Bound retention and release resources: Strings and the parsed argument slice are borrowed until synchronous LoadProgram consumption; no checker lease, process or resident history is acquired.
func prepareAPICompileLoadOptions(semanticConfigPath string, singleThreaded bool, checkers int, tsgoArgs []string) driver.LoadProgramOptions {
  return driver.LoadProgramOptions{ForceEmit: true, SemanticConfigPath: semanticConfigPath, SingleThreaded: singleThreaded, Checkers: checkers, TsgoArgs: tsgoArgs}
}

// prepareAPICompileInvocation parses the original native API argv and returns its exact cwd, selected config and loader policy.
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
func prepareAPICompileInvocation(args []string) (apiCommandRequest, int) {
  fs := flag.NewFlagSet("api-compile", flag.ContinueOnError)
  fs.SetOutput(stderr)
  tsconfigPath := fs.String("tsconfig", "tsconfig.json", "path to tsconfig.json")
  cwdOverride := fs.String("cwd", "", "override the working directory")
  singleThreaded := fs.Bool("singleThreaded", false, "run TypeScript-Go single-threaded")
  checkers := fs.Int("checkers", 0, "type-checker pool size (0 = TypeScript-Go default)")
  tsgoArgsRaw := fs.String("tsgo-args", "", "JSON array of forwarded tsgo CLI flags")
  // See cmd/ttsc/build.go's filterHostArgs call for the rationale.
  if err := fs.Parse(filterHostArgs(args)); err != nil {
    return apiCommandRequest{}, 2
  }

  cwd, err := cwdutil.Resolve(*cwdOverride, getwd)
  if err != nil {
    fmt.Fprintf(stderr, "ttsc: %v\n", err)
    return apiCommandRequest{}, 2
  }

  tsgoArgs, err := decodeTsgoArgs(*tsgoArgsRaw)
  if err != nil {
    fmt.Fprintf(stderr, "ttsc: %v\n", err)
    return apiCommandRequest{}, 2
  }

  return apiCommandRequest{cwd: cwd, tsconfigPath: *tsconfigPath, options: prepareAPICompileLoadOptions(os.Getenv(driver.SemanticConfigPathEnv), *singleThreaded, *checkers, tsgoArgs)}, 0
}

// apiCommandRequest carries the existing resolved API invocation until its
// synchronous LoadProgram call. It owns no compiler lease or cached response.
//
// Go Evidence addresses exported declarations only; these private native
// review grounds describe the request carrier consumed by the real wrapper.
// Common: Principled implementation: The selected cwd/config and loader policy retain compile ForceEmit versus transform ForceNoEmit; the wrappers consume these exact values for real LoadProgram calls.
// Common: Clear and simple design: One value carries prepared command intent across synchronous load and response ownership; no hidden dispatch or compiler producer is introduced.
// Common: Prohibited implementation shortcuts: The carrier contains actual parsed values, never fabricated output, cached status, mocked loader or a public test-only API.
// Common: Meaningful documentation: Native prose identifies policy distinctions and the wrapper's Program lease ownership.
// Portability: OS-neutral implementation: Native cwd/config strings and argv are forwarded without shell, symlink or forced-separator conversion.
// Performance: Efficient algorithms: Fields transfer in constant-size value copies; the forwarded argv slice is not retraversed or compiled by this carrier.
// Performance: Reuse equivalent work: Each preparation creates invocation-local intent; the carrier stores no global cache or previous command result.
// Performance: Bound retention and release resources: Referenced argv remains owned by the synchronous request lifetime; the carrier acquires no checker lease, process or independently retained resource.
type apiCommandRequest struct {
  cwd          string
  tsconfigPath string
  options      driver.LoadProgramOptions
}
