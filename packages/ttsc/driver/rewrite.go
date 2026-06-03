// Package driver: post-emit rewriter.
//
// tsgo emits `.js` with plugin-owned call expressions preserved as-is because
// the compile-time transformer stage is now hosted outside the native
// compiler. This file implements the emit-time rewrite pattern pioneered by
// tsgonest: we intercept tsgo's Emit() via its WriteFile callback, locate each
// previously-recognized plugin call in the emitted JS, and replace the call
// expression with the JS the native consumer produced.
//
// The rewriter operates on the output text only — it relies on the caller
// having already produced an ordered list of (file, call, emittedJS) triples.
// Today we match by textual pattern (`<alias>.<method>(...)`), which is safe
// because the compiler-stripped call site is distinctive.
package driver

import (
  "context"
  "errors"
  "fmt"
  "os"
  "path/filepath"
  "regexp"
  "strings"
  "sync"
  "unicode"

  "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
)

// Rewrite describes one emit-time patch. Produced by CollectCallSites after
// the engine has generated a replacement JS fragment for the call.
type Rewrite struct {
  File          *ast.SourceFile
  RootName      string
  Namespaces    []string
  Method        string
  Replacement   string
  ConsumeParens bool
}

// RewriteSet groups rewrites by file, preserving source order.
type RewriteSet struct {
  byPath map[string][]Rewrite
}

// NewRewriteSet returns an empty set.
func NewRewriteSet() *RewriteSet { return &RewriteSet{byPath: map[string][]Rewrite{}} }

// Add registers a rewrite under the absolute path of its source file.
func (rs *RewriteSet) Add(r Rewrite) {
  if r.File == nil {
    return
  }
  path := filepath.ToSlash(r.File.FileName())
  rs.byPath[path] = append(rs.byPath[path], r)
}

// Len returns the total number of rewrites across every file.
func (rs *RewriteSet) Len() int {
  n := 0
  for _, rws := range rs.byPath {
    n += len(rws)
  }
  return n
}

// RewriteSentinel is the marker inserted at the top of a patched file so
// re-running the emit on an already-rewritten file is a no-op.
const RewriteSentinel = "/* @ttsc-rewritten */"

// EmitAll runs tsgo's emitter, patching every registered plugin-owned call in
// the output. Returns the tsgo diagnostics and any patch-time error. When
// `writeFile` is nil, the patched JS is written to disk via the standard
// tsgo WriteFile.
//
// `writeFile` does not need to be concurrency-safe: emit() funnels every
// invocation through one mutex, so the callback never runs on two goroutines
// at once even though TypeScript-Go emits files in parallel.
func (p *Program) EmitAll(rs *RewriteSet, writeFile shimcompiler.WriteFile) (*shimcompiler.EmitResult, []Diagnostic, error) {
  return p.emit(rs, nil, writeFile)
}

// EmitAllRaw runs TypeScript-Go emit without ttsc output-text rewrites.
//
// `writeFile` does not need to be concurrency-safe: like EmitAll, EmitAllRaw
// funnels every invocation through one mutex, so the callback never runs on
// two goroutines at once even though TypeScript-Go emits files in parallel.
// This is the contract a plugin's output rewriter relies on — it is the
// emit-stage phase ttsc guarantees runs single-threaded (a plugin's WriteFile
// is the standard place to carry per-file cursors or an output map), so ttsc
// owns the serialization rather than pushing goroutine-safety onto every
// plugin author. See the emit-concurrency contract in the plugin docs.
func (p *Program) EmitAllRaw(writeFile shimcompiler.WriteFile) (*shimcompiler.EmitResult, []Diagnostic, error) {
  if p == nil || p.TSProgram == nil {
    return nil, nil, errors.New("driver: nil program")
  }
  if err := p.ApplyLinkedPlugins(); err != nil {
    return nil, nil, err
  }
  // TypeScript-Go's parallel emit invokes WriteFile once per emitted file,
  // concurrently — one goroutine per source file. Serialize the whole callback
  // under wfMu so a plugin's output rewriter sees one writer at a time: a
  // callback that mutates shared state (e.g. @nestia/core's per-file rewrite
  // cursors and runtime-alias cache) would otherwise trip `fatal error:
  // concurrent map read and map write`. The callback is cheap I/O, so
  // serializing it costs ~nothing while parse/check/emit-text still parallelize
  // — the same trade EmitAll makes for its own WriteFile.
  var wfMu sync.Mutex
  wf := func(fileName, text string, data *shimcompiler.WriteFileData) error {
    wfMu.Lock()
    defer wfMu.Unlock()
    if writeFile != nil {
      return writeFile(fileName, text, data)
    }
    return DefaultWriteFile(fileName, text)
  }
  result := p.TSProgram.Emit(context.Background(), shimcompiler.EmitOptions{
    WriteFile: wf,
  })
  return result, convertDiagnostics(result.Diagnostics), nil
}

// EmitFile runs tsgo's emitter for one source file, applying the same rewrite
// pipeline as EmitAll.
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
  // TypeScript-Go's parallel emit invokes this WriteFile callback once per
  // emitted file, concurrently — one goroutine per source file. Serialize the
  // whole callback body under wfMu: the `cursors` map would otherwise trip
  // `fatal error: concurrent map writes`, and the wrapped `writeFile` (which a
  // caller may back with its own non-thread-safe state, e.g. api-compile's
  // output map) must likewise see one writer at a time. The patch work here is
  // cheap, so serializing only the callback costs ~nothing while parsing,
  // checking, and emit-text generation still parallelize.
  var wfMu sync.Mutex
  wf := func(fileName, text string, data *shimcompiler.WriteFileData) error {
    wfMu.Lock()
    defer wfMu.Unlock()
    // A patched file is idempotent: once the sentinel exists, the emitted text
    // is passed through unchanged. This matters for watch/rebuild loops and
    // tests that re-run emit over the same output directory.
    if strings.Contains(text, RewriteSentinel) {
      if writeFile != nil {
        return writeFile(fileName, text, data)
      }
      return DefaultWriteFile(fileName, text)
    }
    // Rewrites are matched after tsgo has printed JavaScript. The source-file
    // association is recovered from the output path because WriteFile receives
    // only the final file name and text.
    patched, err := applyRewrites(fileName, text, rs, cursors)
    if err != nil {
      return err
    }
    if patched != text {
      patched = insertSentinel(patched)
    }
    if writeFile != nil {
      return writeFile(fileName, patched, data)
    }
    return DefaultWriteFile(fileName, patched)
  }

  result := p.TSProgram.Emit(context.Background(), shimcompiler.EmitOptions{
    TargetSourceFile: target,
    WriteFile:        wf,
  })
  return result, convertDiagnostics(result.Diagnostics), nil
}

// DefaultWriteFile is the default disk writer used when EmitAll's caller does not
// supply a custom WriteFile callback.
func DefaultWriteFile(fileName, text string) error {
  if dir := filepath.Dir(fileName); dir != "" {
    if err := os.MkdirAll(dir, 0o755); err != nil {
      return err
    }
  }
  return os.WriteFile(fileName, []byte(text), 0o644)
}

// insertSentinel prepends RewriteSentinel to the output text. When the file
// starts with a "use strict" directive (either quote style), the sentinel is
// inserted after it so the directive remains the first statement — ES modules
// and bundlers expect it at position zero.
func insertSentinel(text string) string {
  for _, prefix := range []string{"\"use strict\";\n", "'use strict';\n"} {
    if strings.HasPrefix(text, prefix) {
      return prefix + RewriteSentinel + "\n" + text[len(prefix):]
    }
  }
  return RewriteSentinel + "\n" + text
}

// applyRewrites applies all registered rewrites for the source file that
// corresponds to outputName. cursors tracks how many rewrites have already
// been applied per source path across multiple WriteFile calls so incremental
// watch rebuilds resume at the right offset rather than re-scanning from zero.
func applyRewrites(outputName, text string, rs *RewriteSet, cursors map[string]int) (string, error) {
  srcPath, ok := findSourceForOutput(outputName, rs)
  if !ok || len(rs.byPath[srcPath]) == 0 {
    return text, nil
  }
  rewrites := rs.byPath[srcPath]
  pos := cursors[srcPath]
  out := text
  searchFrom := 0
  for pos < len(rewrites) {
    r := rewrites[pos]
    replaced, nextSearchFrom, ok, err := spliceCall(out, r, searchFrom)
    if err != nil {
      return "", err
    }
    if !ok {
      preview := out
      if len(preview) > 400 {
        preview = preview[:400] + "…"
      }
      return "", fmt.Errorf("driver: could not locate %s.%s(…) call in %s (tried roots %v; preview: %q)", joinRootAndNamespaces(r), r.Method, outputName, candidateRoots(r.RootName), preview)
    }
    out = replaced
    searchFrom = nextSearchFrom
    pos++
  }
  cursors[srcPath] = pos
  return out, nil
}

// findSourceForOutput recovers which registered source file produced a given
// emitted output, using the source paths in rs.byPath as the universe.
//
// The match is anchored on the source's path relative to the common directory
// shared by all registered sources. The output's stem must end with that exact
// relative path (with a leading "/" boundary unless the source sits at the
// common directory root). This is stricter than a generic suffix match: a
// barrel file like `lib/api/x/index.js` will not accidentally collide with an
// unrelated `src/.../y/index.ts` that happens to share the basename. The bug
// surfaced when typia ran across shopping-backend's nestia-generated barrel
// files; the looser match steered the rewriter at the wrong source and threw
// `driver: could not locate typia.random(…) call in …`.
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

// spliceCall locates the next call expression for r in text starting at
// searchFrom and splices in r.Replacement. When ConsumeParens is true the
// replacement covers the entire call including arguments; otherwise only the
// head (root.namespaces.method) is replaced and the argument list is kept.
// Returns the patched text, the byte position to resume from on the next
// call, a found flag, and any error from the paren-matching step.
func spliceCall(text string, r Rewrite, searchFrom int) (string, int, bool, error) {
  aliases := candidateRoots(r.RootName)
  pattern := callRegexFor(aliases, r.Namespaces, r.Method)
  idx, needleLen := findCallMatch(text, pattern, searchFrom)
  if idx < 0 {
    return text, searchFrom, false, nil
  }
  parenPos := idx + needleLen
  closePos, ok := matchParen(text, parenPos)
  if !ok {
    return text, searchFrom, false, errors.New("driver: unbalanced parens while locating plugin call")
  }
  if r.ConsumeParens {
    replaced := text[:idx] + r.Replacement + text[closePos+1:]
    return replaced, idx + len(r.Replacement), true, nil
  }
  replaced := text[:idx] + r.Replacement + text[idx+needleLen:]
  return replaced, idx + len(r.Replacement), true, nil
}

// callRegexFor compiles the loose-match needle pattern used by spliceCall.
//
// tsgo's emitter preserves source line breaks in property-access chains, so a
// source-side `typia.misc\n  .literals<T>()` lands in the output as
// `typia_1.default.misc\n  .literals()`. A literal needle would miss it; the
// pattern instead allows any whitespace (spaces, tabs, newlines) between
// segments, around the trailing dot before the method, and before the opening
// paren. Group 1 captures the trailing `(` so callers can compute the call
// site's text length precisely (regexes can't return per-byte segment widths
// otherwise).
//
// Results are cached by candidate-aliases × namespaces × method because the
// same rewrite descriptor is re-checked once per emitted file in incremental
// watch builds.
func callRegexFor(aliases, namespaces []string, method string) *regexp.Regexp {
  key := strings.Join(aliases, "|") + "\x00" + strings.Join(namespaces, ".") + "\x00" + method
  if cached, ok := callRegexCache.Load(key); ok {
    return cached.(*regexp.Regexp)
  }
  rootAlternation := make([]string, 0, len(aliases))
  for _, alias := range aliases {
    rootAlternation = append(rootAlternation, regexp.QuoteMeta(alias))
  }
  var b strings.Builder
  b.WriteString(`(?:`)
  b.WriteString(strings.Join(rootAlternation, `|`))
  b.WriteString(`)`)
  for _, ns := range namespaces {
    b.WriteString(`\s*\.\s*`)
    b.WriteString(regexp.QuoteMeta(ns))
  }
  b.WriteString(`\s*\.\s*`)
  b.WriteString(regexp.QuoteMeta(method))
  b.WriteString(`\s*(\()`)
  // MustCompile is safe because every contributing string was QuoteMeta'd
  // and the surrounding template is a fixed regex grammar.
  re := regexp.MustCompile(b.String())
  callRegexCache.Store(key, re)
  return re
}

var callRegexCache sync.Map

// findCallMatch scans `text` from `searchFrom` for the next call expression
// matched by the loose-match `pattern`, applying the same "must start outside
// an identifier" rule as the old literal indexAtCallStart so generated locals
// like `mytypia.foo(` don't shadow `typia.foo(`. Returns the start byte of the
// match and the length up to (but not including) the captured `(`.
func findCallMatch(text string, pattern *regexp.Regexp, searchFrom int) (int, int) {
  start := searchFrom
  if start < 0 {
    start = 0
  }
  for start <= len(text) {
    loc := pattern.FindStringSubmatchIndex(text[start:])
    if loc == nil {
      return -1, 0
    }
    matchStart := start + loc[0]
    parenStart := start + loc[2]
    if matchStart > 0 && isIdentifierPart(rune(text[matchStart-1])) {
      start = matchStart + 1
      continue
    }
    return matchStart, parenStart - matchStart
  }
  return -1, 0
}

// candidateRoots expands a bare module name into the set of identifier stems
// tsgo's CommonJS emitter may produce for it. For example "typia" becomes
// ["typia", "typia_1.default", "typia_2.default", "typia.default",
// "typia_1", "typia_2"]. The regex alternation built from these candidates
// matches the emitted call regardless of which deduplication suffix tsgo chose.
func candidateRoots(root string) []string {
  return []string{
    root,
    root + "_1.default",
    root + "_2.default",
    root + ".default",
    root + "_1",
    root + "_2",
  }
}

// joinRootAndNamespaces returns the human-readable "root.ns1.ns2" form of
// the rewrite's call head, used in error messages only.
func joinRootAndNamespaces(r Rewrite) string {
  if len(r.Namespaces) == 0 {
    return r.RootName
  }
  return r.RootName + "." + strings.Join(r.Namespaces, ".")
}

// needleTail returns the literal suffix of a call expression head, e.g.
// ".ns.method(". This was the original literal-search needle before the regex
// rewriter was introduced; it is kept for potential future use by callers
// that do a quick pre-filter before invoking the regex path.
func needleTail(r Rewrite) string {
  if len(r.Namespaces) == 0 {
    return "." + r.Method + "("
  }
  return "." + strings.Join(r.Namespaces, ".") + "." + r.Method + "("
}

// isIdentifierPart reports whether r can appear inside a JavaScript identifier.
// Used to ensure a regex match does not begin mid-identifier (e.g. "mytypia"
// must not match as "typia").
func isIdentifierPart(r rune) bool {
  return r == '_' || r == '$' || unicode.IsLetter(r) || unicode.IsDigit(r)
}

// matchParen finds the closing ")" that matches the "(" at text[pos],
// skipping over nested parentheses, strings, template literals, comments, and
// regex literals. Returns the byte index of the closing ")" and true on
// success; (0, false) when pos does not point at "(" or the text ends before
// the paren is closed. The lastSignificant variable tracks the most recently
// seen non-whitespace byte so canStartRegexLiteral can distinguish division
// from a regex literal opener.
func matchParen(text string, pos int) (int, bool) {
  if pos >= len(text) || text[pos] != '(' {
    return 0, false
  }
  depth := 1
  lastSignificant := byte('(')
  for i := pos + 1; i < len(text); i++ {
    ch := text[i]
    switch ch {
    case ' ', '\t', '\n', '\r', '\f':
      continue
    case '(':
      depth++
      lastSignificant = ch
    case ')':
      depth--
      if depth == 0 {
        return i, true
      }
      lastSignificant = ch
    case '"', '\'':
      end, ok := skipQuoted(text, i, ch)
      if !ok {
        return 0, false
      }
      i = end
      lastSignificant = 'x'
    case '`':
      end, ok := skipTemplate(text, i)
      if !ok {
        return 0, false
      }
      i = end
      lastSignificant = 'x'
    case '/':
      if i+1 < len(text) {
        switch text[i+1] {
        case '/':
          i = skipLineComment(text, i+2)
          continue
        case '*':
          end, ok := skipBlockComment(text, i+2)
          if !ok {
            return 0, false
          }
          i = end
          continue
        }
      }
      if canStartRegexLiteral(lastSignificant) {
        end, ok := skipRegexLiteral(text, i)
        if !ok {
          return 0, false
        }
        i = end
        lastSignificant = 'x'
        continue
      }
      lastSignificant = ch
    default:
      lastSignificant = ch
    }
  }
  return 0, false
}

// skipQuoted advances past a single- or double-quoted string literal starting
// at pos. Returns the index of the closing quote and true, or (0, false) on
// unterminated literals. Newlines inside a non-template string are illegal in
// JS and also terminate the scan as a failure.
func skipQuoted(text string, pos int, quote byte) (int, bool) {
  for i := pos + 1; i < len(text); i++ {
    switch text[i] {
    case '\\':
      i++
    case quote:
      return i, true
    case '\n', '\r':
      return 0, false
    }
  }
  return 0, false
}

// skipTemplate advances past a backtick template literal starting at pos.
// Nested template expressions (${...}) are not recursed into — the rewriter
// only needs to balance the outer backtick so it does not misinterpret a
// backtick inside the template as the end of a surrounding construct.
func skipTemplate(text string, pos int) (int, bool) {
  for i := pos + 1; i < len(text); i++ {
    switch text[i] {
    case '\\':
      i++
    case '`':
      return i, true
    }
  }
  return 0, false
}

// skipLineComment advances past a "//" line comment starting at pos (pos
// should be the character after the second "/"). Returns the index of the
// line terminator, or the last valid index when no newline is found.
func skipLineComment(text string, pos int) int {
  for i := pos; i < len(text); i++ {
    if text[i] == '\n' || text[i] == '\r' {
      return i
    }
  }
  return len(text) - 1
}

// skipBlockComment advances past a "/* … */" block comment starting at pos
// (pos should be the character after the opening "/*"). Returns the index of
// the closing "/" and true, or (0, false) when the comment is unterminated.
func skipBlockComment(text string, pos int) (int, bool) {
  for i := pos; i+1 < len(text); i++ {
    if text[i] == '*' && text[i+1] == '/' {
      return i + 1, true
    }
  }
  return 0, false
}

// canStartRegexLiteral reports whether the byte previous (the last
// non-whitespace character seen before a "/") allows a regex literal to
// start. This is the minimal set of characters that unambiguously precede a
// regex in emitted CommonJS output; false positives are safe (they cause an
// extra skipRegexLiteral attempt that quickly fails), false negatives would
// misparse a "/" as the start of a comment or regex.
func canStartRegexLiteral(previous byte) bool {
  return strings.ContainsRune("([{=,:;!&|?+-*~^<>%", rune(previous))
}

// skipRegexLiteral advances past a "/" regex literal starting at pos.
// Character classes ("[…]") are tracked so a "/" inside them is not treated
// as the closing delimiter. Returns the index of the last flag character (or
// the closing "/" when no flags follow) and true, or (0, false) for unterminated
// or newline-terminated literals.
func skipRegexLiteral(text string, pos int) (int, bool) {
  inClass := false
  for i := pos + 1; i < len(text); i++ {
    switch text[i] {
    case '\\':
      i++
    case '[':
      inClass = true
    case ']':
      inClass = false
    case '/':
      if inClass {
        continue
      }
      for i+1 < len(text) && isRegexFlag(text[i+1]) {
        i++
      }
      return i, true
    case '\n', '\r':
      return 0, false
    }
  }
  return 0, false
}

// isRegexFlag reports whether ch is a valid regex flag character (letter,
// digit, "_" or "$"). ES2025 allows any IdentifierPart after the closing "/".
func isRegexFlag(ch byte) bool {
  return ch == '_' ||
    ch == '$' ||
    unicode.IsLetter(rune(ch)) ||
    unicode.IsDigit(rune(ch))
}
