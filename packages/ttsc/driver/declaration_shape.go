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
//
// @evidence contracts/common.md#principled-implementation TypeScript's own declaration emitter defines public shape; a no-output fallback conservatively hashes source rather than pretending the shape is unchanged.
// @evidence contracts/common.md#clear-and-simple-design One forced declaration emit feeds a signature builder and SHA-256 digest; diagnostic structure contributes through one helper.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Public shape is not guessed from syntax or patched to match expected invalidation examples.
// @evidence contracts/common.md#meaningful-documentation The native comment explains public versus private movement and resident invalidation purpose following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Diagnostic filenames use compiler path-relative operations; the digest has no guessed OS case policy or native separator serialization.
// @evidence contracts/performance.md#efficient-algorithms Only the selected source is force-emitted, and signature text is accumulated with a builder before hashing.
// @evidence contracts/performance.md#reuse-equivalent-work The method reuses the loaded program and latched linked-hook outcome; declaration-shape reuse across generations is owned by the resident consumer.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The temporary signature and digest are returned without acquiring a lease or storing another resident cache.
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
