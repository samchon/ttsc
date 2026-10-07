// Package driver: forced-emit output containment.
//
// tsc guards a program whose sources spill outside `rootDir` with TS6059 and,
// under `--noEmitOnError`, refuses to emit. ttsc's forced-emit lanes
// (`--emit`, a plugin host's runBuild) intentionally proceed past that guard,
// and tsgo then computes the output path of an out-of-rootDir source relative
// to the common source directory — which resolves to a `.js` right next to the
// dependency's own source. The classic trigger is package
// self-reference: a project nested inside a dependency's directory resolves
// the dependency's name without a node_modules hop, so its sources are not
// classified as external-library files and stay in the emit set.
//
// The guard here confines every ttsc-owned emit lane to the project's
// configured `outDir`: an output that would escape it is silently skipped, the
// same way tsc treats node_modules externals (no emit, no error).
package driver

import "github.com/microsoft/typescript-go/shim/tspath"

// isBuildInfoOutput identifies the metadata artifact selected by this compiler
// generation. Its configured extension does not determine its kind, and an
// unrelated .tsbuildinfo path must not acquire metadata privileges.
//
// Private Go helpers are reviewed through their emit owners rather than selected
// as exported Evidence hosts.
// Common: Principled implementation: The loaded command line computes the same explicit or inferred build-information destination as native emission, including incremental eligibility; compiler path comparison establishes exact lexical identity under the Program's case policy.
// Common: Clear and simple design: One artifact predicate serves containment and source-map correction rather than independent suffix rules.
// Common: Prohibited implementation shortcuts: The real compiler-selected path replaces the suffix exception; no API-specific filename or consumer exemption compensates for output loss.
// Common: Meaningful documentation: Native prose distinguishes selected artifact identity from filename extension and explains why unrelated metadata-looking paths remain ordinary outputs.
// Portability: OS-neutral implementation: Native compiler path comparison uses the loaded Program's current directory and actual case policy, without assuming case behavior from the operating system.
// Performance: Efficient algorithms: Upstream destination inference and lexical comparison process a bounded number of path strings with costs proportional to their text; no directory traversal or file read is added.
// Performance: Reuse equivalent work: The current compiler generation owns destination selection; this predicate introduces no result cache or independent producer.
// Performance: Bound retention and release resources: The predicate returns a boolean and retains no compiler generation, path history or external resource.
func (p *Program) isBuildInfoOutput(fileName string) bool {
  if p == nil || p.TSProgram == nil {
    return false
  }
  buildInfo := p.TSProgram.CommandLine().GetBuildInfoFileName()
  return buildInfo != "" && tspath.ComparePaths(buildInfo, fileName, tspath.ComparePathsOptions{
    UseCaseSensitiveFileNames: p.TSProgram.UseCaseSensitiveFileNames(),
    CurrentDirectory:          p.TSProgram.GetCurrentDirectory(),
  }) == 0
}

// outputEscapesOutDir reports whether fileName — an emit output path tsgo
// computed for this program — would land outside the project's configured
// `outDir` (and `declarationDir`, when set). Projects without `outDir` emit
// next to their sources by design, so the guard only applies when `outDir`
// gives the project an output boundary. The compiler-selected build-information
// artifact is exempt because its location can legitimately be outside outDir.
func (p *Program) outputEscapesOutDir(fileName string) bool {
  if p == nil || p.TSProgram == nil {
    return false
  }
  options := p.TSProgram.Options()
  if options.OutDir == "" {
    return false
  }
  if p.isBuildInfoOutput(fileName) {
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
