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

// runDump builds the full code graph for a project and prints it as JSON to
// stdout, then exits. Unlike serve it does not stay resident: it is the one-shot
// `ttscgraph dump` a user pipes into a file to feed the 3D viewer or any other
// tooling. Every node and edge is included, with none of the MCP response caps.
// Returns 0 on success, 1 on a load or serialize error, 2 on invalid invocation.
func runDump(args []string) int {
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
    return 2
  }

  cwd := strings.TrimSpace(*cwdFlag)
  if cwd == "" {
    resolved, err := getwd()
    if err != nil {
      fmt.Fprintf(stderr, "ttscgraph: could not resolve working directory: %v\n", err)
      return 2
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
    return 1
  }
  if prog == nil {
    fmt.Fprintf(stderr, "ttscgraph: could not load %s/%s\n", cwd, tsconfig)
    return 1
  }
  defer func() { _ = prog.Close() }()

  g := graph.Build(prog)
  // The artifacts arrive from a plugin that parsed documents this Program never
  // read, so they are a second producer's facts and the origin says so. Applying
  // them before the dump is what turns a citation of a document section from a
  // token into a relation.
  artifacts, err := graph.LoadArtifacts(strings.TrimSpace(*artifactsFlag))
  if err != nil {
    fmt.Fprintf(stderr, "ttscgraph: could not read the published artifacts: %v\n", err)
    return 1
  }
  graph.ApplyArtifacts(g, artifacts)
  ignored := graph.GitIgnoredFiles(cwd, g)
  texts := graph.SourceTexts(prog)
  origin, err := dumpOrigin(prog, texts, strings.TrimSpace(*artifactsFlag) != "")
  if err != nil {
    fmt.Fprintf(stderr, "ttscgraph: %v\n", err)
    return 1
  }
  // Stream the document out instead of marshalling it into one byte slice and
  // then copying that slice into a string: on VS Code the dump is 323 MB, so
  // the string conversion alone was a second full copy of it, for nothing. The
  // encoder writes through a buffer straight to stdout.
  if err := graph.EncodeDump(
    stdout,
    g,
    cwd,
    tsconfig,
    ignored,
    texts,
    origin,
    *prettyFlag,
  ); err != nil {
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
// dumpOrigin builds the provenance for one dump. askedForArtifacts is what
// turns the artifact capability from a guess into a claim: a producer that was
// never pointed at a publisher did not look, and saying it did would make a
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
