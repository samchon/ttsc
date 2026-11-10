//go:build !ttsc_typescript_7_1

package main

import shimast "github.com/microsoft/typescript-go/shim/ast"

// sourceInputText is the unchanged compiler text on the pre-mapper target.
func sourceInputText(source *shimast.SourceFile) string {
  return source.Text()
}
