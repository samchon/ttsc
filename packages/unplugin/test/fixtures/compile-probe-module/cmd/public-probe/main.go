package main

import (
  "os"
  _ "example.com/ttscunpluginsharedprogramprobe/compile-probe"
  "github.com/samchon/ttsc/packages/ttsc/utility"
)

func main() {
  os.Exit(utility.RunCommandWithIO("shared-public-probe", "0.0.0", os.Args[1:], os.Stdout, os.Stderr))
}
