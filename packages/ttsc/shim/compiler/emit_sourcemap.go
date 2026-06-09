// gen_shims:hand-maintained
//
// Source-map emission for the single-file plugin-transform emit path.
//
// tsgo's Program.Emit has no hook to inject a custom transformer, so ttsc's
// driver assembles the per-file emit pipeline by hand (see GetSourceFilesToEmit
// / GetScriptTransformers / GetOutputPathsFor). That hand-assembly must also
// reproduce the source-map step the emitter would otherwise run: a bare
// printer.Write with a nil generator drops the `.js.map` entirely. This file
// ports internal/compiler/emitter.go's `printSourceFile` source-map branch so a
// `sourceMap` / `inlineSourceMap` build that goes through a plugin transform
// produces the same map (and `//# sourceMappingURL=` trailer) a plain build
// does. Keep it in sync with that emitter source when the pin is bumped.
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
// `//# sourceMappingURL=` comment when a map was produced. MapText/MapPath are
// the external source-map file and its path; both are empty when no external map
// is written (source maps disabled, or an inline map encoded into the JS).
type PrintedFile struct {
  JS      string
  MapText string
  MapPath string
}

// PrintFileWithSourceMap renders sourceFile through a printer built from options
// and emitContext, optionally generating a source map, mirroring
// emitter.printSourceFile for the single-file plugin-transform path. When
// `sourceMap`/`inlineSourceMap` is enabled (and the file is not JSON) it builds a
// sourcemap.Generator, feeds it to the printer so positions are recorded,
// appends the sourceMappingURL trailer, and returns the external map text/path
// (or encodes the map inline). host supplies the same directory/casing context
// tsgo's emitter reads. With source maps off it is byte-for-byte the prior
// bare-printer behavior.
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
    NewLine:         options.NewLine,
    SourceMap:       options.SourceMap.IsTrue(),
    InlineSourceMap: options.InlineSourceMap.IsTrue(),
    InlineSources:   options.InlineSources.IsTrue(),
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

  result := PrintedFile{}
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
