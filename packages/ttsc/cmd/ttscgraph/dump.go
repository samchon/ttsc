package main

import (
  "flag"
  "fmt"
  "path/filepath"
  "strings"

  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph"
)

// preparedDumpCommand retains one loaded Program and its actual graph, source
// texts and producer origin until the command adapter finishes encoding.
type preparedDumpCommand struct {
  program  *driver.Program
  built    *graph.Graph
  cwd      string
  tsconfig string
  texts    map[string]string
  origin   graph.DumpOrigin
  pretty   bool
}

// runDump emits the complete raw graph as a JSON document, without MCP caps.
// Host ignore acquisition belongs to this default command adapter. The prepared
// command owns grammar, compiler loading, origin claims and streaming encoding.
// Returns 0 on success, 1 on a load or serialize error, 2 on invalid invocation.
func runDump(args []string) int {
  prepared, code := prepareDumpCommand(args)
  if prepared == nil {
    return code
  }
  defer func() { _ = prepared.program.Close() }()
  return prepared.encode(graph.GitIgnoredFiles(prepared.cwd, prepared.built))
}

// prepareDumpCommand owns the shipped grammar and producer claims. It releases
// the Program on preparation failure; a successful caller owns its final close.
func prepareDumpCommand(args []string) (*preparedDumpCommand, int) {
  fs := flag.NewFlagSet("ttscgraph dump", flag.ContinueOnError)
  fs.SetOutput(stderr)
  cwdFlag := fs.String("cwd", "", "project root (defaults to process cwd)")
  tsconfigFlag := fs.String("tsconfig", "tsconfig.json", "project tsconfig path")
  prettyFlag := fs.Bool("pretty", false, "indent the JSON output")
  artifactsFlag := fs.String(
    "artifacts",
    "",
    "path to the artifacts a plugin published (JSON); absent or missing means none",
  )
  if err := fs.Parse(args); err != nil {
    return nil, 2
  }

  cwd := strings.TrimSpace(*cwdFlag)
  if cwd == "" {
    resolved, err := getwd()
    if err != nil {
      fmt.Fprintf(stderr, "ttscgraph: could not resolve working directory: %v\n", err)
      return nil, 2
    }
    cwd = resolved
  }
  // Resolve the project root the same way LoadProgram does (absolute, then
  // tsgo-normalized) so the dump path mapper receives the same canonical root
  // grammar and drive-letter case as the compiler's source paths.
  if abs, err := filepath.Abs(cwd); err == nil {
    cwd = abs
  }
  cwd = shimtspath.ResolvePath(cwd)
  tsconfig := strings.TrimSpace(*tsconfigFlag)

  prog, _, err := driver.LoadProgram(cwd, tsconfig, driver.LoadProgramOptions{})
  if err != nil {
    fmt.Fprintf(stderr, "ttscgraph: could not load %s/%s: %v\n", cwd, tsconfig, err)
    return nil, 1
  }
  if prog == nil {
    fmt.Fprintf(stderr, "ttscgraph: could not load %s/%s\n", cwd, tsconfig)
    return nil, 1
  }

  g := graph.Build(prog)
  // The artifacts arrive from a plugin that parsed documents this Program never
  // read, so they are a second producer's facts and the origin says so. Applying
  // them before the dump is what turns a citation of a document section from a
  // token into a relation.
  artifacts, err := graph.LoadArtifacts(strings.TrimSpace(*artifactsFlag))
  if err != nil {
    fmt.Fprintf(stderr, "ttscgraph: could not read the published artifacts: %v\n", err)
    _ = prog.Close()
    return nil, 1
  }
  graph.ApplyArtifacts(g, artifacts)
  texts := graph.SourceTexts(prog)
  origin, err := dumpOrigin(prog, texts, strings.TrimSpace(*artifactsFlag) != "")
  if err != nil {
    fmt.Fprintf(stderr, "ttscgraph: %v\n", err)
    _ = prog.Close()
    return nil, 1
  }
  return &preparedDumpCommand{program: prog, built: g, cwd: cwd, tsconfig: tsconfig, texts: texts, origin: origin, pretty: *prettyFlag}, 0
}

// encode projects an actual prepared command with evaluated ignore membership.
// It preserves stdout streaming and reports the same serialization diagnostics.
// Buffered streaming avoids retaining another complete JSON byte slice and
// string, which matters for large raw graph documents.
func (prepared *preparedDumpCommand) encode(ignored map[string]bool) int {
  if err := graph.EncodeDump(stdout, prepared.built, prepared.cwd, prepared.tsconfig, ignored, prepared.texts, prepared.origin, prepared.pretty); err != nil {
    fmt.Fprintf(stderr, "ttscgraph: %v\n", err)
    return 1
  }
  return 0
}

// dumpOrigin assembles the one-shot command's snapshot evidence. A dump written
// to a file outlives the process that made it and is read by tooling that never
// saw the project, so it carries the same provenance a served snapshot does:
// without it the file is a pile of facts with no way to tell which program, or
// which day, they describe.
//
// askedForArtifacts turns the artifact capability from a guess into a claim:
// a producer never pointed at a publisher did not look. Saying it did would make a
// project with no artifacts indistinguishable from one whose artifacts were
// never requested.
func dumpOrigin(
  prog *driver.Program,
  texts map[string]string,
  askedForArtifacts bool,
) (graph.DumpOrigin, error) {
  configs, err := parsedConfigs(prog)
  if err != nil {
    return graph.DumpOrigin{}, err
  }
  configHashes, err := hashFiles(configFiles(configs))
  if err != nil {
    return graph.DumpOrigin{}, err
  }
  _, diskDigests, err := hashProgramSources(prog)
  if err != nil {
    return graph.DumpOrigin{}, err
  }
  capabilities := fullSnapshotCapabilities
  if askedForArtifacts {
    capabilities = append(append([]string{}, capabilities...), graph.CapabilityArtifactNodes)
  }
  provenance := graph.NewProvenance(
    serveProducer(),
    capabilities,
    fileDigests(configHashes),
    rootFileEntries(projectRootFilesFromConfigs(configs, false)),
    texts,
    diskDigests,
  )
  if askedForArtifacts {
    provenance.ArtifactProducer = &graph.Producer{Tool: "@ttsc/lint graph-nodes"}
  }
  return graph.DumpOrigin{
    Provenance:  provenance,
    Diagnostics: graph.NewDiagnostics(prog),
  }, nil
}
