package main

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

type lintDirectiveKind int

const (
  lintDirectiveDisable lintDirectiveKind = iota
  lintDirectiveEnable
  lintDirectiveDisableLine
  lintDirectiveDisableNextLine
)

type lintDirective struct {
  kind  lintDirectiveKind
  rules lintDirectiveRules
}

type lintDirectiveRules struct {
  all   bool
  rules map[string]struct{}
}

type lintDirectiveEvent struct {
  pos   int
  rules lintDirectiveRules
  on    bool
}

type lintInlineDirectives struct {
  lines  map[int][]lintDirectiveRules
  events []lintDirectiveEvent
}

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

func parseLintInlineDirectives(file *shimast.SourceFile) *lintInlineDirectives {
  directives := &lintInlineDirectives{
    lines: make(map[int][]lintDirectiveRules),
  }
  scanner := shimscanner.NewScanner()
  scanner.SetText(file.Text())
  scanner.SetSkipTrivia(false)

scan:
  for {
    kind := scanner.Scan()
    switch kind {
    case shimast.KindEndOfFile:
      break scan
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

func (d *lintInlineDirectives) empty() bool {
  return d == nil || (len(d.lines) == 0 && len(d.events) == 0)
}

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

func (r lintDirectiveRules) matches(rule string) bool {
  if r.all {
    return true
  }
  _, ok := r.rules[normalizeDirectiveRuleName(rule)]
  return ok
}

func parseLintDirectiveComment(raw string) (lintDirective, bool) {
  text := stripCommentDelimiters(raw)
  if directive, ok := parseLintDirectiveLine(text); ok {
    return directive, true
  }
  return lintDirective{}, false
}

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

func normalizeDirectiveRuleName(name string) string {
  name = strings.TrimSpace(name)
  name = strings.TrimPrefix(name, "@typescript-eslint/")
  name = strings.TrimPrefix(name, "typescript-eslint/")
  name = strings.TrimPrefix(name, "eslint/")
  return name
}
