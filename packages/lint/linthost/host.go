// Bootstrap glue for the @ttsc/lint native binary.
//
// We don't import `github.com/samchon/ttsc/packages/ttsc/driver` from a
// source plugin because that would force every consumer of @ttsc/lint to
// have the in-tree samchon/ttsc/packages/ttsc module on their go.work — a
// dependency the public proxy cannot satisfy and that conflicts with
// ttsc's runtime-generated go.work overlay. Instead, this file inlines a
// minimal Program/Checker bootstrap (the same pattern documented in
// 03-tsgo.md and used by every other source-plugin reference fixture).
package linthost

import (
  "context"
  "errors"
  "fmt"
  "os"
  "path/filepath"
  "strings"
  "sync/atomic"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  "github.com/microsoft/typescript-go/shim/bundled"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  "github.com/microsoft/typescript-go/shim/tsoptions"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
  "github.com/microsoft/typescript-go/shim/vfs/cachedvfs"
  "github.com/microsoft/typescript-go/shim/vfs/osvfs"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

var programLifecycleSequence atomic.Uint64

// program bundles the tsgo Program with the parsed config and a checker
// release callback so the orchestration code can clean up after itself.
type program struct {
  cwd            string
  tsProgram      *shimcompiler.Program
  parsed         *tsoptions.ParsedCommandLine
  checker        *shimchecker.Checker
  releaseChecker func()
  identity       publicrule.ProjectIdentity
  projectCycle   *projectCycle
}

type loadProgramOptions struct {
  forceEmit   bool
  forceNoEmit bool
  outDir      string
  // needsRuleChecker asks loadProgram to pin the checker pool and acquire the
  // checker that type-aware lint rules receive through Context.Checker.
  needsRuleChecker bool
  // singleThreaded mirrors `tsgo --singleThreaded`: one checker, serial
  // parse/check/emit.
  singleThreaded bool
  // checkers mirrors `tsgo --checkers`: type-checker pool size. Zero leaves
  // TypeScript-Go's default; ignored when singleThreaded is set.
  checkers int
  // tsgoArgs carries tsgo CLI flags the `ttsc` launcher forwarded (`--strict`,
  // `--target es2020`, …). They are parsed through TypeScript-Go's own
  // command-line parser into a CompilerOptions overlay that wins over the
  // tsconfig, exactly as tsgo's CLI merges them.
  tsgoArgs        []string
  projectIdentity publicrule.ProjectIdentity
}

// loadProgram parses the given tsconfig and builds a Program. When
// needsRuleChecker is set, it also acquires a type checker for lint rules.
// Mirrors the canonical bootstrap pattern from
// `03-tsgo.md` — the only ttsc-specific bit is that `forceEmit`/
// `forceNoEmit`/`outDir` overrides are merged into the parsed config
// before the program is created so `--noEmit` and friends behave like
// they do in `ttsc check`.
func loadProgram(cwd, tsconfigPath string, options loadProgramOptions) (*program, []*shimast.Diagnostic, error) {
  if !filepath.IsAbs(cwd) {
    abs, err := filepath.Abs(cwd)
    if err != nil {
      return nil, nil, fmt.Errorf("loadProgram: cwd: %w", err)
    }
    cwd = abs
  }
  resolved := tsconfigPath
  if !filepath.IsAbs(resolved) {
    resolved = filepath.Join(cwd, resolved)
  }

  fs := bundled.WrapFS(cachedvfs.From(osvfs.FS()))
  host := shimcompiler.NewCompilerHost(cwd, fs, bundled.LibPath(), nil, nil)

  cliOptions, cliDiags := parseTsgoArgs(options.tsgoArgs, host)
  if len(cliDiags) > 0 {
    return nil, cliDiags, nil
  }

  parsed, parseDiags := tsoptions.GetParsedCommandLineOfConfigFile(
    resolved,
    cliOptions,
    nil,
    host,
    nil,
  )
  if parsed == nil {
    return nil, nil, fmt.Errorf("tsoptions: parsed command line was nil for %s", resolved)
  }
  if len(parseDiags) > 0 {
    return nil, parseDiags, nil
  }
  if len(parsed.Errors) > 0 {
    return nil, parsed.Errors, nil
  }
  if options.forceNoEmit {
    forceNoEmit(parsed)
  }
  if options.forceEmit {
    forceEmit(parsed)
  }
  if options.outDir != "" {
    overrideOutDir(cwd, parsed, options.outDir)
  }
  applyThreading(parsed, options.singleThreaded, options.checkers)
  if options.needsRuleChecker {
    forceSingleChecker(parsed)
  }

  // SingleThreaded is left unset so the program keeps TypeScript-Go's parallel
  // source parsing and parallel emit. For type-aware lint rules, the checker
  // pool is pinned to a single checker (see forceSingleChecker): the lint
  // engine walks files serially against the one checker GetTypeChecker hands
  // back, and rules ask that checker to resolve types in nodes drawn from every
  // source file. TypeScript-Go's multi-checker pool affinitizes each file to a
  // different checker and forbids mixing types across them, so a type whose
  // declarations span files on different checkers (e.g. a circular
  // indexed-access alias) resolves to `any` on the borrowed checker. AST-only
  // lint rules do not receive a checker, so they keep the user's checker pool.
  tsProgram := shimcompiler.NewProgram(shimcompiler.ProgramOptions{
    Config:                      parsed,
    Host:                        host,
    UseSourceOfProjectReference: true,
  })
  if tsProgram == nil {
    return nil, nil, errors.New("compiler.NewProgram returned nil")
  }
  var checker *shimchecker.Checker
  var release func()
  if options.needsRuleChecker {
    checker, release = tsProgram.GetTypeChecker(context.Background())
  }
  return &program{
    cwd:            cwd,
    tsProgram:      tsProgram,
    parsed:         parsed,
    checker:        checker,
    releaseChecker: release,
    identity:       normalizeProjectIdentity(options.projectIdentity, cwd, resolved),
  }, nil, nil
}

func normalizeProjectIdentity(
  identity publicrule.ProjectIdentity,
  cwd string,
  configPath string,
) publicrule.ProjectIdentity {
  if identity.InvocationCwd == "" {
    identity.InvocationCwd = cwd
  }
  if identity.LogicalConfigPath == "" {
    identity.LogicalConfigPath = absoluteProjectPath(identity.InvocationCwd, configPath)
  }
  if identity.LogicalProjectRoot == "" {
    identity.LogicalProjectRoot = filepath.Dir(identity.LogicalConfigPath)
  }
  if identity.PhysicalConfigPath == "" {
    identity.PhysicalConfigPath = realProjectPath(absoluteProjectPath(cwd, configPath))
  }
  if identity.PhysicalProjectRoot == "" {
    identity.PhysicalProjectRoot = realProjectPath(cwd)
  }
  if identity.PluginConfigOrigin == "" {
    if origin := os.Getenv("TTSC_PLUGIN_CONFIG_DIR"); origin != "" {
      identity.PluginConfigOrigin = absoluteProjectPath(identity.InvocationCwd, origin)
    }
  }
  identity.LifecycleID = fmt.Sprintf(
    "%d:%d",
    os.Getpid(),
    programLifecycleSequence.Add(1),
  )
  return identity
}

func absoluteProjectPath(cwd string, target string) string {
  if filepath.IsAbs(target) {
    return filepath.Clean(target)
  }
  return filepath.Clean(filepath.Join(cwd, target))
}

func realProjectPath(target string) string {
  original := filepath.Clean(target)
  resolved := original
  seen := make(map[string]struct{})
  for range 255 {
    key := filepath.Clean(resolved)
    if _, exists := seen[key]; exists {
      return original
    }
    seen[key] = struct{}{}

    next, ok := resolveProjectPathAncestor(resolved)
    if !ok {
      return filepath.Clean(resolved)
    }
    resolved = next
  }
  return original
}

// resolveProjectPathAncestor resolves the nearest existing or symlink-like
// ancestor and reattaches the remaining path. Besides ordinary links, this
// lets Windows expand an 8.3 short-name ancestor even when the target itself
// has not been created yet. Some directory junctions are readable through
// os.Readlink while EvalSymlinks either leaves them unchanged or fails on their
// children, so both resolution paths are retained.
func resolveProjectPathAncestor(target string) (string, bool) {
  original := filepath.Clean(target)
  probe := original
  suffix := make([]string, 0)
  evaluateAncestor := true
  for {
    if evaluateAncestor {
      if evaluated, err := filepath.EvalSymlinks(probe); err == nil {
        // EvalSymlinks resolves the probe's complete ancestry. If it leaves
        // the spelling unchanged, retrying it on every parent cannot reveal
        // anything new; retain only the os.Readlink walk for junctions that
        // EvalSymlinks does not expose.
        evaluateAncestor = false
        candidate := filepath.Clean(evaluated)
        for i := len(suffix) - 1; i >= 0; i-- {
          candidate = filepath.Join(candidate, suffix[i])
        }
        candidate = filepath.Clean(candidate)
        if candidate != original {
          return candidate, true
        }
      }
    }
    if _, err := os.Readlink(probe); err == nil {
      destination := resolveDirLink(probe)
      for i := len(suffix) - 1; i >= 0; i-- {
        destination = filepath.Join(destination, suffix[i])
      }
      destination = filepath.Clean(destination)
      if destination != original {
        return destination, true
      }
    }
    parent := filepath.Dir(probe)
    if parent == probe {
      return "", false
    }
    suffix = append(suffix, filepath.Base(probe))
    probe = parent
  }
}

func (p *program) runLintCycle(engine *Engine) []*Finding {
  if p == nil || engine == nil {
    return nil
  }
  files := p.userSourceFiles()
  if p.projectCycle == nil {
    cycle := engine.evaluateProject(p.identity, files, p.checker)
    p.projectCycle = &cycle
  }
  projectFindings := append([]*Finding(nil), p.projectCycle.findings...)
  return append(projectFindings, engine.runFiles(files, p.checker, p.projectCycle.results, p.cwd)...)
}

// close releases the type checker acquired by loadProgram. Safe to call on
// a nil receiver and idempotent after the first call.
func (p *program) close() {
  if p == nil {
    return
  }
  if p.releaseChecker != nil {
    p.releaseChecker()
    p.releaseChecker = nil
  }
}

// userSourceFiles returns the tsconfig-selected source files the lint engine
// owns. The tsconfig file list is the boundary: imported libraries, generated
// output, and JSON modules may still appear in Program.SourceFiles(), but lint
// and format should not walk them unless the project selected them as TS/JS
// source roots.
func (p *program) userSourceFiles() []*shimast.SourceFile {
  roots := p.userSourceFileNames()
  out := make([]*shimast.SourceFile, 0)
  for _, f := range p.tsProgram.SourceFiles() {
    if f == nil {
      continue
    }
    if _, ok := roots[canonicalProjectPath(p.cwd, f.FileName())]; !ok {
      continue
    }
    out = append(out, f)
  }
  return out
}

func (p *program) userSourceFileNames() map[string]struct{} {
  out := make(map[string]struct{})
  if p == nil || p.parsed == nil || p.parsed.ParsedConfig == nil {
    return out
  }
  for _, fileName := range p.parsed.ParsedConfig.FileNames {
    if isLintSourceFileName(fileName) {
      out[canonicalProjectPath(p.cwd, fileName)] = struct{}{}
    }
  }
  return out
}

func canonicalProjectPath(cwd, fileName string) string {
  if !filepath.IsAbs(fileName) {
    fileName = filepath.Join(cwd, fileName)
  }
  return filepath.ToSlash(filepath.Clean(fileName))
}

func isLintSourceFileName(fileName string) bool {
  switch strings.ToLower(filepath.Ext(fileName)) {
  case ".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs":
    return true
  default:
    return false
  }
}

// programDiagnostics returns the bind + semantic diagnostics for the
// loaded program. Same surface tsgo's CLI prints when you run a regular
// `tsgo --noEmit`.
func (p *program) programDiagnostics() []*shimast.Diagnostic {
  if p == nil || p.tsProgram == nil {
    return nil
  }
  ctx := context.Background()
  raw := shimcompiler.GetDiagnosticsOfAnyProgram(
    ctx,
    p.tsProgram,
    nil,
    false,
    p.tsProgram.GetBindDiagnostics,
    p.tsProgram.GetSemanticDiagnostics,
  )
  return shimcompiler.SortAndDeduplicateDiagnostics(raw)
}

// findSourceFile locates a source file in the program by absolute path.
// tsgo normalizes SourceFile.FileName() through tspath (forward slashes,
// resolved "."/".." segments); a bare filepath.ToSlash only swaps separator
// characters for the host OS, so a caller-supplied path with an unresolved
// "."/".." round-trip (or, on a POSIX host, backslash separators surviving
// from a Windows-authored path) could still fail to match here even after
// that conversion. Normalize both sides through tspath instead — the same gap
// this closes in ttsc's resident serve host (samchon/ttsc#319).
func (p *program) findSourceFile(target string) *shimast.SourceFile {
  want := shimtspath.NormalizePath(target)
  for _, file := range p.tsProgram.SourceFiles() {
    if shimtspath.NormalizePath(file.FileName()) == want {
      return file
    }
  }
  return nil
}

// forceEmit clears the NoEmit and EmitDeclarationOnly flags so the
// program emits JavaScript even when the tsconfig says otherwise.
func forceEmit(parsed *tsoptions.ParsedCommandLine) {
  if parsed == nil || parsed.ParsedConfig == nil || parsed.ParsedConfig.CompilerOptions == nil {
    return
  }
  options := parsed.ParsedConfig.CompilerOptions
  options.NoEmit = shimcore.TSFalse
  options.EmitDeclarationOnly = shimcore.TSFalse
}

// forceNoEmit sets the NoEmit flag regardless of what the tsconfig
// specifies. Used by fix and check subcommands that must not write output
// files as a side effect of type-checking.
func forceNoEmit(parsed *tsoptions.ParsedCommandLine) {
  if parsed == nil || parsed.ParsedConfig == nil || parsed.ParsedConfig.CompilerOptions == nil {
    return
  }
  parsed.ParsedConfig.CompilerOptions.NoEmit = shimcore.TSTrue
}

// parseTsgoArgs runs forwarded tsgo CLI flags through TypeScript-Go's own
// command-line parser, yielding a CompilerOptions overlay loadProgram merges
// over the tsconfig — so a flag like `ttsc --strict` reaches the in-process
// lint program even though @ttsc/lint never shells out to `tsgo`. Returns an
// empty (non-nil) options value when there are no forwarded flags.
func parseTsgoArgs(args []string, host shimcompiler.CompilerHost) (*shimcore.CompilerOptions, []*shimast.Diagnostic) {
  if len(args) == 0 {
    return &shimcore.CompilerOptions{}, nil
  }
  cli := tsoptions.ParseCommandLine(args, host)
  if cli == nil {
    return &shimcore.CompilerOptions{}, nil
  }
  if len(cli.Errors) > 0 {
    return nil, cli.Errors
  }
  return cli.CompilerOptions(), nil
}

// applyThreading forwards the --singleThreaded / --checkers knobs onto the
// parsed compiler options. ttsc mirrors tsgo here: the values land in
// CompilerOptions, and both Program.SingleThreaded() and the checker pool read
// them from there. SingleThreaded wins over Checkers, matching the pool.
//
// When a type-aware lint rule is active, loadProgram calls forceSingleChecker
// afterwards, so a `--checkers N` greater than 1 is recorded here and then
// clamped back to a single checker. AST-only lint runs keep the recorded
// checker count. `--singleThreaded` still takes full effect.
func applyThreading(parsed *tsoptions.ParsedCommandLine, singleThreaded bool, checkers int) {
  if parsed == nil || parsed.ParsedConfig == nil || parsed.ParsedConfig.CompilerOptions == nil {
    return
  }
  options := parsed.ParsedConfig.CompilerOptions
  if singleThreaded {
    options.SingleThreaded = shimcore.TSTrue
  }
  if checkers > 0 {
    n := checkers
    options.Checkers = &n
  }
}

// forceSingleChecker pins the TypeScript-Go checker pool to a single checker.
//
// The lint engine walks the program serially and obtains types through the
// single checker GetTypeChecker hands back. Rules query types on nodes from
// arbitrary source files, so the checker must be the same one that checked
// every file. A pool of size > 1 affinitizes files to distinct checkers;
// resolving a type whose declarations cross that boundary yields `any`.
// Parallel parsing and emit are unaffected — they do not consult the count.
func forceSingleChecker(parsed *tsoptions.ParsedCommandLine) {
  if parsed == nil || parsed.ParsedConfig == nil || parsed.ParsedConfig.CompilerOptions == nil {
    return
  }
  options := parsed.ParsedConfig.CompilerOptions
  if options.SingleThreaded == shimcore.TSTrue {
    return
  }
  one := 1
  options.Checkers = &one
}

// overrideOutDir replaces the parsed config's OutDir with `outDir`.
// Relative outDir values are resolved against `cwd`; absolute paths are
// used as-is. Paths are converted to forward slashes for tsgo
// compatibility.
func overrideOutDir(cwd string, parsed *tsoptions.ParsedCommandLine, outDir string) {
  if parsed == nil || parsed.ParsedConfig == nil || parsed.ParsedConfig.CompilerOptions == nil {
    return
  }
  if filepath.IsAbs(outDir) {
    parsed.ParsedConfig.CompilerOptions.OutDir = filepath.ToSlash(outDir)
    return
  }
  parsed.ParsedConfig.CompilerOptions.OutDir = filepath.ToSlash(filepath.Join(cwd, outDir))
}
