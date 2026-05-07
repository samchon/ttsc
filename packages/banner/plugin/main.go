// Native sidecar entrypoint for `@ttsc/banner`.
package main

import (
  "fmt"
  "os"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

const version = "0.0.1"

func main() {
  os.Exit(run(os.Args[1:]))
}

func run(args []string) int {
  if len(args) == 0 {
    fmt.Fprintln(os.Stderr, "@ttsc/banner: command required (expected build|transform|check|version)")
    return 2
  }
  switch args[0] {
  case "-v", "--version", "version":
    fmt.Fprintf(os.Stdout, "@ttsc/banner %s\n", version)
    return 0
  case "build":
    return utility.RunBuild(args[1:])
  case "transform":
    return utility.RunTransform(args[1:])
  case "check":
    return utility.RunCheck(args[1:])
  default:
    fmt.Fprintf(os.Stderr, "@ttsc/banner: unknown command %q\n", args[0])
    return 2
  }
}
