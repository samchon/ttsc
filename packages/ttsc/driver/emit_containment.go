// Package driver: forced-emit output containment.
//
// tsc guards a program whose sources spill outside `rootDir` with TS6059 and,
// under `--noEmitOnError`, refuses to emit. ttsc's forced-emit lanes
// (`--emit`, a plugin host's runBuild) intentionally proceed past that guard,
// and tsgo then computes the output path of an out-of-rootDir source relative
// to the common source directory — which resolves to a `.js` right next to the
// dependency's own source (issue #293). The classic trigger is package
// self-reference: a project nested inside a dependency's directory resolves
// the dependency's name without a node_modules hop, so its sources are not
// classified as external-library files and stay in the emit set.
//
// The guard here confines every ttsc-owned emit lane to the project's
// configured `outDir`: an output that would escape it is silently skipped, the
// same way tsc treats node_modules externals (no emit, no error).
package driver

import (
  "strings"

  "github.com/microsoft/typescript-go/shim/tspath"
)

// outputEscapesOutDir reports whether fileName — an emit output path tsgo
// computed for this program — would land outside the project's configured
// `outDir` (and `declarationDir`, when set). Projects without `outDir` emit
// next to their sources by design, so the guard only applies when `outDir`
// gives the project an output boundary. `.tsbuildinfo` is exempt because its
// default location is next to the tsconfig, legitimately outside `outDir`.
func (p *Program) outputEscapesOutDir(fileName string) bool {
  if p == nil || p.TSProgram == nil {
    return false
  }
  options := p.TSProgram.Options()
  if options.OutDir == "" {
    return false
  }
  if strings.HasSuffix(fileName, ".tsbuildinfo") {
    return false
  }
  cmp := tspath.ComparePathsOptions{
    UseCaseSensitiveFileNames: p.TSProgram.UseCaseSensitiveFileNames(),
    CurrentDirectory:          p.TSProgram.GetCurrentDirectory(),
  }
  if tspath.ContainsPath(options.OutDir, fileName, cmp) {
    return false
  }
  if options.DeclarationDir != "" && tspath.ContainsPath(options.DeclarationDir, fileName, cmp) {
    return false
  }
  return true
}
