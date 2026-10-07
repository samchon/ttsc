package main

import (
  _ "embed"
  "fmt"
  "os"
  "os/exec"
  "runtime"

  "example.com/batch-materialization-dependency"
)

//go:embed asset.txt
var asset string

// main preserves the empty smoke and compiler race delegate by default.
// Fixture-only modes expose the imported value or its embedded bytes and source path.
func main() {
  if os.Getenv("TTSC_E2E_SOURCE_MATERIALIZATION_PROBE") == "1" {
    fmt.Fprintln(os.Stderr, dependency.Value())
    return
  }
  if os.Getenv("TTSC_E2E_SOURCE_MATERIALIZATION_PROBE") == "2" {
    if len(os.Args) > 1 && os.Args[1] == "panic" {
      panic("source-build-panic")
    }
    fmt.Fprintln(os.Stderr, dependency.Value())
    _, file, _, _ := runtime.Caller(0)
    // Quoting retains the asset's LF byte in one observable output line.
    fmt.Printf("%s|%q|%s\n", dependency.Value(), asset, file)
    return
  }
  source := os.Getenv("ORPHAN_RACE_SOURCE")
  done := os.Getenv("ORPHAN_RACE_DONE")
  compiler := os.Getenv("ORPHAN_RACE_COMPILER")
  if source == "" && done == "" && compiler == "" {
    return
  }
  if source == "" || done == "" || compiler == "" {
    fmt.Fprintln(os.Stderr, "orphan race requires source, done marker and compiler")
    os.Exit(1)
  }
  if len(os.Args) > 1 {
    first, errFirst := os.Stat(os.Args[1])
    target, errTarget := os.Stat(source)
    _, errDone := os.Stat(done)
    if errFirst == nil && errTarget == nil && os.SameFile(first, target) && os.IsNotExist(errDone) {
      if err := os.WriteFile(source, []byte("export const value: string = \"two\";\n"), 0o644); err != nil {
        fmt.Fprintln(os.Stderr, err)
        os.Exit(1)
      }
      if err := os.WriteFile(done, nil, 0o644); err != nil {
        fmt.Fprintln(os.Stderr, err)
        os.Exit(1)
      }
    }
  }
  command := exec.Command(compiler, os.Args[1:]...)
  command.Stdin, command.Stdout, command.Stderr = os.Stdin, os.Stdout, os.Stderr
  if err := command.Run(); err != nil {
    if exit, ok := err.(*exec.ExitError); ok {
      os.Exit(exit.ExitCode())
    }
    fmt.Fprintln(os.Stderr, err)
    os.Exit(1)
  }
}
