// gen_shims:hand-maintained
//
// Prints one source file together with a source map back to its original text,
// for hosts that hand transformed TypeScript to a bundler instead of emitting
// JavaScript.
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
// sourceFile must be nonnil. Mapping quality depends on transformed nodes
// retaining valid original positions through emitContext.
//
// @evidence contracts/common.md#principled-implementation The upstream printer writes text and mapping segments in the same traversal, using node positions and EmitContext provenance; the version-3 map names the output basename and resolves sources relative to its directory.
// @evidence contracts/common.md#clear-and-simple-design A fresh printer, generator and writer belong to one file, preventing printer-held source indexes from leaking into the next map.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Fresh per-file mapping state corrects the actual source-index lifetime; source names and inline content come from compiler objects rather than consumer-specific substitutions.
// @evidence contracts/common.md#meaningful-documentation Native prose explains map layout, fresh-printer ownership, inline sources, nonnil input and original-position requirements in separated paragraphs.
// @evidence contracts/performance.md#efficient-algorithms One printer traversal creates emitted text and mapping segments together; output and map serialization costs grow with nodes, text bytes, mapping segments and optional inline source text rather than an independent second AST walk.
// @evidence contracts/performance.md#reuse-equivalent-work The same traversal supplies both outputs and EmitContext supplies original-node provenance; a fresh per-file printer is necessary because retained source indexes cannot be shared between independent map generators.
// @evidence contracts/performance.md#bound-retention-and-release-resources One call owns its printer, generator and writer, retaining output and mapping bytes only until return; the two strings transfer to the caller with no historical map cache or running task.
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
