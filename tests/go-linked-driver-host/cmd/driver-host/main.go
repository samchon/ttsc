package main

import (
  "flag"
  "fmt"
  "os"
  "path/filepath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

func main() {
  os.Exit(run(os.Args[1:]))
}

func run(args []string) int {
  if len(args) == 0 {
    fmt.Fprintln(os.Stderr, "driver-host: command required")
    return 2
  }
  switch args[0] {
  case "build":
    return runBuild(args[1:])
  case "check":
    return runCheck(args[1:])
  case "transform":
    fmt.Fprintln(os.Stderr, "driver-host: transform is not implemented")
    return 2
  case "-v", "--version", "version":
    fmt.Fprintln(os.Stdout, "driver-host 0.1.0")
    return 0
  default:
    fmt.Fprintf(os.Stderr, "driver-host: unknown command %q\n", args[0])
    return 2
  }
}

func runCheck(args []string) int {
  return runProgram(args, true)
}

func runBuild(args []string) int {
  return runProgram(args, false)
}

func runProgram(args []string, forceNoEmit bool) int {
  fs := flag.NewFlagSet("driver-host", flag.ContinueOnError)
  fs.SetOutput(os.Stderr)
  cwd := fs.String("cwd", "", "project directory")
  tsconfig := fs.String("tsconfig", "tsconfig.json", "tsconfig")
  _ = fs.String("plugins-json", "", "ordered plugin descriptors")
  emit := fs.Bool("emit", false, "force emit")
  noEmit := fs.Bool("noEmit", false, "force no emit")
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
      fmt.Fprintf(os.Stderr, "driver-host: cwd: %v\n", err)
      return 2
    }
  }
  prog, diags, err := driver.LoadProgram(root, *tsconfig, driver.LoadProgramOptions{
    ForceEmit:   *emit,
    ForceNoEmit: *noEmit || forceNoEmit,
    OutDir:      *outDir,
  })
  if err != nil {
    fmt.Fprintf(os.Stderr, "driver-host: %v\n", err)
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
  if *noEmit || forceNoEmit {
    return 0
  }
  if err := os.WriteFile(filepath.Join(root, "driver-host-ran.txt"), []byte("ok"), 0o644); err != nil {
    fmt.Fprintf(os.Stderr, "driver-host: marker: %v\n", err)
    return 2
  }
  _, emitDiags, err := prog.EmitAllRaw(nil)
  if err != nil {
    fmt.Fprintf(os.Stderr, "driver-host: emit: %v\n", err)
    return 3
  }
  for _, diag := range emitDiags {
    fmt.Fprintln(os.Stderr, "  -", diag.String())
  }
  if driver.CountErrors(emitDiags) > 0 {
    return 2
  }
  return 0
}
