package main

import (
  "flag"
  "fmt"
  "os"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"
  "github.com/samchon/ttsc/packages/ttsc/driver"
)

func main() {
  os.Exit(run(os.Args[1:]))
}

func run(args []string) int {
  if len(args) == 0 {
    fmt.Fprintln(os.Stderr, "emit-host: command required")
    return 2
  }
  switch args[0] {
  case "build":
    return runBuild(args[1:])
  case "check":
    return 0
  case "-v", "--version", "version":
    fmt.Fprintln(os.Stdout, "emit-host 0.1.0")
    return 0
  default:
    fmt.Fprintf(os.Stderr, "emit-host: unknown command %q\n", args[0])
    return 2
  }
}

func runBuild(args []string) int {
  fs := flag.NewFlagSet("emit-host", flag.ContinueOnError)
  fs.SetOutput(os.Stderr)
  cwd := fs.String("cwd", "", "project directory")
  tsconfig := fs.String("tsconfig", "tsconfig.json", "tsconfig")
  _ = fs.String("plugins-json", "", "ordered plugin descriptors")
  emit := fs.Bool("emit", false, "force emit")
  _ = fs.Bool("noEmit", false, "force no emit")
  outDir := fs.String("outDir", "", "out dir")
  _ = fs.Bool("quiet", false, "quiet")
  _ = fs.Bool("verbose", false, "verbose")
  if err := fs.Parse(args); err != nil {
    return 2
  }
  root := *cwd
  if root == "" {
    var err error
    root, err = os.Getwd()
    if err != nil {
      fmt.Fprintf(os.Stderr, "emit-host: cwd: %v\n", err)
      return 2
    }
  }
  prog, diags, err := driver.LoadProgram(root, *tsconfig, driver.LoadProgramOptions{
    ForceEmit: *emit,
    OutDir:    *outDir,
  })
  if err != nil {
    fmt.Fprintf(os.Stderr, "emit-host: %v\n", err)
    return 2
  }
  if len(diags) > 0 {
    for _, diag := range diags {
      fmt.Fprintln(os.Stderr, diag.String())
    }
    return 2
  }
  defer prog.Close()
  if diags := prog.Diagnostics(); len(diags) > 0 {
    for _, diag := range diags {
      fmt.Fprintln(os.Stderr, diag.String())
    }
    return 2
  }
  // The typia-host shape under regression test: only the host's own
  // transform is passed; linked plugins must still be honored by the
  // driver's emit funnel.
  hostTransform := func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    var v *shimast.NodeVisitor
    visit := func(n *shimast.Node) *shimast.Node {
      if n != nil && n.Kind == shimast.KindNumericLiteral && n.Text() == "0" {
        return ec.Factory.NewNumericLiteral("100", 0)
      }
      return v.VisitEachChild(n)
    }
    v = ec.NewNodeVisitor(visit)
    return v.VisitSourceFile(sf)
  }
  if _, err := prog.EmitWithPluginTransformers([]driver.PluginTransform{hostTransform}, nil); err != nil {
    fmt.Fprintf(os.Stderr, "emit-host: emit: %v\n", err)
    return 3
  }
  return 0
}
