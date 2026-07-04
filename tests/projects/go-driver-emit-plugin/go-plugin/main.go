package main

import (
  "flag"
  "fmt"
  "os"
  "path/filepath"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"
  "github.com/samchon/ttsc/packages/ttsc/driver"
)

func main() {
  os.Exit(run(os.Args[1:]))
}

func run(args []string) int {
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

func runBuild(args []string) int {
  fs := flag.NewFlagSet("build", flag.ContinueOnError)
  fs.SetOutput(os.Stderr)
  cwd := fs.String("cwd", "", "")
  tsconfig := fs.String("tsconfig", "", "")
  _ = fs.String("plugins-json", "", "")
  _ = fs.Bool("emit", false, "")
  _ = fs.Bool("noEmit", false, "")
  _ = fs.Bool("quiet", false, "")
  _ = fs.Bool("verbose", false, "")
  _ = fs.String("outDir", "", "")
  if err := fs.Parse(args); err != nil {
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

  emitDiags, err := prog.EmitWithPluginTransformers([]driver.PluginTransform{replaceBeforeLiteral}, writeFile)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  if len(emitDiags) != 0 {
    driver.WritePrettyDiagnostics(os.Stderr, emitDiags, root)
    return 2
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
      return ec.Factory.NewStringLiteral("GO DRIVER EMIT PLUGIN", 0)
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
