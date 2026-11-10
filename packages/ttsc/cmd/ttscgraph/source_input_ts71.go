//go:build ttsc_typescript_7_1

package main

import shimast "github.com/microsoft/typescript-go/shim/ast"

// sourceInputText reads upstream's pre-mapping text for freshness comparisons;
// checker facts and their provenance continue to use the transformed Text().
func sourceInputText(source *shimast.SourceFile) string {
  return source.OriginalText()
}
