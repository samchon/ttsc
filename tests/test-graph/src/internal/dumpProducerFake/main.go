package main

import (
  "fmt"
  "os"
)

func main() {
  if len(os.Args) < 2 || os.Args[1] != "dump" {
    fmt.Fprintln(os.Stderr, "expected dump command")
    os.Exit(3)
  }
  file := os.Getenv("TTSCGRAPH_FAKE_DUMP")
  raw, err := os.ReadFile(file)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    os.Exit(2)
  }
  if _, err := os.Stdout.Write(raw); err != nil {
    fmt.Fprintln(os.Stderr, err)
    os.Exit(2)
  }
}
