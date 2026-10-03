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
// @evidence contracts/performance.md#efficient-algorithms The same printer Write supplies text and mapping segments without a separate map-building AST pass in this adapter. Work includes upstream traversal, trivia and supplied handlers, source/name path processing, mapping encoding, cloned source/name/content lists and JSON serialization; space grows with output, mapping and optional inline source bytes, with temporary JSON bytes alongside the returned map string.
// @evidence contracts/performance.md#reuse-equivalent-work The same traversal supplies both outputs and EmitContext supplies original-node provenance; a fresh per-file printer is necessary because retained source indexes cannot be shared between independent map generators.
// @evidence contracts/performance.md#bound-retention-and-release-resources The call owns its fresh printer, generator and writer; returned text and map strings retain output bytes for their consumers. Local mapping lists, source references and temporary JSON storage become unreachable when the call ends, while the borrowed emit context and handler state remain caller-owned. There is no adapter-owned historical cache, running task or enforced byte cap.
// @evidence contracts/portability.md#os-neutral-implementation The generator uses the emitted source directory as its lexical path base and a fixed case-sensitive policy for original source names, including names recovered through emit provenance. These map paths are presentation data rather than filesystem identity queries; the adapter performs no native lookup or case-sensitivity probe.
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
