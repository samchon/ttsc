// Command compilertargetprobe records the version of the compiler it was
// linked against, so a project can observe which compiler target ttsc built.
package main

import (
  "os"
  "path/filepath"
  "strings"

  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimvfs "github.com/microsoft/typescript-go/shim/vfs"
)

// The neutral API must compile on every target.
var _ = shimvfs.CaseSensitivityOf

func main() {
  if len(os.Args) < 2 || os.Args[1] != "check" {
    return
  }
  cwd := "."
  for _, arg := range os.Args[2:] {
    if value, ok := strings.CutPrefix(arg, "--cwd="); ok {
      cwd = value
    }
  }
  if err := os.WriteFile(filepath.Join(cwd, "compiler-version.txt"), []byte(shimcore.Version()), 0o644); err != nil {
    os.Stderr.WriteString(err.Error() + "\n")
    os.Exit(1)
  }
}
