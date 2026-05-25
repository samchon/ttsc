// Inline-disable directive parser and filter for the lint engine.
//
// Supports both `eslint-disable` and `lint-disable` comment families in
// four forms: `disable`, `enable`, `disable-line`, and
// `disable-next-line`. Rule lists are comma- or space-separated; an
// empty list disables all rules. The `--` description separator (ESLint
// convention) is also recognized and stripped before parsing rule names.
package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// lintDirectiveKind classifies the four comment forms the parser recognizes.
type lintDirectiveKind int

const (
  // lintDirectiveDisable activates suppression from the comment position until
  // a matching `enable` is seen (or end of file).
  lintDirectiveDisable lintDirectiveKind = iota
  // lintDirectiveEnable cancels a prior `disable` for the named rules (or all
  // rules when no rule list is given).
  lintDirectiveEnable
  // lintDirectiveDisableLine suppresses findings on the same source line as
  // the directive comment.
  lintDirectiveDisableLine
  // lintDirectiveDisableNextLine suppresses findings on the line immediately
  // following the directive comment.
  lintDirectiveDisableNextLine
)

// lintDirective is the parsed representation of one directive comment.
type lintDirective struct {
  kind  lintDirectiveKind
  rules lintDirectiveRules
}

// lintDirectiveRules holds the rule scope of a directive. When `all` is
// true the directive applies to every rule; otherwise only the named rules
// in `rules` are affected.
type lintDirectiveRules struct {
  all   bool
  rules map[string]struct{}
}

// lintDirectiveEvent is one enable/disable transition recorded in source
// order. `pos` is the byte offset of the comment. `on` is true for a
// disable event and false for an enable event.
type lintDirectiveEvent struct {
  pos   int
  rules lintDirectiveRules
  on    bool
}

// lintInlineDirectives accumulates the per-file directive information
// extracted by parseLintInlineDirectives. `lines` maps a zero-based line
// number to any disable-line / disable-next-line directives on that line.
// `events` is the ordered list of range-style disable/enable transitions.
type lintInlineDirectives struct {
  lines  map[int][]lintDirectiveRules
  events []lintDirectiveEvent
}

// lintDisableState tracks the cumulative suppress/allow state as
// lintDirectiveEvents are replayed in order up to a finding's position.
// `all` means every rule is suppressed. `rules` is the set of individually
// suppressed rules. `enabledInAll` is the set of rules that were
// re-enabled via `eslint-enable <rule>` while `all` was active.
type lintDisableState struct {
  all          bool
  rules        map[string]struct{}
  enabledInAll map[string]struct{}
}

func filterInlineDisabledFindings(file *shimast.SourceFile, findings []*Finding) []*Finding {
  if len(findings) == 0 || file == nil {
    return findings
  }
  directives := parseLintInlineDirectives(file)
  if directives.empty() {
    return findings
  }
  filtered := findings[:0]
  for _, finding := range findings {
    if finding == nil || !directives.suppresses(file, finding) {
      filtered = append(filtered, finding)
    }
  }
  return filtered
}

// parseLintInlineDirectives scans all comment tokens in `file` for
// recognized directive markers and returns a structured summary of the
// per-line and range-style suppressions found.
//
// The raw scanner does not split `KindTemplateExpression` on its own:
// after returning `KindTemplateHead`/`KindTemplateMiddle`, it resumes
// lexing the substitution as ordinary code, and a later `}` is reported
// as `KindCloseBraceToken` instead of re-entering the template body.
// Without intervention the next backtick would open a fresh template
// scan that swallows the rest of the file (including every disable
// directive comment) as one runaway unterminated literal. The parser
// avoids this by calling `ReScanTemplateToken` on the matching `}`;
// this loop mirrors that behavior with a brace-depth stack so comment
// positions stay aligned with the source bytes past any template
// substitution.
func parseLintInlineDirectives(file *shimast.SourceFile) *lintInlineDirectives {
  directives := &lintInlineDirectives{
    lines: make(map[int][]lintDirectiveRules),
  }
  scanner := shimscanner.NewScanner()
  scanner.SetText(file.Text())
  scanner.SetSkipTrivia(false)

  // templateBraceDepth tracks `{` nesting inside each open template
  // substitution. A zero on top means the next `}` matches the original
  // `${` and must be re-scanned as a template middle/tail token.
  var templateBraceDepth []int

scan:
  for {
    kind := scanner.Scan()
    switch kind {
    case shimast.KindEndOfFile:
      break scan
    case shimast.KindTemplateHead, shimast.KindTemplateMiddle:
      // Entering a `${...}` substitution; account for its closing `}`.
      templateBraceDepth = append(templateBraceDepth, 0)
      continue
    case shimast.KindOpenBraceToken:
      if n := len(templateBraceDepth); n > 0 {
        templateBraceDepth[n-1]++
      }
      continue
    case shimast.KindCloseBraceToken:
      n := len(templateBraceDepth)
      if n == 0 {
        continue
      }
      if templateBraceDepth[n-1] > 0 {
        templateBraceDepth[n-1]--
        continue
      }
      // Matching `}` for the original `${`. Pop the substitution and
      // rescan as template; a `KindTemplateMiddle` reopens a new
      // substitution, a `KindTemplateTail` closes the template literal.
      templateBraceDepth = templateBraceDepth[:n-1]
      rescanned := scanner.ReScanTemplateToken(false /*isTaggedTemplate*/)
      if rescanned == shimast.KindTemplateMiddle {
        templateBraceDepth = append(templateBraceDepth, 0)
      }
      continue
    case shimast.KindSingleLineCommentTrivia, shimast.KindMultiLineCommentTrivia:
    default:
      continue
    }
    directive, ok := parseLintDirectiveComment(scanner.TokenText())
    if !ok {
      continue
    }
    start := scanner.TokenStart()
    end := scanner.TokenEnd()
    startLine := shimscanner.GetECMALineOfPosition(file, start)
    endLine := startLine
    if end > start {
      endLine = shimscanner.GetECMALineOfPosition(file, end-1)
    }
    switch directive.kind {
    case lintDirectiveDisableLine:
      directives.lines[startLine] = append(directives.lines[startLine], directive.rules)
    case lintDirectiveDisableNextLine:
      directives.lines[endLine+1] = append(directives.lines[endLine+1], directive.rules)
    case lintDirectiveDisable:
      directives.events = append(directives.events, lintDirectiveEvent{
        pos:   start,
        rules: directive.rules,
        on:    true,
      })
    case lintDirectiveEnable:
      directives.events = append(directives.events, lintDirectiveEvent{
        pos:   start,
        rules: directive.rules,
        on:    false,
      })
    }
  }
  return directives
}

// empty reports whether no directives were found in the file, allowing the
// caller to skip the filtering step entirely.
func (d *lintInlineDirectives) empty() bool {
  return d == nil || (len(d.lines) == 0 && len(d.events) == 0)
}

// suppresses reports whether the directive set causes `finding` to be
// suppressed. It checks the per-line map first (disable-line and
// disable-next-line directives), then replays the ordered event list to
// compute the range-style disable/enable state at the finding's position.
func (d *lintInlineDirectives) suppresses(file *shimast.SourceFile, finding *Finding) bool {
  if d == nil || finding == nil || file == nil {
    return false
  }
  line := shimscanner.GetECMALineOfPosition(file, finding.Pos)
  for _, rules := range d.lines[line] {
    if rules.matches(finding.Rule) {
      return true
    }
  }
  var state lintDisableState
  for _, event := range d.events {
    if event.pos > finding.Pos {
      break
    }
    state.apply(event)
  }
  return state.matches(finding.Rule)
}

// apply updates the disable state by folding in one directive event.
// Disable events add rules; enable events remove them. When the event
// targets all rules (`event.rules.all`), the entire state is replaced
// rather than merged.
func (s *lintDisableState) apply(event lintDirectiveEvent) {
  if event.on {
    if event.rules.all {
      s.all = true
      s.enabledInAll = nil
      return
    }
    if s.rules == nil {
      s.rules = make(map[string]struct{}, len(event.rules.rules))
    }
    for rule := range event.rules.rules {
      s.rules[rule] = struct{}{}
      delete(s.enabledInAll, rule)
    }
    return
  }

  if event.rules.all {
    s.all = false
    s.rules = nil
    s.enabledInAll = nil
    return
  }
  for rule := range event.rules.rules {
    delete(s.rules, rule)
    if s.all {
      if s.enabledInAll == nil {
        s.enabledInAll = make(map[string]struct{}, len(event.rules.rules))
      }
      s.enabledInAll[rule] = struct{}{}
    }
  }
}

// matches reports whether `rule` is currently suppressed given this state.
// The name is normalized before lookup so that `@typescript-eslint/` prefixes
// do not prevent a match.
func (s lintDisableState) matches(rule string) bool {
  normalized := normalizeDirectiveRuleName(rule)
  if _, ok := s.rules[normalized]; ok {
    return true
  }
  if !s.all {
    return false
  }
  _, enabled := s.enabledInAll[normalized]
  return !enabled
}

// matches reports whether this rule-set covers `rule`. Returns true when the
// directive targeted all rules or when `rule` (normalized) appears in the
// named set.
func (r lintDirectiveRules) matches(rule string) bool {
  if r.all {
    return true
  }
  _, ok := r.rules[normalizeDirectiveRuleName(rule)]
  return ok
}

// parseLintDirectiveComment strips comment delimiters from `raw` and
// delegates to parseLintDirectiveLine. Returns (zero, false) when the
// comment does not contain a recognized directive marker.
func parseLintDirectiveComment(raw string) (lintDirective, bool) {
  text := stripCommentDelimiters(raw)
  if directive, ok := parseLintDirectiveLine(text); ok {
    return directive, true
  }
  return lintDirective{}, false
}

// stripCommentDelimiters removes `//` and `/* … */` syntax from `raw` and
// returns the trimmed inner text. Handles JSDoc-style `* ` prefix on the
// first content line.
func stripCommentDelimiters(raw string) string {
  switch {
  case strings.HasPrefix(raw, "//"):
    return strings.TrimSpace(raw[2:])
  case strings.HasPrefix(raw, "/*"):
    text := raw[2:]
    if strings.HasSuffix(text, "*/") {
      text = text[:len(text)-2]
    }
    text = strings.TrimSpace(text)
    if strings.HasPrefix(text, "*") {
      text = strings.TrimSpace(text[1:])
    }
    return text
  default:
    return strings.TrimSpace(raw)
  }
}

// parseLintDirectiveLine matches `text` against all recognized directive
// markers in declaration order (longest suffix first to avoid prefix
// ambiguity). Returns the first match found or (zero, false) if none match.
func parseLintDirectiveLine(text string) (lintDirective, bool) {
  for _, prefix := range []string{"eslint", "lint"} {
    for _, form := range []struct {
      suffix string
      kind   lintDirectiveKind
    }{
      {"disable-next-line", lintDirectiveDisableNextLine},
      {"disable-line", lintDirectiveDisableLine},
      {"disable", lintDirectiveDisable},
      {"enable", lintDirectiveEnable},
    } {
      marker := prefix + "-" + form.suffix
      payload, ok := directivePayload(text, marker)
      if !ok {
        continue
      }
      return lintDirective{
        kind:  form.kind,
        rules: parseDirectiveRules(payload),
      }, true
    }
  }
  return lintDirective{}, false
}

// directivePayload returns the text after `marker` in `text` when `text`
// starts with `marker` followed by whitespace or end of string. The
// returned payload is trimmed of leading/trailing whitespace.
func directivePayload(text, marker string) (string, bool) {
  if !strings.HasPrefix(text, marker) {
    return "", false
  }
  rest := text[len(marker):]
  if rest != "" && rest[0] != ' ' && rest[0] != '\t' && rest[0] != '\r' && rest[0] != '\n' {
    return "", false
  }
  return strings.TrimSpace(rest), true
}

// parseDirectiveRules converts the payload (the text after the directive
// marker) into a lintDirectiveRules value. The `--` separator strips an
// optional human-readable description. An empty rule list means "all rules".
func parseDirectiveRules(payload string) lintDirectiveRules {
  payload = stripDirectiveDescription(payload)
  payload = strings.ReplaceAll(payload, ",", " ")
  fields := strings.Fields(payload)
  rules := make(map[string]struct{}, len(fields))
  for _, field := range fields {
    if strings.HasPrefix(field, "--") {
      break
    }
    name := normalizeDirectiveRuleName(field)
    if name != "" {
      rules[name] = struct{}{}
    }
  }
  if len(rules) == 0 {
    return lintDirectiveRules{all: true}
  }
  return lintDirectiveRules{rules: rules}
}

// stripDirectiveDescription returns the portion of `payload` before the
// first ` -- ` token (ESLint's description separator). The separator must
// be surrounded by whitespace or be at a string boundary to avoid
// stripping `--` from rule names like `no--foo`.
func stripDirectiveDescription(payload string) string {
  for i := 0; i < len(payload)-1; i++ {
    if payload[i] != '-' || payload[i+1] != '-' {
      continue
    }
    prevOK := i == 0 || payload[i-1] == ' ' || payload[i-1] == '\t'
    next := i + 2
    nextOK := next >= len(payload) || payload[next] == ' ' || payload[next] == '\t'
    if prevOK && nextOK {
      return strings.TrimSpace(payload[:i])
    }
  }
  return payload
}

// normalizeDirectiveRuleName strips common ESLint namespace prefixes while
// preserving the kebab/slash rule IDs diagnostics use.
func normalizeDirectiveRuleName(name string) string {
  return normalizeBuiltinRuleName(name)
}
