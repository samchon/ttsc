package main

import (
  "fmt"
  "os"
  _ "example.com/ttscunpluginsharedprogramprobe/compile-probe"
  "github.com/samchon/ttsc/packages/ttsc/utility"
)

func main() {
  // These modes supply actual child stderr/status inputs to the public host.
  // They do not run or certify a SDK checker hook.
  switch os.Getenv("TTSC_E2E_PUBLIC_PROBE_MODE") {
  case "check-warning":
    if len(os.Args) > 1 && os.Args[1] == "check" {
      fmt.Fprintln(os.Stderr, "src/main.ts(1,1): warning TS9001: check warning")
      os.Exit(0)
    }
  case "check-failure":
    if len(os.Args) > 1 && os.Args[1] == "check" {
      fmt.Fprintln(os.Stderr, "src/main.ts:1:7 - error TS2322: Type 'string' is not assignable to type 'number'.")
      fmt.Fprintln(os.Stderr, "check plugin crashed")
      os.Exit(3)
    }
  case "transform-failure":
    fmt.Fprintln(os.Stderr, "transform plugin crashed")
    os.Exit(3)
  }
  os.Exit(utility.RunCommandWithIO("shared-public-probe", "0.0.0", os.Args[1:], os.Stdout, os.Stderr))
}
