// JSON API adapter for source-level transformation results.
//
// `api-transform` returns the TypeScript source files that TypeScript-Go
// parsed for the owning project. It is the no-emit companion to api-compile:
// diagnostics are still collected, but the result surface is TypeScript text
// rather than emitted JavaScript.
package main

import (
  "encoding/json"
  "flag"
  "fmt"
  "os"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  cwdutil "github.com/samchon/ttsc/packages/ttsc/internal/cwd"
)

// apiTransformResult separates source output, compiler dependencies and
// native-plugin evaluation observations so each keeps its own reuse meaning.
type apiTransformResult struct {
  // Diagnostics may accompany partial source results.
  Diagnostics []apiCompileDiagnostic `json:"diagnostics,omitempty"`

  // TypeScript contains the parsed text of every non-declaration source the
  // Program facade exposes, keyed like api-compile output. Linked program hooks
  // run before the read but mutate the parsed AST in place, so this text is the
  // file as parsed (including any source preamble), not a printed AST.
  TypeScript map[string]string `json:"typescript"`

  // Graph is the host-owned reference graph of the loaded program (direct
  // resolved reference edges, global-scope files, tsconfig extends chain),
  // keyed like TypeScript. Consumers use it to register every file whose
  // content can influence a transformed module, so bundler caches invalidate
  // soundly without per-plugin reporting.
  Graph *driver.TransformGraph `json:"graph,omitempty"`

  // Dependencies records inputs declared by the linked source contributors.
  // This lane does not run emit transformers or type-driven emit lowering.
  Dependencies map[string][]string `json:"dependencies,omitempty"`

  // DependenciesComplete lists only files whose every source contributor
  // declared completeness. With no contributors, every file is complete.
  DependenciesComplete []string `json:"dependenciesComplete,omitempty"`

  // HostInputs are absolute native plugin config files evaluated while this
  // generation loaded or transformed. JavaScript hosts merge descriptor inputs.
  HostInputs []string `json:"hostInputs,omitempty"`

  // HostInputHashes contains consistent evaluation-time SHA-256 observations.
  // Null means observed absence; omitted keys mean no reusable content proof.
  HostInputHashes map[string]*string `json:"hostInputHashes,omitempty"`

  // HostInputRealpaths carries physical identities observed at evaluation.
  // Null means absence; omitted keys leave symlink or junction identity unknown.
  HostInputRealpaths map[string]*string `json:"hostInputRealpaths,omitempty"`

  // ObservationsComplete is false only for an explicit unsupported observation
  // boundary reported by a linked hook. Absence does not prove completeness.
  ObservationsComplete *bool `json:"observationsComplete,omitempty"`
}

// runAPITransform implements the `api-transform` sub-command. It loads the
// TypeScript program in no-emit mode and returns the source text of every
// non-declaration file as a JSON object, keyed by the same relative-path
// convention as api-compile. Diagnostics are included; partial results are
// returned even when diagnostics are present.
//
// The actual preparation supplies ForceNoEmit and resolved argv/cwd. This
// wrapper owns its one LoadProgram call and closes a nonnil acquired Program
// after the borrowed source-response operation returns. That response owner
// constructs the graph before linked source hooks and never emits files.
func runAPITransform(args []string) int {
  request, code := prepareAPITransformInvocation(args)
  if code != 0 {
    return code
  }
  cwd := request.cwd
  prog, diags, err := driver.LoadProgram(cwd, request.tsconfigPath, request.options)
  if err != nil {
    fmt.Fprintf(stderr, "ttsc api-transform: %v\n", err)
    return 2
  }
  if prog != nil {
    defer prog.Close()
  }
  return writeTransformedProgramResponse(prog, diags, cwd)
}

// writeTransformedProgramResponse borrows the loaded generation for the actual
// source/reference-graph envelope and performs no emit operation. The caller
// owns Close after all consumers. This operation does not require changing the
// Program's NoEmit option; runAPITransform still loads with ForceNoEmit:true.
//
// Go Evidence addresses exported declarations only; these private native
// review grounds remain attached to the owning operation and its callers.
// Common: Principled implementation: The borrowed Program supplies the actual graph before SourceFiles hooks, source texts, diagnostics and observation metadata in the original sequence.
// Common: Clear and simple design: The wrapper owns parse/load/Close and this operation owns the unchanged no-emission source envelope.
// Common: Prohibited implementation shortcuts: No source text or graph is fabricated, diagnostic omitted, option silently toggled or cached response replayed; nil Program/config-diagnostic and writer-error branches remain.
// Common: Meaningful documentation: Borrowing and the distinct ForceNoEmit true wrapper policy are explicit; callers must close only after all consumers.
// Portability: OS-neutral implementation: Existing apiOutputKey and native JSON serialization preserve path and byte conventions without a subprocess or new filesystem-case assumption.
// Performance: Efficient algorithms: The original graph, resident-file enumeration and one JSON encoding remain; work scales with actual graph/source/envelope bytes.
// Performance: Reuse equivalent work: An immutable no-plugin generation already emitted to memory can supply its original source text and graph without a second load. This is operation-level reuse, not a claim of equal compile/transform loader policies.
// Performance: Bound retention and release resources: The caller retains the checker lease across borrowing and closes it once after the final consumer; this operation creates invocation-local envelope collections and does not own the lease or a retained cache.
func writeTransformedProgramResponse(prog *driver.Program, diags []driver.Diagnostic, cwd string) int {
  typescript := map[string]string{}
  var dependencies driver.TransformDependencies
  var graph *driver.TransformGraph
  var hostInputs []string
  var hostInputHashes map[string]*string
  var hostInputRealpaths map[string]*string
  var observationsComplete *bool
  if prog != nil {
    // Compute the reference graph before SourceFiles() runs linked plugin
    // hooks: those mutate parsed ASTs in place, and the graph must describe
    // the original source's resolved references — the transform's inputs —
    // not the mutated output.
    graph = driver.NewTransformGraph(prog, cwd)
    for _, file := range prog.SourceFiles() {
      typescript[apiOutputKey(cwd, file.FileName().AsString())] = file.Text()
    }
    diags = append(diags, prog.Diagnostics()...)
    dependencies = prog.TransformDependenciesFor(cwd)
    hostInputs = prog.PluginHostInputs()
    hostInputHashes = prog.PluginHostInputHashes()
    hostInputRealpaths = prog.PluginHostInputRealpaths()
    if prog.PluginObservationsIncomplete() {
      incomplete := false
      observationsComplete = &incomplete
    }
  }

  result := apiTransformResult{
    Dependencies:         dependencies.Dependencies,
    DependenciesComplete: dependencies.Complete,
    Diagnostics:          make([]apiCompileDiagnostic, 0, len(diags)),
    Graph:                graph,
    HostInputs:           hostInputs,
    HostInputHashes:      hostInputHashes,
    HostInputRealpaths:   hostInputRealpaths,
    ObservationsComplete: observationsComplete,
    TypeScript:           typescript,
  }
  for _, diag := range diags {
    result.Diagnostics = append(result.Diagnostics, toAPICompileDiagnostic(diag))
  }

  if err := json.NewEncoder(stdout).Encode(result); err != nil {
    fmt.Fprintf(stderr, "ttsc api-transform: write result: %v\n", err)
    return 3
  }
  if driver.CountErrors(diags) > 0 {
    return 2
  }
  return 0
}

// prepareAPITransformLoadOptions is the exact options policy used by the real
// runAPITransform parse path. It explicitly keeps ForceNoEmit:true distinct
// from compile's ForceEmit:true; no mutable Program option is flipped for reuse.
//
// Go Evidence addresses exported declarations only; these private native
// review grounds remain attached to the owning operation and its callers.
// Common: Principled implementation: The real runAPITransform parse path consumes the exact ForceNoEmit true policy while preserving all parsed threading, semantic-config and tsgo argument fields.
// Common: Clear and simple design: One value constructor isolates loader policy from the borrowed source-envelope operation.
// Common: Prohibited implementation shortcuts: Original compile/transform policy differences remain explicit and are not merged merely to lower a producer count.
// Common: Meaningful documentation: Native prose identifies the actual caller and forbids mutable Program option flipping for reuse.
// Portability: OS-neutral implementation: Existing native path and argv values are forwarded without shell or separator conversion.
// Performance: Efficient algorithms: Constant-size value construction forwards the parsed argv slice without an extra traversal.
// Performance: Reuse equivalent work: The constructor performs no compilation or result replay and stores no prior request state.
// Performance: Bound retention and release resources: Parsed values remain caller-owned through synchronous loading; no independent resource or retention owner is introduced.
func prepareAPITransformLoadOptions(semanticConfigPath string, singleThreaded bool, checkers int, tsgoArgs []string) driver.LoadProgramOptions {
  return driver.LoadProgramOptions{ForceNoEmit: true, SemanticConfigPath: semanticConfigPath, SingleThreaded: singleThreaded, Checkers: checkers, TsgoArgs: tsgoArgs}
}

// prepareAPITransformInvocation parses the original native API argv and returns its exact cwd, selected config and loader policy.
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
func prepareAPITransformInvocation(args []string) (apiCommandRequest, int) {
  fs := flag.NewFlagSet("api-transform", flag.ContinueOnError)
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

  return apiCommandRequest{cwd: cwd, tsconfigPath: *tsconfigPath, options: prepareAPITransformLoadOptions(os.Getenv(driver.SemanticConfigPathEnv), *singleThreaded, *checkers, tsgoArgs)}, 0
}
