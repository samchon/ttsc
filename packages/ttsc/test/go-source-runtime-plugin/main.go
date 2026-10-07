// Project-shaped Go source plugin fixture.
//
// Runtime consumers share this immutable producer. Unlike the lightweight cache
// fixture, it emits through the real compiler and records successful publication
// provenance so ttsx and its register hook consume compiler-owned outputs.
package main

import (
  "encoding/json"
  "flag"
  "fmt"
  "os"
  "path/filepath"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"
  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// Plugin is the manifest entry after local operation inference.
type Plugin struct {
  Config    map[string]any `json:"config"`
  Name      string         `json:"name"`
  Operation string         `json:"-"`
  Stage     string         `json:"stage"`
}

func main() {
  os.Exit(run(os.Args[1:]))
}

func run(args []string) int {
  if len(args) == 0 {
    fmt.Fprintln(os.Stderr, "go-source-plugin: command required")
    return 2
  }
  switch args[0] {
  case "-v", "--version", "version":
    fmt.Fprintln(os.Stdout, "go-source-plugin 0.0.0-test")
    return 0
  case "build":
    return runBuild(args[1:])
  case "check":
    return 0
  default:
    fmt.Fprintf(os.Stderr, "go-source-plugin: unknown command %q\n", args[0])
    return 2
  }
}

// runBuild emits through the actual compiler so runtime output ownership is
// recorded from compiler source files and successful publication callbacks.
func runBuild(args []string) (status int) {
  flags := flag.NewFlagSet("build", flag.ContinueOnError)
  flags.SetOutput(os.Stderr)
  cwd := flags.String("cwd", "", "")
  tsconfig := flags.String("tsconfig", "", "")
  pluginsJSON := flags.String("plugins-json", "", "")
  provenancePath := flags.String("emit-provenance-json", "", "")
  _ = flags.Bool("emit", false, "")
  _ = flags.Bool("quiet", false, "")
  _ = flags.Bool("verbose", false, "")
  _ = flags.Bool("noEmit", false, "")
  outDir := flags.String("outDir", "dist", "")
  if err := flags.Parse(args); err != nil {
    return 2
  }
  if *provenancePath != "" && !filepath.IsAbs(*provenancePath) {
    fmt.Fprintln(os.Stderr, "go-source-plugin: emit provenance path must be absolute")
    return 2
  }
  root := *cwd
  if root == "" {
    var err error
    root, err = os.Getwd()
    if err != nil {
      fmt.Fprintln(os.Stderr, err)
      return 2
    }
  }
  config := *tsconfig
  if config == "" {
    config = filepath.Join(root, "tsconfig.json")
  }
  plugins, err := parsePlugins(*pluginsJSON)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  prog, diagnostics, err := driver.LoadProgram(root, config, driver.LoadProgramOptions{
    ForceEmit: true, OutDir: *outDir,
    SourcePreamble: "declare function goUpper(value: string): string;\n",
  })
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  if len(diagnostics) != 0 {
    driver.WritePrettyDiagnostics(os.Stderr, diagnostics, root)
    return 2
  }
  defer prog.Close()
  publish := writeEmittedFile
  if *provenancePath != "" {
    var snapshot func() map[string][]string
    publish, snapshot, err = prog.NewEmitProvenanceRecorder(writeEmittedFile)
    if err != nil {
      fmt.Fprintln(os.Stderr, err)
      return 2
    }
    defer func() {
      if err := driver.WriteEmitProvenanceJSON(*provenancePath, snapshot()); err != nil {
        fmt.Fprintln(os.Stderr, err)
        status = 2
      }
    }()
  }
  pending := map[string]string{}
  var transformError error
  transformPlugin := func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    var visitor *shimast.NodeVisitor
    visit := func(node *shimast.Node) *shimast.Node {
      if node == nil {
        return nil
      }
      if node.Kind == shimast.KindCallExpression {
        call := node.AsCallExpression()
        if call.Expression.Kind == shimast.KindIdentifier && call.Expression.Text() == "goUpper" && call.Arguments != nil && len(call.Arguments.Nodes) == 1 && call.Arguments.Nodes[0].Kind == shimast.KindStringLiteral {
          value, err := transformValue(call.Arguments.Nodes[0].Text(), plugins)
          if err != nil {
            transformError = err
            return node
          }
          return ec.Factory.NewStringLiteral(value, 0)
        }
      }
      return visitor.VisitEachChild(node)
    }
    visitor = ec.NewNodeVisitor(visit)
    return visitor.VisitSourceFile(sf)
  }
  emitDiagnostics, err := prog.EmitWithPluginTransformers([]driver.PluginTransform{transformPlugin}, func(name, text string, _ *shimcompiler.WriteFileData) error {
    pending[name] = text
    return nil
  })
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  if transformError != nil {
    fmt.Fprintln(os.Stderr, transformError)
    return 2
  }
  driver.WritePrettyDiagnostics(os.Stderr, emitDiagnostics, root)
  for name, text := range pending {
    if err := publish(name, text, nil); err != nil {
      fmt.Fprintln(os.Stderr, err)
      return 2
    }
  }
  return 0
}

func writeEmittedFile(name, text string, _ *shimcompiler.WriteFileData) error {
  if err := os.MkdirAll(filepath.Dir(name), 0o755); err != nil {
    return err
  }
  return os.WriteFile(name, []byte(text), 0o644)
}

func parsePlugins(input string) ([]Plugin, error) {
  if input == "" {
    return nil, nil
  }
  var plugins []Plugin
  if err := json.Unmarshal([]byte(input), &plugins); err != nil {
    return nil, fmt.Errorf("go-source-plugin: invalid --plugins-json: %w", err)
  }
  for i := range plugins {
    plugins[i].Operation = inferOperation(plugins[i].Config)
  }
  return plugins, nil
}

// transformValue retains the fixture's ordered operation and mutation semantics.
func transformValue(value string, plugins []Plugin) (string, error) {
  if len(plugins) == 0 {
    // A missing manifest still produces deterministic output so the fixture can
    // test source-plugin execution separately from descriptor loading.
    plugins = []Plugin{{Operation: "go-uppercase"}}
  }
  for _, plugin := range plugins {
    switch plugin.Operation {
    case "go-uppercase":
      value = strings.ToUpper(value)
    case "go-lowercase":
      value = strings.ToLower(value)
    case "go-prefix":
      value = stringConfig(plugin.Config, "prefix") + value
    case "go-suffix":
      value += stringConfig(plugin.Config, "suffix")
    case "go-reverse":
      runes := []rune(value)
      for i, j := 0, len(runes)-1; i < j; i, j = i+1, j-1 {
        runes[i], runes[j] = runes[j], runes[i]
      }
      value = string(runes)
    default:
      return "", fmt.Errorf("go-source-plugin: unsupported operation %q", plugin.Operation)
    }
  }
  return value, nil
}

func inferOperation(config map[string]any) string {
  // Explicit operation wins; shorthand prefix/suffix configs exist to keep
  // fixture tsconfig files compact.
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

func stringConfig(config map[string]any, key string) string {
  if config == nil {
    return ""
  }
  value, _ := config[key].(string)
  return value
}
