// Test-only native sidecar for the go-transformer corpus.
//
// The command implements the same command family as production sidecars
// (`check`, `build`, `transform`, `version`) while keeping the transformation
// domain deliberately tiny. It is a protocol fixture, not a production plugin.
package main

import (
  "encoding/json"
  "flag"
  "fmt"
  "os"
  "path/filepath"

  "github.com/samchon/ttsc/tests/go-transformer/transformer"
)

func main() {
  os.Exit(run(os.Args[1:]))
}

func run(args []string) int {
  if len(args) == 0 {
    fmt.Fprintln(os.Stderr, "ttsc-go-transformer: command is required")
    return 2
  }
  switch args[0] {
  case "-v", "--version", "version":
    fmt.Fprintln(os.Stdout, "ttsc-go-transformer 0.1.0-test")
    return 0
  case "transform":
    return runTransform(args[1:])
  case "build":
    return runBuild(args[1:])
  case "check":
    return runCheck(args[1:])
  default:
    fmt.Fprintf(os.Stderr, "ttsc-go-transformer: unknown command %q\n", args[0])
    return 2
  }
}

func runCheck(args []string) int {
  fs := flag.NewFlagSet("check", flag.ContinueOnError)
  fs.SetOutput(os.Stderr)
  _ = fs.String("cwd", "", "project directory")
  _ = fs.String("tsconfig", "", "tsconfig")
  _ = fs.String("plugins-json", "", "ordered plugin descriptors")
  if err := fs.Parse(args); err != nil {
    return 2
  }
  // The fixture has no analysis phase. Successful flag parsing is enough to
  // prove that the host invoked the sidecar with the expected command shape.
  return 0
}

func runBuild(args []string) int {
  fs := flag.NewFlagSet("build", flag.ContinueOnError)
  fs.SetOutput(os.Stderr)
  cwd := fs.String("cwd", "", "project directory")
  _ = fs.String("tsconfig", "", "tsconfig")
  pluginsJSON := fs.String("plugins-json", "", "ordered plugin descriptors")
  _ = fs.Bool("emit", false, "emit")
  _ = fs.Bool("quiet", false, "quiet")
  outDir := fs.String("outDir", "dist", "out dir")
  if err := fs.Parse(args); err != nil {
    return 2
  }
  root := *cwd
  if root == "" {
    var err error
    root, err = os.Getwd()
    if err != nil {
      fmt.Fprintf(os.Stderr, "ttsc-go-transformer: cwd: %v\n", err)
      return 2
    }
  }
  source := filepath.Join(root, "src", "main.ts")
  text, err := os.ReadFile(source)
  if err != nil {
    fmt.Fprintf(os.Stderr, "ttsc-go-transformer: read %s: %v\n", source, err)
    return 2
  }
  plugins, err := parsePlugins(*pluginsJSON)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  result, err := transformer.Transform(string(text), plugins)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  out := filepath.Join(root, *outDir, "main.js")
  if filepath.IsAbs(*outDir) {
    // ttsc passes an absolute outDir for some cache/runtime lanes. The sidecar
    // treats that as authoritative rather than joining it under cwd.
    out = filepath.Join(*outDir, "main.js")
  }
  if err := os.MkdirAll(filepath.Dir(out), 0o755); err != nil {
    fmt.Fprintf(os.Stderr, "ttsc-go-transformer: mkdir: %v\n", err)
    return 2
  }
  if err := os.WriteFile(out, []byte(result.Code), 0o644); err != nil {
    fmt.Fprintf(os.Stderr, "ttsc-go-transformer: write %s: %v\n", out, err)
    return 2
  }
  return 0
}

func runTransform(args []string) int {
  fs := flag.NewFlagSet("transform", flag.ContinueOnError)
  fs.SetOutput(os.Stderr)
  file := fs.String("file", "", "source file")
  out := fs.String("out", "", "output file")
  _ = fs.String("tsconfig", "", "owning tsconfig")
  pluginsJSON := fs.String("plugins-json", "", "ordered plugin descriptors")
  if err := fs.Parse(args); err != nil {
    return 2
  }
  if *file == "" {
    fmt.Fprintln(os.Stderr, "ttsc-go-transformer: transform requires --file")
    return 2
  }
  source, err := os.ReadFile(*file)
  if err != nil {
    fmt.Fprintf(os.Stderr, "ttsc-go-transformer: read %s: %v\n", *file, err)
    return 2
  }
  plugins, err := parsePlugins(*pluginsJSON)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  result, err := transformer.Transform(string(source), plugins)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  if *out != "" {
    if err := os.MkdirAll(filepath.Dir(*out), 0o755); err != nil {
      fmt.Fprintf(os.Stderr, "ttsc-go-transformer: mkdir: %v\n", err)
      return 2
    }
    if err := os.WriteFile(*out, []byte(result.Code), 0o644); err != nil {
      fmt.Fprintf(os.Stderr, "ttsc-go-transformer: write %s: %v\n", *out, err)
      return 2
    }
    return 0
  }
  fmt.Fprint(os.Stdout, result.Code)
  return 0
}

type pluginDescriptor struct {
  Config map[string]any `json:"config"`
  Name   string         `json:"name"`
  Stage  string         `json:"stage"`
}

func parsePlugins(input string) ([]transformer.Plugin, error) {
  if input == "" {
    return nil, nil
  }
  var descriptors []pluginDescriptor
  if err := json.Unmarshal([]byte(input), &descriptors); err != nil {
    return nil, fmt.Errorf("ttsc-go-transformer: invalid --plugins-json: %w", err)
  }
  plugins := make([]transformer.Plugin, 0, len(descriptors))
  for _, descriptor := range descriptors {
    // Plugin order is semantically observable in this fixture: prefix,
    // uppercase, suffix must run in descriptor order.
    plugins = append(plugins, transformer.Plugin{
      Config:    descriptor.Config,
      Operation: inferOperation(descriptor.Config),
      Name:      descriptor.Name,
    })
  }
  return plugins, nil
}

func inferOperation(config map[string]any) string {
  // Short config forms keep JSON fixtures readable while still covering the
  // sidecar's operation-dispatch branch.
  if value, ok := config["operation"].(string); ok && value != "" {
    return value
  }
  if _, ok := config["prefix"]; ok {
    return "go-prefix"
  }
  if _, ok := config["suffix"]; ok {
    return "go-suffix"
  }
  return "go-uppercase"
}
