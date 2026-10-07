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

// runDriverEmit preserves the existing buffered driver host fixture. The mode
// uses real Program emission; pending callbacks are not publication receipts.
func runDriverEmit(args []string) int {
  if len(args) == 0 {
    fmt.Fprintln(os.Stderr, "go-driver-emit-plugin: command required")
    return 2
  }
  switch args[0] {
  case "version", "-v", "--version":
    fmt.Fprintln(os.Stdout, "go-driver-emit-plugin 0.0.0")
    return 0
  case "check":
    return 0
  case "build":
    return runBuild(args[1:])
  default:
    fmt.Fprintf(os.Stderr, "go-driver-emit-plugin: unknown command %q\n", args[0])
    return 2
  }
}

func runBuild(args []string) (status int) {
  fs := flag.NewFlagSet("build", flag.ContinueOnError)
  fs.SetOutput(os.Stderr)
  cwd := fs.String("cwd", "", "")
  tsconfig := fs.String("tsconfig", "", "")
  manifest := fs.String("manifest", "manifest.json", "")
  provenancePath := fs.String("emit-provenance-json", "", "")
  projectContextJSON := fs.String("project-context-json", "", "")
  _ = fs.String("plugins-json", "", "")
  _ = fs.Bool("emit", false, "")
  _ = fs.Bool("noEmit", false, "")
  _ = fs.Bool("quiet", false, "")
  _ = fs.Bool("verbose", false, "")
  _ = fs.String("outDir", "", "")
  if err := fs.Parse(args); err != nil {
    return 2
  }
  // The launcher can forward identity metadata to this selected host. Validate
  // its object transport without replacing the explicit cwd/tsconfig Program
  // inputs or claiming that the fixture established the reported identity.
  if strings.TrimSpace(*projectContextJSON) != "" {
    var identity map[string]json.RawMessage
    if err := json.Unmarshal([]byte(*projectContextJSON), &identity); err != nil {
      fmt.Fprintln(os.Stderr, "go-driver-emit-plugin: invalid --project-context-json:", err)
      return 2
    }
    if identity == nil {
      fmt.Fprintln(os.Stderr, "go-driver-emit-plugin: --project-context-json must be an object")
      return 2
    }
  }
  if *provenancePath != "" && !filepath.IsAbs(*provenancePath) {
    fmt.Fprintln(os.Stderr, "go-driver-emit-plugin: emit provenance path must be absolute")
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
  tsconfigPath := *tsconfig
  if tsconfigPath == "" {
    tsconfigPath = filepath.Join(root, "tsconfig.json")
  }

  prog, diags, err := driver.LoadProgram(root, tsconfigPath, driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  if len(diags) != 0 {
    driver.WritePrettyDiagnostics(os.Stderr, diags, root)
    return 2
  }
  defer prog.Close()

  publish := writeFile
  if *provenancePath != "" {
    var snapshot func() map[string][]string
    publish, snapshot, err = prog.NewEmitProvenanceRecorder(writeFile)
    if err != nil {
      fmt.Fprintln(os.Stderr, "go-driver-emit-plugin: emit provenance failed:", err)
      return 2
    }
    // Only the final writer records publication: buffering transformed outputs
    // does not establish a successful disk write or an eligible source owner.
    defer func() {
      if err := driver.WriteEmitProvenanceJSON(*provenancePath, snapshot()); err != nil {
        fmt.Fprintln(os.Stderr, "go-driver-emit-plugin: emit provenance failed:", err)
        status = 2
      }
    }()
  }

  // Match existing native hosts that buffer outputs and check only the Go
  // error before publication. Compiler diagnostics must also fail this host.
  pending := map[string]string{}
  emitDiags, err := prog.EmitWithPluginTransformers([]driver.PluginTransform{replaceBeforeLiteral}, func(name, text string, _ *shimcompiler.WriteFileData) error {
    pending[name] = text
    return nil
  })
  if err != nil {
    fmt.Fprintln(os.Stderr, "go-driver-emit-plugin: emit failed:", err)
    return 2
  }
  driver.WritePrettyDiagnostics(os.Stderr, emitDiags, root)
  emitted := []string{}
  for name, text := range pending {
    if err := publish(name, text, nil); err != nil {
      fmt.Fprintln(os.Stderr, err)
      return 2
    }
    emitted = append(emitted, name)
  }
  if *manifest != "" {
    manifestPath := *manifest
    if !filepath.IsAbs(manifestPath) {
      manifestPath = filepath.Join(root, manifestPath)
    }
    data, err := json.Marshal(emitted)
    if err != nil {
      fmt.Fprintln(os.Stderr, err)
      return 2
    }
    if err := writeFile(manifestPath, string(data), nil); err != nil {
      fmt.Fprintln(os.Stderr, err)
      return 2
    }
  }
  return 0
}

func replaceBeforeLiteral(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
  var visitor *shimast.NodeVisitor
  visit := func(node *shimast.Node) *shimast.Node {
    if node == nil {
      return node
    }
    if node.Kind == shimast.KindStringLiteral && node.Text() == "before" {
      f := ec.Factory
      standalone := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
      access := standalone.NewPropertyAccessExpression(f.NewIdentifier("input"), nil, standalone.NewIdentifier("value"), shimast.NodeFlagsNone)
      parameter := f.NewParameterDeclaration(nil, nil, f.NewIdentifier("input"), nil, nil, nil)
      arrow := f.NewArrowFunction(nil, nil, f.NewNodeList([]*shimast.Node{parameter}), nil, nil, f.NewToken(shimast.KindEqualsGreaterThanToken), access)
      argument := f.NewObjectLiteralExpression(f.NewNodeList([]*shimast.Node{
        f.NewPropertyAssignment(nil, f.NewIdentifier("value"), nil, nil, f.NewStringLiteral("GO DRIVER EMIT PLUGIN", 0)),
      }), false)
      return f.NewCallExpression(f.NewParenthesizedExpression(arrow), nil, nil, f.NewNodeList([]*shimast.Node{argument}), shimast.NodeFlagsNone)
    }
    return visitor.VisitEachChild(node)
  }
  visitor = ec.NewNodeVisitor(visit)
  return visitor.VisitSourceFile(sf)
}

func writeFile(fileName, text string, _ *shimcompiler.WriteFileData) error {
  if err := os.MkdirAll(filepath.Dir(fileName), 0o755); err != nil {
    return err
  }
  return os.WriteFile(fileName, []byte(text), 0o644)
}
