package driver

import (
  "context"
  "crypto/sha256"
  "encoding/hex"
  "fmt"
  "strings"

  "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
)

// DeclarationShapeDigest hashes the declaration output TypeScript itself
// derives for one source file. Resident consumers compare the old and new
// values to distinguish a private body edit from a public semantic movement
// before expanding invalidation through reverse dependencies.
func (p *Program) DeclarationShapeDigest(file *ast.SourceFile) (string, error) {
  if p == nil || p.TSProgram == nil || file == nil {
    return "", fmt.Errorf("driver: declaration shape requires a loaded source file")
  }
  if err := p.ApplyLinkedPlugins(); err != nil {
    return "", err
  }
  var signature strings.Builder
  emitted := false
  p.TSProgram.Emit(context.Background(), shimcompiler.EmitOptions{
    TargetSourceFile: file,
    EmitOnly:         shimcompiler.EmitOnlyForcedDts,
    WriteFile: func(_ string, text string, data *shimcompiler.WriteFileData) error {
      emitted = true
      if data != nil && data.SourceMapUrlPos >= 0 && data.SourceMapUrlPos <= len(text) {
        text = text[:data.SourceMapUrlPos]
      }
      signature.WriteString(text)
      if data != nil {
        for _, diagnostic := range data.Diagnostics {
          appendDeclarationShapeDiagnostic(&signature, file, diagnostic)
        }
      }
      return nil
    },
  })
  if !emitted {
    // Mirrors tsgo's incremental fallback to the file version when forced
    // declaration emit has no output. This is conservative: any body movement
    // expands dependents instead of risking a stale semantic closure.
    signature.WriteString(file.Text())
  }
  digest := sha256.Sum256([]byte(signature.String()))
  return hex.EncodeToString(digest[:]), nil
}

func appendDeclarationShapeDiagnostic(builder *strings.Builder, source *ast.SourceFile, diagnostic *ast.Diagnostic) {
  if diagnostic == nil {
    return
  }
  builder.WriteString("\n")
  diagnosticFile := diagnostic.File()
  if diagnosticFile != nil && diagnosticFile != source {
    builder.WriteString(shimtspath.EnsurePathIsNonModuleName(shimtspath.GetRelativePathFromDirectory(
      shimtspath.GetDirectoryPath(string(source.Path())),
      string(diagnosticFile.Path()),
      shimtspath.ComparePathsOptions{},
    )))
  }
  if diagnosticFile != nil {
    builder.WriteString(fmt.Sprintf("(%d,%d): ", diagnostic.Pos(), diagnostic.Len()))
  }
  builder.WriteString(diagnostic.Category().Name())
  builder.WriteString(fmt.Sprintf("%d: ", diagnostic.Code()))
  builder.WriteString(string(diagnostic.MessageKey()))
  builder.WriteString("\n")
  for _, argument := range diagnostic.MessageArgs() {
    builder.WriteString(argument)
    builder.WriteString("\n")
  }
  for _, chain := range diagnostic.MessageChain() {
    appendDeclarationShapeDiagnostic(builder, source, chain)
  }
  for _, related := range diagnostic.RelatedInformation() {
    appendDeclarationShapeDiagnostic(builder, source, related)
  }
}
