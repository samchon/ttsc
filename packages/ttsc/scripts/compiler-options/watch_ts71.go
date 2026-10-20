//go:build ttsc_typescript_7_1

package main

import "github.com/microsoft/typescript-go/shim/tsoptions"

// watchOptionDeclarations returns nothing: the 7.1 compiler removed its watch
// options (watchFile, watchDirectory, fallbackPolling and the rest).
func watchOptionDeclarations() []*tsoptions.CommandLineOption {
  return nil
}
