// Package driver: post-emit rewriter.
//
// tsgo emits `.js` with plugin-owned call expressions preserved as-is because
// the compile-time transformer stage is hosted outside the native compiler.
// This file implements an emit-time rewrite pattern: it intercepts tsgo's Emit() via its WriteFile callback, locates each
// previously-recognized plugin call in the emitted JS, and replaces the call
// expression with the JS the native consumer produced.
//
// The caller registers an ordered list of Rewrite values per source file.
// The unmodified upstream JavaScript parser identifies executable calls and
// emitted import declarations; replacements splice those original byte ranges
// without treating literal or comment contents as executable call sites.
package driver

import (
  "context"
  "errors"
  "fmt"
  "os"
  "path/filepath"
  "slices"
  "strings"
  "sync"

  "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// Rewrite describes one emit-time patch: the replacement JS fragment a linked
// plugin generated for one recognized call. When
// RootName names a default or namespace import, emit examines matching emitted
// import/require declarations, including collision-suffixed names. A unique
// applicable binding selects that alias; absent or ambiguous candidates fall
// back to the source root spelling rather than certifying emitted identity.
//
// @evidence contracts/common.md#principled-implementation Descriptors carry caller-recognized source-call replacements; emit attempts emitted import-alias association and otherwise uses its documented source-root fallback, without independently validating descriptor contents or certifying every binding.
// @evidence contracts/common.md#clear-and-simple-design One descriptor separates source identity, call path, replacement text, and argument consumption.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Import collision suffixes are resolved from emitted declarations rather than hardcoded numeric guesses.
// @evidence contracts/common.md#meaningful-documentation Native prose explains production and imported-root binding following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation The descriptor holds AST and call data; registration and output association own native path operations.
// @evidenceExclude contracts/performance.md#efficient-algorithms The descriptor performs no matching algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The descriptor coordinates no repeated work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Caller-owned descriptor values acquire no external resource or resident cache.
type Rewrite struct {
  File          *ast.SourceFile
  RootName      string
  Namespaces    []string
  Method        string
  Replacement   string
  ConsumeParens bool
}

// RewriteSet groups rewrites by slash-normalized AST filename, preserving
// registration order. Callers supply the source-call order required by emit;
// the container neither sorts positions nor validates descriptor contents.
//
// @evidence contracts/common.md#principled-implementation Per-file descriptor lists preserve registration order for the emit cursor; correct source-call ordering and descriptor contents remain the registering caller's responsibility.
// @evidence contracts/common.md#clear-and-simple-design One path-to-list map stores registrations; emit-local state is not mixed into it.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Registrations describe recognized source calls rather than fixture-only output patches.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies file grouping and order following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Registration uses slash-normalized native source filenames, shared with emitted-output association.
// @evidenceExclude contracts/performance.md#efficient-algorithms Add and emit helpers own registration and matching strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Emit-local descriptor caches own reuse rather than this registration type.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller owns the set's lifetime; no external lease or process-global cache is acquired.
type RewriteSet struct {
  byPath map[string][]Rewrite
}

// NewRewriteSet returns an empty set.
//
// @evidence contracts/common.md#principled-implementation An initialized map supports explicit source-call registration without a global mutable registry.
// @evidence contracts/common.md#clear-and-simple-design Construction allocates only the per-set path map.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No descriptors are prepopulated for test cases or named packages.
// @evidence contracts/common.md#meaningful-documentation Native prose states empty construction following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Map allocation performs no native operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms This constructor selects no collection-processing algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work It owns no repeated-work coordinator.
// @evidence contracts/performance.md#bound-retention-and-release-resources Construction transfers an empty map to the caller-owned set. Later registrations retain source AST references, descriptor slices and strings without a cap or removal API; releasing the set drops its ownership, while other consumers may retain the same values. No native handle is acquired.
func NewRewriteSet() *RewriteSet { return &RewriteSet{byPath: map[string][]Rewrite{}} }

// Add registers a rewrite under its source file's slash-normalized filename.
// It preserves registration order, without sorting by call position or
// validating that the caller's filename is absolute.
//
// @evidence contracts/common.md#principled-implementation A descriptor with no source is ignored; other descriptors append under their supplied AST filename. Callers must register recognized calls in the order expected by emitted-call matching; this operation does not validate or sort them.
// @evidence contracts/common.md#clear-and-simple-design One nil guard, key normalization, and append own registration.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The map key comes from the source AST, not an inferred output basename.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies source-path registration following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation filepath.ToSlash normalizes actual native filenames without guessing host separators.
// @evidence contracts/performance.md#efficient-algorithms Filename slash conversion and key hashing process path bytes before appending to one source list, without scanning other registered files. Slice growth may copy that list's descriptors and map growth depends on the distinct source-key population.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Registration owns no shared computation or cache validity decision.
// @evidence contracts/performance.md#bound-retention-and-release-resources Each append retains descriptor/source-AST references and supplied slices/strings in the set. Registration count and retained bytes have no configured bound or removal API; ownership ends when the caller releases the set, without releasing independently retained aliases or native handles.
func (rs *RewriteSet) Add(r Rewrite) {
  if r.File == nil {
    return
  }
  path := filepath.ToSlash(r.File.FileName())
  rs.byPath[path] = append(rs.byPath[path], r)
}

// Len returns the total number of rewrites across every file.
//
// @evidence contracts/common.md#principled-implementation The count includes every registered file list rather than treating file count as call count.
// @evidence contracts/common.md#clear-and-simple-design One map pass sums list lengths without another maintained counter.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Counts derive from registrations with no assumed calls per file.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes total rewrites from files following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Counting map entries performs no native operation.
// @evidence contracts/performance.md#efficient-algorithms Each file list contributes its constant-time length without visiting individual rewrite entries.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The count owns no shared computation coordinator.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Counting creates no retained state or resource.
func (rs *RewriteSet) Len() int {
  n := 0
  for _, rws := range rs.byPath {
    n += len(rws)
  }
  return n
}

// RewriteSentinel is the exact header comment inserted after the directive
// prologue, preserving a byte-order mark and interpreter directive. Re-emitting
// output with that header marker is a no-op; application data and comments
// outside the header do not establish already-rewritten state.
const RewriteSentinel = "/* @ttsc-rewritten */"

// EmitAll runs tsgo's emitter, patching every registered plugin-owned call in
// the output. Returns native emit diagnostics; returned writer/patch callback errors
// become native write diagnostics. The separate error reports early program
// admission or linked-hook failure. When
// `writeFile` is nil, output is written through DefaultWriteFile.
//
// `writeFile` does not need to be concurrency-safe: emit() funnels every
// invocation through one mutex, so the callback never runs on two goroutines
// at once even when the native program uses parallel emission.
//
// @evidence contracts/common.md#principled-implementation Whole-program rewrites delegate to one emit owner that qualifies linked-hook failures and serializes callback state.
// @evidence contracts/common.md#clear-and-simple-design A nil target selects whole-program work without duplicating output policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The common emit path prevents a separate whole-program shortcut from bypassing rewrites or linked hooks.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain result errors, default writer, and callback serialization following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Delegated emission uses native lexical output containment and the program's reported case policy; the default writer uses native filesystem APIs, while custom destination effects remain caller-owned.
// @evidence contracts/performance.md#efficient-algorithms Whole-program native generation and callback source association, upstream parsing and ordered call selection process source, registered-path and output bytes. The callback mutex serializes rewriting and destination work, including arbitrary caller writer costs; diagnostic conversion adds returned findings/text work.
// @evidence contracts/performance.md#reuse-equivalent-work Delegated emission reuses the current loaded program and generation-latched linked hooks; cursors are shared only within this emit invocation and each affected output is parsed once for call, import and marker identity, not across subsequent emits.
// @evidence contracts/performance.md#bound-retention-and-release-resources Emit-local cursors grow with encountered source keys; each callback temporarily owns one parsed output and its executable-call ranges without a configured byte or call cap. Local ownership ends on return, while native program/checker state, supplied descriptors, writer effects and returned results remain with their owners; Close releases a checker lease rather than all those values or disk output.
func (p *Program) EmitAll(rs *RewriteSet, writeFile shimcompiler.WriteFile) (*shimcompiler.EmitResult, []Diagnostic, error) {
  return p.emit(rs, nil, writeFile)
}

// EmitAllRaw runs TypeScript-Go emit without ttsc output-text rewrites.
//
// `writeFile` does not need to be concurrency-safe: like EmitAll, EmitAllRaw
// funnels every invocation through one mutex, so the callback never runs on
// two goroutines at once even when the native program uses parallel emission.
// This is the contract a plugin's output rewriter relies on — it is the
// emit-stage phase ttsc guarantees runs single-threaded (a plugin's WriteFile
// is the standard place to carry per-file cursors or an output map), so ttsc
// owns the serialization rather than pushing goroutine-safety onto every
// plugin author. See the emit-concurrency contract in the plugin docs.
//
// @evidence contracts/common.md#principled-implementation Native emission honors linked program hooks, compiler incremental-output policy, and output containment while omitting only ttsc text rewrites.
// @evidence contracts/common.md#clear-and-simple-design One serialized writer callback wraps the compiler emit owner and shared diagnostic conversion.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Compiler emission is not patched or replaced with expected-output text; skipped writes are marked for accurate emitted-file reporting.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes raw output and guaranteed callback serialization following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Native containment resolves compiler paths with its case policy, and DefaultWriteFile uses native filesystem APIs.
// @evidence contracts/performance.md#efficient-algorithms Native generation processes the current program and emitted text; serialized callbacks add lexical path-containment and default filesystem or arbitrary caller-writer costs. Result diagnostics require conversion. Native threading policy remains selected by the loaded program, with no measured claim that callback serialization is inexpensive.
// @evidence contracts/performance.md#reuse-equivalent-work The loaded program and latched linked-hook outcome are reused by emission instead of loading an independent compiler instance.
// @evidence contracts/performance.md#bound-retention-and-release-resources This call adds no persistent output cache or checker lease. Native program/checker state and returned output/diagnostic data remain reachable through their respective owners; writer handles, retained buffers or disk artifacts follow the selected writer's policy. Program.Close releases its checker lease, not all program state or destination output.
func (p *Program) EmitAllRaw(writeFile shimcompiler.WriteFile) (*shimcompiler.EmitResult, []Diagnostic, error) {
  if p == nil || p.TSProgram == nil {
    return nil, nil, errors.New("driver: nil program")
  }
  if err := p.ApplyLinkedPlugins(); err != nil {
    return nil, nil, err
  }
  // Native emission may invoke WriteFile concurrently under its selected
  // threading policy. Serialize the whole callback
  // under wfMu so a plugin's output rewriter sees one writer at a time: a
  // callback that mutates shared state (e.g. @nestia/core's per-file rewrite
  // cursors and runtime-alias cache) could otherwise race. Writer work and
  // lock contention are included in emission cost; this does not change the
  // native generation threading policy.
  var wfMu sync.Mutex
  wf := func(fileName, text string, data *shimcompiler.WriteFileData) error {
    wfMu.Lock()
    defer wfMu.Unlock()
    if p.outputEscapesOutDir(fileName) {
      // Marking the write skipped keeps the file out of EmitResult.EmittedFiles,
      // so callers reporting emitted counts don't include phantom outputs.
      if data != nil {
        data.SkippedDtsWrite = true
      }
      return nil
    }
    if writeFile != nil {
      return writeFile(fileName, text, data)
    }
    return DefaultWriteFile(fileName, text)
  }
  result := p.emitProgram(shimcompiler.EmitOptions{
    WriteFile: wf,
  })
  return result, p.convertProgramDiagnostics(result.Diagnostics), nil
}

// EmitFile passes target to native emission through EmitAll's shared rewrite
// pipeline. A nil target selects whole-program emission. Native emit owns the
// selected target's output/diagnostic scope and returned writer errors become
// emit diagnostics, while early admission or linked-hook failure returns error.
//
// @evidence contracts/common.md#principled-implementation Targeted emission uses the same rewrite, failure, and writer policy as whole-program emission.
// @evidence contracts/common.md#clear-and-simple-design One target parameter delegates to the shared emit owner.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No special single-file path bypasses registered hooks or containment.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies single-source emission and shared policy following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Delegated output containment uses native lexical compiler paths and its reported case policy; the default native writer and caller-supplied writer retain their own destination semantics.
// @evidence contracts/performance.md#efficient-algorithms Target selection remains native; delegated source generation, output association, upstream parsing/call selection/splice work and diagnostic conversion depend on reached inputs and emitted text. Callback serialization includes actual writer work and lock contention, without a constant-cost or target-only-computation claim.
// @evidence contracts/performance.md#reuse-equivalent-work The current program and generation-latched hooks are reused, with cursors shared only within this delegated emit and one parsed tree serving each affected output; a later invocation owns fresh cursors and trees.
// @evidence contracts/performance.md#bound-retention-and-release-resources Delegated invocation-local source cursors and per-output parsed call ranges have no configured source/byte/call cap and lose local ownership on return. Supplied descriptors, native program/checker state, returned data and writer artifacts may outlive the call under their owners; this wrapper does not release them or acquire another checker lease.
func (p *Program) EmitFile(rs *RewriteSet, target *ast.SourceFile, writeFile shimcompiler.WriteFile) (*shimcompiler.EmitResult, []Diagnostic, error) {
  return p.emit(rs, target, writeFile)
}

func (p *Program) emit(rs *RewriteSet, target *ast.SourceFile, writeFile shimcompiler.WriteFile) (*shimcompiler.EmitResult, []Diagnostic, error) {
  if p == nil || p.TSProgram == nil {
    return nil, nil, errors.New("driver: nil program")
  }
  if err := p.ApplyLinkedPlugins(); err != nil {
    return nil, nil, err
  }
  if rs == nil {
    rs = NewRewriteSet()
  }
  cursors := map[string]int{}
  // Native emission may invoke this WriteFile callback concurrently under its
  // selected threading policy. Serialize the
  // whole callback body under wfMu: the `cursors` map would otherwise trip
  // `fatal error: concurrent map writes`, and the wrapped `writeFile` (which a
  // caller may back with its own non-thread-safe state, e.g. api-compile's
  // output map) must likewise see one writer at a time. Rewriting, destination
  // work and lock contention remain part of this emission's cost.
  var wfMu sync.Mutex
  wf := func(fileName, text string, data *shimcompiler.WriteFileData) error {
    wfMu.Lock()
    defer wfMu.Unlock()
    if p.outputEscapesOutDir(fileName) {
      // See EmitAllRaw: mark the write skipped so EmitResult.EmittedFiles
      // reflects only files actually written.
      if data != nil {
        data.SkippedDtsWrite = true
      }
      return nil
    }
    // Compiler-selected state keeps its native bytes even when configured with
    // a JavaScript-looking name. Executable output uses the shared lexical owner.
    patched := text
    if !p.isBuildInfoOutput(fileName) {
      var err error
      patched, err = applyRewrites(fileName, text, rs, cursors)
      if err != nil {
        return err
      }
    }
    if writeFile != nil {
      return writeFile(fileName, patched, data)
    }
    return DefaultWriteFile(fileName, patched)
  }

  result := p.emitProgram(shimcompiler.EmitOptions{
    TargetSourceFile: target,
    WriteFile:        wf,
  })
  return result, p.convertProgramDiagnostics(result.Diagnostics), nil
}

// emitProgram runs one whole-program or single-file emit, taking tsgo's
// incremental lane when the resolved compiler options ask for build
// information.
//
// tsgo's own CLI branches the same way, `performIncrementalCompilation` vs
// `performCompilation` on `CompilerOptions.IsIncremental()`, in
// `internal/execute`, which a host constructing its Program in-process never
// enters. Without this branch `incremental`, `composite`, and `tsBuildInfoFile`
// would parse and resolve and then have no effect: a plugin-carrying project
// would emit its JavaScript without build information. The containment guard
// exempts the compiler-selected state artifact regardless of its extension.
//
// A single-file emit stays on the plain lane. Build information describes a
// whole program, and tsgo's incremental program returns early on a
// `TargetSourceFile` request without writing any, so routing it there would
// only add a snapshot computation nothing reads.
func (p *Program) emitProgram(options shimcompiler.EmitOptions) *shimcompiler.EmitResult {
  ctx := context.Background()
  if options.TargetSourceFile == nil && p.emitsBuildInfo() {
    return shimcompiler.EmitFreshWithBuildInfo(ctx, p.TSProgram, options)
  }
  return p.TSProgram.Emit(ctx, options)
}

// emitsBuildInfo reports whether this program's resolved options ask tsgo to
// write build information.
//
// The question is delegated to `CompilerOptions.IsIncremental`, the same
// predicate tsgo's own CLI branches on, rather than restated as
// `Incremental || Composite` here: a second copy of the rule is a second thing
// to keep in step with upstream.
func (p *Program) emitsBuildInfo() bool {
  if p == nil || p.TSProgram == nil {
    return false
  }
  options := p.TSProgram.Options()
  if options == nil {
    return false
  }
  return options.IsIncremental()
}

// DefaultWriteFile is the default disk writer used when EmitAll's caller does not
// supply a custom WriteFile callback. Existing files are truncated; a failed
// write can leave partial output. Requested creation modes are subject to the
// native platform and umask, and do not replace existing file permissions.
//
// @evidence contracts/common.md#principled-implementation Parent directories are created before the output is written, and native errors remain visible to emit callers.
// @evidence contracts/common.md#clear-and-simple-design One directory-creation step precedes one file write.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The writer uses actual requested filenames without suppressing filesystem failures or relying on shell commands.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the default callback role following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation filepath.Dir, os.MkdirAll, and os.WriteFile supply OS-neutral native operations without separator or command assumptions.
// @evidence contracts/performance.md#efficient-algorithms Native parent creation can walk missing ancestors and query existing entries; path length/depth and output bytes drive delegated work. The text-to-byte conversion and file write process the supplied output without a directory enumeration or intermediate output collection.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Each emit write is requested independently; this writer owns no reuse coordinator.
// @evidence contracts/performance.md#bound-retention-and-release-resources os.WriteFile opens one output handle and attempts its closure after the write, including write failure; open failure acquires no handle. The adapter retains no handle or historical output buffer after returning, but created directories and partial or completed files remain on disk without rollback.
func DefaultWriteFile(fileName, text string) error {
  if dir := filepath.Dir(fileName); dir != "" {
    if err := os.MkdirAll(dir, 0o755); err != nil {
      return err
    }
  }
  return os.WriteFile(fileName, []byte(text), 0o644)
}

// parseRewriteOutput uses the same unmodified upstream parser as native
// compilation. A single tree supplies executable call ranges, emitted import
// declarations and the directive/header boundary; inert literal and comment
// text never becomes an executable call candidate.
func parseRewriteOutput(outputName, text string) *ast.SourceFile {
  parseName := filepath.ToSlash(outputName)
  if !filepath.IsAbs(outputName) {
    parseName = "/" + strings.TrimPrefix(parseName, "/")
  }
  kind := shimcore.ScriptKindJS
  if strings.EqualFold(filepath.Ext(outputName), ".jsx") {
    kind = shimcore.ScriptKindJSX
  }
  return shimparser.ParseSourceFile(ast.SourceFileParseOptions{FileName: parseName}, text, kind)
}

// rewriteHeaderStart preserves the byte-order mark and interpreter directive.
// The upstream scanner supplies the shebang extent rather than a second lexer.
func rewriteHeaderStart(text string) int {
  pos := 0
  if strings.HasPrefix(text, "\uFEFF") {
    pos = len("\uFEFF")
  }
  pos += len(shimscanner.GetShebang(text[pos:]))
  return pos
}

// rewriteDirectiveEnd returns the end of the complete directive prologue.
// Comments do not interrupt directives, but a nonliteral statement does.
func rewriteDirectiveEnd(file *ast.SourceFile) int {
  pos := rewriteHeaderStart(file.Text())
  if file.Statements != nil {
    for _, statement := range file.Statements.Nodes {
      if !isRewriteDirective(statement) {
        break
      }
      pos = statement.End()
    }
  }
  return pos
}

func isRewriteDirective(statement *ast.Node) bool {
  return statement != nil && statement.Kind == ast.KindExpressionStatement &&
    statement.AsExpressionStatement().Expression.Kind == ast.KindStringLiteral
}

// hasRewriteSentinel recognizes the exact first header comment, including
// earlier outputs whose marker preceded all directives or followed use strict.
// A string, template, line comment, larger block comment or body comment cannot
// establish this state. Directive boundaries come from the parsed source tree.
func hasRewriteSentinel(file *ast.SourceFile) bool {
  text := file.Text()
  at := func(pos int) bool {
    pos = shimscanner.SkipTriviaEx(text, pos, &shimscanner.SkipTriviaOptions{StopAtComments: true})
    return strings.HasPrefix(text[pos:], RewriteSentinel)
  }
  if at(rewriteHeaderStart(text)) {
    return true
  }
  if file.Statements != nil {
    for _, statement := range file.Statements.Nodes {
      if !isRewriteDirective(statement) {
        break
      }
      if at(statement.End()) {
        return true
      }
    }
  }
  return false
}

// insertSentinel keeps all directives, a byte-order mark and any shebang in
// place. The original parsed tree remains valid for this header boundary:
// directive statements contain no executable calls that rewrites can change.
func insertSentinel(text string, file *ast.SourceFile) string {
  if hasRewriteSentinel(file) {
    return text
  }
  pos := rewriteDirectiveEnd(file)
  if strings.HasPrefix(text[pos:], "\r\n") {
    pos += 2
  } else if strings.HasPrefix(text[pos:], "\n") || strings.HasPrefix(text[pos:], "\r") {
    pos++
  }
  prefix := text[:pos]
  if pos > 0 && prefix != "\uFEFF" && prefix[len(prefix)-1] != '\n' && prefix[len(prefix)-1] != '\r' {
    prefix += "\n"
  }
  return prefix + RewriteSentinel + "\n" + text[pos:]
}

// emittedRewriteCall holds original-output byte ranges. Non-consuming rewrites
// end at the callee so argument trivia and nested calls remain available;
// consuming rewrites cover the complete native-parsed call expression.
type emittedRewriteCall struct {
  start     int
  calleeEnd int
  end       int
  path      string
}

func collectEmittedRewriteCalls(file *ast.SourceFile) []emittedRewriteCall {
  calls := []emittedRewriteCall{}
  var visit func(*ast.Node)
  visit = func(node *ast.Node) {
    if node == nil {
      return
    }
    if node.Kind == ast.KindCallExpression {
      call := node.AsCallExpression()
      if call.QuestionDotToken == nil {
        if path := rewriteCallPath(call.Expression); path != "" {
          calls = append(calls, emittedRewriteCall{
            start: shimscanner.GetTokenPosOfNode(node, file, false),
            calleeEnd: call.Expression.End(), end: node.End(), path: path,
          })
        }
      }
    }
    node.ForEachChild(func(child *ast.Node) bool {
      visit(child)
      return false
    })
  }
  file.ForEachChild(func(node *ast.Node) bool { visit(node); return false })
  return calls
}

// rewriteCallPath compares complete identifier/property chains, so an
// identifier substring or a property of another receiver cannot match a root.
// The parser resolves Unicode identifiers and property-segment trivia.
func rewriteCallPath(node *ast.Node) string {
  segments := []string{}
  for node != nil && node.Kind == ast.KindPropertyAccessExpression {
    access := node.AsPropertyAccessExpression()
    if access.QuestionDotToken != nil {
      return ""
    }
    name := identifierName(access.Name())
    if name == "" {
      return ""
    }
    segments = append(segments, name)
    node = access.Expression
  }
  root := identifierName(node)
  if root == "" || len(segments) == 0 {
    return ""
  }
  segments = append(segments, root)
  for left, right := 0, len(segments)-1; left < right; left, right = left+1, right-1 {
    segments[left], segments[right] = segments[right], segments[left]
  }
  return strings.Join(segments, ".")
}

func rewriteCallPaths(rewrite Rewrite, aliases []string) []string {
  suffix := "." + rewrite.Method
  if len(rewrite.Namespaces) != 0 {
    suffix = "." + strings.Join(rewrite.Namespaces, ".") + suffix
  }
  paths := make([]string, 0, len(aliases))
  for _, alias := range aliases {
    paths = append(paths, alias+suffix)
  }
  return paths
}

// applyRewrites parses only an associated JavaScript output, then selects
// executable calls in registration order against the original immutable text.
// One forward traversal and builder avoid reparsing replacement fragments and
// copying the complete output for each descriptor. A consuming replacement
// skips its removed descendants; a callee-only replacement retains them.
func applyRewrites(outputName, text string, rs *RewriteSet, cursors map[string]int) (string, error) {
  switch strings.ToLower(filepath.Ext(outputName)) {
  case ".js", ".jsx", ".mjs", ".cjs":
  default:
    return text, nil
  }
  srcPath, ok := findSourceForOutput(outputName, rs)
  if !ok || len(rs.byPath[srcPath]) == 0 {
    return text, nil
  }
  rewrites := rs.byPath[srcPath]
  pos := cursors[srcPath]
  if pos >= len(rewrites) {
    return text, nil
  }
  file := parseRewriteOutput(outputName, text)
  if hasRewriteSentinel(file) {
    return text, nil
  }
  if len(file.Diagnostics()) != 0 {
    return "", fmt.Errorf("driver: invalid emitted JavaScript while locating plugin call in %s", outputName)
  }
  calls := collectEmittedRewriteCalls(file)
  emittedBindings := collectEmittedImportBindings(file)
  aliasesByRoot := map[string][]string{}
  pathsByHead := map[string][]string{}
  var out strings.Builder
  out.Grow(len(text))
  copiedThrough, callIndex := 0, 0
  for pos < len(rewrites) {
    r := rewrites[pos]
    aliases, cached := aliasesByRoot[r.RootName]
    if !cached {
      aliases = rewriteAliases(r, emittedBindings)
      aliasesByRoot[r.RootName] = aliases
    }
    head := r.RootName + "\x00" + strings.Join(r.Namespaces, "\x00") + "\x00" + r.Method
    paths, cached := pathsByHead[head]
    if !cached {
      paths = rewriteCallPaths(r, aliases)
      pathsByHead[head] = paths
    }
    found := false
    for callIndex < len(calls) {
      call := calls[callIndex]
      callIndex++
      if call.start < copiedThrough || !slices.Contains(paths, call.path) {
        continue
      }
      out.WriteString(text[copiedThrough:call.start])
      out.WriteString(r.Replacement)
      copiedThrough = call.calleeEnd
      if r.ConsumeParens {
        copiedThrough = call.end
      }
      found = true
      break
    }
    if !found {
      preview := text
      if len(preview) > 400 {
        preview = preview[:400] + "…"
      }
      return "", fmt.Errorf("driver: could not locate %s.%s(…) call in %s (tried roots %v; preview: %q)", joinRootAndNamespaces(r), r.Method, outputName, aliases, preview)
    }
    pos++
  }
  out.WriteString(text[copiedThrough:])
  cursors[srcPath] = pos
  return insertSentinel(out.String(), file), nil
}

// findSourceForOutput recovers which registered source file produced a given
// emitted output, using the source paths in rs.byPath as the universe.
//
// The match is anchored on the source's path relative to the common directory
// shared by all registered sources. The output's stem must end with that exact
// relative path (with a leading "/" boundary unless the source sits at the
// common directory root). This is stricter than a generic suffix match: a
// barrel file like `lib/api/x/index.js` will not accidentally collide with an
// unrelated `src/.../y/index.ts` that happens to share the basename; a looser
// match would steer the rewriter at the wrong source and fail with
// `driver: could not locate <call>(…) call in …`.
//
// Ambiguous matches (two or more registered sources with the same tail) return
// no match so the caller treats the output as having no rewrites.
func findSourceForOutput(outputName string, rs *RewriteSet) (string, bool) {
  if len(rs.byPath) == 0 {
    return "", false
  }
  outStem := strings.TrimSuffix(filepath.ToSlash(outputName), filepath.Ext(outputName))
  commonDir := commonSourceDirectoryFor(rs)
  var matched string
  hits := 0
  for srcPath := range rs.byPath {
    tail := sourceTail(srcPath, commonDir)
    if tail == "" {
      continue
    }
    if outStem == tail || strings.HasSuffix(outStem, "/"+tail) {
      matched = srcPath
      hits++
    }
  }
  if hits != 1 {
    return "", false
  }
  return matched, true
}

// commonSourceDirectoryFor returns the deepest directory (with trailing "/")
// shared by every source path in rs.byPath. When rs has a single source this is
// just that source's directory.
func commonSourceDirectoryFor(rs *RewriteSet) string {
  var dirs [][]string
  for srcPath := range rs.byPath {
    dirs = append(dirs, strings.Split(filepath.ToSlash(filepath.Dir(srcPath)), "/"))
  }
  if len(dirs) == 0 {
    return ""
  }
  common := dirs[0]
  for _, other := range dirs[1:] {
    n := len(common)
    if len(other) < n {
      n = len(other)
    }
    shared := 0
    for i := 0; i < n; i++ {
      if common[i] != other[i] {
        break
      }
      shared++
    }
    common = common[:shared]
    if len(common) == 0 {
      break
    }
  }
  if len(common) == 0 {
    return ""
  }
  return strings.Join(common, "/") + "/"
}

// sourceTail returns the source stem (extension dropped) without the common
// directory prefix. The leading "/" is also stripped so callers can match it as
// a suffix segment.
func sourceTail(srcPath, commonDir string) string {
  stem := strings.TrimSuffix(filepath.ToSlash(srcPath), filepath.Ext(srcPath))
  if commonDir != "" && strings.HasPrefix(stem, commonDir) {
    return stem[len(commonDir):]
  }
  return strings.TrimPrefix(stem, "/")
}

type emittedImportKind uint8

const (
  emittedImportDirect emittedImportKind = iota
  emittedImportDefault
  emittedImportNamespace
  emittedImportRetainedDefault
  emittedImportRetainedNamespace
)

type emittedImportBinding struct {
  name string
  kind emittedImportKind
}

// collectEmittedImportBindings recovers the identifiers TypeScript-Go
// actually assigned to top-level CommonJS imports in one emitted JavaScript
// file. The source-level import name is not enough: the emitter owns collision
// suffixes and may choose any free number. Parsing the emitted declarations
// keeps alias discovery coupled to that output instead of guessing a maximum.
func collectEmittedImportBindings(file *ast.SourceFile) map[string][]emittedImportBinding {
  bindings := map[string][]emittedImportBinding{}
  if file == nil || file.Statements == nil {
    return bindings
  }
  for _, statement := range file.Statements.Nodes {
    if statement == nil {
      continue
    }
    if statement.Kind == ast.KindImportDeclaration {
      collectRetainedImportBinding(bindings, statement.AsImportDeclaration())
      continue
    }
    if statement.Kind != ast.KindVariableStatement {
      continue
    }
    variables := statement.AsVariableStatement()
    if variables == nil || variables.DeclarationList == nil {
      continue
    }
    declarations := variables.DeclarationList.AsVariableDeclarationList()
    if declarations == nil || declarations.Declarations == nil {
      continue
    }
    for _, declaration := range declarations.Declarations.Nodes {
      if declaration == nil {
        continue
      }
      variable := declaration.AsVariableDeclaration()
      if variable == nil {
        continue
      }
      name := identifierName(variable.Name())
      module, kind, ok := emittedRequireModule(variable.Initializer)
      if name == "" || !ok {
        continue
      }
      bindings[module] = append(bindings[module], emittedImportBinding{name: name, kind: kind})
    }
  }
  return bindings
}

func collectRetainedImportBinding(bindings map[string][]emittedImportBinding, declaration *ast.ImportDeclaration) {
  if declaration == nil || declaration.ImportClause == nil {
    return
  }
  module, ok := stringLiteralValue(declaration.ModuleSpecifier)
  if !ok {
    return
  }
  clause := declaration.ImportClause.AsImportClause()
  if clause == nil {
    return
  }
  if name := identifierName(clause.Name()); name != "" {
    bindings[module] = append(bindings[module], emittedImportBinding{name: name, kind: emittedImportRetainedDefault})
  }
  if clause.NamedBindings == nil || clause.NamedBindings.Kind != ast.KindNamespaceImport {
    return
  }
  namespace := clause.NamedBindings.AsNamespaceImport()
  if namespace == nil {
    return
  }
  if name := identifierName(namespace.Name()); name != "" {
    bindings[module] = append(bindings[module], emittedImportBinding{name: name, kind: emittedImportRetainedNamespace})
  }
}

// emittedRequireModule recognizes the declaration shapes TypeScript-Go owns
// for CommonJS imports: a direct require or a require wrapped in its
// __importDefault/__importStar helper. User calls with other wrappers are not
// import declarations and therefore cannot become rewrite aliases.
func emittedRequireModule(node *ast.Node) (string, emittedImportKind, bool) {
  node = unwrapParentheses(node)
  if node == nil || node.Kind != ast.KindCallExpression {
    return "", emittedImportDirect, false
  }
  call := node.AsCallExpression()
  if call == nil || call.QuestionDotToken != nil || call.Arguments == nil || len(call.Arguments.Nodes) != 1 {
    return "", emittedImportDirect, false
  }
  if identifierName(call.Expression) == "require" {
    module, ok := stringLiteralValue(call.Arguments.Nodes[0])
    return module, emittedImportDirect, ok
  }
  helper := callExpressionName(call.Expression)
  if helper != "__importDefault" && helper != "__importStar" {
    return "", emittedImportDirect, false
  }
  module, _, ok := emittedRequireModule(call.Arguments.Nodes[0])
  if !ok {
    return "", emittedImportDirect, false
  }
  if helper == "__importDefault" {
    return module, emittedImportDefault, true
  }
  return module, emittedImportNamespace, true
}

func callExpressionName(node *ast.Node) string {
  node = unwrapParentheses(node)
  if name := identifierName(node); name != "" {
    return name
  }
  if node == nil || node.Kind != ast.KindPropertyAccessExpression {
    return ""
  }
  access := node.AsPropertyAccessExpression()
  if access == nil {
    return ""
  }
  return identifierName(access.Name())
}

func unwrapParentheses(node *ast.Node) *ast.Node {
  for node != nil && node.Kind == ast.KindParenthesizedExpression {
    expression := node.AsParenthesizedExpression()
    if expression == nil || expression.Expression == nil {
      return nil
    }
    node = expression.Expression
  }
  return node
}

func identifierName(node *ast.Node) string {
  if node == nil || node.Kind != ast.KindIdentifier {
    return ""
  }
  identifier := node.AsIdentifier()
  if identifier == nil {
    return ""
  }
  return identifier.Text
}

func stringLiteralValue(node *ast.Node) (string, bool) {
  if node == nil || node.Kind != ast.KindStringLiteral {
    return "", false
  }
  literal := node.AsStringLiteral()
  if literal == nil {
    return "", false
  }
  return literal.Text, true
}

type sourceImportKind uint8

const (
  sourceImportDefault sourceImportKind = iota
  sourceImportNamespace
  sourceImportEquals
)

type sourceImport struct {
  module string
  kind   sourceImportKind
}

// rewriteAliases binds one source import to the identifiers recovered from its
// emitted require declaration. Retained ESM imports and non-import roots keep
// their source spelling; CommonJS imports use only emitter-owned bindings so a
// nearby identifier cannot be mistaken for the plugin call.
func rewriteAliases(r Rewrite, emittedBindings map[string][]emittedImportBinding) []string {
  imported, ok := sourceImportForRoot(r.File, r.RootName)
  if !ok {
    return []string{r.RootName + ".default", r.RootName}
  }
  retainedKind := emittedImportRetainedDefault
  if imported.kind == sourceImportNamespace {
    retainedKind = emittedImportRetainedNamespace
  }
  if imported.kind != sourceImportEquals {
    for _, binding := range emittedBindings[imported.module] {
      if binding.name == r.RootName && binding.kind == retainedKind {
        return []string{r.RootName}
      }
    }
  }
  candidates := []emittedImportBinding{}
  preferred := []emittedImportBinding{}
  sourceBindings := sourceTopLevelVariableNames(r.File)
  wantKind := emittedImportDirect
  switch imported.kind {
  case sourceImportDefault:
    wantKind = emittedImportDefault
  case sourceImportNamespace:
    wantKind = emittedImportNamespace
  }
  for _, binding := range emittedBindings[imported.module] {
    if _, sourceOwned := sourceBindings[binding.name]; sourceOwned {
      continue
    }
    if !emittedNameForRoot(binding.name, r.RootName) {
      continue
    }
    candidates = append(candidates, binding)
    if binding.kind == wantKind {
      preferred = append(preferred, binding)
    }
  }
  var binding emittedImportBinding
  switch {
  case len(preferred) == 1:
    binding = preferred[0]
  case len(preferred) > 1:
    return []string{r.RootName}
  case len(candidates) == 1:
    binding = candidates[0]
  case len(candidates) > 1:
    return []string{r.RootName}
  default:
    // An ESM emit retains the source binding instead of creating a require.
    return []string{r.RootName}
  }
  if imported.kind == sourceImportDefault {
    return []string{binding.name + ".default"}
  }
  return []string{binding.name}
}

func sourceImportForRoot(file *ast.SourceFile, root string) (sourceImport, bool) {
  if file == nil || file.Statements == nil {
    return sourceImport{}, false
  }
  for _, statement := range file.Statements.Nodes {
    if statement == nil {
      continue
    }
    switch statement.Kind {
    case ast.KindImportDeclaration:
      declaration := statement.AsImportDeclaration()
      if declaration == nil || declaration.ImportClause == nil {
        continue
      }
      clause := declaration.ImportClause.AsImportClause()
      if clause == nil {
        continue
      }
      if identifierName(clause.Name()) == root {
        module, ok := stringLiteralValue(declaration.ModuleSpecifier)
        return sourceImport{module: module, kind: sourceImportDefault}, ok
      }
      if clause.NamedBindings != nil && clause.NamedBindings.Kind == ast.KindNamespaceImport {
        namespace := clause.NamedBindings.AsNamespaceImport()
        if namespace != nil && identifierName(namespace.Name()) == root {
          module, ok := stringLiteralValue(declaration.ModuleSpecifier)
          return sourceImport{module: module, kind: sourceImportNamespace}, ok
        }
      }
    case ast.KindImportEqualsDeclaration:
      declaration := statement.AsImportEqualsDeclaration()
      if declaration == nil || identifierName(declaration.Name()) != root || declaration.ModuleReference == nil ||
        declaration.ModuleReference.Kind != ast.KindExternalModuleReference {
        continue
      }
      reference := declaration.ModuleReference.AsExternalModuleReference()
      if reference != nil {
        module, ok := stringLiteralValue(reference.Expression)
        return sourceImport{module: module, kind: sourceImportEquals}, ok
      }
    }
  }
  return sourceImport{}, false
}

func sourceTopLevelVariableNames(file *ast.SourceFile) map[string]struct{} {
  names := map[string]struct{}{}
  if file == nil || file.Statements == nil {
    return names
  }
  for _, statement := range file.Statements.Nodes {
    if statement == nil || statement.Kind != ast.KindVariableStatement {
      continue
    }
    variables := statement.AsVariableStatement()
    if variables == nil || variables.DeclarationList == nil {
      continue
    }
    declarations := variables.DeclarationList.AsVariableDeclarationList()
    if declarations == nil || declarations.Declarations == nil {
      continue
    }
    for _, declaration := range declarations.Declarations.Nodes {
      if declaration == nil {
        continue
      }
      variable := declaration.AsVariableDeclaration()
      if variable == nil {
        continue
      }
      if name := identifierName(variable.Name()); name != "" {
        names[name] = struct{}{}
      }
    }
  }
  return names
}

func emittedNameForRoot(name, root string) bool {
  if name == root {
    return true
  }
  suffix := strings.TrimPrefix(name, root+"_")
  if suffix == "" || suffix == name {
    return false
  }
  for _, ch := range suffix {
    if ch < '0' || ch > '9' {
      return false
    }
  }
  return true
}

// joinRootAndNamespaces returns the human-readable "root.ns1.ns2" form of
// the rewrite's call head, used in error messages only.
func joinRootAndNamespaces(r Rewrite) string {
  if len(r.Namespaces) == 0 {
    return r.RootName
  }
  return r.RootName + "." + strings.Join(r.Namespaces, ".")
}
