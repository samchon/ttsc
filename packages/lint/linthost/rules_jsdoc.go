package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type jsdocLintRule struct {
  name  string
  check func(*Context, string, parsedJSDocBlock)
}

func (r jsdocLintRule) Name() string { return r.name }
func (r jsdocLintRule) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}

func (r jsdocLintRule) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || r.check == nil || !isTypeScriptSourceName(ctx.File.FileName()) {
    return
  }
  src := ctx.File.Text()
  for _, block := range findJSDocBlocks(src) {
    r.check(ctx, src, parseJSDocBlock(src, block))
  }
}

type parsedJSDocBlock struct {
  block          jsdocBlock
  hasDescription bool
  tags           []parsedJSDocTag
}

type parsedJSDocTag struct {
  name         string
  lowerName    string
  tagStart     int
  tagEnd       int
  contentStart int
  contentEnd   int
  content      string
}

var knownJSDocTags = map[string]struct{}{
  "abstract":        {},
  "access":          {},
  "alias":           {},
  "alpha":           {},
  "arg":             {},
  "argument":        {},
  "async":           {},
  "augments":        {},
  "author":          {},
  "beta":            {},
  "borrows":         {},
  "callback":        {},
  "category":        {},
  "class":           {},
  "classdesc":       {},
  "constant":        {},
  "constructor":     {},
  "constructs":      {},
  "copyright":       {},
  "default":         {},
  "defaultvalue":    {},
  "deprecated":      {},
  "description":     {},
  "enum":            {},
  "event":           {},
  "eventproperty":   {},
  "example":         {},
  "exception":       {},
  "exports":         {},
  "extends":         {},
  "external":        {},
  "file":            {},
  "fileoverview":    {},
  "fires":           {},
  "function":        {},
  "generator":       {},
  "global":          {},
  "hideconstructor": {},
  "host":            {},
  "ignore":          {},
  "implements":      {},
  "inheritdoc":      {},
  "inheritDoc":      {},
  "inner":           {},
  "instance":        {},
  "interface":       {},
  "internal":        {},
  "kind":            {},
  "label":           {},
  "lends":           {},
  "license":         {},
  "link":            {},
  "listens":         {},
  "member":          {},
  "memberof":        {},
  "method":          {},
  "mixes":           {},
  "mixin":           {},
  "module":          {},
  "name":            {},
  "namespace":       {},
  "override":        {},
  "package":         {},
  "param":           {},
  "private":         {},
  "privateRemarks":  {},
  "privateremarks":  {},
  "prop":            {},
  "property":        {},
  "protected":       {},
  "public":          {},
  "readonly":        {},
  "remarks":         {},
  "requires":        {},
  "return":          {},
  "returns":         {},
  "satisfies":       {},
  "sealed":          {},
  "see":             {},
  "since":           {},
  "static":          {},
  "summary":         {},
  "template":        {},
  "this":            {},
  "throws":          {},
  "todo":            {},
  "tutorial":        {},
  "type":            {},
  "typedef":         {},
  "variation":       {},
  "version":         {},
  "virtual":         {},
  "yield":           {},
  "yields":          {},
}

var jsdocTagsWithType = map[string]struct{}{
  "arg":       {},
  "argument":  {},
  "callback":  {},
  "enum":      {},
  "exception": {},
  "param":     {},
  "prop":      {},
  "property":  {},
  "return":    {},
  "returns":   {},
  "throws":    {},
  "type":      {},
  "typedef":   {},
  "yield":     {},
  "yields":    {},
}

var emptyJSDocTags = map[string]struct{}{
  "abstract":        {},
  "async":           {},
  "generator":       {},
  "global":          {},
  "hideconstructor": {},
  "ignore":          {},
  "inheritdoc":      {},
  "inner":           {},
  "instance":        {},
  "override":        {},
  "readonly":        {},
  "static":          {},
  "virtual":         {},
}

func isTypeScriptSourceName(name string) bool {
  name = strings.ToLower(name)
  return strings.HasSuffix(name, ".ts") ||
    strings.HasSuffix(name, ".tsx") ||
    strings.HasSuffix(name, ".mts") ||
    strings.HasSuffix(name, ".cts")
}

func parseJSDocBlock(src string, block jsdocBlock) parsedJSDocBlock {
  parsed := parsedJSDocBlock{block: block}
  previousTag := -1
  for lineStart := block.bodyStart; lineStart < block.bodyEnd; {
    lineEnd := lineStart
    for lineEnd < block.bodyEnd && src[lineEnd] != '\n' {
      lineEnd++
    }
    contentStart := jsdocLineContentStart(src, lineStart, lineEnd)
    trimmed := strings.TrimSpace(src[contentStart:lineEnd])
    if trimmed != "" {
      if src[contentStart] == '@' {
        tagStart := contentStart
        tagEnd := tagStart + 1
        for tagEnd < lineEnd && isJSDocTagNamePart(src[tagEnd]) {
          tagEnd++
        }
        if tagEnd > tagStart+1 {
          bodyStart := tagEnd
          for bodyStart < lineEnd && (src[bodyStart] == ' ' || src[bodyStart] == '\t') {
            bodyStart++
          }
          name := src[tagStart+1 : tagEnd]
          lowerName := strings.ToLower(name)
          if name == "inheritDoc" {
            lowerName = "inheritdoc"
          }
          if name == "privateRemarks" {
            lowerName = "privateremarks"
          }
          parsed.tags = append(parsed.tags, parsedJSDocTag{
            name:         name,
            lowerName:    lowerName,
            tagStart:     tagStart,
            tagEnd:       tagEnd,
            contentStart: bodyStart,
            contentEnd:   lineEnd,
            content:      strings.TrimSpace(src[bodyStart:lineEnd]),
          })
          previousTag = len(parsed.tags) - 1
        }
      } else if previousTag == -1 || parsed.tags[previousTag].lowerName == "description" {
        parsed.hasDescription = true
        if previousTag != -1 {
          parsed.tags[previousTag].contentEnd = lineEnd
          parsed.tags[previousTag].content = strings.TrimSpace(parsed.tags[previousTag].content + "\n" + src[contentStart:lineEnd])
        }
      } else {
        parsed.tags[previousTag].contentEnd = lineEnd
        parsed.tags[previousTag].content = strings.TrimSpace(parsed.tags[previousTag].content + "\n" + src[contentStart:lineEnd])
      }
    }
    if lineEnd >= block.bodyEnd {
      break
    }
    lineStart = lineEnd + 1
  }
  for _, tag := range parsed.tags {
    if tag.lowerName == "description" && strings.TrimSpace(tag.content) != "" {
      parsed.hasDescription = true
    }
  }
  return parsed
}

func jsdocLineContentStart(src string, start, end int) int {
  i := start
  for i < end && (src[i] == ' ' || src[i] == '\t' || src[i] == '\r') {
    i++
  }
  if i < end && src[i] == '*' {
    i++
    if i < end && (src[i] == ' ' || src[i] == '\t') {
      i++
    }
  }
  return i
}

func isJSDocTagNamePart(b byte) bool {
  return isJSDocTagByte(b) ||
    (b >= '0' && b <= '9') ||
    b == '-' ||
    b == '_'
}

func jsdocLeadingType(text string) (string, string) {
  rest := strings.TrimLeft(text, " \t")
  if !strings.HasPrefix(rest, "{") {
    return "", rest
  }
  depth := 0
  for i := 0; i < len(rest); i++ {
    switch rest[i] {
    case '{':
      depth++
    case '}':
      depth--
      if depth == 0 {
        return strings.TrimSpace(rest[1:i]), strings.TrimLeft(rest[i+1:], " \t")
      }
    }
  }
  return "", rest
}

func jsdocNameAndDescription(text string) (string, string) {
  _, rest := jsdocLeadingType(text)
  rest = strings.TrimSpace(rest)
  if rest == "" || strings.HasPrefix(rest, "-") {
    return "", strings.TrimSpace(strings.TrimPrefix(rest, "-"))
  }
  fields := strings.Fields(rest)
  if len(fields) == 0 {
    return "", ""
  }
  name := fields[0]
  desc := strings.TrimSpace(rest[len(name):])
  desc = strings.TrimSpace(strings.TrimPrefix(desc, "-"))
  return name, desc
}

func jsdocDescriptionAfterType(text string) string {
  _, rest := jsdocLeadingType(text)
  rest = strings.TrimSpace(rest)
  rest = strings.TrimSpace(strings.TrimPrefix(rest, "-"))
  return rest
}

func jsdocFirstWordAfterType(text string) string {
  _, rest := jsdocLeadingType(text)
  fields := strings.Fields(rest)
  if len(fields) == 0 {
    return ""
  }
  return fields[0]
}

func jsdocTagHasLeadingType(tag parsedJSDocTag) (string, bool) {
  typ, _ := jsdocLeadingType(tag.content)
  return typ, typ != ""
}

func jsdocTypeContainsIdentifier(typ, name string) bool {
  name = strings.ToLower(name)
  for i := 0; i < len(typ); {
    if !isIdentifierPart(typ[i]) {
      i++
      continue
    }
    start := i
    for i < len(typ) && isIdentifierPart(typ[i]) {
      i++
    }
    if strings.ToLower(typ[start:i]) == name {
      return true
    }
  }
  return false
}

func checkJSDocTagNames(ctx *Context, _ string, block parsedJSDocBlock) {
  for _, tag := range block.tags {
    key := tag.name
    if key == "inheritDoc" {
      key = "inheritdoc"
    }
    if key == "privateRemarks" {
      key = "privateremarks"
    }
    if _, ok := knownJSDocTags[key]; ok {
      continue
    }
    if _, ok := knownJSDocTags[strings.ToLower(key)]; ok {
      continue
    }
    ctx.ReportRange(tag.tagStart, tag.tagEnd, "Unknown JSDoc tag.")
  }
}

func checkJSDocRequireParamName(ctx *Context, _ string, block parsedJSDocBlock) {
  for _, tag := range block.tags {
    if tag.lowerName != "param" && tag.lowerName != "arg" && tag.lowerName != "argument" {
      continue
    }
    name, _ := jsdocNameAndDescription(tag.content)
    if name == "" {
      ctx.ReportRange(tag.tagStart, tag.tagEnd, "JSDoc @param tags must include a parameter name.")
    }
  }
}

func checkJSDocRequireParamDescription(ctx *Context, _ string, block parsedJSDocBlock) {
  for _, tag := range block.tags {
    if tag.lowerName != "param" && tag.lowerName != "arg" && tag.lowerName != "argument" {
      continue
    }
    name, desc := jsdocNameAndDescription(tag.content)
    if name != "" && desc == "" {
      ctx.ReportRange(tag.tagStart, tag.tagEnd, "JSDoc @param tags must include a description.")
    }
  }
}

func checkJSDocRequirePropertyName(ctx *Context, _ string, block parsedJSDocBlock) {
  for _, tag := range block.tags {
    if tag.lowerName != "property" && tag.lowerName != "prop" {
      continue
    }
    name, _ := jsdocNameAndDescription(tag.content)
    if name == "" {
      ctx.ReportRange(tag.tagStart, tag.tagEnd, "JSDoc @property tags must include a property name.")
    }
  }
}

func checkJSDocRequirePropertyDescription(ctx *Context, _ string, block parsedJSDocBlock) {
  for _, tag := range block.tags {
    if tag.lowerName != "property" && tag.lowerName != "prop" {
      continue
    }
    name, desc := jsdocNameAndDescription(tag.content)
    if name != "" && desc == "" {
      ctx.ReportRange(tag.tagStart, tag.tagEnd, "JSDoc @property tags must include a description.")
    }
  }
}

func checkJSDocRequireReturnsDescription(ctx *Context, _ string, block parsedJSDocBlock) {
  for _, tag := range block.tags {
    if tag.lowerName != "returns" && tag.lowerName != "return" {
      continue
    }
    if jsdocDescriptionAfterType(tag.content) == "" {
      ctx.ReportRange(tag.tagStart, tag.tagEnd, "JSDoc @returns tags must include a description.")
    }
  }
}

func checkJSDocRequireDescription(ctx *Context, _ string, block parsedJSDocBlock) {
  if !block.hasDescription {
    ctx.ReportRange(block.block.start, block.block.start+3, "JSDoc blocks must include a description.")
  }
}

func checkJSDocNoTypes(ctx *Context, _ string, block parsedJSDocBlock) {
  for _, tag := range block.tags {
    if _, ok := jsdocTagsWithType[tag.lowerName]; !ok {
      continue
    }
    if _, ok := jsdocTagHasLeadingType(tag); ok {
      ctx.ReportRange(tag.tagStart, tag.tagEnd, "Do not duplicate TypeScript types inside JSDoc tags.")
    }
  }
}

func checkJSDocRejectAnyType(ctx *Context, _ string, block parsedJSDocBlock) {
  for _, tag := range block.tags {
    typ, ok := jsdocTagHasLeadingType(tag)
    if !ok {
      continue
    }
    normalized := strings.TrimSpace(strings.ToLower(typ))
    if normalized == "*" || jsdocTypeContainsIdentifier(typ, "any") {
      ctx.ReportRange(tag.tagStart, tag.tagEnd, "Do not use any in JSDoc types.")
    }
  }
}

func checkJSDocRejectFunctionType(ctx *Context, _ string, block parsedJSDocBlock) {
  for _, tag := range block.tags {
    typ, ok := jsdocTagHasLeadingType(tag)
    if !ok {
      continue
    }
    if jsdocTypeContainsIdentifier(typ, "function") {
      ctx.ReportRange(tag.tagStart, tag.tagEnd, "Do not use the unsafe Function type in JSDoc.")
    }
  }
}

func checkJSDocCheckValues(ctx *Context, _ string, block parsedJSDocBlock) {
  for _, tag := range block.tags {
    if tag.lowerName != "access" {
      continue
    }
    switch jsdocFirstWordAfterType(tag.content) {
    case "public", "protected", "private", "package":
    default:
      ctx.ReportRange(tag.tagStart, tag.tagEnd, "JSDoc @access must be public, protected, private, or package.")
    }
  }
}

func checkJSDocEmptyTags(ctx *Context, _ string, block parsedJSDocBlock) {
  for _, tag := range block.tags {
    if _, ok := emptyJSDocTags[tag.lowerName]; !ok {
      continue
    }
    if strings.TrimSpace(tag.content) != "" {
      ctx.ReportRange(tag.tagStart, tag.tagEnd, "This JSDoc tag must not have content.")
    }
  }
}

func init() {
  Register(jsdocLintRule{name: "jsdoc/check-tag-names", check: checkJSDocTagNames})
  Register(jsdocLintRule{name: "jsdoc/check-values", check: checkJSDocCheckValues})
  Register(jsdocLintRule{name: "jsdoc/empty-tags", check: checkJSDocEmptyTags})
  Register(jsdocLintRule{name: "jsdoc/no-types", check: checkJSDocNoTypes})
  Register(jsdocLintRule{name: "jsdoc/reject-any-type", check: checkJSDocRejectAnyType})
  Register(jsdocLintRule{name: "jsdoc/reject-function-type", check: checkJSDocRejectFunctionType})
  Register(jsdocLintRule{name: "jsdoc/require-description", check: checkJSDocRequireDescription})
  Register(jsdocLintRule{name: "jsdoc/require-param-description", check: checkJSDocRequireParamDescription})
  Register(jsdocLintRule{name: "jsdoc/require-param-name", check: checkJSDocRequireParamName})
  Register(jsdocLintRule{name: "jsdoc/require-property-description", check: checkJSDocRequirePropertyDescription})
  Register(jsdocLintRule{name: "jsdoc/require-property-name", check: checkJSDocRequirePropertyName})
  Register(jsdocLintRule{name: "jsdoc/require-returns-description", check: checkJSDocRequireReturnsDescription})
}
