// gen_shims:hand-maintained
//
// Source-map emission for the single-file plugin-transform emit path.
//
// tsgo's Program.Emit has no hook to inject a custom transformer, so ttsc's
// driver assembles the per-file emit pipeline by hand (see GetSourceFilesToEmit
// / GetScriptTransformers / GetOutputPathsFor). That hand-assembly must also
// reproduce every step the emitter would otherwise run: building the printer's
// options from the compiler options, the source-map branch a bare printer.Write
// with a nil generator drops entirely, the `emitBOM` byte-order mark, and the
// `WriteFileData` the emitter hands its writeFile callback. This file ports
// internal/compiler/emitter.go's `emitJSFile` PrinterOptions construction and
// the whole of its `printSourceFile` so a build that goes through a plugin
// transform honors the same compiler options — and produces the same map (and
// `//# sourceMappingURL=` trailer, and the same first bytes) — a plain build
// does.
//
// Keep it in sync with that emitter source when the pin is bumped. Anything
// `emitJSFile` sets and this file omits takes the Go zero value, which silently
// turns the option off for every project that emits through a plugin transform,
// and anything `printSourceFile` does around the printer that this file omits
// is missing from the plugin lane's output even when the option set matches.
// `printer_options_field_set_matches_pinned_emitter_test.go` fails when the pin
// changes the PrinterOptions field set,
// `write_file_data_field_set_matches_pinned_emitter_test.go` fails when it
// changes the WriteFileData field set, and
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
type PrintedFile struct {
  JS      string
  MapText string
  MapPath string

  // SourceMapUrlPos is the offset of the `//# sourceMappingURL=` trailer in JS,
  // or -1 when no trailer was written — the value tsgo's emitter reports as
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

// PrintFileWithSourceMap renders sourceFile through a printer built from options
// and emitContext, optionally generating a source map, mirroring
// emitter.emitJSFile and emitter.printSourceFile for the single-file
// plugin-transform path. The PrinterOptions below are emitJSFile's, field for
// field: `removeComments`, `newLine`, `noEmitHelpers`, `sourceMap`,
// `inlineSourceMap`, `inlineSources`, and `target`. When
// `sourceMap`/`inlineSourceMap` is enabled (and the file is not JSON) it builds a
// sourcemap.Generator, feeds it to the printer so positions are recorded,
// appends the sourceMappingURL trailer, records its offset, and returns the
// external map text/path (or encodes the map inline). `emitBOM` prepends the
// UTF-8 byte order mark to the JavaScript afterwards, exactly where
// printSourceFile does it — outside PrinterOptions, which is why forwarding the
// whole options struct never reached it. The external map is written without a
// mark, matching the emitter's own `writeText(sourceMapFilePath, ..., nil)`.
// host supplies the same directory/casing context tsgo's emitter reads.
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
      sourceMapDirectory(options, host, jsFilePath, sourceFile),
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

// sourceMapDirectory mirrors emitter.getSourceMapDirectory: the directory the
// sourcemap generator resolves source paths against, honoring sourceRoot/mapRoot
// and falling back to the .js output directory.
func sourceMapDirectory(options *innercore.CompilerOptions, host innerprinter.EmitHost, filePath string, sourceFile *innerast.SourceFile) string {
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
