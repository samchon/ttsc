package linthost

import (
  "sort"
  "strconv"
  "strings"
  "unicode"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// regexpSourceRule implements the high-confidence, source-text subset of
// eslint-plugin-regexp. The first wave intentionally targets regex literals
// only: TypeScript-Go has already parsed those successfully, so these checks can
// stay AST-only and avoid pretending to evaluate arbitrary `RegExp(...)`
// constructor strings.
type regexpSourceRule struct {
  name  string
  check func(regexpLiteralParts) bool
  // repair turns an accepted finding into the correction the check already
  // located. A rule without one stays diagnostic-only.
  repair func(regexpLiteralParts) regexpRepair
}

type regexpLiteralParts struct {
  // start is the literal's offset in the source file. Repairs are computed in
  // literal-relative coordinates and lifted onto the file through it.
  start   int
  raw     string
  pattern string
  flags   string
}

// patternOffset is where the pattern begins inside `raw`, past the opening `/`.
func (regexpLiteralParts) patternOffset() int { return 1 }

// flagsOffset is where the flag run begins inside `raw`, past the closing `/`.
func (parts regexpLiteralParts) flagsOffset() int { return len(parts.pattern) + 2 }

// regexpRepair is the correction a regexp rule computed for one literal.
//
// Its edits are relative to the literal's own text, so a rule never handles
// file coordinates; `Check` validates and lifts the whole repair in one place.
type regexpRepair struct {
  // message replaces regexpRuleMessage when non-empty, for a rule whose
  // finding can name the exact thing it located.
  message string
  // fix is the one correct rewrite, applied by `ttsc fix`.
  fix []TextEdit
  // suggestions are competing rewrites only the author can choose between.
  suggestions []Suggestion
}

func (r regexpSourceRule) Name() string { return r.name }
func (regexpSourceRule) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindRegularExpressionLiteral}
}
func (r regexpSourceRule) Check(ctx *Context, node *shimast.Node) {
  parts, ok := parseRegexpLiteralParts(ctx, node)
  if !ok || r.check == nil || !r.check(parts) {
    return
  }
  message := regexpRuleMessage(r.name)
  if r.repair == nil {
    ctx.Report(node, message)
    return
  }
  repair := r.repair(parts)
  if repair.message != "" {
    message = repair.message
  }
  suggestions := make([]Suggestion, 0, len(repair.suggestions))
  for _, suggestion := range repair.suggestions {
    edits := parts.acceptEdits(suggestion.Edits)
    if len(edits) == 0 {
      continue
    }
    suggestions = append(suggestions, Suggestion{Title: suggestion.Title, Edits: edits})
  }
  ctx.ReportFixSuggestions(node, message, parts.acceptEdits(repair.fix), suggestions...)
}

// acceptEdits validates one candidate rewrite of this literal and lifts it into
// file coordinates, or returns nil to leave the finding without that edit.
//
// The gate is the compiler's own regexp parser applied to the rewritten literal
// as a whole. Every repair here is a splice into live regex syntax, where a
// locally correct edit can still leave a pattern the engine rejects: `/{1,}/`
// carries no atom, so its brace run is an Annex B literal rather than a
// quantifier, and rewriting it to `/+/` yields "nothing to repeat". Rules stay
// free to compute the ideal edit and cannot emit one that fails to parse.
//
// Validity is not equivalence. That a rewrite still parses says nothing about
// whether it matches the same strings, so preserving semantics remains each
// rule's own burden -- this only keeps a syntactically broken edit off disk.
func (parts regexpLiteralParts) acceptEdits(edits []TextEdit) []TextEdit {
  rewritten, ok := applyRegexpLiteralEdits(parts.raw, edits)
  if !ok || rewritten == parts.raw {
    return nil
  }
  if !shimscanner.IsValidRegularExpressionLiteral(rewritten) {
    return nil
  }
  shifted := make([]TextEdit, 0, len(edits))
  for _, edit := range edits {
    shifted = append(shifted, TextEdit{
      Pos:  parts.start + edit.Pos,
      End:  parts.start + edit.End,
      Text: edit.Text,
    })
  }
  return shifted
}

// applyRegexpLiteralEdits splices literal-relative edits into `raw`. It reports
// false for an empty, out-of-bounds, or overlapping edit set rather than
// producing text from a half-applied rewrite.
func applyRegexpLiteralEdits(raw string, edits []TextEdit) (string, bool) {
  if len(edits) == 0 {
    return "", false
  }
  ordered := make([]TextEdit, len(edits))
  copy(ordered, edits)
  sort.SliceStable(ordered, func(i, j int) bool { return ordered[i].Pos < ordered[j].Pos })
  boundary := 0
  for _, edit := range ordered {
    if edit.Pos < boundary || edit.End < edit.Pos || edit.End > len(raw) {
      return "", false
    }
    boundary = edit.End
  }
  out := raw
  for i := len(ordered) - 1; i >= 0; i-- {
    out = out[:ordered[i].Pos] + ordered[i].Text + out[ordered[i].End:]
  }
  return out, true
}

type regexpNoUselessEscapeAlias struct{}

func (regexpNoUselessEscapeAlias) Name() string { return "regexp/no-useless-escape" }
func (regexpNoUselessEscapeAlias) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindRegularExpressionLiteral}
}
func (regexpNoUselessEscapeAlias) Check(ctx *Context, node *shimast.Node) {
  pos, end := tokenRange(ctx.File, node)
  if pos < 0 {
    return
  }
  reportRegexEscapes(ctx, ctx.File.Text()[pos:end], pos)
}

func parseRegexpLiteralParts(ctx *Context, node *shimast.Node) (regexpLiteralParts, bool) {
  // `nodeText` and `tokenRange` skip the same leading trivia, so the text a
  // repair reasons about always begins at exactly `start` in the file.
  start, _ := tokenRange(ctx.File, node)
  raw := nodeText(ctx.File, node)
  if start < 0 || len(raw) < 2 || raw[0] != '/' {
    return regexpLiteralParts{}, false
  }
  closing := strings.LastIndexByte(raw, '/')
  if closing <= 0 {
    return regexpLiteralParts{}, false
  }
  return regexpLiteralParts{
    start:   start,
    raw:     raw,
    pattern: raw[1:closing],
    flags:   raw[closing+1:],
  }, true
}

func regexpRuleMessage(name string) string {
  switch name {
  case "regexp/no-control-character":
    return "Unexpected control character in regular expression."
  case "regexp/no-dupe-characters-character-class":
    return "Unexpected duplicate character in character class."
  case "regexp/no-empty-alternative":
    return "Unexpected empty alternative."
  case "regexp/no-empty-capturing-group":
    return "Unexpected empty capturing group."
  case "regexp/no-empty-character-class":
    return "Unexpected empty character class."
  case "regexp/no-empty-group":
    return "Unexpected empty group."
  case "regexp/no-empty-lookarounds-assertion":
    return "Unexpected empty lookaround assertion."
  case "regexp/no-misleading-unicode-character":
    return "Unexpected misleading Unicode character in character class."
  case "regexp/no-useless-character-class":
    return "Unexpected character class with one character."
  case "regexp/no-useless-flag":
    return "Unexpected useless regular expression flag."
  case "regexp/no-useless-quantifier":
    return "Unexpected useless quantifier."
  case "regexp/no-useless-two-nums-quantifier":
    return "Unexpected quantifier with equal minimum and maximum."
  case "regexp/no-zero-quantifier":
    return "Unexpected quantifier that repeats zero times."
  case "regexp/prefer-d":
    return "Prefer \\d over [0-9]."
  case "regexp/prefer-plus-quantifier":
    return "Prefer + over {1,}."
  case "regexp/prefer-question-quantifier":
    return "Prefer ? over {0,1}."
  case "regexp/prefer-star-quantifier":
    return "Prefer * over {0,}."
  case "regexp/prefer-w":
    return "Prefer \\w over [A-Za-z0-9_]."
  case "regexp/require-unicode-regexp":
    return "Regular expression should use the u or v flag."
  case "regexp/require-unicode-sets-regexp":
    return "Regular expression should use the v flag."
  case "regexp/sort-flags":
    return "Regular expression flags should be sorted."
  default:
    return "Unexpected regular expression pattern."
  }
}

func regexpHasEmptyAlternative(parts regexpLiteralParts) bool {
  return scanRegexpPattern(parts.pattern, func(pattern string, i int) bool {
    if pattern[i] != '|' {
      return false
    }
    return i == 0 || i == len(pattern)-1 || pattern[i-1] == '|' || pattern[i-1] == '(' || pattern[i+1] == '|' || pattern[i+1] == ')'
  })
}

func regexpHasEmptyCapturingGroup(parts regexpLiteralParts) bool {
  return scanRegexpPattern(parts.pattern, func(pattern string, i int) bool {
    return pattern[i] == '(' && i+1 < len(pattern) && pattern[i+1] == ')'
  })
}

func regexpHasEmptyGroup(parts regexpLiteralParts) bool {
  return scanRegexpPattern(parts.pattern, func(pattern string, i int) bool {
    return strings.HasPrefix(pattern[i:], "(?:)")
  })
}

func regexpHasEmptyLookaround(parts regexpLiteralParts) bool {
  return scanRegexpPattern(parts.pattern, func(pattern string, i int) bool {
    return strings.HasPrefix(pattern[i:], "(?=)") ||
      strings.HasPrefix(pattern[i:], "(?!)") ||
      strings.HasPrefix(pattern[i:], "(?<=)") ||
      strings.HasPrefix(pattern[i:], "(?<!)")
  })
}

// regexpHasEmptyCharacterClass reports non-negated character classes whose
// parsed element list is empty. The compiler's regexp parser is the syntax
// authority; the structural walk runs only after that parser accepts the full
// literal, so malformed escapes, flags, and class-set expressions cannot
// create lint findings.
func regexpHasEmptyCharacterClass(parts regexpLiteralParts) bool {
  if !shimscanner.IsValidRegularExpressionLiteral(parts.raw) {
    return false
  }
  unicodeSets := strings.Contains(parts.flags, "v")
  depth := 0
  for i := 0; i < len(parts.pattern); i++ {
    switch parts.pattern[i] {
    case '\\':
      i++
    case '[':
      if depth != 0 && !unicodeSets {
        continue
      }
      depth++
      content := i + 1
      negated := content < len(parts.pattern) && parts.pattern[content] == '^'
      if negated {
        content++
      }
      if !negated && content < len(parts.pattern) && parts.pattern[content] == ']' {
        return true
      }
    case ']':
      if depth > 0 {
        depth--
      }
    }
  }
  return false
}

func regexpQuantifierIsZero(quantifier regexpQuantifier) bool {
  return quantifier.min == 0 && (!quantifier.hasComma || quantifier.max == 0)
}

func regexpQuantifierIsTwoNums(quantifier regexpQuantifier) bool {
  return quantifier.hasComma && quantifier.min == quantifier.max && quantifier.min >= 0
}

func regexpQuantifierIsUseless(quantifier regexpQuantifier) bool {
  return !quantifier.hasComma && quantifier.min == 1 && quantifier.max == -1
}

func regexpQuantifierIsPlus(quantifier regexpQuantifier) bool {
  return quantifier.hasComma && quantifier.min == 1 && quantifier.max == -1
}

func regexpQuantifierIsStar(quantifier regexpQuantifier) bool {
  return quantifier.hasComma && quantifier.min == 0 && quantifier.max == -1
}

func regexpQuantifierIsQuestion(quantifier regexpQuantifier) bool {
  return quantifier.hasComma && quantifier.min == 0 && quantifier.max == 1
}

func regexpQuantifierCheck(accept func(regexpQuantifier) bool) func(regexpLiteralParts) bool {
  return func(parts regexpLiteralParts) bool {
    return scanRegexpQuantifiers(parts.pattern, accept)
  }
}

func regexpNeedsUnicodeFlag(parts regexpLiteralParts) bool {
  return !strings.ContainsAny(parts.flags, "uv")
}

func regexpNeedsUnicodeSetsFlag(parts regexpLiteralParts) bool {
  return !strings.Contains(parts.flags, "v")
}

func regexpFlagsUnsorted(parts regexpLiteralParts) bool {
  return regexpSortedFlags(parts.flags) != parts.flags
}

func regexpSortedFlags(flags string) string {
  sorted := []byte(flags)
  sort.SliceStable(sorted, func(i, j int) bool {
    return regexpFlagOrder(sorted[i]) < regexpFlagOrder(sorted[j])
  })
  return string(sorted)
}

// regexpSortFlagsRepair hands back the sorted flag string the check already
// built to decide the finding. A permutation of the flag run cannot change what
// the literal matches, so this is a fix rather than a suggestion.
func regexpSortFlagsRepair(parts regexpLiteralParts) regexpRepair {
  return regexpRepair{fix: []TextEdit{parts.flagEdit(regexpSortedFlags(parts.flags))}}
}

// flagEdit replaces this literal's whole flag run.
func (parts regexpLiteralParts) flagEdit(flags string) TextEdit {
  return TextEdit{
    Pos:  parts.flagsOffset(),
    End:  parts.flagsOffset() + len(parts.flags),
    Text: flags,
  }
}

// regexpFlagsWith inserts `flag` at its canonical `dgimsuvy` position without
// reordering the flags already present, so adding one flag never silently does
// `regexp/sort-flags`' job on an unsorted literal.
func regexpFlagsWith(flags string, flag byte) string {
  if strings.IndexByte(flags, flag) >= 0 {
    return flags
  }
  order := regexpFlagOrder(flag)
  for i := 0; i < len(flags); i++ {
    if regexpFlagOrder(flags[i]) > order {
      return flags[:i] + string(flag) + flags[i:]
    }
  }
  return flags + string(flag)
}

// regexpUnicodeFlagRepair offers `u` and `v` as competing suggestions.
//
// Both satisfy the rule and neither is the obvious answer: `u` is the widely
// supported mode, `v` the stricter ES2024 superset. Both also change what the
// pattern matches -- surrogate pairs stop being two independent code units --
// so this is never applied automatically by `ttsc fix`.
func regexpUnicodeFlagRepair(parts regexpLiteralParts) regexpRepair {
  return regexpRepair{suggestions: []Suggestion{
    {Title: "Add the `u` flag.", Edits: []TextEdit{parts.flagEdit(regexpFlagsWith(parts.flags, 'u'))}},
    {Title: "Add the `v` flag.", Edits: []TextEdit{parts.flagEdit(regexpFlagsWith(parts.flags, 'v'))}},
  }}
}

// regexpUnicodeSetsFlagRepair offers the single `v` rewrite, replacing `u`
// where the literal already carries it. It stays a suggestion for the same
// reason as regexpUnicodeFlagRepair: `v` is a stricter mode with its own
// matching semantics, not a spelling of the existing pattern.
func regexpUnicodeSetsFlagRepair(parts regexpLiteralParts) regexpRepair {
  title, flags := "Add the `v` flag.", parts.flags
  if strings.IndexByte(flags, 'u') >= 0 {
    title = "Replace the `u` flag with `v`."
    flags = strings.Replace(flags, "u", "", 1)
  }
  return regexpRepair{suggestions: []Suggestion{
    {Title: title, Edits: []TextEdit{parts.flagEdit(regexpFlagsWith(flags, 'v'))}},
  }}
}

func regexpFlagOrder(flag byte) int {
  const order = "dgimsuvy"
  if i := strings.IndexByte(order, flag); i >= 0 {
    return i
  }
  return len(order) + int(flag)
}

// regexpHasUselessFlag decides `regexp/no-useless-flag` for the two flags whose
// effect is visible in the pattern alone: `i` (nothing it could re-case) and `m`
// (no `^`/`$` for it to re-anchor).
//
// Both questions are answered on the regexp AST from regex_tree.go rather than
// on a byte scan. `scanRegexpPattern` never enters a character class -- correct
// for the rules that hunt `|`, `(`, `{` outside classes, and correct for `m`
// (`^`/`$` are literals inside a class), but fatal for `i`, because `[a-z]` is
// exactly where the flag earns its keep.
//
// A literal the parser rejects yields no finding at all: the rule tells people
// to delete a flag, so it stays silent whenever it cannot see the whole pattern.
func regexpHasUselessFlag(parts regexpLiteralParts) bool {
  return regexpUselessFlags(parts) != ""
}

// regexpUselessFlags returns every flag the literal carries that its own
// pattern can never exercise, in canonical order.
func regexpUselessFlags(parts regexpLiteralParts) string {
  ignoreCase := strings.Contains(parts.flags, "i")
  multiline := strings.Contains(parts.flags, "m")
  if !ignoreCase && !multiline {
    return ""
  }
  parsed, err := regexParseLiteral(parts.raw)
  if err != nil {
    return ""
  }
  useless := make([]byte, 0, 2)
  if ignoreCase && !regexpNodeIsCaseVariant(parsed.Body, strings.ContainsAny(parts.flags, "uv")) {
    useless = append(useless, 'i')
  }
  if multiline && !regexpNodeHasLineAnchor(parsed.Body) {
    useless = append(useless, 'm')
  }
  return string(useless)
}

// regexpUselessFlagRepair deletes the dead flags the analysis named. The
// analysis is one-sided -- anything it cannot settle counts as using the flag
// -- so a flag it does reach here is provably inert and the deletion is a fix
// rather than a suggestion.
func regexpUselessFlagRepair(parts regexpLiteralParts) regexpRepair {
  useless := regexpUselessFlags(parts)
  if useless == "" {
    return regexpRepair{}
  }
  var edits []TextEdit
  for i := 0; i < len(parts.flags); i++ {
    if strings.IndexByte(useless, parts.flags[i]) < 0 {
      continue
    }
    edits = append(edits, TextEdit{
      Pos: parts.flagsOffset() + i,
      End: parts.flagsOffset() + i + 1,
    })
  }
  return regexpRepair{message: regexpUselessFlagMessage(useless), fix: edits}
}

// regexpUselessFlagMessage names the flags rather than leaving the reader to
// rediscover which one the analysis found inert. Only `i` and `m` are ever
// judged, so the list is one or two entries.
func regexpUselessFlagMessage(useless string) string {
  quoted := make([]string, 0, len(useless))
  for i := 0; i < len(useless); i++ {
    quoted = append(quoted, "`"+string(useless[i])+"`")
  }
  if len(quoted) == 1 {
    return "Unexpected useless regular expression flag " + quoted[0] + "."
  }
  return "Unexpected useless regular expression flags " + strings.Join(quoted, " and ") + "."
}

func regexpHasPreferD(parts regexpLiteralParts) bool {
  return strings.Contains(parts.pattern, "[0-9]")
}

func regexpHasPreferW(parts regexpLiteralParts) bool {
  return strings.Contains(parts.pattern, "[A-Za-z0-9_]") || strings.Contains(parts.pattern, "[a-zA-Z0-9_]")
}

func regexpHasDuplicateClassCharacter(parts regexpLiteralParts) bool {
  return walkRegexpCharacterClasses(parts.pattern, func(content string) bool {
    if classHasRange(content) {
      return false
    }
    seen := map[byte]struct{}{}
    for i := 0; i < len(content); i++ {
      ch := content[i]
      if ch == '\\' {
        i++
        continue
      }
      if ch == '^' && i == 0 {
        continue
      }
      if ch == '-' {
        continue
      }
      if _, ok := seen[ch]; ok {
        return true
      }
      seen[ch] = struct{}{}
    }
    return false
  })
}

func regexpHasUselessCharacterClass(parts regexpLiteralParts) bool {
  return walkRegexpCharacterClasses(parts.pattern, func(content string) bool {
    if len(content) != 1 {
      return false
    }
    ch := content[0]
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9')
  })
}

func scanRegexpPattern(pattern string, visit func(pattern string, i int) bool) bool {
  inClass := false
  for i := 0; i < len(pattern); i++ {
    switch pattern[i] {
    case '\\':
      i++
    case '[':
      if !inClass {
        inClass = true
      }
    case ']':
      inClass = false
    default:
      if !inClass && visit(pattern, i) {
        return true
      }
    }
  }
  return false
}

// regexpQuantifier is one `{...}` count quantifier located in a pattern.
//
// The span travels with the bounds because every quantifier-shorthand rule in
// this family answers "is this quantifier redundant?" and "what replaces it?"
// from the same scan.
type regexpQuantifier struct {
  // start and end bracket `{`..`}` inclusive-exclusive, relative to the
  // pattern rather than to the whole literal.
  start    int
  end      int
  min      int
  max      int
  hasComma bool
}

func scanRegexpQuantifiers(pattern string, visit func(regexpQuantifier) bool) bool {
  return scanRegexpPattern(pattern, func(pattern string, i int) bool {
    if pattern[i] != '{' {
      return false
    }
    end := i + 1
    for end < len(pattern) && pattern[end] != '}' {
      end++
    }
    if end >= len(pattern) {
      return false
    }
    body := pattern[i+1 : end]
    hasComma := strings.Contains(body, ",")
    min, max := -1, -1
    if hasComma {
      pair := strings.SplitN(body, ",", 2)
      min = parseRegexpQuantifierNumber(pair[0])
      if pair[1] != "" {
        max = parseRegexpQuantifierNumber(pair[1])
      }
    } else {
      min = parseRegexpQuantifierNumber(body)
    }
    return min >= 0 && visit(regexpQuantifier{
      start:    i,
      end:      end + 1,
      min:      min,
      max:      max,
      hasComma: hasComma,
    })
  })
}

// regexpQuantifierRepair builds the repair shared by the quantifier-shorthand
// rules: every `{...}` the rule accepts is rewritten by `rewrite`, and the
// whole set travels as one atomic fix so a literal is never half-canonicalized.
//
// `rewrite` may decline an individual quantifier whose neighbours make the
// rewrite unsafe; the remaining ones still apply.
func regexpQuantifierRepair(
  accept func(regexpQuantifier) bool,
  rewrite func(pattern string, quantifier regexpQuantifier) (string, bool),
) func(regexpLiteralParts) regexpRepair {
  return func(parts regexpLiteralParts) regexpRepair {
    var edits []TextEdit
    scanRegexpQuantifiers(parts.pattern, func(quantifier regexpQuantifier) bool {
      if !accept(quantifier) {
        return false
      }
      if text, ok := rewrite(parts.pattern, quantifier); ok {
        edits = append(edits, TextEdit{
          Pos:  parts.patternOffset() + quantifier.start,
          End:  parts.patternOffset() + quantifier.end,
          Text: text,
        })
      }
      return false
    })
    return regexpRepair{fix: edits}
  }
}

// regexpQuantifierSymbol rewrites a count quantifier to its one-character
// shorthand. `{1,}` and `+` bind identically, so a trailing lazy `?` survives
// the swap unchanged.
func regexpQuantifierSymbol(symbol string) func(string, regexpQuantifier) (string, bool) {
  return func(string, regexpQuantifier) (string, bool) { return symbol, true }
}

// regexpQuantifierExactCount collapses `{n,n}` to `{n}`. The braces stay, so
// nothing can fuse with a neighbouring token.
func regexpQuantifierExactCount(_ string, quantifier regexpQuantifier) (string, bool) {
  return "{" + strconv.Itoa(quantifier.min) + "}", true
}

// regexpQuantifierDrop deletes a `{1}` that repeats its atom exactly once.
//
// Two following characters make the deletion unsafe, and neither is caught by
// re-parsing the result, because both rewrites still parse:
//
//   - `?`, `*`, `+`, or `{`: the braces are the quantifier and the `?` in
//     `/a{1}?/` only makes it lazy, so dropping them turns "exactly one" into
//     "zero or one".
//   - A digit: the braces separate a backreference or octal escape from a
//     digit, and `/\1{1}2/` would fuse into `\12`, backreference twelve.
func regexpQuantifierDrop(pattern string, quantifier regexpQuantifier) (string, bool) {
  if quantifier.end >= len(pattern) {
    return "", true
  }
  switch next := pattern[quantifier.end]; {
  case next == '?', next == '*', next == '+', next == '{':
    return "", false
  case next >= '0' && next <= '9':
    return "", false
  }
  return "", true
}

func parseRegexpQuantifierNumber(text string) int {
  if text == "" {
    return -1
  }
  for i := 0; i < len(text); i++ {
    if text[i] < '0' || text[i] > '9' {
      return -1
    }
  }
  value, err := strconv.Atoi(text)
  if err != nil {
    return -1
  }
  return value
}

// regexpClassSpan is one character class located in a pattern.
type regexpClassSpan struct {
  // start and end bracket `[`..`]` inclusive-exclusive, relative to the
  // pattern rather than to the whole literal.
  start   int
  end     int
  content string
}

// walkRegexpCharacterClassSpans visits every character class in source order,
// stopping early when visit returns true and reporting whether it did. A `[`
// that opens no class -- an escaped bracket, or one with no closing `]` -- is
// skipped, which is what keeps `/\[0-9]/` from being read as a digit class.
func walkRegexpCharacterClassSpans(pattern string, visit func(regexpClassSpan) bool) bool {
  for i := 0; i < len(pattern); i++ {
    if pattern[i] == '\\' {
      i++
      continue
    }
    if pattern[i] != '[' {
      continue
    }
    start := i + 1
    for j := start; j < len(pattern); j++ {
      if pattern[j] == '\\' {
        j++
        continue
      }
      if pattern[j] == ']' {
        if visit(regexpClassSpan{start: i, end: j + 1, content: pattern[start:j]}) {
          return true
        }
        i = j
        break
      }
    }
  }
  return false
}

func walkRegexpCharacterClasses(pattern string, visit func(content string) bool) bool {
  return walkRegexpCharacterClassSpans(pattern, func(span regexpClassSpan) bool {
    return visit(span.content)
  })
}

// regexpClassShorthandRepair rewrites every character class spelled exactly as
// one of `spellings` into `shorthand`.
//
// The shorthand always begins with a backslash, so it cannot fuse with the
// atom before it the way a bare character could, and it is a complete atom, so
// a following quantifier keeps applying to the same thing.
//
// The class walk is stricter than the substring test that decides the finding:
// it will not see a spelled-out class nested inside a `v`-mode class, so such a
// literal is reported without a fix rather than rewritten through a bracket
// that is not the class boundary.
func regexpClassShorthandRepair(
  shorthand string,
  spellings ...string,
) func(regexpLiteralParts) regexpRepair {
  return func(parts regexpLiteralParts) regexpRepair {
    var edits []TextEdit
    walkRegexpCharacterClassSpans(parts.pattern, func(span regexpClassSpan) bool {
      for _, spelling := range spellings {
        if span.content != spelling {
          continue
        }
        edits = append(edits, TextEdit{
          Pos:  parts.patternOffset() + span.start,
          End:  parts.patternOffset() + span.end,
          Text: shorthand,
        })
        break
      }
      return false
    })
    return regexpRepair{fix: edits}
  }
}

func classHasRange(content string) bool {
  for i := 1; i+1 < len(content); i++ {
    if content[i] == '\\' {
      i++
      continue
    }
    if content[i] == '-' {
      return true
    }
  }
  return false
}

// regexpCaseFoldScanLimit bounds the fold scan of a single character range.
// The scan exists to prove a range case-*invariant*, so refusing to walk an
// unbounded one costs at most a missed report, never a wrong one. Every script
// block that carries cased letters is orders of magnitude narrower than this.
const regexpCaseFoldScanLimit = 0x20000

// regexpNodeIsCaseVariant reports whether toggling the `i` flag can change what
// the node matches.
//
// Mirrors eslint-plugin-regexp's `isCaseVariant(pattern, flags, false)`, which
// judges a character class element by element rather than as a whole set: an
// element that the flag widens keeps the flag alive even when the class already
// spells both cases out, so `/[a-zA-Z]/i` is case-variant.
//
// The analysis is one-sided. Every construct it cannot settle from the AST --
// a Unicode property escape, a `v`-mode set-notation class, a range too wide to
// fold-scan, an unmodeled node -- counts as case-variant, so the rule stays
// quiet rather than order a load-bearing flag deleted. Backreferences are
// case-variant for a real reason and not merely out of caution: `i` makes the
// backreference comparison itself case-insensitive, so `/(.)\1/i` matches "aA"
// while `/(.)\1/` does not, without a single letter in the source.
func regexpNodeIsCaseVariant(node regexNode, unicodeMode bool) bool {
  switch n := node.(type) {
  case nil:
    return false
  case *regexCharNode:
    return regexpCharIsCaseVariant(n, unicodeMode)
  case *regexClassRangeNode:
    return regexpClassRangeIsCaseVariant(n, unicodeMode)
  case *regexClassNode:
    for _, expression := range n.Expressions {
      if regexpNodeIsCaseVariant(expression, unicodeMode) {
        return true
      }
    }
    return false
  case *regexAlternativeNode:
    for _, expression := range n.Expressions {
      if regexpNodeIsCaseVariant(expression, unicodeMode) {
        return true
      }
    }
    return false
  case *regexDisjunctionNode:
    return regexpNodeIsCaseVariant(n.Left, unicodeMode) ||
      regexpNodeIsCaseVariant(n.Right, unicodeMode)
  case *regexGroupNode:
    // A group name is never matched against the input, so `/(?<year>\d{4})/i`
    // stays case-invariant despite the letters in `year`.
    return regexpNodeIsCaseVariant(n.Expression, unicodeMode)
  case *regexRepetitionNode:
    return regexpNodeIsCaseVariant(n.Expression, unicodeMode)
  case *regexAssertionNode:
    switch n.Kind {
    case "^", "$":
      return false
    case "\\b", "\\B":
      // Word boundaries are defined in terms of `\w`, which grows by U+017F and
      // U+212A under `iu`/`iv`.
      return unicodeMode
    }
    return regexpNodeIsCaseVariant(n.Assertion, unicodeMode)
  case *regexBackreferenceNode:
    // `i` canonicalizes the backreference comparison itself.
    return true
  case *regexUnicodePropertyNode:
    // Whether `\p{...}` is closed under case folding needs the Unicode property
    // tables, not the source text: `\p{Lu}` moves under `i`, `\p{Nd}` does not.
    return true
  case *regexClassSetNode:
    // A `v`-mode set-notation class is kept verbatim by the parser, so its
    // members are not available to judge.
    return true
  }
  // An unmodeled node keeps the flag: silence beats a wrong deletion.
  return true
}

// regexpCharIsCaseVariant reports whether the `i` flag widens what a single
// character node matches.
func regexpCharIsCaseVariant(char *regexCharNode, unicodeMode bool) bool {
  if !char.codePointIsNaN() {
    return regexpRuneIsCaseVariant(rune(char.CodePoint))
  }
  switch char.Kind {
  case "meta":
    switch char.Value {
    case "\\w", "\\W":
      // `\w` is the one character set the flag moves: in Unicode mode
      // Canonicalize folds U+017F and U+212A onto `s` and `k`, so they join the
      // word characters (and leave `\W`).
      return unicodeMode
    case "\\d", "\\D", "\\s", "\\S", ".", "\\b":
      return false
    }
  case "decimal":
    // Annex B `\8` and `\9` match the bare digits.
    return false
  case "control":
    // `\cX` is a control code point, but a dangling `\c` matches the two
    // characters `\` and `c`, and that `c` re-cases.
    return char.Value == "\\c"
  }
  return true
}

// regexpClassRangeIsCaseVariant reports whether the `i` flag widens a character
// class range. A range is case-variant as soon as it contains one code point
// with a case-folded counterpart, because that counterpart may sit outside the
// range.
func regexpClassRangeIsCaseVariant(node *regexClassRangeNode, unicodeMode bool) bool {
  if node.From == nil || node.To == nil {
    return true
  }
  if node.From.codePointIsNaN() || node.To.codePointIsNaN() {
    // Annex B reads `[\d-z]` as three independent members while the AST still
    // models it as a range, so judge the two ends on their own.
    return regexpCharIsCaseVariant(node.From, unicodeMode) ||
      regexpCharIsCaseVariant(node.To, unicodeMode)
  }
  low, high := rune(node.From.CodePoint), rune(node.To.CodePoint)
  if low > high || high-low >= regexpCaseFoldScanLimit {
    return true
  }
  for r := low; r <= high; r++ {
    if regexpRuneIsCaseVariant(r) {
      return true
    }
  }
  return false
}

// regexpRuneIsCaseVariant reports whether a code point has any case-folded
// counterpart.
//
// unicode.SimpleFold walks the simple case-folding orbit, which is exactly the
// equivalence class ECMAScript's Canonicalize builds in `u`/`v` mode. Legacy
// mode canonicalizes more narrowly -- it keeps U+017F, U+212A and U+00DF apart
// from their ASCII or uppercase partners -- so there the orbit is a superset,
// and the rule at worst keeps quiet about a flag it could have reported.
func regexpRuneIsCaseVariant(r rune) bool {
  return unicode.SimpleFold(r) != r
}

// regexpNodeHasLineAnchor reports whether the pattern contains a `^` or `$`
// assertion, the only thing the `m` flag re-defines. Character classes are not
// descended into: `^` and `$` are literal characters in there.
func regexpNodeHasLineAnchor(node regexNode) bool {
  switch n := node.(type) {
  case *regexAssertionNode:
    if n.Kind == "^" || n.Kind == "$" {
      return true
    }
    return regexpNodeHasLineAnchor(n.Assertion)
  case *regexAlternativeNode:
    for _, expression := range n.Expressions {
      if regexpNodeHasLineAnchor(expression) {
        return true
      }
    }
    return false
  case *regexDisjunctionNode:
    return regexpNodeHasLineAnchor(n.Left) || regexpNodeHasLineAnchor(n.Right)
  case *regexGroupNode:
    return regexpNodeHasLineAnchor(n.Expression)
  case *regexRepetitionNode:
    return regexpNodeHasLineAnchor(n.Expression)
  }
  return false
}

func init() {
  Register(regexpSourceRule{name: "regexp/no-control-character", check: func(parts regexpLiteralParts) bool {
    return regexContainsControl(parts.raw)
  }})
  Register(regexpSourceRule{name: "regexp/no-dupe-characters-character-class", check: regexpHasDuplicateClassCharacter})
  Register(regexpSourceRule{name: "regexp/no-empty-alternative", check: regexpHasEmptyAlternative})
  Register(regexpSourceRule{name: "regexp/no-empty-capturing-group", check: regexpHasEmptyCapturingGroup})
  Register(regexpSourceRule{name: "regexp/no-empty-character-class", check: regexpHasEmptyCharacterClass})
  Register(regexpSourceRule{name: "regexp/no-empty-group", check: regexpHasEmptyGroup})
  Register(regexpSourceRule{name: "regexp/no-empty-lookarounds-assertion", check: regexpHasEmptyLookaround})
  Register(regexpSourceRule{name: "regexp/no-misleading-unicode-character", check: func(parts regexpLiteralParts) bool {
    return regexHasSurrogatePair(parts.raw)
  }})
  Register(regexpSourceRule{name: "regexp/no-useless-character-class", check: regexpHasUselessCharacterClass})
  Register(regexpNoUselessEscapeAlias{})
  Register(regexpSourceRule{
    name:   "regexp/no-useless-flag",
    check:  regexpHasUselessFlag,
    repair: regexpUselessFlagRepair,
  })
  Register(regexpSourceRule{
    name:   "regexp/no-useless-quantifier",
    check:  regexpQuantifierCheck(regexpQuantifierIsUseless),
    repair: regexpQuantifierRepair(regexpQuantifierIsUseless, regexpQuantifierDrop),
  })
  Register(regexpSourceRule{
    name:   "regexp/no-useless-two-nums-quantifier",
    check:  regexpQuantifierCheck(regexpQuantifierIsTwoNums),
    repair: regexpQuantifierRepair(regexpQuantifierIsTwoNums, regexpQuantifierExactCount),
  })
  // `regexp/no-zero-quantifier` stays diagnostic-only: `{0}` says the atom
  // never matches, so the correction is to delete the atom or repair the
  // bound, and the rule computes neither.
  Register(regexpSourceRule{
    name:  "regexp/no-zero-quantifier",
    check: regexpQuantifierCheck(regexpQuantifierIsZero),
  })
  Register(regexpSourceRule{
    name:   "regexp/prefer-d",
    check:  regexpHasPreferD,
    repair: regexpClassShorthandRepair("\\d", "0-9"),
  })
  Register(regexpSourceRule{
    name:   "regexp/prefer-plus-quantifier",
    check:  regexpQuantifierCheck(regexpQuantifierIsPlus),
    repair: regexpQuantifierRepair(regexpQuantifierIsPlus, regexpQuantifierSymbol("+")),
  })
  Register(regexpSourceRule{
    name:   "regexp/prefer-question-quantifier",
    check:  regexpQuantifierCheck(regexpQuantifierIsQuestion),
    repair: regexpQuantifierRepair(regexpQuantifierIsQuestion, regexpQuantifierSymbol("?")),
  })
  Register(regexpSourceRule{
    name:   "regexp/prefer-star-quantifier",
    check:  regexpQuantifierCheck(regexpQuantifierIsStar),
    repair: regexpQuantifierRepair(regexpQuantifierIsStar, regexpQuantifierSymbol("*")),
  })
  Register(regexpSourceRule{
    name:   "regexp/prefer-w",
    check:  regexpHasPreferW,
    repair: regexpClassShorthandRepair("\\w", "A-Za-z0-9_", "a-zA-Z0-9_"),
  })
  Register(regexpSourceRule{
    name:   "regexp/require-unicode-regexp",
    check:  regexpNeedsUnicodeFlag,
    repair: regexpUnicodeFlagRepair,
  })
  Register(regexpSourceRule{
    name:   "regexp/require-unicode-sets-regexp",
    check:  regexpNeedsUnicodeSetsFlag,
    repair: regexpUnicodeSetsFlagRepair,
  })
  Register(regexpSourceRule{
    name:   "regexp/sort-flags",
    check:  regexpFlagsUnsorted,
    repair: regexpSortFlagsRepair,
  })
}
