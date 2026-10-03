// gen_shims:hand-maintained
//
// Source-map emission for the single-file plugin-transform emit path.
//
// tsgo's Program.Emit has no hook to inject a custom transformer, so ttsc's
// driver assembles the per-file emit pipeline by hand (see GetSourceFilesToEmit
// / GetScriptTransformers / GetOutputPathsFor). That hand-assembly must also
// reproduce the selected text/map assembly steps: building the printer's
// options from the compiler options, the source-map branch a bare printer.Write
// with a nil generator drops entirely, the `emitBOM` byte-order mark, and the
// trailer position the emitter places in WriteFileData. This file ports
// internal/compiler/emitter.go's `emitJSFile` PrinterOptions construction and
// its printing, source-map and BOM assembly policy. The driver owns writing
// returned artifacts and its metadata; upstream diagnostic/write-result and
// SourceMaps receipt machinery is not reproduced by this helper. Byte and map
// compatibility depends on the actual transformed nodes and retained provenance.
//
// Keep it in sync with that emitter source when the pin is bumped. Anything
// `emitJSFile` sets and this file omits takes the Go zero value, which silently
// turns the option off for every project that emits through a plugin transform,
// and anything `printSourceFile` does around the printer that this file omits
// is missing from the plugin lane's output even when the option set matches.
// `emit_plugin_transform_matches_plain_emit_for_printer_options_test.go` fails
// when a forwarded option stops matching the plain emit.
package compiler

import (
  innerast "github.com/microsoft/typescript-go/internal/ast"
  innercore "github.com/microsoft/typescript-go/internal/core"
  inneroutputpaths "github.com/microsoft/typescript-go/internal/outputpaths"
  innerprinter "github.com/microsoft/typescript-go/internal/printer"
  innersourcemap "github.com/microsoft/typescript-go/internal/sourcemap"
  innerstringutil "github.com/microsoft/typescript-go/internal/stringutil"
  innertspath "github.com/microsoft/typescript-go/internal/tspath"
)

// PrintedFile is the rendered output of one source file in the plugin-transform
// emit path. JS is the JavaScript text, already carrying a trailing
// `//# sourceMappingURL=` comment when a map was produced and a leading UTF-8
// byte order mark when `emitBOM` is on. MapText/MapPath are the external
// source-map file and its path; both are empty when no external map is written
// (source maps disabled, or an inline map encoded into the JS).
//
// @evidence contracts/common.md#principled-implementation The record separates emitted script, optional external map and map destination, retaining the pinned emitter's pre-BOM trailer coordinate rather than mixing file bytes with writer positions.
// @evidence contracts/common.md#clear-and-simple-design One per-file result carries related output artifacts; absent external maps use empty values and absent trailers use the documented negative sentinel.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The sentinel and pre-BOM coordinate are compiler protocol values, not patched expected answers; no foreign state or consumer-specific output is introduced.
// @evidence contracts/common.md#meaningful-documentation Native prose explains map absence, inline output and BOM coordinate effects; every member has native documentation separated by blank source lines.
// @evidence contracts/portability.md#os-neutral-implementation MapPath preserves the host-resolved native output destination while JS contains URI trailer spelling; the fields keep those distinct rather than equating URL and filesystem identity.
// @evidenceExclude contracts/performance.md#efficient-algorithms This record represents output and does not choose the printing algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This output record does not coordinate computation across consumers.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Storage lifetime belongs to the printing operation and its caller, not independently to the result declaration.
type PrintedFile struct {
  // JS contains emitted script text, optional map trailer and optional BOM.
  JS string

  // MapText contains the external map JSON, or empty text for inline or absent maps.
  MapText string

  // MapPath is the destination for MapText, or empty when no external map is emitted.
  MapPath string

  // SourceMapUrlPos is the offset of the `//# sourceMappingURL=` trailer in JS,
  // or -1 when no trailer was written, the value tsgo's emitter reports as
  // WriteFileData.SourceMapUrlPos so a caller can locate and rewrite the
  // trailer without re-scanning the text. Like the emitter's, it is the printer
  // writer's text position, taken BEFORE the `emitBOM` mark is prepended, so a
  // BOM build's offset is three bytes short of the trailer's position in the
  // written file. That is the pinned emitter's own behavior
  // (internal/compiler/emitter.go::printSourceFile computes sourceMapUrlPos
  // from the writer and only then calls AddUTF8ByteOrderMark), and this lane
  // exists to match it: "correcting" the offset here would make a plugin build
  // disagree with the plain build of the same project.
  SourceMapUrlPos int
}

// PrintFileWithSourceMap renders node from sourceFile through a printer built
// from options and emitContext, optionally generating a source map, mirroring
// their text/map assembly for the single-file plugin-transform path. It returns
// artifacts; it does not reproduce upstream writes, diagnostics, SourceMaps
// receipts or complete WriteFileData. The PrinterOptions below are emitJSFile's, field for
// field: `removeComments`, `newLine`, `noEmitHelpers`, `sourceMap`,
// `inlineSourceMap`, `inlineSources`, and `target`. When
// `sourceMap`/`inlineSourceMap` is enabled (and the file is not JSON) it builds a
// sourcemap.Generator, feeds it to the printer so positions are recorded,
// appends the sourceMappingURL trailer, records its offset, and returns the
// external map text/path (or encodes the map inline). `emitBOM` prepends the
// UTF-8 byte order mark to the JavaScript afterwards, exactly where
// printSourceFile does it, outside PrinterOptions, which is why forwarding the
// whole options struct never reached it. Returned external map text has no BOM,
// matching the text supplied to upstream's map write.
// host supplies the same directory/casing context tsgo's emitter reads.
//
// The source file, compiler options and host must be nonnil. Original node
// positions and emitContext provenance determine source-map accuracy.
//
// @evidence contracts/common.md#principled-implementation The maintained port follows the pinned emitter's printer options, map eligibility, URI encoding, newline/trailer handling and post-print BOM ordering; upstream printer traversal derives mappings from retained node provenance.
// @evidence contracts/common.md#clear-and-simple-design One per-file printer/writer/generator owns output assembly, while focused helpers separate source-root, shared map-directory and trailer-URL policy without duplicating output state.
// @evidence contracts/common.md#prohibited-implementation-shortcuts JSON map suppression, inline maps and pre-BOM offsets implement actual compiler options and output protocol; they do not select fixtures or patch upstream printer behavior.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish printer settings from post-print BOM effects, external from inline maps, path context and provenance requirements; the result documents its coordinate convention explicitly.
// @evidence contracts/portability.md#os-neutral-implementation Compiler path helpers normalize native output paths, host-provided case sensitivity governs relative identity, and trailer paths are separately URI-encoded; URL spelling is not treated as filesystem casing.
// @evidence contracts/performance.md#efficient-algorithms Text and mapping collection share one printer invocation; upstream printing can also consult node provenance, semantic helpers, source positions and path text, so this is not a strict one-pass bound over input or output bytes. Map-table copies and JSON serialization, optional base64, trailer writes and a BOM text copy add their own work. The writer's recorded position avoids rescanning emitted text just to locate the trailer.
// @evidence contracts/performance.md#reuse-equivalent-work Text and source mappings share the printer traversal and EmitContext provenance; no cross-file printer source-index state is reused, and compiler options and transformed nodes determine each output.
// @evidence contracts/performance.md#bound-retention-and-release-resources Per-call printer, writer and generator hold output buffers, source/name indexes, mapping segments and optional borrowed source text. Map serialization/base64 and BOM assembly can temporarily coexist with those buffers; result strings retain their backing bytes after return. EmitContext and source/semantic graphs remain caller-owned, and this function adds no historical result registry or spawned task. No fixed byte cap is imposed here.
func PrintFileWithSourceMap(
  emitContext *innerprinter.EmitContext,
  node *innerast.Node,
  sourceFile *innerast.SourceFile,
  options *innercore.CompilerOptions,
  host innerprinter.EmitHost,
  jsFilePath string,
  sourceMapFilePath string,
) PrintedFile {
  printer := innerprinter.NewPrinter(innerprinter.PrinterOptions{
    RemoveComments:  options.RemoveComments.IsTrue(),
    NewLine:         options.NewLine,
    NoEmitHelpers:   options.NoEmitHelpers.IsTrue(),
    SourceMap:       options.SourceMap.IsTrue(),
    InlineSourceMap: options.InlineSourceMap.IsTrue(),
    InlineSources:   options.InlineSources.IsTrue(),
    Target:          options.Target,
  }, innerprinter.PrintHandlers{}, emitContext)
  writer := innerprinter.NewTextWriter(options.NewLine.GetNewLineCharacter(), 0)

  shouldEmit := (options.SourceMap.IsTrue() || options.InlineSourceMap.IsTrue()) &&
    !innertspath.FileExtensionIs(sourceFile.FileName(), innertspath.ExtensionJson)

  var generator *innersourcemap.Generator
  if shouldEmit {
    generator = innersourcemap.NewGenerator(
      innertspath.GetBaseFileName(innertspath.NormalizeSlashes(jsFilePath)),
      sourceMapSourceRoot(options),
      SourceMapDirectory(options, host, jsFilePath, sourceFile),
      innertspath.ComparePathsOptions{
        UseCaseSensitiveFileNames: host.UseCaseSensitiveFileNames(),
        CurrentDirectory:          host.GetCurrentDirectory(),
      },
    )
  }

  printer.Write(node, sourceFile, writer, generator)

  result := PrintedFile{SourceMapUrlPos: -1}
  if generator != nil {
    url := sourceMappingURL(options, generator, host, jsFilePath, sourceMapFilePath, sourceFile)
    if len(url) > 0 {
      if !writer.IsAtStartOfLine() {
        if options.NewLine == innercore.NewLineKindCRLF {
          writer.RawWrite("\r\n")
        } else {
          writer.RawWrite("\n")
        }
      }
      result.SourceMapUrlPos = writer.GetTextPos()
      writer.WriteComment("//# sourceMappingURL=")
      writer.WriteComment(url)
    }
    if !options.InlineSourceMap.IsTrue() && len(sourceMapFilePath) > 0 {
      result.MapText = generator.String()
      result.MapPath = sourceMapFilePath
    }
  } else {
    writer.WriteLine()
  }
  result.JS = writer.String()
  if options.EmitBOM.IsTrue() {
    result.JS = innerstringutil.AddUTF8ByteOrderMark(result.JS)
  }
  return result
}

// sourceMapSourceRoot mirrors emitter.getSourceRoot: a normalized sourceRoot
// with a trailing separator so it composes with the relative source paths.
func sourceMapSourceRoot(options *innercore.CompilerOptions) string {
  root := innertspath.NormalizeSlashes(options.SourceRoot)
  if len(root) > 0 {
    root = innertspath.EnsureTrailingDirectorySeparator(root)
  }
  return root
}

// SourceMapDirectory returns the directory the pinned compiler's source-map
// generator uses to resolve source paths. This is the generator's internal
// directory context, not the map's published sourceRoot field.
//
// A nonempty sourceRoot selects the host's common source directory. Otherwise
// mapRoot selects the map directory, projecting sourceFile's path into that
// root when sourceFile is present; a relative mapRoot is based on the common
// source directory. Without either option, the output file's directory is used.
// The options and host must be nonnil; sourceFile may be nil.
//
// @evidence contracts/common.md#principled-implementation The maintained helper follows pinned emitter.getSourceMapDirectory's sourceRoot precedence, per-source mapRoot projection and relative-root anchoring, returning the exact generator base instead of assuming maps are based on an emitted file directory.
// @evidence contracts/common.md#clear-and-simple-design One supported public helper owns generator-directory policy for printing and downstream map consumers, avoiding independently implemented path-base rules.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Directory selection follows real compiler options and host context, including URL and relative roots, without a consumer-specific map repair or filesystem guessing.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish internal generator context from published sourceRoot, describe option precedence and path projection, and state nonnil versus optional inputs.
// @evidence contracts/portability.md#os-neutral-implementation Compiler path helpers handle native roots and URL spelling separately, while per-source projection uses the host's actual current/common directories and case policy rather than an OS-name assumption.
// @evidence contracts/performance.md#efficient-algorithms Branching applies sourceRoot/mapRoot precedence and compiler path normalization/remapping over path text. Host CommonSourceDirectory/current-directory/case queries are delegated work and may compute or reuse source metadata; the absence of a local file loop does not bound those host costs. Centralizing this policy avoids separate consumer implementations, not all repeated path work.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This pure path-context calculation does not coordinate completed or in-flight work across requests; map consumers own any per-file index of its results.
// @evidence contracts/performance.md#bound-retention-and-release-resources Intermediate normalized/remapped path strings are invocation-local, and the returned directory string can retain newly allocated or borrowed backing bytes. Host-owned common-directory/source metadata remains with that host. This helper keeps no independent historical result cache, native handle or running task; callers determine the returned string's retention.
func SourceMapDirectory(options *innercore.CompilerOptions, host innerprinter.EmitHost, filePath string, sourceFile *innerast.SourceFile) string {
  if len(options.SourceRoot) > 0 {
    return host.CommonSourceDirectory()
  }
  if len(options.MapRoot) > 0 {
    dir := innertspath.NormalizeSlashes(options.MapRoot)
    if sourceFile != nil {
      dir = innertspath.GetDirectoryPath(inneroutputpaths.GetSourceFilePathInNewDir(
        sourceFile.FileName(),
        dir,
        host.GetCurrentDirectory(),
        host.CommonSourceDirectory(),
        host.UseCaseSensitiveFileNames(),
      ))
    }
    if innertspath.GetRootLength(dir) == 0 {
      dir = innertspath.CombinePaths(host.CommonSourceDirectory(), dir)
    }
    return dir
  }
  return innertspath.GetDirectoryPath(innertspath.NormalizePath(filePath))
}

// sourceMappingURL mirrors emitter.getSourceMappingURL: the value written after
// `//# sourceMappingURL=`, either an inline base64 data URL or the encoded path
// to the external `.js.map` (honoring mapRoot).
func sourceMappingURL(options *innercore.CompilerOptions, generator *innersourcemap.Generator, host innerprinter.EmitHost, filePath string, sourceMapFilePath string, sourceFile *innerast.SourceFile) string {
  if options.InlineSourceMap.IsTrue() {
    return generator.Base64DataURL()
  }
  sourceMapFile := innertspath.GetBaseFileName(innertspath.NormalizeSlashes(sourceMapFilePath))
  if len(options.MapRoot) > 0 {
    dir := innertspath.NormalizeSlashes(options.MapRoot)
    if sourceFile != nil {
      dir = innertspath.GetDirectoryPath(inneroutputpaths.GetSourceFilePathInNewDir(
        sourceFile.FileName(),
        dir,
        host.GetCurrentDirectory(),
        host.CommonSourceDirectory(),
        host.UseCaseSensitiveFileNames(),
      ))
    }
    if innertspath.GetRootLength(dir) == 0 {
      dir = innertspath.CombinePaths(host.CommonSourceDirectory(), dir)
      return innerstringutil.EncodeURI(innertspath.GetRelativePathToDirectoryOrUrl(
        innertspath.GetDirectoryPath(innertspath.NormalizePath(filePath)),
        innertspath.CombinePaths(dir, sourceMapFile),
        true,
        innertspath.ComparePathsOptions{
          UseCaseSensitiveFileNames: host.UseCaseSensitiveFileNames(),
          CurrentDirectory:          host.GetCurrentDirectory(),
        },
      ))
    }
    return innerstringutil.EncodeURI(innertspath.CombinePaths(dir, sourceMapFile))
  }
  return innerstringutil.EncodeURI(sourceMapFile)
}
