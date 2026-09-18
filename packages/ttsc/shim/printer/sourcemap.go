// gen_shims:hand-maintained
//
// Prints one source file together with a source map back to its original text,
// for hosts that hand transformed TypeScript to a bundler instead of emitting
// JavaScript (samchon/ttsc#1392).
package printer

import (
  "github.com/microsoft/typescript-go/internal/ast"
  innerprinter "github.com/microsoft/typescript-go/internal/printer"
  "github.com/microsoft/typescript-go/internal/sourcemap"
  "github.com/microsoft/typescript-go/internal/tspath"
)

// EmitSourceFileWithSourceMap renders sourceFile the way EmitSourceFile does
// and also returns a version 3 source map, as JSON, from the rendered text back
// to the original positions its nodes still carry.
//
// It builds its own printer from options, handlers, and emitContext, because a
// printer remembers the last source it mapped across writes and would reuse
// that source's index in the next file's map. `file` is the source file's base
// name and `sources` are relative to its directory, the layout a bundler
// resolves a module's map against. options.InlineSources adds each source's
// original text as `sourcesContent`, which lets a consumer check the map
// against the text it was generated from.
func EmitSourceFileWithSourceMap(
  options PrinterOptions,
  handlers PrintHandlers,
  emitContext *EmitContext,
  sourceFile *ast.SourceFile,
) (string, string) {
  printer := innerprinter.NewPrinter(options, handlers, emitContext)
  fileName := sourceFile.FileName()
  directory := tspath.GetDirectoryPath(fileName)
  generator := sourcemap.NewGenerator(
    tspath.GetBaseFileName(fileName),
    "",
    directory,
    tspath.ComparePathsOptions{UseCaseSensitiveFileNames: true, CurrentDirectory: directory},
  )
  writer := innerprinter.NewTextWriter(options.NewLine.GetNewLineCharacter(), 0)
  printer.Write(sourceFile.AsNode(), sourceFile, writer, generator)
  return writer.String(), generator.String()
}
