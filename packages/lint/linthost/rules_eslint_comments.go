package linthost

import (
  "encoding/json"
  "sort"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

const (
  eslintCommentsDisableEnablePair   = "eslint-comments/disable-enable-pair"
  eslintCommentsNoAggregatingEnable = "eslint-comments/no-aggregating-enable"
  eslintCommentsNoDuplicateDisable  = "eslint-comments/no-duplicate-disable"
  eslintCommentsNoRestrictedDisable = "eslint-comments/no-restricted-disable"
  eslintCommentsNoUnlimitedDisable  = "eslint-comments/no-unlimited-disable"
  eslintCommentsNoUnusedDisable     = "eslint-comments/no-unused-disable"
  eslintCommentsNoUnusedEnable      = "eslint-comments/no-unused-enable"
  eslintCommentsNoUse               = "eslint-comments/no-use"
  eslintCommentsRequireDescription  = "eslint-comments/require-description"
)

var eslintCommentRuleNames = []string{
  eslintCommentsDisableEnablePair,
  eslintCommentsNoAggregatingEnable,
  eslintCommentsNoDuplicateDisable,
  eslintCommentsNoRestrictedDisable,
  eslintCommentsNoUnlimitedDisable,
  eslintCommentsNoUnusedDisable,
  eslintCommentsNoUnusedEnable,
  eslintCommentsNoUse,
  eslintCommentsRequireDescription,
}

func init() {
  for _, name := range eslintCommentRuleNames {
    Register(eslintCommentDirectiveRule{name: name})
  }
}

type eslintCommentDirectiveRule struct{ name string }

func (r eslintCommentDirectiveRule) Name() string { return r.name }
func (r eslintCommentDirectiveRule) Visits() []shimast.Kind {
  return nil
}
func (r eslintCommentDirectiveRule) Check(*Context, *shimast.Node) {}

func collectEslintCommentFindings(
  file *shimast.SourceFile,
  rawFindings []*Finding,
  directives *lintInlineDirectives,
  fileRules RuleConfig,
  resolver RuleResolver,
) []*Finding {
  if file == nil || directives.empty() {
    return nil
  }
  ctx := eslintCommentContext{
    file:       file,
    directives: directives,
    rules:      fileRules,
    resolver:   resolver,
  }
  usedDisables := ctx.usedDisableDirectives(rawFindings)
  var findings []*Finding
  ctx.noUse(&findings)
  ctx.requireDescription(&findings)
  ctx.noUnlimitedDisable(&findings)
  ctx.noRestrictedDisable(&findings)
  ctx.disableEnablePair(&findings)
  ctx.replayDirectiveState(&findings)
  ctx.noUnusedDisable(&findings, usedDisables)
  return findings
}

type eslintCommentContext struct {
  file       *shimast.SourceFile
  directives *lintInlineDirectives
  rules      RuleConfig
  resolver   RuleResolver
}

func (c eslintCommentContext) severity(name string) Severity {
  return c.rules.Severity(name)
}

func (c eslintCommentContext) report(findings *[]*Finding, name string, rec lintDirectiveRecord, message string) {
  severity := c.severity(name)
  if severity == SeverityOff {
    return
  }
  *findings = append(*findings, &Finding{
    Rule:     name,
    Severity: severity,
    File:     c.file,
    Pos:      rec.pos,
    End:      rec.end,
    Message:  message,
  })
}

func (c eslintCommentContext) noUse(findings *[]*Finding) {
  if c.severity(eslintCommentsNoUse) == SeverityOff {
    return
  }
  allow := parseNoUseAllow(c.resolver.RuleOptions(eslintCommentsNoUse))
  for _, rec := range c.directives.records {
    if _, ok := allow[rec.marker]; ok {
      continue
    }
    c.report(findings, eslintCommentsNoUse, rec, "ESLint directive comments are not allowed.")
  }
}

func (c eslintCommentContext) requireDescription(findings *[]*Finding) {
  if c.severity(eslintCommentsRequireDescription) == SeverityOff {
    return
  }
  for _, rec := range c.directives.records {
    if rec.hasDescription && strings.TrimSpace(rec.description) != "" {
      continue
    }
    c.report(findings, eslintCommentsRequireDescription, rec, "ESLint directive comments must include a description.")
  }
}

func (c eslintCommentContext) noUnlimitedDisable(findings *[]*Finding) {
  if c.severity(eslintCommentsNoUnlimitedDisable) == SeverityOff {
    return
  }
  for _, rec := range c.directives.records {
    if !isDisableDirective(rec.kind) || !rec.rules.all {
      continue
    }
    c.report(findings, eslintCommentsNoUnlimitedDisable, rec, "Unexpected unlimited eslint-disable directive.")
  }
}

func (c eslintCommentContext) noRestrictedDisable(findings *[]*Finding) {
  if c.severity(eslintCommentsNoRestrictedDisable) == SeverityOff {
    return
  }
  restricted := parseRestrictedDisableRules(c.resolver.RuleOptions(eslintCommentsNoRestrictedDisable))
  if len(restricted) == 0 {
    return
  }
  for _, rec := range c.directives.records {
    if !isDisableDirective(rec.kind) {
      continue
    }
    if rec.rules.all {
      c.report(findings, eslintCommentsNoRestrictedDisable, rec, "Unexpected eslint-disable directive for restricted rules.")
      continue
    }
    for _, rule := range uniqueRuleList(rec.ruleList) {
      if _, ok := restricted[rule]; ok {
        c.report(findings, eslintCommentsNoRestrictedDisable, rec, "Unexpected eslint-disable directive for restricted rule "+rule+".")
        break
      }
    }
  }
}

func (c eslintCommentContext) disableEnablePair(findings *[]*Finding) {
  if c.severity(eslintCommentsDisableEnablePair) == SeverityOff {
    return
  }
  allowWholeFile := parseDisableEnablePairOptions(c.resolver.RuleOptions(eslintCommentsDisableEnablePair)).AllowWholeFile
  for i, rec := range c.directives.records {
    if rec.kind != lintDirectiveDisable {
      continue
    }
    if allowWholeFile && c.isBeforeFirstStatement(rec) {
      continue
    }
    if !hasMatchingEnable(c.directives.records[i+1:], rec) {
      c.report(findings, eslintCommentsDisableEnablePair, rec, "eslint-disable directives must be paired with eslint-enable.")
    }
  }
}

func (c eslintCommentContext) isBeforeFirstStatement(rec lintDirectiveRecord) bool {
  if c.file == nil || c.file.Statements == nil || len(c.file.Statements.Nodes) == 0 {
    return true
  }
  return rec.pos <= c.file.Statements.Nodes[0].Pos()
}

func (c eslintCommentContext) replayDirectiveState(findings *[]*Finding) {
  var state activeDirectiveState
  lineState := map[int]*activeDirectiveState{}
  for _, rec := range c.directives.records {
    switch rec.kind {
    case lintDirectiveDisable:
      if state.isDuplicateDisable(rec) || hasDuplicateRuleToken(rec.ruleList) {
        c.reportOnce(findings, eslintCommentsNoDuplicateDisable, rec, "Duplicate eslint-disable directive.")
      }
      state.applyDisable(rec)
    case lintDirectiveEnable:
      if rec.rules.all && state.hasNamedActive() && !state.hasAllActive() {
        c.report(findings, eslintCommentsNoAggregatingEnable, rec, "eslint-enable should list the rules it enables.")
      }
      if !state.enableWouldChange(rec) {
        c.report(findings, eslintCommentsNoUnusedEnable, rec, "Unused eslint-enable directive.")
      }
      state.applyEnable(rec)
    case lintDirectiveDisableLine, lintDirectiveDisableNextLine:
      st := lineState[rec.targetLine]
      if st == nil {
        st = &activeDirectiveState{}
        lineState[rec.targetLine] = st
      }
      if state.isDuplicateDisable(rec) || st.isDuplicateDisable(rec) || hasDuplicateRuleToken(rec.ruleList) {
        c.reportOnce(findings, eslintCommentsNoDuplicateDisable, rec, "Duplicate eslint-disable directive.")
      }
      st.applyDisable(rec)
    }
  }
}

func (c eslintCommentContext) reportOnce(findings *[]*Finding, name string, rec lintDirectiveRecord, message string) {
  if c.severity(name) == SeverityOff {
    return
  }
  c.report(findings, name, rec, message)
}

func (c eslintCommentContext) noUnusedDisable(findings *[]*Finding, used map[int]struct{}) {
  if c.severity(eslintCommentsNoUnusedDisable) == SeverityOff {
    return
  }
  for _, rec := range c.directives.records {
    if !isDisableDirective(rec.kind) {
      continue
    }
    if _, ok := used[rec.id]; ok {
      continue
    }
    c.report(findings, eslintCommentsNoUnusedDisable, rec, "Unused eslint-disable directive.")
  }
}

func (c eslintCommentContext) usedDisableDirectives(rawFindings []*Finding) map[int]struct{} {
  used := map[int]struct{}{}
  findings := make([]*Finding, 0, len(rawFindings))
  for _, finding := range rawFindings {
    if finding == nil || strings.HasPrefix(finding.Rule, "eslint-comments/") {
      continue
    }
    findings = append(findings, finding)
  }
  sort.SliceStable(findings, func(i, j int) bool { return findings[i].Pos < findings[j].Pos })

  var state activeDirectiveState
  eventIdx := 0
  for _, finding := range findings {
    for eventIdx < len(c.directives.events) && c.directives.events[eventIdx].pos <= finding.Pos {
      event := c.directives.events[eventIdx]
      rec := c.directives.records[event.id]
      if event.on {
        state.applyDisable(rec)
      } else {
        state.applyEnable(rec)
      }
      eventIdx++
    }
    rangeIDs := state.matchingDisableIDs(finding.Rule)
    if len(rangeIDs) > 0 {
      for _, id := range rangeIDs {
        used[id] = struct{}{}
      }
      continue
    }

    line := lineOfPosition(c.file, finding.Pos)
    for _, id := range c.directives.lineRecords[line] {
      rec := c.directives.records[id]
      if rec.rules.matches(finding.Rule) {
        used[id] = struct{}{}
      }
    }
  }
  return used
}

type activeDirectiveState struct {
  allIDs       []int
  ruleIDs      map[string][]int
  enabledInAll map[string]struct{}
}

func (s *activeDirectiveState) applyDisable(rec lintDirectiveRecord) {
  if rec.rules.all {
    s.allIDs = append(s.allIDs, rec.id)
    s.enabledInAll = nil
    return
  }
  if s.ruleIDs == nil {
    s.ruleIDs = make(map[string][]int, len(rec.rules.rules))
  }
  for rule := range rec.rules.rules {
    s.ruleIDs[rule] = append(s.ruleIDs[rule], rec.id)
    delete(s.enabledInAll, rule)
  }
}

func (s *activeDirectiveState) applyEnable(rec lintDirectiveRecord) {
  if rec.rules.all {
    s.allIDs = nil
    s.ruleIDs = nil
    s.enabledInAll = nil
    return
  }
  for rule := range rec.rules.rules {
    delete(s.ruleIDs, rule)
    if len(s.allIDs) > 0 {
      if s.enabledInAll == nil {
        s.enabledInAll = make(map[string]struct{}, len(rec.rules.rules))
      }
      s.enabledInAll[rule] = struct{}{}
    }
  }
}

func (s activeDirectiveState) isDuplicateDisable(rec lintDirectiveRecord) bool {
  if rec.rules.all {
    return len(s.allIDs) > 0
  }
  for rule := range rec.rules.rules {
    if len(s.ruleIDs[rule]) > 0 {
      return true
    }
    if len(s.allIDs) > 0 {
      if _, enabled := s.enabledInAll[rule]; !enabled {
        return true
      }
    }
  }
  return false
}

func (s activeDirectiveState) enableWouldChange(rec lintDirectiveRecord) bool {
  if rec.rules.all {
    return len(s.allIDs) > 0 || len(s.ruleIDs) > 0
  }
  for rule := range rec.rules.rules {
    if len(s.ruleIDs[rule]) > 0 {
      return true
    }
    if len(s.allIDs) > 0 {
      if _, enabled := s.enabledInAll[rule]; !enabled {
        return true
      }
    }
  }
  return false
}

func (s activeDirectiveState) matchingDisableIDs(rule string) []int {
  normalized := normalizeDirectiveRuleName(rule)
  var ids []int
  ids = append(ids, s.ruleIDs[normalized]...)
  if len(s.allIDs) > 0 {
    if _, enabled := s.enabledInAll[normalized]; !enabled {
      ids = append(ids, s.allIDs...)
    }
  }
  return ids
}

func (s activeDirectiveState) hasNamedActive() bool {
  for _, ids := range s.ruleIDs {
    if len(ids) > 0 {
      return true
    }
  }
  return false
}

func (s activeDirectiveState) hasAllActive() bool {
  return len(s.allIDs) > 0
}

func hasMatchingEnable(later []lintDirectiveRecord, disable lintDirectiveRecord) bool {
  if disable.rules.all {
    for _, rec := range later {
      if rec.kind == lintDirectiveEnable && rec.rules.all {
        return true
      }
    }
    return false
  }
  remaining := make(map[string]struct{}, len(disable.rules.rules))
  for rule := range disable.rules.rules {
    remaining[rule] = struct{}{}
  }
  for _, rec := range later {
    if rec.kind != lintDirectiveEnable {
      continue
    }
    if rec.rules.all {
      return true
    }
    for rule := range rec.rules.rules {
      delete(remaining, rule)
    }
    if len(remaining) == 0 {
      return true
    }
  }
  return false
}

func isDisableDirective(kind lintDirectiveKind) bool {
  return kind == lintDirectiveDisable || kind == lintDirectiveDisableLine || kind == lintDirectiveDisableNextLine
}

func uniqueRuleList(ruleList []string) []string {
  seen := make(map[string]struct{}, len(ruleList))
  out := make([]string, 0, len(ruleList))
  for _, rule := range ruleList {
    if _, ok := seen[rule]; ok {
      continue
    }
    seen[rule] = struct{}{}
    out = append(out, rule)
  }
  return out
}

func hasDuplicateRuleToken(ruleList []string) bool {
  seen := make(map[string]struct{}, len(ruleList))
  for _, rule := range ruleList {
    if _, ok := seen[rule]; ok {
      return true
    }
    seen[rule] = struct{}{}
  }
  return false
}

func lineOfPosition(file *shimast.SourceFile, pos int) int {
  return shimscanner.GetECMALineOfPosition(file, pos)
}

type disableEnablePairOptions struct {
  AllowWholeFile bool `json:"allowWholeFile"`
}

func parseDisableEnablePairOptions(raw json.RawMessage) disableEnablePairOptions {
  var out disableEnablePairOptions
  if len(raw) > 0 {
    _ = json.Unmarshal(raw, &out)
  }
  return out
}

type noUseOptions struct {
  Allow []string `json:"allow"`
}

func parseNoUseAllow(raw json.RawMessage) map[string]struct{} {
  var opts noUseOptions
  if len(raw) > 0 {
    _ = json.Unmarshal(raw, &opts)
  }
  out := make(map[string]struct{}, len(opts.Allow))
  for _, marker := range opts.Allow {
    marker = strings.TrimSpace(marker)
    if marker != "" {
      out[marker] = struct{}{}
    }
  }
  return out
}

type restrictedDisableOptions struct {
  Rules []string `json:"rules"`
}

func parseRestrictedDisableRules(raw json.RawMessage) map[string]struct{} {
  if len(raw) == 0 {
    return nil
  }
  var rules []string
  if err := json.Unmarshal(raw, &rules); err != nil {
    var opts restrictedDisableOptions
    if err := json.Unmarshal(raw, &opts); err == nil {
      rules = opts.Rules
    }
  }
  out := make(map[string]struct{}, len(rules))
  for _, rule := range rules {
    if normalized := normalizeDirectiveRuleName(rule); normalized != "" {
      out[normalized] = struct{}{}
    }
  }
  return out
}
