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
  innerast "github.com/microsoft/TypeScript/tsc/internal/ast"
  innercore "github.com/microsoft/TypeScript/tsc/internal/core"
  inneroutputpaths "github.com/microsoft/TypeScript/tsc/internal/outputpaths"
  innerprinter "github.com/microsoft/TypeScript/tsc/internal/printer"
  innersourcemap "github.com/microsoft/TypeScript/tsc/internal/sourcemap"
  innerstringutil "github.com/microsoft/TypeScript/tsc/internal/stringutil"
  innertspath "github.com/microsoft/TypeScript/tsc/internal/tspath"
)

// PrintedFile is the rendered output of one source file in the plugin-transform
// emit path. JS is the script text, carrying a sourceMappingURL trailer when
// its selected URL is nonempty and a leading UTF-8 BOM when emitBOM is on.
// MapText/MapPath contain external map text and its selected destination only
// when mapping is enabled, maps are not inline and that destination is nonempty.
// They are otherwise empty. These are returned artifacts, not write receipts.
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
  MapPath innertspath.RootedFilePath

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

// SourceMapHost supplies the directory and path-identity context the
// compiler's source-map placement reads: the common source directory that a
// relative mapRoot and a sourceRoot resolve against, the base directory an
// absolute mapRoot resolves against, and the case policy of path comparison.
// The compiler's emit host satisfies it.
//
// @evidence contracts/common.md#principled-implementation The three methods are exactly the emit-host queries the pinned emitter's source-map directory and URL policy read.
// @evidence contracts/common.md#clear-and-simple-design A narrow interface lets a driver-owned emit host supply map context without implementing the declaration-emit host.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Directory context comes from the host's compiler state, not from a guessed process directory.
// @evidence contracts/common.md#meaningful-documentation Native prose names each method's role in map placement, with a blank line before tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources An interface declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms An interface declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work An interface declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Implementations own path identity; the declaration names rooted path types and a case policy rather than an OS assumption.
type SourceMapHost interface {
  // CommonSourceDirectory is the directory a relative mapRoot and a sourceRoot resolve against.
  //
  // @evidence contracts/common.md#principled-implementation The query is the emit-host method the pinned emitter's source-map policy reads for this value.
  // @evidence contracts/common.md#clear-and-simple-design One method supplies one map-placement input without a wider host contract.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts The value comes from the host's compiler state rather than a guessed process directory.
  // @evidence contracts/common.md#meaningful-documentation Native prose names the value and its role in map placement following the documentation skill.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources CommonSourceDirectory declares a signature only; the implementation owns acquisition and release of resources.
  // @evidenceExclude contracts/performance.md#efficient-algorithms CommonSourceDirectory declares a signature only; the implementation owns the processing strategy.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work CommonSourceDirectory declares a signature only; the implementation owns any shared work.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation CommonSourceDirectory is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
  CommonSourceDirectory() innertspath.RootedDirectoryPath

  // BaseDirectory is the directory an absolute mapRoot resolves against.
  //
  // @evidence contracts/common.md#principled-implementation The query is the emit-host method the pinned emitter's source-map policy reads for this value.
  // @evidence contracts/common.md#clear-and-simple-design One method supplies one map-placement input without a wider host contract.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts The value comes from the host's compiler state rather than a guessed process directory.
  // @evidence contracts/common.md#meaningful-documentation Native prose names the value and its role in map placement following the documentation skill.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources BaseDirectory declares a signature only; the implementation owns acquisition and release of resources.
  // @evidenceExclude contracts/performance.md#efficient-algorithms BaseDirectory declares a signature only; the implementation owns the processing strategy.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work BaseDirectory declares a signature only; the implementation owns any shared work.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation BaseDirectory is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
  BaseDirectory() innertspath.RootedDirectoryPath

  // CaseSensitivity is the case policy of map path comparison.
  //
  // @evidence contracts/common.md#principled-implementation The query is the emit-host method the pinned emitter's source-map policy reads for this value.
  // @evidence contracts/common.md#clear-and-simple-design One method supplies one map-placement input without a wider host contract.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts The value comes from the host's compiler state rather than a guessed process directory.
  // @evidence contracts/common.md#meaningful-documentation Native prose names the value and its role in map placement following the documentation skill.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources CaseSensitivity declares a signature only; the implementation owns acquisition and release of resources.
  // @evidenceExclude contracts/performance.md#efficient-algorithms CaseSensitivity declares a signature only; the implementation owns the processing strategy.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work CaseSensitivity declares a signature only; the implementation owns any shared work.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation CaseSensitivity is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
  CaseSensitivity() innertspath.CaseSensitivity
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
  host SourceMapHost,
  jsFilePath innertspath.RootedFilePath,
  sourceMapFilePath innertspath.RootedFilePath,
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
    !sourceFile.FileName().ExtensionIs(innertspath.ExtensionJson)

  var generator *innersourcemap.Generator
  if shouldEmit {
    generator = innersourcemap.NewGenerator(
      jsFilePath.BaseName(),
      sourceMapSourceRoot(options),
      SourceMapDirectory(options, host, jsFilePath, sourceFile),
      host.CaseSensitivity(),
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
    if !options.InlineSourceMap.IsTrue() && sourceMapFilePath != "" {
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
  root := options.SourceRoot.AsString()
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
// source directory and an absolute one on the host's base directory. Without
// either option, the output file's directory is used.
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
func SourceMapDirectory(options *innercore.CompilerOptions, host SourceMapHost, filePath innertspath.RootedFilePath, sourceFile *innerast.SourceFile) innertspath.RootedDirectoryPath {
  if len(options.SourceRoot) > 0 {
    return host.CommonSourceDirectory()
  }
  if len(options.MapRoot) > 0 {
    return mapRootDirectory(options.MapRoot, host, sourceFile)
  }
  return filePath.Directory()
}

// mapRootDirectory mirrors emitter.getMapRootDirectory: mapRoot resolved
// against the common source directory when relative and the base directory
// otherwise, then narrowed to sourceFile's projected directory beneath it.
func mapRootDirectory(mapRoot innertspath.SourceMapLocation, host SourceMapHost, sourceFile *innerast.SourceFile) innertspath.RootedDirectoryPath {
  directory := mapRoot.ResolveDirectory(host.CommonSourceDirectory(), host.BaseDirectory())
  if sourceFile != nil {
    directory = inneroutputpaths.GetSourceFileNameInNewDir(
      sourceFile.FileName(),
      directory,
      host.CommonSourceDirectory(),
      host.CaseSensitivity(),
    ).Directory()
  }
  return directory
}

// sourceMappingURL mirrors emitter.getSourceMappingURL: the value written after
// `//# sourceMappingURL=`, either an inline base64 data URL or the encoded path
// to the external `.js.map` (honoring mapRoot).
func sourceMappingURL(options *innercore.CompilerOptions, generator *innersourcemap.Generator, host SourceMapHost, filePath innertspath.RootedFilePath, sourceMapFilePath innertspath.RootedFilePath, sourceFile *innerast.SourceFile) string {
  if options.InlineSourceMap.IsTrue() {
    return generator.Base64DataURL()
  }
  sourceMapFile := sourceMapFilePath.BaseName()
  if len(options.MapRoot) > 0 {
    mapFilePath := mapRootDirectory(options.MapRoot, host, sourceFile).ResolveFile(sourceMapFile)
    if options.MapRoot.IsRelative() {
      return innerstringutil.EncodeURI(innertspath.GetRelativePathToDirectoryOrUrl(
        filePath.Directory().AsString(),
        mapFilePath.AsString(),
        true,
        host.CaseSensitivity(),
      ))
    }
    return innerstringutil.EncodeURI(mapFilePath.AsString())
  }
  return innerstringutil.EncodeURI(sourceMapFile)
}
