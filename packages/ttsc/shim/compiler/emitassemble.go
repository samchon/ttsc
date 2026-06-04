// gen_shims:hand-maintained
//
// Emit-pipeline assembly parts: pick the files tsgo would emit and resolve
// their output paths, so ttsc's driver can drive emit per file with a plugin
// transformer inserted ahead of the builtin chain.
package compiler

import (
  _ "unsafe"

  innerast "github.com/microsoft/typescript-go/internal/ast"
  innercompiler "github.com/microsoft/typescript-go/internal/compiler"
  innercore "github.com/microsoft/typescript-go/internal/core"
  inneroutputpaths "github.com/microsoft/typescript-go/internal/outputpaths"
)

// GetSourceFilesToEmit returns the source files tsgo would emit for the program
// (excludes .d.ts and external-library files), linked from the internal package.
//
//go:linkname GetSourceFilesToEmit github.com/microsoft/typescript-go/internal/compiler.getSourceFilesToEmit
func GetSourceFilesToEmit(host innercompiler.SourceFileMayBeEmittedHost, targetSourceFile *innerast.SourceFile, forceDtsEmit bool) []*innerast.SourceFile

// OutputPaths holds the resolved output file paths for one source file.
type OutputPaths = inneroutputpaths.OutputPaths

// GetOutputPathsFor resolves the .js / .d.ts / map output paths for a source
// file (honoring rootDir/outDir), the same call tsgo's emitter makes.
func GetOutputPathsFor(sourceFile *innerast.SourceFile, options *innercore.CompilerOptions, host inneroutputpaths.OutputPathsHost, forceDtsEmit bool) *inneroutputpaths.OutputPaths {
  return inneroutputpaths.GetOutputPathsFor(sourceFile, options, host, forceDtsEmit)
}
