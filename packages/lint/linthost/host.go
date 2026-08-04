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

// program bundles the tsgo Program with the parsed config and the standalone
// checker used only by type-aware lint rules.
type program struct {
  cwd          string
  tsProgram    *shimcompiler.Program
  parsed       *tsoptions.ParsedCommandLine
  checker      *shimchecker.Checker
  identity     publicrule.ProjectIdentity
  projectCycle *projectCycle
  // projectRoots memoizes projectSourceFileNames, which resolves every
  // selected file's path and therefore costs filesystem work. The tsconfig
  // selection cannot change while one program is loaded — a config edit or a
  // new or removed file forces a full reload upstream rather than an
  // applyChange — while every read and every write consults the set at least
  // once per cycle, and a fix or format cascade repeats that per pass. Filled
  // lazily under the same single-threaded assumption projectCycle already
  // makes, and read-only to its callers.
  projectRoots map[string]struct{}
}

type loadProgramOptions struct {
  forceEmit   bool
  forceNoEmit bool
  outDir      string
  // needsRuleChecker asks loadProgram to create the standalone checker that
  // type-aware lint rules receive through Context.Checker.
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
// needsRuleChecker is set, it also creates a standalone checker for lint rules.
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

  // Keep the user's checker pool intact for parallel semantic diagnostics.
  // Type-aware lint rules cannot borrow one member of that pool: they walk
  // every source file through a single Context.Checker, while TypeScript-Go
  // affinitizes files to different pool members and forbids mixing their type
  // graphs. Instead, lint owns a standalone checker over the same Program.
  // Every lint type is then produced by one checker, while the Program's pool
  // remains free to check its file groups in parallel. The engine serializes
  // type-aware walks, so this dedicated checker is never accessed concurrently.
  tsProgram := shimcompiler.NewProgram(shimcompiler.ProgramOptions{
    Config:                      parsed,
    Host:                        host,
    UseSourceOfProjectReference: true,
  })
  if tsProgram == nil {
    return nil, nil, errors.New("compiler.NewProgram returned nil")
  }
  var checker *shimchecker.Checker
  if options.needsRuleChecker {
    checker, _ = shimchecker.NewChecker(tsProgram, nil)
  }
  return &program{
    cwd:       cwd,
    tsProgram: tsProgram,
    parsed:    parsed,
    checker:   checker,
    identity:  normalizeProjectIdentity(options.projectIdentity, cwd, resolved),
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

// runProjectCycle evaluates the project rules alone and returns the cycle,
// without walking a single file.
//
// A consumer wanting only what project rules produced — a hint corpus, say —
// should not pay for the file walk that produces findings it will throw away.
// The cycle is memoized on the program exactly as runLintCycle memoizes it, so
// asking for hints and then linting the same program evaluates each rule once.
func (p *program) runProjectCycle(engine *Engine) *projectCycle {
  if p == nil || engine == nil {
    return nil
  }
  if p.projectCycle == nil {
    p.projectCycle = engine.evaluateProject(p.identity, p.userSourceFiles(), p.checker)
  }
  return p.projectCycle
}

// runLintCycle walks everything the invocation reads: the project's own sources
// and the TypeScript it imported. Every caller here reports its findings, so a
// source the type-check pass read must be able to produce one.
func (p *program) runLintCycle(engine *Engine) []*Finding {
  return p.runCycleOver(engine, p.userSourceFiles())
}

// runWriteScopedCycle walks the project's own sources alone. It serves the
// commands that edit files and report nothing: `format` and the LSP document
// fix and format verbs.
//
// Such a command must not rewrite a sibling package it merely imports, and it
// prints no diagnostic, so a finding outside the project has nowhere to go.
// Reading wider would spend a full walk, once per cascade pass, on findings the
// command discards. Scope is enforced by what these commands read rather than
// by filtering afterwards, which leaves projectWritableFindings to `fix` alone.
func (p *program) runWriteScopedCycle(engine *Engine) []*Finding {
  return p.runCycleOver(engine, p.projectSourceFiles())
}

// runCycleOver evaluates the project rules and the file rules over one file set,
// memoizing the project cycle on the program so a second verb against the same
// program does not re-evaluate a rule. The caller owns the scope decision.
//
// That memo makes the scope a property of the program, not of the call: the
// first cycle fixes the population every later verb observes. One loaded
// program therefore serves one scope, and a caller must not ask the same
// program for both a lint cycle and a write-scoped one.
func (p *program) runCycleOver(engine *Engine, files []*shimast.SourceFile) []*Finding {
  if p == nil || engine == nil {
    return nil
  }
  if p.projectCycle == nil {
    p.projectCycle = engine.evaluateProject(p.identity, files, p.checker)
  }
  fileFindings := engine.runFiles(files, p.checker, p.projectCycle.results, p.cwd)
  return append(p.projectCycle.finalize(), fileFindings...)
}

// close drops the standalone lint checker. Safe to call on a nil receiver and
// idempotent after the first call.
func (p *program) close() {
  if p == nil {
    return
  }
  p.checker = nil
}

// sourceFileByPath returns the resident Program's source file whose name matches
// absPath (slash-normalized), or nil when the Program has no such file. Mirrors
// how driver.Program.SourceFile resolves a path over SourceFiles().
func (p *program) sourceFileByPath(absPath string) *shimast.SourceFile {
  if p == nil || p.tsProgram == nil {
    return nil
  }
  normalized := filepath.ToSlash(absPath)
  for _, file := range p.tsProgram.SourceFiles() {
    if file == nil {
      continue
    }
    if filepath.ToSlash(file.FileName()) == normalized {
      return file
    }
  }
  return nil
}

// applyChange incrementally updates the resident Program for one changed file:
// tsgo re-parses only that file and reuses every other file's AST, and the
// standalone lint checker is rebuilt over the new Program. It mirrors
// driver.Session.Apply, adapted to lint's standalone serial checker (lint cannot
// borrow tsgo's pooled checker — see loadProgram). The caller has already
// confirmed absPath is a known source file; a config edit or a new/removed file
// is handled by a full reload upstream, not here. tsgo returns a rebuilt Program
// when the edit reshaped the import graph, and that rebuilt Program is still
// correct, but callers use the reused flag to distinguish incremental updates
// from full Program reconstruction in product telemetry.
func (p *program) applyChange(absPath string) bool {
  if p == nil || p.tsProgram == nil {
    return false
  }
  name := absPath
  if file := p.sourceFileByPath(absPath); file != nil {
    name = file.FileName()
  }
  fs := bundled.WrapFS(cachedvfs.From(osvfs.FS()))
  host := shimcompiler.NewCompilerHost(p.cwd, fs, bundled.LibPath(), nil, nil)
  changed := shimtspath.ToPath(name, p.cwd, fs.UseCaseSensitiveFileNames())
  newProg, reused := p.tsProgram.UpdateProgram(changed, host, nil)
  if newProg != nil {
    p.tsProgram = newProg
    if p.checker != nil {
      p.checker, _ = shimchecker.NewChecker(newProg, nil)
    }
  }
  // The prior cycle described the pre-edit Program; drop it so the next verb
  // re-evaluates its rules over the updated ASTs.
  p.projectCycle = nil
  return reused
}

// userSourceFiles returns the source files the lint engine reads for one cycle:
// the tsconfig-selected TS/JS roots plus every TypeScript source the Program
// pulled in through an import.
//
// The tsconfig file list alone is not the boundary. `ttsc` type-checks a
// first-party sibling workspace package that resolves to its own `src`, so a
// reporting pass restricted to the file list would hold a second, narrower view
// of the single Program the invocation loaded — the file is checked but never
// linted, and never reaches a project rule's ctx.Sources (samchon/ttsc#1065).
// A consumer cannot close that gap from configuration either: adding the
// sibling to `include` also changes what the project emits.
//
// The widening admits authored TypeScript only — `.ts`, `.tsx`, `.mts`, `.cts`
// that are not declaration files. Everything else stays selection-driven:
//   - a declaration file is typings rather than authored source, and the bundled
//     `lib.*.d.ts` set plus every published package's `.d.ts` reach
//     Program.SourceFiles() as well;
//   - JavaScript enters the Program only under `allowJs`, where the project's own
//     file list already selects the JS it owns;
//   - a JSON module carries no lint source at all.
//
// A project that selects any of those explicitly keeps them, exactly as before.
// A published dependency reaches the Program through its typings, so its own
// `.ts` sources stay out without a dependency-shaped rule here.
func (p *program) userSourceFiles() []*shimast.SourceFile {
  roots := p.projectSourceFileNames()
  out := make([]*shimast.SourceFile, 0)
  for _, f := range p.tsProgram.SourceFiles() {
    if f == nil {
      continue
    }
    if p.selectedByProject(roots, f.FileName()) {
      out = append(out, f)
      continue
    }
    if isImportedLintSourceFile(f) {
      out = append(out, f)
    }
  }
  return out
}

// projectSourceFiles returns the Program's copy of the files the tsconfig itself
// selected — the project's own sources, the set `format` walks and the set any
// lint write stays inside.
func (p *program) projectSourceFiles() []*shimast.SourceFile {
  roots := p.projectSourceFileNames()
  out := make([]*shimast.SourceFile, 0, len(roots))
  for _, f := range p.tsProgram.SourceFiles() {
    if f == nil {
      continue
    }
    if !p.selectedByProject(roots, f.FileName()) {
      continue
    }
    out = append(out, f)
  }
  return out
}

// projectSourceFileNames returns the canonical paths of the TS/JS files the
// tsconfig itself selected, indexed under both the configured spelling and the
// resolved one.
//
// This is the narrow half of the boundary above. `format` reads nothing else at
// all, and `fix` reads wider but writes only here, because a project must not
// rewrite a sibling package's sources merely because it imports them. See
// projectWritableFindings.
//
// Both spellings are indexed because a project can be reached through a
// junction, a symlink, or a Windows 8.3 short name, and the Program need not
// report a file under the spelling the config used. Before the read scope
// widened, an alias mismatch merely dropped the file from every pass. Now it
// would leave the file readable and unwritable, turning a fixable diagnostic
// into one `fix` refuses to touch, so ownership resolves the alias.
func (p *program) projectSourceFileNames() map[string]struct{} {
  if p == nil {
    return map[string]struct{}{}
  }
  if p.projectRoots != nil {
    return p.projectRoots
  }
  out := make(map[string]struct{})
  if p.parsed != nil && p.parsed.ParsedConfig != nil {
    for _, fileName := range p.parsed.ParsedConfig.FileNames {
      if !isLintSourceFileName(fileName) {
        continue
      }
      absolute := absoluteProjectPath(p.cwd, fileName)
      out[canonicalProjectPath(p.cwd, absolute)] = struct{}{}
      out[canonicalProjectPath(p.cwd, realProjectPath(absolute))] = struct{}{}
    }
  }
  p.projectRoots = out
  return out
}

// selectedByProject reports whether the tsconfig selected fileName, resolving
// the path only when its own spelling misses.
//
// Indexing both spellings above already catches the ordinary link, so this
// fallback exists for a Program spelling that matches neither, such as a
// Windows 8.3 short name. It costs one resolution per file the config did not
// select, paid by the imported set on every cycle, against the rule walk those
// same files are about to receive.
func (p *program) selectedByProject(
  roots map[string]struct{},
  fileName string,
) bool {
  if p == nil || len(roots) == 0 {
    return false
  }
  if _, ok := roots[canonicalProjectPath(p.cwd, fileName)]; ok {
    return true
  }
  resolved := realProjectPath(absoluteProjectPath(p.cwd, fileName))
  _, ok := roots[canonicalProjectPath(p.cwd, resolved)]
  return ok
}

// projectWritableFindings keeps the findings whose file this project may write:
// the ones sitting in a tsconfig-selected source, dropping every edit aimed at a
// source the Program reached only through an import.
//
// This is `fix`'s guard alone, because `fix` is the one command that must read
// wider than it writes: it prints the diagnostics that survive the cascade, so
// an imported source has to reach its report while its edit must not reach
// disk. The package that owns the file fixes it from its own run, under its own
// config. Commands that only write walk the narrow set to begin with. A finding
// without a source file (a project rule's detached report) never reaches disk
// either and is dropped with them.
func (p *program) projectWritableFindings(findings []*Finding) []*Finding {
  roots := p.projectSourceFileNames()
  out := make([]*Finding, 0, len(findings))
  for _, finding := range findings {
    if finding == nil || finding.File == nil {
      continue
    }
    if !p.selectedByProject(roots, finding.File.FileName()) {
      continue
    }
    out = append(out, finding)
  }
  return out
}

func canonicalProjectPath(cwd, fileName string) string {
  if !filepath.IsAbs(fileName) {
    fileName = filepath.Join(cwd, fileName)
  }
  return filepath.ToSlash(filepath.Clean(fileName))
}

// isImportedLintSourceFile reports whether a Program source file the tsconfig
// did not select is authored TypeScript the lint pass must still read.
func isImportedLintSourceFile(file *shimast.SourceFile) bool {
  if file == nil || file.IsDeclarationFile {
    return false
  }
  return isTypeScriptSourceFileName(file.FileName())
}

// isLintSourceFileName reports whether a tsconfig-selected file is a lint/format
// source root. The project's own selection governs here, so both TypeScript and
// JavaScript qualify: a project that lists `.js` under `allowJs` owns it.
func isLintSourceFileName(fileName string) bool {
  switch strings.ToLower(filepath.Ext(fileName)) {
  case ".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs":
    return true
  default:
    return false
  }
}

// isTypeScriptSourceFileName reports whether a path names TypeScript source.
// `.d.ts` shares the `.ts` extension, so callers pair this with the source
// file's IsDeclarationFile flag rather than reading the suffix twice.
func isTypeScriptSourceFileName(fileName string) bool {
  switch strings.ToLower(filepath.Ext(fileName)) {
  case ".ts", ".tsx", ".mts", ".cts":
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
// Type-aware lint rules use their own standalone checker, so this pool size is
// preserved for the Program's semantic diagnostics. `--singleThreaded` still
// takes full effect across the Program and the serial type-aware lint walk.
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
