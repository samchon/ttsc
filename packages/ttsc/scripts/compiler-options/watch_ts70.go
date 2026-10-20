//go:build !ttsc_typescript_7_1

package main

import "github.com/microsoft/typescript-go/shim/tsoptions"

// watchOptionDeclarations returns the 7.0 compiler's watch option grammar,
// which it declares apart from the compiler options.
func watchOptionDeclarations() []*tsoptions.CommandLineOption {
  return tsoptions.OptionsForWatch
}
