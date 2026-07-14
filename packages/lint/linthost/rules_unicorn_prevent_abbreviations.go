// unicorn/prevent-abbreviations keeps the final pre-rename contract from
// eslint-plugin-unicorn. Upstream renamed the rule to `name-replacements` in
// June 2026; ttsc retains the established rule ID so existing configurations
// remain source-compatible while using the complete replacement semantics.
//
// Variable diagnostics are binding-based. The TypeScript checker connects one
// declaration to all of its references, including shadowed names, shorthand
// syntax, JSX, and TypeScript type predicates. A binding is reported once at
// its declaration. A single unambiguous replacement is autofixed only when the
// whole rename is safe; ambiguous replacements are exposed as suggestions.
//
// The canonical replacement table and defaults are pinned to the last
// `prevent-abbreviations` implementation before the upstream rename:
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/42abe74908e8/rules/prevent-abbreviations.js
package linthost

import (
  "bytes"
  "encoding/json"
  "errors"
  "fmt"
  "io"
  "math"
  "path/filepath"
  "regexp"
  "sort"
  "strings"
  "unicode"
  "unicode/utf8"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
  "golang.org/x/text/cases"
  "golang.org/x/text/language"
)

type unicornPreventAbbreviations struct{}

type unicornPreventAbbreviationsImportMode uint8

const (
  unicornPreventAbbreviationsImportOff unicornPreventAbbreviationsImportMode = iota
  unicornPreventAbbreviationsImportInternal
  unicornPreventAbbreviationsImportAll
)

type unicornPreventAbbreviationsOptions struct {
  checkProperties                  bool
  checkVariables                   bool
  checkDefaultAndNamespaceImports unicornPreventAbbreviationsImportMode
  checkShorthandImports            unicornPreventAbbreviationsImportMode
  checkShorthandProperties         bool
  checkFilenames                   bool
  replacements                    map[string][]string
  allowList                        map[string]bool
  ignore                           []*regexp.Regexp
}

type unicornPreventAbbreviationsRawOptions struct {
  CheckProperties                  *bool           `json:"checkProperties"`
  CheckVariables                   *bool           `json:"checkVariables"`
  CheckDefaultAndNamespaceImports json.RawMessage `json:"checkDefaultAndNamespaceImports"`
  CheckShorthandImports            json.RawMessage `json:"checkShorthandImports"`
  CheckShorthandProperties         *bool           `json:"checkShorthandProperties"`
  CheckFilenames                   *bool           `json:"checkFilenames"`
  ExtendDefaultReplacements        *bool           `json:"extendDefaultReplacements"`
  Replacements                    json.RawMessage `json:"replacements"`
  ExtendDefaultAllowList           *bool           `json:"extendDefaultAllowList"`
  AllowList                        json.RawMessage `json:"allowList"`
  Ignore                           json.RawMessage `json:"ignore"`
}

type unicornPreventAbbreviationsReplacementPatch struct {
  disabled bool
  values   map[string]bool
}

type unicornPreventAbbreviationsNameReplacements struct {
  total   int
  samples []string
}

type unicornPreventAbbreviationsBinding struct {
  declaration *shimast.Node
  nameNode    *shimast.Node
  name        string
  symbol      *shimast.Symbol
  scope       *shimast.Node
  references  []*shimast.Node
  seen        map[*shimast.Node]struct{}
}

type unicornPreventAbbreviationsOccupiedName struct {
  scope     *shimast.Node
  reference bool
}

// This is the complete canonical table, not a project-specific subset.
// Replacement order is normalized before diagnostics and suggestions.
var unicornPreventAbbreviationsDefaultReplacements = map[string][]string{
  "acc":    {"accumulator"},
  "arg":    {"argument"},
  "args":   {"arguments"},
  "arr":    {"array"},
  "attr":   {"attribute"},
  "attrs":  {"attributes"},
  "btn":    {"button"},
  "cb":     {"callback"},
  "conf":   {"config"},
  "ctx":    {"context"},
  "cur":    {"current"},
  "curr":   {"current"},
  "db":     {"database"},
  "def":    {"defer", "deferred", "define", "definition"},
  "dest":   {"destination"},
  "dev":    {"development"},
  "dir":    {"direction", "directory"},
  "dirs":   {"directories"},
  "dist":   {"distribution"},
  "doc":    {"document"},
  "docs":   {"documentation", "documents"},
  "dst":    {"daylightSavingTime", "destination", "distribution"},
  "e":      {"error", "event"},
  "el":     {"element"},
  "elem":   {"element"},
  "elems":  {"elements"},
  "env":    {"environment"},
  "envs":   {"environments"},
  "err":    {"error"},
  "ev":     {"event"},
  "evt":    {"event"},
  "ext":    {"extension"},
  "exts":   {"extensions"},
  "fn":     {"function"},
  "func":   {"function"},
  "i":      {"index"},
  "idx":    {"index"},
  "j":      {"index"},
  "len":    {"length"},
  "lib":    {"library"},
  "mod":    {"module"},
  "msg":    {"message"},
  "num":    {"number"},
  "obj":    {"object"},
  "opts":   {"options"},
  "param":  {"parameter"},
  "params": {"parameters"},
  "pkg":    {"package"},
  "prev":   {"previous"},
  "prod":   {"production"},
  "prop":   {"property"},
  "props":  {"properties"},
  "ref":    {"reference"},
  "refs":   {"references"},
  "rel":    {"related", "relationship", "relative"},
  "req":    {"request"},
  "res":    {"resource", "response", "result"},
  "ret":    {"returnValue"},
  "retval": {"returnValue"},
  "sep":    {"separator"},
  "src":    {"source"},
  "stdDev": {"standardDeviation"},
  "str":    {"string"},
  "tbl":    {"table"},
  "temp":   {"temporary"},
  "tit":    {"title"},
  "tmp":    {"temporary"},
  "util":   {"utility"},
  "utils":  {"utilities"},
  "val":    {"value"},
  "var":    {"variable"},
  "vars":   {"variables"},
  "ver":    {"version"},
}

var unicornPreventAbbreviationsDefaultAllowList = map[string]bool{
  "defaultProps":             true,
  "devDependencies":         true,
  "EmberENV":                true,
  "getDerivedStateFromProps": true,
  "getInitialProps":          true,
  "getServerSideProps":       true,
  "getStaticProps":           true,
  "iOS":                      true,
  "propTypes":                true,
  "setupFilesAfterEnv":       true,
}

var unicornPreventAbbreviationsDefaultIgnore = []string{
  "i18n",
  "l10n",
  "a11y",
  "e2e",
  "jQuery",
}

// A source-only rename must remain a valid binding in modules and strict-mode
// code. TypeScript's contextual keywords are deliberately absent: names such
// as `type`, `module`, and `constructor` remain legal lexical bindings.
var unicornPreventAbbreviationsReservedWords = map[string]struct{}{
  "arguments": {}, "await": {},
  "break": {}, "case": {}, "catch": {}, "class": {}, "const": {},
  "continue": {}, "debugger": {}, "default": {}, "delete": {},
  "do": {}, "else": {}, "enum": {}, "export": {}, "extends": {},
  "eval": {}, "false": {}, "finally": {}, "for": {}, "function": {},
  "if": {}, "implements": {}, "import": {}, "in": {}, "instanceof": {},
  "interface": {}, "let": {}, "new": {}, "null": {}, "package": {},
  "private": {}, "protected": {}, "public": {}, "return": {}, "static": {},
  "super": {}, "switch": {}, "this": {}, "throw": {}, "true": {},
  "try": {}, "typeof": {}, "var": {}, "void": {}, "while": {},
  "with": {}, "yield": {},
}

func (unicornPreventAbbreviations) Name() string { return "unicorn/prevent-abbreviations" }
func (unicornPreventAbbreviations) NeedsTypeChecker() bool {
  return true
}
func (unicornPreventAbbreviations) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (unicornPreventAbbreviations) ValidateOptions(raw json.RawMessage) error {
  _, err := decodeUnicornPreventAbbreviationsOptions(raw)
  return err
}

func (unicornPreventAbbreviations) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || ctx.Checker == nil || node == nil {
    return
  }
  options, err := decodeUnicornPreventAbbreviationsOptions(ctx.Options)
  if err != nil {
    return
  }

  bindings, bySymbol, byDeclaration, occupied := collectUnicornPreventAbbreviationsBindings(ctx, node)
  collectUnicornPreventAbbreviationsReferences(ctx, node, bySymbol, byDeclaration)

  generated := make(map[string][]*unicornPreventAbbreviationsBinding)
  if options.checkVariables {
    comments := collectUnicornPreventAbbreviationsComments(ctx.File)
    for _, binding := range bindings {
      reportUnicornPreventAbbreviationsBinding(ctx, binding, options, occupied, generated, comments)
    }
  }
  if options.checkProperties {
    walkDescendants(node, func(candidate *shimast.Node) {
      reportUnicornPreventAbbreviationsProperty(ctx, candidate, options)
    })
  }
  if options.checkFilenames {
    reportUnicornPreventAbbreviationsFilename(ctx, node, options)
  }
}

func decodeUnicornPreventAbbreviationsOptions(raw json.RawMessage) (unicornPreventAbbreviationsOptions, error) {
  options := unicornPreventAbbreviationsOptions{
    checkVariables:                   true,
    checkDefaultAndNamespaceImports: unicornPreventAbbreviationsImportInternal,
    checkShorthandImports:            unicornPreventAbbreviationsImportInternal,
    checkFilenames:                   true,
    replacements:                    cloneUnicornPreventAbbreviationsReplacements(unicornPreventAbbreviationsDefaultReplacements),
    allowList:                        cloneUnicornPreventAbbreviationsAllowList(unicornPreventAbbreviationsDefaultAllowList),
  }
  for _, pattern := range unicornPreventAbbreviationsDefaultIgnore {
    options.ignore = append(options.ignore, regexp.MustCompile(pattern))
  }
  trimmed := bytes.TrimSpace(raw)
  if len(trimmed) == 0 {
    return options, nil
  }
  if trimmed[0] != '{' {
    return options, errors.New("options must be an object")
  }

  var rawFields map[string]json.RawMessage
  if err := json.Unmarshal(trimmed, &rawFields); err != nil {
    return options, fmt.Errorf("options must be an object: %w", err)
  }
  // The value marks boolean fields, whose pointer-backed decoding would
  // otherwise make an explicit null indistinguishable from omission.
  knownFields := map[string]bool{
    "checkProperties":                  true,
    "checkVariables":                   true,
    "checkDefaultAndNamespaceImports": false,
    "checkShorthandImports":            false,
    "checkShorthandProperties":         true,
    "checkFilenames":                   true,
    "extendDefaultReplacements":        true,
    "replacements":                     false,
    "extendDefaultAllowList":           true,
    "allowList":                        false,
    "ignore":                           false,
  }
  for name, value := range rawFields {
    boolean, known := knownFields[name]
    if !known {
      return options, fmt.Errorf("unknown option %q", name)
    }
    if boolean && bytes.Equal(bytes.TrimSpace(value), []byte("null")) {
      return options, fmt.Errorf("option %q must be a boolean", name)
    }
  }

  decoder := json.NewDecoder(bytes.NewReader(trimmed))
  decoder.DisallowUnknownFields()
  var configured unicornPreventAbbreviationsRawOptions
  if err := decoder.Decode(&configured); err != nil {
    return options, fmt.Errorf("options must be an object: %w", err)
  }
  if err := requireUnicornPreventAbbreviationsEOF(decoder); err != nil {
    return options, err
  }

  if configured.CheckProperties != nil {
    options.checkProperties = *configured.CheckProperties
  }
  if configured.CheckVariables != nil {
    options.checkVariables = *configured.CheckVariables
  }
  if configured.CheckShorthandProperties != nil {
    options.checkShorthandProperties = *configured.CheckShorthandProperties
  }
  if configured.CheckFilenames != nil {
    options.checkFilenames = *configured.CheckFilenames
  }

  var err error
  options.checkDefaultAndNamespaceImports, err = decodeUnicornPreventAbbreviationsImportMode(
    configured.CheckDefaultAndNamespaceImports,
    "checkDefaultAndNamespaceImports",
    unicornPreventAbbreviationsImportInternal,
  )
  if err != nil {
    return options, err
  }
  options.checkShorthandImports, err = decodeUnicornPreventAbbreviationsImportMode(
    configured.CheckShorthandImports,
    "checkShorthandImports",
    unicornPreventAbbreviationsImportInternal,
  )
  if err != nil {
    return options, err
  }

  extendReplacements := configured.ExtendDefaultReplacements == nil || *configured.ExtendDefaultReplacements
  if !extendReplacements {
    options.replacements = make(map[string][]string)
  }
  patches, err := decodeUnicornPreventAbbreviationsReplacementPatches(configured.Replacements)
  if err != nil {
    return options, err
  }
  applyUnicornPreventAbbreviationsReplacementPatches(options.replacements, patches)

  extendAllowList := configured.ExtendDefaultAllowList == nil || *configured.ExtendDefaultAllowList
  if !extendAllowList {
    options.allowList = make(map[string]bool)
  }
  allowList, err := decodeUnicornPreventAbbreviationsBooleanMap(configured.AllowList, "allowList")
  if err != nil {
    return options, err
  }
  for name, allowed := range allowList {
    if allowed {
      options.allowList[name] = true
    } else {
      delete(options.allowList, name)
    }
  }

  ignore, err := decodeUnicornPreventAbbreviationsIgnore(configured.Ignore)
  if err != nil {
    return options, err
  }
  options.ignore = append(options.ignore, ignore...)
  return options, nil
}

func requireUnicornPreventAbbreviationsEOF(decoder *json.Decoder) error {
  var trailing any
  if err := decoder.Decode(&trailing); err != io.EOF {
    if err == nil {
      return errors.New("options must contain exactly one object")
    }
    return fmt.Errorf("options contain trailing data: %w", err)
  }
  return nil
}

func decodeUnicornPreventAbbreviationsImportMode(
  raw json.RawMessage,
  name string,
  fallback unicornPreventAbbreviationsImportMode,
) (unicornPreventAbbreviationsImportMode, error) {
  if len(raw) == 0 {
    return fallback, nil
  }
  var value any
  if err := json.Unmarshal(raw, &value); err != nil {
    return fallback, fmt.Errorf("option %q must be a boolean or \"internal\"", name)
  }
  switch configured := value.(type) {
  case bool:
    if configured {
      return unicornPreventAbbreviationsImportAll, nil
    }
    return unicornPreventAbbreviationsImportOff, nil
  case string:
    if configured == "internal" {
      return unicornPreventAbbreviationsImportInternal, nil
    }
  }
  return fallback, fmt.Errorf("option %q must be a boolean or \"internal\"", name)
}

func decodeUnicornPreventAbbreviationsReplacementPatches(
  raw json.RawMessage,
) (map[string]unicornPreventAbbreviationsReplacementPatch, error) {
  patches := make(map[string]unicornPreventAbbreviationsReplacementPatch)
  if len(raw) == 0 {
    return patches, nil
  }
  var entries map[string]json.RawMessage
  if err := json.Unmarshal(raw, &entries); err != nil || entries == nil {
    return nil, errors.New("option \"replacements\" must be an object")
  }
  for name, value := range entries {
    var disabled *bool
    if err := json.Unmarshal(value, &disabled); err == nil && disabled != nil {
      if *disabled {
        return nil, fmt.Errorf("option \"replacements.%s\" must be false or an object", name)
      }
      patches[name] = unicornPreventAbbreviationsReplacementPatch{disabled: true}
      continue
    }
    replacements, err := decodeUnicornPreventAbbreviationsBooleanMap(value, "replacements."+name)
    if err != nil {
      return nil, err
    }
    patches[name] = unicornPreventAbbreviationsReplacementPatch{values: replacements}
  }
  return patches, nil
}

func decodeUnicornPreventAbbreviationsBooleanMap(raw json.RawMessage, name string) (map[string]bool, error) {
  values := make(map[string]bool)
  if len(raw) == 0 {
    return values, nil
  }
  if err := json.Unmarshal(raw, &values); err != nil || values == nil {
    return nil, fmt.Errorf("option %q must be an object with boolean values", name)
  }
  return values, nil
}

func decodeUnicornPreventAbbreviationsIgnore(raw json.RawMessage) ([]*regexp.Regexp, error) {
  if len(raw) == 0 {
    return nil, nil
  }
  var patterns []string
  if err := json.Unmarshal(raw, &patterns); err != nil || patterns == nil {
    return nil, errors.New("option \"ignore\" must be an array of regular-expression strings")
  }
  compiled := make([]*regexp.Regexp, 0, len(patterns))
  seen := make(map[string]struct{}, len(patterns))
  for index, pattern := range patterns {
    if _, duplicate := seen[pattern]; duplicate {
      return nil, fmt.Errorf("option \"ignore\"[%d] duplicates %q", index, pattern)
    }
    seen[pattern] = struct{}{}
    expression, err := regexp.Compile(pattern)
    if err != nil {
      return nil, fmt.Errorf("option \"ignore\"[%d] must be a valid regular expression: %w", index, err)
    }
    compiled = append(compiled, expression)
  }
  return compiled, nil
}

func cloneUnicornPreventAbbreviationsReplacements(source map[string][]string) map[string][]string {
  clone := make(map[string][]string, len(source))
  for name, replacements := range source {
    clone[name] = append([]string(nil), replacements...)
  }
  return clone
}

func cloneUnicornPreventAbbreviationsAllowList(source map[string]bool) map[string]bool {
  clone := make(map[string]bool, len(source))
  for name, allowed := range source {
    clone[name] = allowed
  }
  return clone
}

func applyUnicornPreventAbbreviationsReplacementPatches(
  replacements map[string][]string,
  patches map[string]unicornPreventAbbreviationsReplacementPatch,
) {
  for name, patch := range patches {
    if patch.disabled {
      // Keep an empty entry so lower-first lookup stops here instead of
      // falling through to a differently cased custom key.
      replacements[name] = nil
      continue
    }
    values := make(map[string]bool)
    for _, replacement := range replacements[name] {
      values[replacement] = true
    }
    for replacement, enabled := range patch.values {
      values[replacement] = enabled
    }
    merged := make([]string, 0, len(values))
    for replacement, enabled := range values {
      if enabled {
        merged = append(merged, replacement)
      }
    }
    sort.Strings(merged)
    replacements[name] = merged
  }
}

func collectUnicornPreventAbbreviationsBindings(
  ctx *Context,
  root *shimast.Node,
) (
  []*unicornPreventAbbreviationsBinding,
  map[*shimast.Symbol]*unicornPreventAbbreviationsBinding,
  map[*shimast.Node]*unicornPreventAbbreviationsBinding,
  map[string][]unicornPreventAbbreviationsOccupiedName,
) {
  bindings := make([]*unicornPreventAbbreviationsBinding, 0)
  bySymbol := make(map[*shimast.Symbol]*unicornPreventAbbreviationsBinding)
  byDeclaration := make(map[*shimast.Node]*unicornPreventAbbreviationsBinding)
  occupied := make(map[string][]unicornPreventAbbreviationsOccupiedName)
  seenNames := make(map[*shimast.Node]struct{})

  walkDescendants(root, func(node *shimast.Node) {
    nameNode := unicornPreventAbbreviationsBindingIdentifier(node)
    if nameNode == nil {
      return
    }
    if _, duplicate := seenNames[nameNode]; duplicate {
      return
    }
    seenNames[nameNode] = struct{}{}
    name := identifierText(nameNode)
    if name == "" {
      return
    }
    scope := unicornPreventAbbreviationsBindingScope(node)
    occupied[name] = append(occupied[name], unicornPreventAbbreviationsOccupiedName{scope: scope})

    symbol := unicornPreventAbbreviationsCanonicalSymbol(ctx, nameNode)
    if symbol == nil {
      return
    }
    if existing := bySymbol[symbol]; existing != nil {
      byDeclaration[node] = existing
      return
    }
    binding := &unicornPreventAbbreviationsBinding{
      declaration: node,
      nameNode:    nameNode,
      name:        name,
      symbol:      symbol,
      scope:       scope,
      seen:        make(map[*shimast.Node]struct{}),
    }
    bindings = append(bindings, binding)
    bySymbol[symbol] = binding
    byDeclaration[node] = binding
    for _, declaration := range symbol.Declarations {
      byDeclaration[declaration] = binding
    }
  })
  collectUnicornPreventAbbreviationsOccupiedReferences(
    ctx,
    root,
    occupied,
  )
  return bindings, bySymbol, byDeclaration, occupied
}

// Unresolved lexical references also constrain a rename. Resolved local,
// ambient, and global symbols are covered by ResolveName at every declaration
// and reference site; retaining only unresolved reads here avoids treating
// property-like syntax as a lexical collision.
func collectUnicornPreventAbbreviationsOccupiedReferences(
  ctx *Context,
  root *shimast.Node,
  occupied map[string][]unicornPreventAbbreviationsOccupiedName,
) {
  walkDescendants(root, func(node *shimast.Node) {
    if node.Kind != shimast.KindIdentifier || !unicornPreventAbbreviationsIsNameReference(node) {
      return
    }
    symbol := unicornPreventAbbreviationsCanonicalSymbol(ctx, node)
    if symbol != nil {
      return
    }
    name := identifierText(node)
    if name != "" {
      occupied[name] = append(occupied[name], unicornPreventAbbreviationsOccupiedName{
        scope:     unicornPreventAbbreviationsReferenceScope(node),
        reference: true,
      })
    }
  })
}

// GetExportSymbolOfSymbol normalizes both value and type exports. The shared
// canonicalValueSymbol helper intentionally performs only value-export
// normalization, while this rule also renames interfaces, aliases, enums, and
// their type-position references.
func unicornPreventAbbreviationsCanonicalSymbol(ctx *Context, node *shimast.Node) *shimast.Symbol {
  symbol := valueSymbolAtIdentifier(ctx, node)
  if symbol == nil {
    return nil
  }
  return ctx.Checker.GetExportSymbolOfSymbol(symbol)
}

func unicornPreventAbbreviationsReferenceScope(node *shimast.Node) *shimast.Node {
  for scope := node.Parent; scope != nil; scope = scope.Parent {
    if unicornPreventAbbreviationsIsFunctionLike(scope) {
      return scope
    }
    switch scope.Kind {
    case shimast.KindMappedType,
      shimast.KindConditionalType:
      return scope
    case shimast.KindCaseBlock,
      shimast.KindForStatement,
      shimast.KindForInStatement,
      shimast.KindForOfStatement,
      shimast.KindCatchClause:
      return scope
    case shimast.KindClassDeclaration,
      shimast.KindClassExpression,
      shimast.KindInterfaceDeclaration,
      shimast.KindTypeAliasDeclaration,
      shimast.KindModuleBlock,
      shimast.KindSourceFile,
      shimast.KindClassStaticBlockDeclaration:
      return scope
    case shimast.KindBlock:
      if scope.Parent != nil && unicornPreventAbbreviationsIsFunctionLike(scope.Parent) {
        return scope.Parent
      }
      return scope
    }
  }
  return nil
}

// TypeScript signature nodes introduce parameter/type-parameter scopes just
// like runtime functions, but the shared runtime-only helper deliberately does
// not classify them as function-like.
func unicornPreventAbbreviationsIsFunctionLike(node *shimast.Node) bool {
  if isFunctionLikeKind(node) {
    return true
  }
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindFunctionType,
    shimast.KindConstructorType,
    shimast.KindCallSignature,
    shimast.KindConstructSignature,
    shimast.KindMethodSignature,
    shimast.KindIndexSignature:
    return true
  }
  return false
}

func unicornPreventAbbreviationsIsNameReference(node *shimast.Node) bool {
  if node == nil || node.Parent == nil {
    return true
  }
  if unicornPreventAbbreviationsIsIntrinsicJSXTagName(node) ||
    unicornPreventAbbreviationsIsImportTypeQualifier(node) {
    return false
  }
  parent := node.Parent
  switch parent.Kind {
  case shimast.KindPropertyAccessExpression:
    access := parent.AsPropertyAccessExpression()
    return access == nil || access.Name() != node
  case shimast.KindQualifiedName:
    name := parent.AsQualifiedName()
    return name == nil || name.Right != node
  case shimast.KindPropertyAssignment:
    assignment := parent.AsPropertyAssignment()
    return assignment == nil || assignment.Name() != node
  case shimast.KindBindingElement:
    element := parent.AsBindingElement()
    return element == nil || element.PropertyName != node
  case shimast.KindMethodDeclaration,
    shimast.KindPropertyDeclaration,
    shimast.KindGetAccessor,
    shimast.KindSetAccessor,
    shimast.KindMethodSignature,
    shimast.KindPropertySignature,
    shimast.KindEnumMember:
    return parent.Name() != node
  case shimast.KindImportSpecifier:
    specifier := parent.AsImportSpecifier()
    return specifier == nil || specifier.PropertyName != node
  case shimast.KindExportSpecifier:
    specifier := parent.AsExportSpecifier()
    if unicornPreventAbbreviationsExportSpecifierHasModuleSource(parent) {
      return false
    }
    return specifier == nil || specifier.Name() != node || specifier.PropertyName == nil
  case shimast.KindLabeledStatement:
    statement := parent.AsLabeledStatement()
    return statement == nil || statement.Label != node
  case shimast.KindBreakStatement:
    statement := parent.AsBreakStatement()
    return statement == nil || statement.Label != node
  case shimast.KindContinueStatement:
    statement := parent.AsContinueStatement()
    return statement == nil || statement.Label != node
  case shimast.KindJsxAttribute:
    return parent.Name() != node
  case shimast.KindNamedTupleMember,
    shimast.KindImportAttribute,
    shimast.KindNamespaceExport,
    shimast.KindNamespaceExportDeclaration,
    shimast.KindMetaProperty:
    return parent.Name() != node
  case shimast.KindJsxNamespacedName:
    return false
  }
  return true
}

func unicornPreventAbbreviationsIsIntrinsicJSXTagName(node *shimast.Node) bool {
  if node == nil || node.Parent == nil || !shimscanner.IsIntrinsicJsxName(identifierText(node)) {
    return false
  }
  switch node.Parent.Kind {
  case shimast.KindJsxOpeningElement,
    shimast.KindJsxSelfClosingElement,
    shimast.KindJsxClosingElement:
    return node.Parent.TagName() == node
  }
  return false
}

func unicornPreventAbbreviationsIsImportTypeQualifier(node *shimast.Node) bool {
  current := node
  for current != nil && current.Parent != nil && current.Parent.Kind == shimast.KindQualifiedName {
    current = current.Parent
  }
  if current == nil || current.Parent == nil || current.Parent.Kind != shimast.KindImportType {
    return false
  }
  imported := current.Parent.AsImportTypeNode()
  return imported != nil && imported.Qualifier == current
}

func unicornPreventAbbreviationsExportSpecifierHasModuleSource(specifier *shimast.Node) bool {
  for current := specifier; current != nil; current = current.Parent {
    if current.Kind == shimast.KindExportDeclaration {
      declaration := current.AsExportDeclaration()
      return declaration != nil && declaration.ModuleSpecifier != nil
    }
    if current.Kind == shimast.KindSourceFile {
      return false
    }
  }
  return false
}

func unicornPreventAbbreviationsBindingIdentifier(node *shimast.Node) *shimast.Node {
  if node == nil {
    return nil
  }
  switch node.Kind {
  case shimast.KindVariableDeclaration:
    if declaration := node.AsVariableDeclaration(); declaration != nil {
      return unicornPreventAbbreviationsPlainBindingName(declaration.Name())
    }
  case shimast.KindParameter:
    if declaration := node.AsParameterDeclaration(); declaration != nil {
      return unicornPreventAbbreviationsPlainBindingName(declaration.Name())
    }
  case shimast.KindBindingElement:
    if element := node.AsBindingElement(); element != nil {
      return unicornPreventAbbreviationsPlainBindingName(element.Name())
    }
  case shimast.KindFunctionDeclaration,
    shimast.KindFunctionExpression,
    shimast.KindClassDeclaration,
    shimast.KindClassExpression,
    shimast.KindEnumDeclaration,
    shimast.KindModuleDeclaration,
    shimast.KindInterfaceDeclaration,
    shimast.KindTypeAliasDeclaration,
    shimast.KindTypeParameter:
    return unicornPreventAbbreviationsPlainBindingName(node.Name())
  case shimast.KindImportClause,
    shimast.KindNamespaceImport,
    shimast.KindImportSpecifier,
    shimast.KindImportEqualsDeclaration:
    return unicornPreventAbbreviationsPlainBindingName(node.Name())
  }
  return nil
}

func unicornPreventAbbreviationsPlainBindingName(node *shimast.Node) *shimast.Node {
  if node != nil && node.Kind == shimast.KindIdentifier {
    return node
  }
  return nil
}

func unicornPreventAbbreviationsBindingScope(declaration *shimast.Node) *shimast.Node {
  if declaration == nil {
    return nil
  }
  if declaration.Kind == shimast.KindFunctionExpression || declaration.Kind == shimast.KindClassExpression {
    return declaration
  }
  if parameter := unicornPreventAbbreviationsEnclosingParameter(declaration); parameter != nil {
    for scope := parameter.Parent; scope != nil; scope = scope.Parent {
      if unicornPreventAbbreviationsIsFunctionLike(scope) {
        return scope
      }
    }
    return nil
  }
  root := unicornPreventAbbreviationsRootDeclaration(declaration)
  if root != nil && root.Kind == shimast.KindVariableDeclaration && root.Parent != nil &&
    root.Parent.Kind == shimast.KindVariableDeclarationList && shimast.IsVar(root.Parent) {
    for scope := root.Parent.Parent; scope != nil; scope = scope.Parent {
      if unicornPreventAbbreviationsIsFunctionLike(scope) {
        return scope
      }
      switch scope.Kind {
      case shimast.KindSourceFile, shimast.KindModuleBlock, shimast.KindClassStaticBlockDeclaration:
        return scope
      }
    }
    return nil
  }
  if declaration.Kind == shimast.KindTypeParameter {
    for scope := declaration.Parent; scope != nil; scope = scope.Parent {
      if unicornPreventAbbreviationsIsFunctionLike(scope) {
        return scope
      }
      switch scope.Kind {
      case shimast.KindMappedType,
        shimast.KindConditionalType:
        return scope
      case shimast.KindClassDeclaration,
        shimast.KindClassExpression,
        shimast.KindInterfaceDeclaration,
        shimast.KindTypeAliasDeclaration,
        shimast.KindMethodSignature:
        return scope
      }
    }
    return nil
  }
  scope := preferConstLexicalScope(declaration)
  if scope != nil && scope.Kind == shimast.KindBlock && scope.Parent != nil &&
    scope.Parent.Kind == shimast.KindCatchClause {
    return scope.Parent
  }
  return scope
}

// Destructuring BindingElements inherit declaration-kind semantics from the
// root Parameter, catch VariableDeclaration, or variable declaration.
func unicornPreventAbbreviationsRootDeclaration(declaration *shimast.Node) *shimast.Node {
  for declaration != nil && declaration.Kind == shimast.KindBindingElement &&
    declaration.Parent != nil && declaration.Parent.Parent != nil {
    declaration = declaration.Parent.Parent
  }
  return declaration
}

func unicornPreventAbbreviationsEnclosingParameter(declaration *shimast.Node) *shimast.Node {
  for current := declaration; current != nil; current = current.Parent {
    if current.Kind == shimast.KindParameter {
      return current
    }
    if current != declaration && unicornPreventAbbreviationsIsFunctionLike(current) {
      return nil
    }
    if current.Kind == shimast.KindSourceFile {
      return nil
    }
  }
  return nil
}

func collectUnicornPreventAbbreviationsReferences(
  ctx *Context,
  root *shimast.Node,
  bySymbol map[*shimast.Symbol]*unicornPreventAbbreviationsBinding,
  byDeclaration map[*shimast.Node]*unicornPreventAbbreviationsBinding,
) {
  walkDescendants(root, func(node *shimast.Node) {
    if node.Kind != shimast.KindIdentifier {
      return
    }
    symbol := unicornPreventAbbreviationsReferenceSymbol(ctx, node)
    if symbol == nil {
      return
    }
    binding := bySymbol[symbol]
    if binding == nil {
      for _, declaration := range symbol.Declarations {
        if candidate := byDeclaration[declaration]; candidate != nil {
          binding = candidate
          break
        }
      }
    }
    if binding == nil {
      return
    }
    if _, duplicate := binding.seen[node]; duplicate {
      return
    }
    binding.seen[node] = struct{}{}
    binding.references = append(binding.references, node)
  })
}

// The checker binds an export specifier's written name to the exported alias,
// not to the local declaration that supplies it. Resolve the local side through
// TypeScript's dedicated API so a local rename can preserve the public spelling
// (`export { err }` becomes `export { error as err }`). Re-exports have no local
// binding and stay on the ordinary symbol-at-location path.
func unicornPreventAbbreviationsReferenceSymbol(ctx *Context, node *shimast.Node) *shimast.Symbol {
  if node != nil && node.Parent != nil && node.Parent.Kind == shimast.KindExportSpecifier &&
    !unicornPreventAbbreviationsExportSpecifierHasModuleSource(node.Parent) {
    specifier := node.Parent.AsExportSpecifier()
    if specifier != nil && (specifier.PropertyName == node ||
      specifier.PropertyName == nil && specifier.Name() == node) {
      symbol := ctx.Checker.GetExportSpecifierLocalTargetSymbol(node.Parent)
      if symbol != nil {
        return ctx.Checker.GetExportSymbolOfSymbol(symbol)
      }
    }
  }
  return unicornPreventAbbreviationsCanonicalSymbol(ctx, node)
}

func reportUnicornPreventAbbreviationsBinding(
  ctx *Context,
  binding *unicornPreventAbbreviationsBinding,
  options unicornPreventAbbreviationsOptions,
  occupied map[string][]unicornPreventAbbreviationsOccupiedName,
  generated map[string][]*unicornPreventAbbreviationsBinding,
  comments map[int]commentToken,
) {
  if binding == nil || !unicornPreventAbbreviationsShouldCheckBinding(binding, options) {
    return
  }
  replacements := getUnicornPreventAbbreviationsNameReplacements(binding.name, options, 3)
  if replacements.total == 0 {
    return
  }

  safeToRename := unicornPreventAbbreviationsCanRenameBinding(ctx, binding, comments)
  scopes := unicornPreventAbbreviationsBindingReferenceScopes(binding)
  available := make([]string, 0, len(replacements.samples))
  for _, replacement := range replacements.samples {
    name := unicornPreventAbbreviationsAvailableName(
      ctx,
      binding,
      replacement,
      scopes,
      occupied,
      generated,
    )
    if name != "" {
      available = append(available, name)
    }
  }
  replacements.samples = available
  message := unicornPreventAbbreviationsMessage(binding.name, replacements, "variable")

  if replacements.total == 1 && len(replacements.samples) == 1 && safeToRename {
    replacement := replacements.samples[0]
    edits := unicornPreventAbbreviationsRenameEdits(ctx, binding, replacement)
    if len(edits) > 0 {
      generated[replacement] = append(generated[replacement], binding)
      ctx.ReportFix(binding.nameNode, message, edits...)
      return
    }
  }

  suggestions := make([]Suggestion, 0, len(replacements.samples))
  if replacements.total > 1 && safeToRename {
    for _, replacement := range replacements.samples {
      edits := unicornPreventAbbreviationsRenameEdits(ctx, binding, replacement)
      if len(edits) == 0 {
        continue
      }
      suggestions = append(suggestions, Suggestion{
        Title: fmt.Sprintf("Rename to `%s`.", replacement),
        Edits: edits,
      })
    }
  }
  ctx.ReportFixSuggestions(binding.nameNode, message, nil, suggestions...)
}

func unicornPreventAbbreviationsShouldCheckBinding(
  binding *unicornPreventAbbreviationsBinding,
  options unicornPreventAbbreviationsOptions,
) bool {
  declaration := binding.declaration
  if declaration == nil {
    return false
  }
  if unicornPreventAbbreviationsIsShorthandBinding(declaration) && !options.checkShorthandProperties {
    return false
  }
  switch declaration.Kind {
  case shimast.KindVariableDeclaration:
    variable := declaration.AsVariableDeclaration()
    if variable != nil {
      if _, required := unicornPreventAbbreviationsStaticRequireModule(variable.Initializer); required {
        return unicornPreventAbbreviationsImportAllowed(
          options.checkDefaultAndNamespaceImports,
          unicornPreventAbbreviationsIsInternalImport(declaration),
        )
      }
    }
  case shimast.KindImportEqualsDeclaration:
    if !unicornPreventAbbreviationsIsExternalImportEquals(declaration) {
      return true
    }
    return unicornPreventAbbreviationsImportAllowed(
      options.checkDefaultAndNamespaceImports,
      unicornPreventAbbreviationsIsInternalImport(declaration),
    )
  case shimast.KindImportClause, shimast.KindNamespaceImport:
    return unicornPreventAbbreviationsImportAllowed(
      options.checkDefaultAndNamespaceImports,
      unicornPreventAbbreviationsIsInternalImport(declaration),
    )
  case shimast.KindImportSpecifier:
    specifier := declaration.AsImportSpecifier()
    if specifier != nil && specifier.PropertyName != nil &&
      moduleExportNameText(specifier.PropertyName) == "default" {
      return unicornPreventAbbreviationsImportAllowed(
        options.checkDefaultAndNamespaceImports,
        unicornPreventAbbreviationsIsInternalImport(declaration),
      )
    }
    if specifier != nil && specifier.PropertyName == nil {
      return unicornPreventAbbreviationsImportAllowed(
        options.checkShorthandImports,
        unicornPreventAbbreviationsIsInternalImport(declaration),
      )
    }
  }
  return true
}

func unicornPreventAbbreviationsIsShorthandBinding(declaration *shimast.Node) bool {
  if declaration == nil || declaration.Kind != shimast.KindBindingElement {
    return false
  }
  element := declaration.AsBindingElement()
  return element != nil && element.PropertyName == nil && element.DotDotDotToken == nil &&
    declaration.Parent != nil && declaration.Parent.Kind == shimast.KindObjectBindingPattern
}

func unicornPreventAbbreviationsImportAllowed(
  mode unicornPreventAbbreviationsImportMode,
  internal bool,
) bool {
  return mode == unicornPreventAbbreviationsImportAll ||
    mode == unicornPreventAbbreviationsImportInternal && internal
}

func unicornPreventAbbreviationsIsInternalImport(declaration *shimast.Node) bool {
  if declaration != nil && declaration.Kind == shimast.KindVariableDeclaration {
    variable := declaration.AsVariableDeclaration()
    if variable == nil {
      return false
    }
    source, required := unicornPreventAbbreviationsStaticRequireModule(variable.Initializer)
    return required && unicornPreventAbbreviationsIsInternalModule(source)
  }
  for ancestor := declaration; ancestor != nil; ancestor = ancestor.Parent {
    if ancestor.Kind == shimast.KindImportDeclaration {
      imported := ancestor.AsImportDeclaration()
      if imported == nil {
        return false
      }
      source := stringLiteralText(imported.ModuleSpecifier)
      return unicornPreventAbbreviationsIsInternalModule(source)
    }
    if ancestor.Kind == shimast.KindImportEqualsDeclaration {
      imported := ancestor.AsImportEqualsDeclaration()
      if imported == nil || imported.ModuleReference == nil ||
        imported.ModuleReference.Kind != shimast.KindExternalModuleReference {
        return false
      }
      external := imported.ModuleReference.AsExternalModuleReference()
      if external == nil {
        return false
      }
      source := stringLiteralText(external.Expression)
      return unicornPreventAbbreviationsIsInternalModule(source)
    }
  }
  return false
}

func unicornPreventAbbreviationsIsInternalModule(source string) bool {
  return !strings.Contains(source, "node_modules") &&
    (strings.HasPrefix(source, ".") || strings.HasPrefix(source, "/"))
}

// Import controls apply only to upstream's exact static-require shape: one
// ordinary string-literal argument on a non-optional bare require call.
func unicornPreventAbbreviationsStaticRequireModule(node *shimast.Node) (string, bool) {
  node = stripParens(node)
  if node == nil || node.Kind != shimast.KindCallExpression {
    return "", false
  }
  call := node.AsCallExpression()
  if call == nil || call.QuestionDotToken != nil || callCalleeName(call) != "require" ||
    call.Arguments == nil || len(call.Arguments.Nodes) != 1 {
    return "", false
  }
  argument := call.Arguments.Nodes[0]
  if argument == nil || argument.Kind != shimast.KindStringLiteral {
    return "", false
  }
  literal := argument.AsStringLiteral()
  if literal == nil {
    return "", false
  }
  return literal.Text, true
}

func unicornPreventAbbreviationsIsExternalImportEquals(declaration *shimast.Node) bool {
  if declaration == nil || declaration.Kind != shimast.KindImportEqualsDeclaration {
    return false
  }
  imported := declaration.AsImportEqualsDeclaration()
  return imported != nil && imported.ModuleReference != nil &&
    imported.ModuleReference.Kind == shimast.KindExternalModuleReference
}

func unicornPreventAbbreviationsCanRenameBinding(
  ctx *Context,
  binding *unicornPreventAbbreviationsBinding,
  comments map[int]commentToken,
) bool {
  if binding == nil || len(binding.references) == 0 || unicornPreventAbbreviationsBindingIsExternallyVisible(ctx, binding) {
    return false
  }
  if strings.EqualFold(filepath.Ext(ctx.File.FileName()), ".vue") {
    return false
  }
  parameter := unicornPreventAbbreviationsEnclosingParameter(binding.declaration)
  if parameter != nil && unicornPreventAbbreviationsParameterHasJSDoc(ctx, parameter, comments) {
    return false
  }
  if parameter != nil && isParameterProperty(parameter) {
    return false
  }
  for _, reference := range binding.references {
    if noFallthroughNodeIsJSXTagName(reference) {
      return false
    }
    if pos, end := tokenRange(ctx.File, reference); pos < 0 || end <= pos {
      return false
    }
  }
  return true
}

func unicornPreventAbbreviationsBindingIsExternallyVisible(
  ctx *Context,
  binding *unicornPreventAbbreviationsBinding,
) bool {
  if ctx == nil || ctx.File == nil || binding == nil || binding.symbol == nil || ctx.File.IsDeclarationFile {
    return true
  }
  declarations := make([]*shimast.Node, 0, len(binding.symbol.Declarations)+1)
  declarations = append(declarations, binding.declaration)
  declarations = append(declarations, binding.symbol.Declarations...)
  seen := make(map[*shimast.Node]struct{}, len(declarations))
  for _, declaration := range declarations {
    if declaration == nil {
      return true
    }
    if _, duplicate := seen[declaration]; duplicate {
      continue
    }
    seen[declaration] = struct{}{}
    source := shimast.GetSourceFileOfNode(declaration)
    // A source-only edit is safe only when every declaration is proven to
    // belong to the current file. Detached or synthetic declarations fail
    // closed just like declarations owned by another source file.
    if source == nil || source != ctx.File {
      return true
    }
    if unicornPreventAbbreviationsDeclarationIsExportedOrAmbient(declaration) {
      return true
    }
  }
  return false
}

func unicornPreventAbbreviationsDeclarationIsExportedOrAmbient(declaration *shimast.Node) bool {
  if declaration == nil {
    return true
  }
  for owner := declaration; owner != nil; owner = owner.Parent {
    if owner.Flags&shimast.NodeFlagsAmbient != 0 ||
      owner.ModifierFlags()&shimast.ModifierFlagsAmbient != 0 {
      return true
    }
    if owner.Kind == shimast.KindSourceFile {
      break
    }
  }

  owner := declaration
  for current := declaration; current != nil; current = current.Parent {
    if current.Kind == shimast.KindVariableDeclaration {
      owner = current
      break
    }
    if current.Kind == shimast.KindParameter || current.Kind == shimast.KindCatchClause ||
      unicornPreventAbbreviationsIsFunctionLike(current) || current.Kind == shimast.KindSourceFile {
      break
    }
  }
  flags := shimast.GetCombinedModifierFlags(owner)
  namedExport := flags&shimast.ModifierFlagsExport != 0 && flags&shimast.ModifierFlagsDefault == 0
  return namedExport || flags&shimast.ModifierFlagsAmbient != 0
}

func collectUnicornPreventAbbreviationsComments(file *shimast.SourceFile) map[int]commentToken {
  comments := make(map[int]commentToken)
  forEachCommentToken(file, func(kind shimast.Kind, pos, end int) {
    comments[end] = commentToken{kind: kind, pos: pos, end: end}
  })
  return comments
}

func unicornPreventAbbreviationsParameterHasJSDoc(
  ctx *Context,
  parameter *shimast.Node,
  comments map[int]commentToken,
) bool {
  if ctx == nil || ctx.File == nil || parameter == nil {
    return false
  }
  function := parameter.Parent
  for function != nil && !unicornPreventAbbreviationsIsFunctionLike(function) {
    function = function.Parent
  }
  if function == nil {
    return false
  }
  commentable := function
  for commentable.Parent != nil {
    parent := commentable.Parent
    attachable := false
    switch parent.Kind {
    case shimast.KindVariableDeclaration,
      shimast.KindVariableDeclarationList,
      shimast.KindVariableStatement,
      shimast.KindPropertyDeclaration,
      shimast.KindPropertyAssignment,
      shimast.KindPropertySignature,
      shimast.KindTypeAliasDeclaration,
      shimast.KindExportAssignment,
      shimast.KindExpressionStatement:
      attachable = true
    case shimast.KindBinaryExpression:
      expression := parent.AsBinaryExpression()
      attachable = expression != nil && expression.Right == commentable &&
        expression.OperatorToken != nil && isAssignmentOperator(expression.OperatorToken.Kind)
    case shimast.KindParenthesizedExpression,
      shimast.KindAsExpression,
      shimast.KindSatisfiesExpression,
      shimast.KindNonNullExpression,
      shimast.KindTypeAssertionExpression:
      attachable = parent.Expression() == commentable
    }
    if !attachable {
      break
    }
    commentable = parent
  }
  start, _ := tokenRange(ctx.File, commentable)
  if start <= 0 {
    return false
  }
  text := ctx.File.Text()
  prefix := strings.TrimRightFunc(text[:start], unicode.IsSpace)
  attached, ok := comments[len(prefix)]
  if !ok || attached.kind != shimast.KindMultiLineCommentTrivia ||
    attached.pos < 0 || attached.end > len(text) ||
    !strings.HasPrefix(text[attached.pos:attached.end], "/**") {
    return false
  }
  if unicornPreventAbbreviationsLineBreakCount(text[attached.end:start]) > 1 {
    return false
  }
  comment := text[attached.pos:attached.end]
  for offset := 0; ; {
    index := strings.Index(comment[offset:], "@param")
    if index < 0 {
      return false
    }
    end := offset + index + len("@param")
    if end == len(comment) || !unicornPreventAbbreviationsRegExpWordByte(comment[end]) {
      return true
    }
    offset = end
  }
}

func unicornPreventAbbreviationsLineBreakCount(text string) int {
  count := 0
  for index := 0; index < len(text); {
    character, size := utf8.DecodeRuneInString(text[index:])
    switch character {
    case '\r':
      count++
      if index+size < len(text) && text[index+size] == '\n' {
        size++
      }
    case '\n', '\u2028', '\u2029':
      count++
    }
    index += size
  }
  return count
}

// JavaScript's /\b/u word boundary still uses ASCII \w semantics.
func unicornPreventAbbreviationsRegExpWordByte(character byte) bool {
  return character >= 'a' && character <= 'z' ||
    character >= 'A' && character <= 'Z' ||
    character >= '0' && character <= '9' || character == '_'
}

func unicornPreventAbbreviationsRenameEdits(
  ctx *Context,
  binding *unicornPreventAbbreviationsBinding,
  replacement string,
) []TextEdit {
  if !unicornPreventAbbreviationsValidIdentifier(replacement) {
    return nil
  }
  edits := make([]TextEdit, 0, len(binding.references))
  seen := make(map[[2]int]struct{}, len(binding.references))
  for _, reference := range binding.references {
    pos, end := tokenRange(ctx.File, reference)
    if pos < 0 || end <= pos {
      return nil
    }
    key := [2]int{pos, end}
    if _, duplicate := seen[key]; duplicate {
      continue
    }
    seen[key] = struct{}{}
    edits = append(edits, TextEdit{
      Pos:  pos,
      End:  end,
      Text: unicornPreventAbbreviationsReferenceReplacement(reference, binding.name, replacement),
    })
  }
  sort.Slice(edits, func(i, j int) bool {
    if edits[i].Pos == edits[j].Pos {
      return edits[i].End < edits[j].End
    }
    return edits[i].Pos < edits[j].Pos
  })
  return edits
}

func unicornPreventAbbreviationsReferenceReplacement(node *shimast.Node, oldName, newName string) string {
  if node == nil || node.Parent == nil {
    return newName
  }
  parent := node.Parent
  switch parent.Kind {
  case shimast.KindShorthandPropertyAssignment:
    shorthand := parent.AsShorthandPropertyAssignment()
    if shorthand != nil && shorthand.Name() == node {
      return oldName + ": " + newName
    }
  case shimast.KindBindingElement:
    element := parent.AsBindingElement()
    if element != nil && element.Name() == node && element.PropertyName == nil && element.DotDotDotToken == nil &&
      parent.Parent != nil && parent.Parent.Kind == shimast.KindObjectBindingPattern {
      return oldName + ": " + newName
    }
  case shimast.KindImportSpecifier:
    specifier := parent.AsImportSpecifier()
    if specifier != nil && specifier.Name() == node && specifier.PropertyName == nil {
      return oldName + " as " + newName
    }
  case shimast.KindExportSpecifier:
    specifier := parent.AsExportSpecifier()
    if specifier != nil && specifier.Name() == node && specifier.PropertyName == nil {
      return newName + " as " + oldName
    }
  }
  return newName
}

func unicornPreventAbbreviationsAvailableName(
  ctx *Context,
  binding *unicornPreventAbbreviationsBinding,
  desired string,
  scopes []*shimast.Node,
  occupied map[string][]unicornPreventAbbreviationsOccupiedName,
  generated map[string][]*unicornPreventAbbreviationsBinding,
) string {
  candidate := desired
  if !unicornPreventAbbreviationsValidIdentifier(candidate) {
    candidate += "_"
    if !unicornPreventAbbreviationsValidIdentifier(candidate) {
      return ""
    }
  }
  for unicornPreventAbbreviationsCheckerNameCollides(ctx, candidate, binding) ||
    unicornPreventAbbreviationsOccupiedNameCollides(candidate, binding.scope, occupied) ||
    unicornPreventAbbreviationsGeneratedNameCollides(candidate, binding, scopes, generated) {
    candidate += "_"
  }
  return candidate
}

// ResolveName covers every declaration visible where the renamed binding is
// declared or read, including compiler-provided globals which do not occur as
// identifier nodes in the source file. The unresolved-reference pass remains
// necessary because the checker intentionally returns nil for those names.
func unicornPreventAbbreviationsCheckerNameCollides(
  ctx *Context,
  name string,
  binding *unicornPreventAbbreviationsBinding,
) bool {
  if ctx == nil || ctx.Checker == nil || binding == nil {
    return false
  }
  meaning := shimast.SymbolFlagsValue | shimast.SymbolFlagsType |
    shimast.SymbolFlagsNamespace | shimast.SymbolFlagsAlias
  locations := make([]*shimast.Node, 0, len(binding.references)+1)
  locations = append(locations, binding.nameNode)
  locations = append(locations, binding.references...)
  seen := make(map[*shimast.Node]struct{}, len(locations))
  for _, location := range locations {
    if location == nil {
      continue
    }
    if _, duplicate := seen[location]; duplicate {
      continue
    }
    seen[location] = struct{}{}
    if ctx.Checker.ResolveName(name, location, meaning, false /*excludeGlobals*/) != nil {
      return true
    }
  }
  return false
}

// Each generated name retains its binding plus the precise scopes where it is
// declared or referenced. This allows legal shadowing while still detecting
// a newly renamed inner declaration that would capture an outer binding's read
// in a deeper descendant scope.
func unicornPreventAbbreviationsBindingReferenceScopes(
  binding *unicornPreventAbbreviationsBinding,
) []*shimast.Node {
  if binding == nil {
    return nil
  }
  scopes := make([]*shimast.Node, 0, len(binding.references)+1)
  seen := make(map[*shimast.Node]struct{}, len(binding.references)+1)
  add := func(scope *shimast.Node) {
    if _, duplicate := seen[scope]; duplicate {
      return
    }
    seen[scope] = struct{}{}
    scopes = append(scopes, scope)
  }
  add(binding.scope)
  for _, scope := range unicornPreventAbbreviationsVarRestrictedScopes(binding.declaration, binding.scope) {
    add(scope)
  }
  for _, reference := range binding.references {
    add(unicornPreventAbbreviationsReferenceScope(reference))
  }
  return scopes
}

// A var declaration is function-scoped, but ECMAScript early errors also
// prohibit it from crossing lexical declarations in any containing block,
// loop, switch, or catch before that function boundary. Record those syntactic
// containers in addition to the var binding's function scope.
func unicornPreventAbbreviationsVarRestrictedScopes(
  declaration *shimast.Node,
  bindingScope *shimast.Node,
) []*shimast.Node {
  root := unicornPreventAbbreviationsRootDeclaration(declaration)
  if root == nil || root.Kind != shimast.KindVariableDeclaration || root.Parent == nil ||
    root.Parent.Kind != shimast.KindVariableDeclarationList || !shimast.IsVar(root.Parent) {
    return nil
  }
  scopes := make([]*shimast.Node, 0)
  for current := root.Parent.Parent; current != nil && current != bindingScope; current = current.Parent {
    switch current.Kind {
    case shimast.KindBlock:
      if current.Parent == nil || !unicornPreventAbbreviationsIsFunctionLike(current.Parent) {
        scopes = append(scopes, current)
      }
    case shimast.KindCaseBlock,
      shimast.KindForStatement,
      shimast.KindForInStatement,
      shimast.KindForOfStatement,
      shimast.KindCatchClause:
      scopes = append(scopes, current)
    }
  }
  return scopes
}

func unicornPreventAbbreviationsOccupiedNameCollides(
  name string,
  scope *shimast.Node,
  names map[string][]unicornPreventAbbreviationsOccupiedName,
) bool {
  for _, occupied := range names[name] {
    if occupied.reference {
      if scope == nil || occupied.scope == nil || scope == occupied.scope ||
        unicornPreventAbbreviationsIsAncestor(scope, occupied.scope) {
        return true
      }
      continue
    }
    if scope == nil || occupied.scope == nil || scope == occupied.scope ||
      unicornPreventAbbreviationsIsAncestor(occupied.scope, scope) {
      return true
    }
  }
  return false
}

func unicornPreventAbbreviationsGeneratedNameCollides(
  name string,
  binding *unicornPreventAbbreviationsBinding,
  scopes []*shimast.Node,
  names map[string][]*unicornPreventAbbreviationsBinding,
) bool {
  for _, existing := range names[name] {
    existingScopes := unicornPreventAbbreviationsBindingReferenceScopes(existing)
    for _, scope := range scopes {
      for _, existingScope := range existingScopes {
        if scope == existingScope {
          return true
        }
      }
    }
    if binding == nil || existing == nil || binding.scope == nil || existing.scope == nil {
      return true
    }
    if unicornPreventAbbreviationsIsAncestor(binding.scope, existing.scope) {
      if unicornPreventAbbreviationsBindingHasReferenceInScope(binding, existing.scope) {
        return true
      }
    } else if unicornPreventAbbreviationsIsAncestor(existing.scope, binding.scope) {
      if unicornPreventAbbreviationsBindingHasReferenceInScope(existing, binding.scope) {
        return true
      }
    }
  }
  return false
}

func unicornPreventAbbreviationsBindingHasReferenceInScope(
  binding *unicornPreventAbbreviationsBinding,
  scope *shimast.Node,
) bool {
  if binding == nil || scope == nil {
    return true
  }
  for _, reference := range binding.references {
    referenceScope := unicornPreventAbbreviationsReferenceScope(reference)
    if referenceScope == nil || referenceScope == scope ||
      unicornPreventAbbreviationsIsAncestor(scope, referenceScope) {
      return true
    }
  }
  return false
}

func unicornPreventAbbreviationsIsAncestor(ancestor, node *shimast.Node) bool {
  for current := node.Parent; current != nil; current = current.Parent {
    if current == ancestor {
      return true
    }
  }
  return false
}

func reportUnicornPreventAbbreviationsProperty(
  ctx *Context,
  node *shimast.Node,
  options unicornPreventAbbreviationsOptions,
) {
  if node == nil || node.Kind != shimast.KindIdentifier || identifierText(node) == "__proto__" ||
    !unicornPreventAbbreviationsIsProperty(node) {
    return
  }
  name := identifierText(node)
  replacements := getUnicornPreventAbbreviationsNameReplacements(name, options, 3)
  if replacements.total == 0 {
    return
  }
  message := unicornPreventAbbreviationsMessage(name, replacements, "property")
  suggestions := make([]Suggestion, 0, len(replacements.samples))
  if replacements.total > 1 && (node.Parent == nil || node.Parent.Kind != shimast.KindExportSpecifier) {
    pos, end := tokenRange(ctx.File, node)
    if pos >= 0 {
      for _, replacement := range replacements.samples {
        // Property IdentifierNames may use reserved words; only lexical
        // identifier validity matters here.
        if !shimscanner.IsValidIdentifier(replacement) {
          continue
        }
        suggestions = append(suggestions, Suggestion{
          Title: fmt.Sprintf("Rename to `%s`.", replacement),
          Edits: []TextEdit{{Pos: pos, End: end, Text: replacement}},
        })
      }
    }
  }
  ctx.ReportFixSuggestions(node, message, nil, suggestions...)
}

func unicornPreventAbbreviationsIsProperty(node *shimast.Node) bool {
  if node == nil || node.Parent == nil {
    return false
  }
  parent := node.Parent
  switch parent.Kind {
  case shimast.KindPropertyAccessExpression:
    access := parent.AsPropertyAccessExpression()
    if access == nil || access.Name() != node || parent.Parent == nil {
      return false
    }
    switch parent.Parent.Kind {
    case shimast.KindBinaryExpression:
      expression := parent.Parent.AsBinaryExpression()
      return expression != nil && expression.Left == parent && expression.OperatorToken != nil &&
        isAssignmentOperator(expression.OperatorToken.Kind)
    case shimast.KindPrefixUnaryExpression:
      expression := parent.Parent.AsPrefixUnaryExpression()
      return expression != nil && expression.Operand == parent &&
        (expression.Operator == shimast.KindPlusPlusToken || expression.Operator == shimast.KindMinusMinusToken)
    case shimast.KindPostfixUnaryExpression:
      expression := parent.Parent.AsPostfixUnaryExpression()
      return expression != nil && expression.Operand == parent &&
        (expression.Operator == shimast.KindPlusPlusToken || expression.Operator == shimast.KindMinusMinusToken)
    }
  case shimast.KindPropertyAssignment:
    assignment := parent.AsPropertyAssignment()
    return assignment != nil && assignment.Name() == node &&
      !isDestructuringAssignmentTarget(parent)
  case shimast.KindMethodDeclaration,
    shimast.KindPropertyDeclaration,
    shimast.KindGetAccessor,
    shimast.KindSetAccessor,
    shimast.KindMethodSignature,
    shimast.KindPropertySignature:
    return parent.Name() == node
  case shimast.KindExportSpecifier:
    specifier := parent.AsExportSpecifier()
    return specifier != nil && specifier.PropertyName != nil && specifier.Name() == node
  }
  return false
}

func reportUnicornPreventAbbreviationsFilename(
  ctx *Context,
  node *shimast.Node,
  options unicornPreventAbbreviationsOptions,
) {
  filenameWithPath := ctx.File.FileName()
  if filenameWithPath == "" || unicornPreventAbbreviationsIsVirtualFilename(filenameWithPath) {
    return
  }
  filename := filepath.Base(filenameWithPath)
  extension := unicornPreventAbbreviationsFilenameExtension(filename)
  basename := strings.TrimSuffix(filename, extension)
  replacements := getUnicornPreventAbbreviationsNameReplacements(basename, options, 3)
  if replacements.total == 0 {
    return
  }
  for index := range replacements.samples {
    replacements.samples[index] += extension
  }
  ctx.Report(node, unicornPreventAbbreviationsMessage(filename, replacements, "filename"))
}

func unicornPreventAbbreviationsIsVirtualFilename(filename string) bool {
  return filename == "<input>" || filename == "<text>"
}

// Node's path.extname treats a leading-dot basename such as `.err` as having
// no extension, while filepath.Ext returns the whole basename. Preserve the
// upstream filename contract without changing platform-specific separators.
func unicornPreventAbbreviationsFilenameExtension(filename string) string {
  extension := filepath.Ext(filename)
  if extension == filename {
    return ""
  }
  return extension
}

func getUnicornPreventAbbreviationsNameReplacements(
  name string,
  options unicornPreventAbbreviationsOptions,
  limit int,
) unicornPreventAbbreviationsNameReplacements {
  if name == "" || unicornPreventAbbreviationsUppercase(name) == name || options.allowList[name] {
    return unicornPreventAbbreviationsNameReplacements{}
  }
  for _, pattern := range options.ignore {
    if pattern.MatchString(name) {
      return unicornPreventAbbreviationsNameReplacements{}
    }
  }

  exact := getUnicornPreventAbbreviationsWordReplacements(name, options)
  if len(exact) > 0 {
    total := len(exact)
    if len(exact) > limit {
      exact = exact[:limit]
    }
    return unicornPreventAbbreviationsNameReplacements{total: total, samples: exact}
  }

  words := splitUnicornPreventAbbreviationsWords(name)
  combinations := make([][]string, 0, len(words))
  total := 1
  changed := false
  for _, word := range words {
    replacements := getUnicornPreventAbbreviationsWordReplacements(word, options)
    if len(replacements) == 0 {
      replacements = []string{word}
    } else {
      changed = true
    }
    combinations = append(combinations, replacements)
    if total > math.MaxInt/len(replacements) {
      total = math.MaxInt
    } else {
      total *= len(replacements)
    }
  }
  if !changed {
    return unicornPreventAbbreviationsNameReplacements{}
  }
  samples := cartesianUnicornPreventAbbreviationsSamples(combinations, limit)
  for index, parts := range samples {
    for part := len(parts) - 1; part > 0; part-- {
      if unicornPreventAbbreviationsASCIIWord(parts[part]) && strings.HasSuffix(parts[part-1], parts[part]) {
        parts = append(parts[:part], parts[part+1:]...)
      }
    }
    samples[index] = parts
  }
  joined := make([]string, 0, len(samples))
  for _, parts := range samples {
    joined = append(joined, strings.Join(parts, ""))
  }
  return unicornPreventAbbreviationsNameReplacements{total: total, samples: joined}
}

func getUnicornPreventAbbreviationsWordReplacements(
  word string,
  options unicornPreventAbbreviationsOptions,
) []string {
  if word == "" || unicornPreventAbbreviationsUppercase(word) == word || options.allowList[word] {
    return nil
  }
  keys := []string{
    lowerUnicornPreventAbbreviationsFirst(word),
    word,
    upperUnicornPreventAbbreviationsFirst(word),
  }
  var replacements []string
  for _, key := range keys {
    if configured, ok := options.replacements[key]; ok {
      replacements = configured
      break
    }
  }
  if len(replacements) == 0 {
    return nil
  }
  transformed := make([]string, 0, len(replacements))
  upperFirst := unicornPreventAbbreviationsStartsUpper(word)
  for _, replacement := range replacements {
    if upperFirst {
      transformed = append(transformed, upperUnicornPreventAbbreviationsFirst(replacement))
    } else {
      transformed = append(transformed, lowerUnicornPreventAbbreviationsFirst(replacement))
    }
  }
  sort.Strings(transformed)
  return transformed
}

func splitUnicornPreventAbbreviationsWords(name string) []string {
  runes := []rune(name)
  if len(runes) == 0 {
    return nil
  }
  words := make([]string, 0, len(runes))
  start := 0
  flush := func(end int) {
    if end > start {
      words = append(words, string(runes[start:end]))
    }
    start = end
  }
  for index, current := range runes {
    if index == 0 {
      continue
    }
    // This is the rune-level equivalent of upstream's
    // /(?=\P{Lowercase_Letter})|(?<=\P{Letter})/u split expression.
    if !unicode.Is(unicode.Ll, current) || !unicode.IsLetter(runes[index-1]) {
      flush(index)
    }
  }
  flush(len(runes))
  return words
}

func cartesianUnicornPreventAbbreviationsSamples(parts [][]string, limit int) [][]string {
  if len(parts) == 0 || limit <= 0 {
    return nil
  }
  samples := make([][]string, 0, limit)
  current := make([]string, len(parts))
  var visit func(int)
  visit = func(index int) {
    if len(samples) >= limit {
      return
    }
    if index == len(parts) {
      samples = append(samples, append([]string(nil), current...))
      return
    }
    for _, value := range parts[index] {
      current[index] = value
      visit(index + 1)
      if len(samples) >= limit {
        return
      }
    }
  }
  visit(0)
  return samples
}

func unicornPreventAbbreviationsMessage(
  discouragedName string,
  replacements unicornPreventAbbreviationsNameReplacements,
  nameType string,
) string {
  const suffix = " A more descriptive name will do too."
  if replacements.total == 1 && len(replacements.samples) == 1 {
    return fmt.Sprintf(
      "The %s `%s` should be named `%s`.%s",
      nameType,
      discouragedName,
      replacements.samples[0],
      suffix,
    )
  }
  names := make([]string, 0, len(replacements.samples))
  for _, replacement := range replacements.samples {
    names = append(names, "`"+replacement+"`")
  }
  rendered := strings.Join(names, ", ")
  omitted := replacements.total - len(replacements.samples)
  if omitted > 0 {
    count := fmt.Sprintf("%d", omitted)
    if omitted > 99 {
      count = "99+"
    }
    rendered += fmt.Sprintf(", ... (%s more omitted)", count)
  }
  return fmt.Sprintf(
    "Please rename the %s `%s`. Suggested names are: %s.%s",
    nameType,
    discouragedName,
    rendered,
    suffix,
  )
}

func unicornPreventAbbreviationsValidIdentifier(name string) bool {
  if !shimscanner.IsValidIdentifier(name) {
    return false
  }
  if _, reserved := unicornPreventAbbreviationsReservedWords[name]; reserved {
    return false
  }
  return true
}

func unicornPreventAbbreviationsASCIIWord(value string) bool {
  if value == "" {
    return false
  }
  for _, character := range value {
    if character > unicode.MaxASCII || !unicode.IsLetter(character) {
      return false
    }
  }
  return true
}

func unicornPreventAbbreviationsStartsUpper(value string) bool {
  first, size := utf8.DecodeRuneInString(value)
  // Upstream compares the first UTF-16 code unit with its upper-case form.
  // Consequently uncased ASCII characters (`$`, `_`, digits) and either half
  // of an astral rune count as upper-first too.
  return first > 0xFFFF || unicornPreventAbbreviationsUppercase(value[:size]) == value[:size]
}

func lowerUnicornPreventAbbreviationsFirst(value string) string {
  first, size := utf8.DecodeRuneInString(value)
  if size == 0 {
    return value
  }
  // JavaScript's charAt(0) sees only the high surrogate of an astral rune, so
  // the final upstream implementation leaves that first rune unchanged.
  if first > 0xFFFF {
    return value
  }
  if first <= unicode.MaxASCII {
    return string(unicode.ToLower(first)) + value[size:]
  }
  return cases.Lower(language.Und).String(value[:size]) + value[size:]
}

func upperUnicornPreventAbbreviationsFirst(value string) string {
  first, size := utf8.DecodeRuneInString(value)
  if size == 0 {
    return value
  }
  if first > 0xFFFF {
    return value
  }
  if first <= unicode.MaxASCII {
    return string(unicode.ToUpper(first)) + value[size:]
  }
  return unicornPreventAbbreviationsUppercase(value[:size]) + value[size:]
}

func unicornPreventAbbreviationsUppercase(value string) string {
  for index := 0; index < len(value); index++ {
    if value[index] >= utf8.RuneSelf {
      return cases.Upper(language.Und).String(value)
    }
  }
  return strings.ToUpper(value)
}

func init() {
  Register(unicornPreventAbbreviations{})
}
