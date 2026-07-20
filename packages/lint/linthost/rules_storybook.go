// Storybook CSF and interaction rules. These are AST-only ports of the
// public eslint-plugin-storybook rule surface that applies to TypeScript,
// TSX story files, and `.storybook/main.ts` addon configs.
package linthost

import (
  "encoding/json"
  "os"
  "path/filepath"
  "regexp"
  "strings"
  "unicode"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

type storybookAwaitInteractions struct{}

func (storybookAwaitInteractions) Name() string { return "storybook/await-interactions" }
func (storybookAwaitInteractions) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (storybookAwaitInteractions) Check(ctx *Context, node *shimast.Node) {
  walkDescendants(node, func(child *shimast.Node) {
    if child == nil || child.Kind != shimast.KindCallExpression || storybookCallIsAwaited(child) || storybookCallIsReturned(child) {
      return
    }
    call := child.AsCallExpression()
    if call == nil {
      return
    }
    if method := storybookAwaitedMethodName(call); method != "" {
      ctx.Report(child, "Interaction should be awaited: "+method+".")
    }
  })
}

type storybookContextInPlayFunction struct{}

func (storybookContextInPlayFunction) Name() string { return "storybook/context-in-play-function" }
func (storybookContextInPlayFunction) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (storybookContextInPlayFunction) Check(ctx *Context, node *shimast.Node) {
  walkDescendants(node, func(child *shimast.Node) {
    if child == nil || child.Kind != shimast.KindCallExpression {
      return
    }
    call := child.AsCallExpression()
    if call == nil || !storybookIsPlayCall(call.Expression) {
      return
    }
    contextName := storybookEnclosingFunctionContextName(child)
    if contextName == "" || !storybookCallPassesContext(call, contextName) {
      ctx.Report(child, "Pass a context when invoking play function of another story.")
    }
  })
}

type storybookCsfComponent struct{}

func (storybookCsfComponent) Name() string { return "storybook/csf-component" }
func (storybookCsfComponent) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (storybookCsfComponent) Check(ctx *Context, node *shimast.Node) {
  meta := storybookDefaultMeta(ctx.File)
  if meta == nil || meta.Object == nil {
    return
  }
  if _, _, ok := storybookObjectProperty(meta.Object, "component"); !ok {
    ctx.Report(meta.Node, "Missing component property.")
  }
}

type storybookDefaultExports struct{}

func (storybookDefaultExports) Name() string { return "storybook/default-exports" }
func (storybookDefaultExports) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (storybookDefaultExports) Check(ctx *Context, node *shimast.Node) {
  if storybookHasDefaultExport(ctx.File) || storybookHasStoriesOfImport(ctx.File) || storybookHasCsf4MetaCall(ctx.File) {
    return
  }
  ctx.Report(storybookFirstNonImportStatement(ctx.File, node), "The file should have a default export.")
}

type storybookHierarchySeparator struct{}

func (storybookHierarchySeparator) Name() string { return "storybook/hierarchy-separator" }

// DiagnosticTags strikes the separator through: `|` is Storybook's superseded
// hierarchy separator, and a title that uses it still renders — Storybook
// keeps reading it — so the finding is exactly "this still works, migrate off
// it", never "delete this title property".
func (storybookHierarchySeparator) DiagnosticTags() []publicrule.DiagnosticTag {
  return []publicrule.DiagnosticTag{publicrule.DiagnosticTagDeprecated}
}
func (storybookHierarchySeparator) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (storybookHierarchySeparator) Check(ctx *Context, node *shimast.Node) {
  meta := storybookDefaultMeta(ctx.File)
  if meta == nil || meta.Object == nil {
    return
  }
  _, value, ok := storybookObjectProperty(meta.Object, "title")
  if !ok || !strings.Contains(storybookLiteralString(value), "|") {
    return
  }
  pos, end, ok := storybookLiteralPipeRange(ctx.File, value)
  if !ok {
    return
  }
  ctx.ReportRange(pos, end, "Deprecated hierarchy separator in title property.")
}

// storybookLiteralPipeRange returns the raw source range of one `|` that the
// parser decoded from a title literal. The tagged diagnostic must cover the
// deprecated separator itself, not the still-live title property around it.
//
// A pipe can be written directly or as an active `\\|`, `\\x7C`, `\\u007C`, or
// `\\u{7C}` escape. Every spelling below evaluates to the same separator, and
// reporting its complete raw escape keeps the editor range valid for each.
func storybookLiteralPipeRange(file *shimast.SourceFile, node *shimast.Node) (int, int, bool) {
  pos, end := tokenRange(file, node)
  if pos < 0 {
    return 0, 0, false
  }
  src := file.Text()
  for index := pos; index < end; {
    if src[index] == '|' {
      return index, index + 1, true
    }
    if src[index] != '\\' {
      index++
      continue
    }
    start := index
    for index < end && src[index] == '\\' {
      index++
    }
    if (index-start)%2 == 0 || index >= end {
      continue
    }
    active := index - 1
    switch src[index] {
    case '|':
      return active, index + 1, true
    case 'x':
      if index+2 < end && hexDigit(src[index+1])*16+hexDigit(src[index+2]) == int('|') {
        return active, index + 3, true
      }
    case 'u':
      if index+1 < end && src[index+1] == '{' {
        close := index + 2
        value := 0
        for close < end && hexDigit(src[close]) >= 0 {
          value = value*16 + hexDigit(src[close])
          close++
        }
        if close > index+2 && close < end && src[close] == '}' && value == int('|') {
          return active, close + 1, true
        }
      } else if index+4 < end &&
        hexDigit(src[index+1])*4096+hexDigit(src[index+2])*256+hexDigit(src[index+3])*16+hexDigit(src[index+4]) == int('|') {
        return active, index + 5, true
      }
    }
    index++
  }
  return 0, 0, false
}

type storybookMetaInlineProperties struct{}

func (storybookMetaInlineProperties) Name() string { return "storybook/meta-inline-properties" }
func (storybookMetaInlineProperties) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (storybookMetaInlineProperties) Check(ctx *Context, node *shimast.Node) {
  meta := storybookDefaultMeta(ctx.File)
  if meta == nil || meta.Object == nil {
    return
  }
  for _, name := range []string{"title", "args"} {
    prop, value, ok := storybookObjectProperty(meta.Object, name)
    if ok && !storybookIsInlineMetaValue(value) {
      ctx.Report(prop, "Meta should only have inline properties: "+name+".")
    }
  }
}

type storybookMetaSatisfiesType struct{}

func (storybookMetaSatisfiesType) Name() string { return "storybook/meta-satisfies-type" }
func (storybookMetaSatisfiesType) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (storybookMetaSatisfiesType) Check(ctx *Context, node *shimast.Node) {
  meta := storybookDefaultMeta(ctx.File)
  if meta == nil || meta.Object == nil || meta.Satisfies {
    return
  }
  ctx.Report(meta.Object, "CSF Meta should use `satisfies` for type safety.")
}

type storybookNoRedundantStoryName struct{}

func (storybookNoRedundantStoryName) Name() string { return "storybook/no-redundant-story-name" }

// DiagnosticTags greys the redundant annotation out. Both arms of this rule
// report an annotation that restates the name Storybook already derives from
// the export identifier — the object property in one, the `Story.storyName =`
// assignment in the other — and each is reported at exactly the range whose
// deletion is the whole resolution.
func (storybookNoRedundantStoryName) DiagnosticTags() []publicrule.DiagnosticTag {
  return []publicrule.DiagnosticTag{publicrule.DiagnosticTagUnnecessary}
}
func (storybookNoRedundantStoryName) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (storybookNoRedundantStoryName) Check(ctx *Context, node *shimast.Node) {
  for _, story := range storybookNamedExports(ctx.File) {
    if story.Init == nil || story.Init.Kind != shimast.KindObjectLiteralExpression {
      continue
    }
    for _, propName := range []string{"name", "storyName"} {
      prop, value, ok := storybookObjectProperty(story.Init, propName)
      if ok && storybookLiteralString(value) == storybookNameFromExport(story.Name) {
        ctx.Report(prop, "Named exports should not use a redundant story name annotation.")
      }
    }
  }
  walkDescendants(node, func(child *shimast.Node) {
    if child == nil || child.Kind != shimast.KindBinaryExpression {
      return
    }
    expr := child.AsBinaryExpression()
    if expr == nil || expr.OperatorToken == nil || expr.OperatorToken.Kind != shimast.KindEqualsToken {
      return
    }
    objectName, propName := storybookPropertyAccessParts(expr.Left)
    if propName == "storyName" && storybookLiteralString(expr.Right) == storybookNameFromExport(objectName) {
      ctx.Report(child, "Named exports should not use a redundant story name annotation.")
    }
  })
}

type storybookNoRendererPackages struct{}

func (storybookNoRendererPackages) Name() string { return "storybook/no-renderer-packages" }
func (storybookNoRendererPackages) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindImportDeclaration}
}
func (storybookNoRendererPackages) Check(ctx *Context, node *shimast.Node) {
  decl := node.AsImportDeclaration()
  if decl == nil {
    return
  }
  frameworks, ok := storybookRendererPackages[storybookLiteralString(decl.ModuleSpecifier)]
  if !ok || len(frameworks) == 0 {
    return
  }
  message := "Do not import Storybook renderer packages directly. Use a framework package instead: " +
    storybookDisjunction(frameworks) + "."
  pos, end, quoted := storybookQuotedTextRange(ctx.File, decl.ModuleSpecifier)
  if !quoted {
    ctx.Report(node, message)
    return
  }
  suggestions := make([]Suggestion, 0, len(frameworks))
  for _, framework := range frameworks {
    suggestions = append(suggestions, Suggestion{
      Title: "Import from `" + framework + "`.",
      Edits: []TextEdit{{Pos: pos, End: end, Text: framework}},
    })
  }
  ctx.ReportFixSuggestions(node, message, nil, suggestions...)
}

// storybookDisjunction renders a package list the way upstream's
// `Intl.ListFormat("en-US", {type: "disjunction"})` does: "a", "a or b",
// "a, b, or c".
func storybookDisjunction(items []string) string {
  quoted := make([]string, 0, len(items))
  for _, item := range items {
    quoted = append(quoted, "`"+item+"`")
  }
  switch len(quoted) {
  case 0:
    return ""
  case 1:
    return quoted[0]
  case 2:
    return quoted[0] + " or " + quoted[1]
  default:
    return strings.Join(quoted[:len(quoted)-1], ", ") + ", or " + quoted[len(quoted)-1]
  }
}

// storybookQuotedTextRange returns the byte range of the text inside a string
// literal's quotes, so a rewrite replaces the contents and leaves the
// surrounding quote characters exactly as the author wrote them. Reports false
// for anything that is not a plainly quoted literal, such as a
// parse-recovered node with no closing quote.
func storybookQuotedTextRange(file *shimast.SourceFile, node *shimast.Node) (int, int, bool) {
  pos, end := tokenRange(file, node)
  if pos < 0 || end-pos < 2 {
    return 0, 0, false
  }
  src := file.Text()
  quote := src[pos]
  if quote != '"' && quote != '\'' {
    return 0, 0, false
  }
  if src[end-1] != quote {
    return 0, 0, false
  }
  return pos + 1, end - 1, true
}

type storybookNoStoriesOf struct{}

func (storybookNoStoriesOf) Name() string { return "storybook/no-stories-of" }

// DiagnosticTags strikes the `storiesOf` import specifier through. The builder
// API is deprecated in favor of CSF but still runs, and the whole reported
// range is the specifier that names it, so migration — not deletion — is the
// instruction the editor should render.
func (storybookNoStoriesOf) DiagnosticTags() []publicrule.DiagnosticTag {
  return []publicrule.DiagnosticTag{publicrule.DiagnosticTagDeprecated}
}
func (storybookNoStoriesOf) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindImportSpecifier}
}
func (storybookNoStoriesOf) Check(ctx *Context, node *shimast.Node) {
  spec := node.AsImportSpecifier()
  if spec != nil && storybookImportSpecifierImportedName(spec) == "storiesOf" {
    reported := spec.Name()
    if spec.PropertyName != nil {
      reported = spec.PropertyName
    }
    ctx.Report(reported, "storiesOf is deprecated and should not be used.")
  }
}

type storybookNoTitlePropertyInMeta struct{}

func (storybookNoTitlePropertyInMeta) Name() string { return "storybook/no-title-property-in-meta" }

// DiagnosticTags greys the `title` property out. CSF3 derives a story's title
// from the file's location on disk, so the property is dead weight rather than
// a wrong value, and the reported range is the property itself: removing
// exactly what the editor fades is the resolution.
func (storybookNoTitlePropertyInMeta) DiagnosticTags() []publicrule.DiagnosticTag {
  return []publicrule.DiagnosticTag{publicrule.DiagnosticTagUnnecessary}
}
func (storybookNoTitlePropertyInMeta) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (storybookNoTitlePropertyInMeta) Check(ctx *Context, node *shimast.Node) {
  meta := storybookDefaultMeta(ctx.File)
  if meta == nil || meta.Object == nil {
    return
  }
  if prop, _, ok := storybookObjectProperty(meta.Object, "title"); ok {
    ctx.Report(prop, "CSF3 does not need a title in meta.")
  }
}

type storybookNoUninstalledAddons struct{ optionsRule }

type storybookNoUninstalledAddonsOptions struct {
  PackageJSONLocation string   `json:"packageJsonLocation"`
  Ignore              []string `json:"ignore"`
}

func (storybookNoUninstalledAddons) Name() string { return "storybook/no-uninstalled-addons" }
func (storybookNoUninstalledAddons) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (storybookNoUninstalledAddons) Check(ctx *Context, node *shimast.Node) {
  opts := storybookNoUninstalledAddonsOptions{}
  _ = ctx.DecodeOptions(&opts)
  installed := storybookInstalledPackages(ctx.File, opts.PackageJSONLocation)
  if len(installed) == 0 {
    return
  }
  ignore := map[string]struct{}{}
  for _, item := range opts.Ignore {
    ignore[item] = struct{}{}
  }
  for _, addon := range storybookAddonEntries(ctx.File) {
    normalized := storybookNormalizeAddonName(addon.Name)
    if normalized == "" || storybookIsLocalAddon(addon.Name) {
      continue
    }
    if _, ok := ignore[addon.Name]; ok {
      continue
    }
    if _, ok := installed[normalized]; !ok {
      ctx.Report(addon.Node, "Storybook addon "+addon.Name+" is not installed in package.json.")
    }
  }
}

type storybookPreferPascalCase struct{}

func (storybookPreferPascalCase) Name() string { return "storybook/prefer-pascal-case" }
func (storybookPreferPascalCase) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (storybookPreferPascalCase) Check(ctx *Context, node *shimast.Node) {
  if storybookHasStoriesOfImport(ctx.File) {
    return
  }
  filters := storybookStoryFilters(storybookDefaultMeta(ctx.File))
  for _, story := range storybookNamedExports(ctx.File) {
    if story.Name == "" || strings.HasPrefix(story.Name, "_") || !storybookIsStoryExport(story.Name, filters) {
      continue
    }
    if !storybookIsPascalCase(story.Name) {
      ctx.Report(story.Node, "The story should use PascalCase notation: "+story.Name+".")
    }
  }
}

type storybookStoryExports struct{}

func (storybookStoryExports) Name() string { return "storybook/story-exports" }
func (storybookStoryExports) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (storybookStoryExports) Check(ctx *Context, node *shimast.Node) {
  meta := storybookDefaultMeta(ctx.File)
  if meta == nil || storybookHasStoriesOfImport(ctx.File) {
    return
  }
  filters := storybookStoryFilters(meta)
  for _, story := range storybookNamedExports(ctx.File) {
    if storybookIsStoryExport(story.Name, filters) {
      return
    }
  }
  ctx.Report(storybookFirstNonImportStatement(ctx.File, node), "The file should have at least one story export.")
}

type storybookUseStorybookExpect struct{}

func (storybookUseStorybookExpect) Name() string { return "storybook/use-storybook-expect" }
func (storybookUseStorybookExpect) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (storybookUseStorybookExpect) Check(ctx *Context, node *shimast.Node) {
  if storybookHasNamedImport(ctx.File, "expect", "@storybook/test", "storybook/test", "@storybook/jest") {
    return
  }
  walkDescendants(node, func(child *shimast.Node) {
    if child == nil || child.Kind != shimast.KindCallExpression {
      return
    }
    call := child.AsCallExpression()
    if call != nil && identifierText(call.Expression) == "expect" {
      ctx.Report(call.Expression, "Do not use global expect directly in the story. Import it from @storybook/test instead.")
    }
  })
}

type storybookUseStorybookTestingLibrary struct{}

func (storybookUseStorybookTestingLibrary) Name() string {
  return "storybook/use-storybook-testing-library"
}
func (storybookUseStorybookTestingLibrary) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindImportDeclaration}
}
func (storybookUseStorybookTestingLibrary) Check(ctx *Context, node *shimast.Node) {
  decl := node.AsImportDeclaration()
  if decl == nil {
    return
  }
  module := storybookLiteralString(decl.ModuleSpecifier)
  if strings.Contains(module, "@testing-library") {
    ctx.Report(node, "Do not use "+module+" directly in the story. Import from storybook/test instead.")
  }
}

type storybookMetaInfo struct {
  File      *shimast.SourceFile
  Node      *shimast.Node
  Object    *shimast.Node
  Satisfies bool
}

type storybookNamedExport struct {
  Name string
  Node *shimast.Node
  Init *shimast.Node
}

type storybookStoryFiltersInfo struct {
  Include []storybookDescriptor
  Exclude []storybookDescriptor
}

type storybookDescriptor struct {
  Text    string
  Pattern *regexp.Regexp
}

type storybookAddonEntry struct {
  Name string
  Node *shimast.Node
}

var storybookRendererPackages = map[string][]string{
  "@storybook/html":           {"@storybook/html-vite", "@storybook/html-webpack5"},
  "@storybook/preact":         {"@storybook/preact-vite", "@storybook/preact-webpack5"},
  "@storybook/react":          {"@storybook/nextjs", "@storybook/react-vite", "@storybook/react-webpack5"},
  "@storybook/server":         {"@storybook/server-webpack5"},
  "@storybook/svelte":         {"@storybook/svelte-vite", "@storybook/svelte-webpack5", "@storybook/sveltekit"},
  "@storybook/vue3":           {"@storybook/vue3-vite", "@storybook/vue3-webpack5"},
  "@storybook/web-components": {"@storybook/web-components-vite", "@storybook/web-components-webpack5"},
}

func storybookDefaultMeta(file *shimast.SourceFile) *storybookMetaInfo {
  if file == nil || file.Statements == nil {
    return nil
  }
  variables := storybookTopLevelVariables(file)
  for _, stmt := range file.Statements.Nodes {
    if stmt == nil {
      continue
    }
    if stmt.Kind == shimast.KindExportAssignment {
      assignment := stmt.AsExportAssignment()
      if assignment == nil || assignment.IsExportEquals {
        continue
      }
      expr := assignment.Expression
      if name := identifierText(expr); name != "" {
        expr = variables[name]
      }
      object, satisfies := storybookMetaObjectExpression(expr)
      if object != nil {
        return &storybookMetaInfo{File: file, Node: stmt, Object: object, Satisfies: satisfies}
      }
    }
    if hasModifier(stmt, shimast.KindExportKeyword) && hasModifier(stmt, shimast.KindDefaultKeyword) {
      if stmt.Kind == shimast.KindVariableStatement {
        if found := storybookDefaultMetaFromVariableStatement(file, stmt); found != nil {
          return found
        }
      }
    }
  }
  return nil
}

func storybookDefaultMetaFromVariableStatement(file *shimast.SourceFile, stmt *shimast.Node) *storybookMetaInfo {
  varStmt := stmt.AsVariableStatement()
  if varStmt == nil || varStmt.DeclarationList == nil {
    return nil
  }
  list := varStmt.DeclarationList.AsVariableDeclarationList()
  if list == nil || list.Declarations == nil || len(list.Declarations.Nodes) == 0 {
    return nil
  }
  decl := list.Declarations.Nodes[0].AsVariableDeclaration()
  if decl == nil {
    return nil
  }
  object, satisfies := storybookMetaObjectExpression(decl.Initializer)
  if object == nil {
    return nil
  }
  return &storybookMetaInfo{File: file, Node: stmt, Object: object, Satisfies: satisfies}
}

func storybookMetaObjectExpression(expr *shimast.Node) (*shimast.Node, bool) {
  satisfies := false
  for expr != nil {
    switch expr.Kind {
    case shimast.KindParenthesizedExpression:
      paren := expr.AsParenthesizedExpression()
      if paren == nil {
        return nil, satisfies
      }
      expr = paren.Expression
    case shimast.KindAsExpression:
      as := expr.AsAsExpression()
      if as == nil {
        return nil, satisfies
      }
      expr = as.Expression
    case shimast.KindSatisfiesExpression:
      sat := expr.AsSatisfiesExpression()
      if sat == nil {
        return nil, satisfies
      }
      satisfies = true
      expr = sat.Expression
    case shimast.KindTypeAssertionExpression:
      assertion := expr.AsTypeAssertion()
      if assertion == nil {
        return nil, satisfies
      }
      expr = assertion.Expression
    default:
      if expr.Kind == shimast.KindObjectLiteralExpression {
        return expr, satisfies
      }
      return nil, satisfies
    }
  }
  return nil, satisfies
}

func storybookHasDefaultExport(file *shimast.SourceFile) bool {
  if file == nil || file.Statements == nil {
    return false
  }
  for _, stmt := range file.Statements.Nodes {
    if stmt == nil {
      continue
    }
    if stmt.Kind == shimast.KindExportAssignment {
      assignment := stmt.AsExportAssignment()
      if assignment != nil && !assignment.IsExportEquals {
        return true
      }
    }
    if hasModifier(stmt, shimast.KindExportKeyword) && hasModifier(stmt, shimast.KindDefaultKeyword) {
      return true
    }
    if storybookExportsDefaultSpecifier(stmt) {
      return true
    }
  }
  return false
}

func storybookExportsDefaultSpecifier(stmt *shimast.Node) bool {
  if stmt == nil || stmt.Kind != shimast.KindExportDeclaration {
    return false
  }
  decl := stmt.AsExportDeclaration()
  if decl == nil || decl.ExportClause == nil || decl.ExportClause.Kind != shimast.KindNamedExports {
    return false
  }
  exports := decl.ExportClause.AsNamedExports()
  if exports == nil || exports.Elements == nil {
    return false
  }
  for _, item := range exports.Elements.Nodes {
    spec := item.AsExportSpecifier()
    if spec != nil && identifierText(spec.Name()) == "default" {
      return true
    }
  }
  return false
}

func storybookTopLevelVariables(file *shimast.SourceFile) map[string]*shimast.Node {
  variables := map[string]*shimast.Node{}
  if file == nil || file.Statements == nil {
    return variables
  }
  for _, stmt := range file.Statements.Nodes {
    if stmt == nil || stmt.Kind != shimast.KindVariableStatement {
      continue
    }
    varStmt := stmt.AsVariableStatement()
    if varStmt == nil || varStmt.DeclarationList == nil {
      continue
    }
    list := varStmt.DeclarationList.AsVariableDeclarationList()
    if list == nil || list.Declarations == nil {
      continue
    }
    for _, item := range list.Declarations.Nodes {
      decl := item.AsVariableDeclaration()
      if decl != nil {
        if name := identifierText(decl.Name()); name != "" {
          variables[name] = decl.Initializer
        }
      }
    }
  }
  return variables
}

func storybookObjectProperty(object *shimast.Node, name string) (*shimast.Node, *shimast.Node, bool) {
  if object == nil || object.Kind != shimast.KindObjectLiteralExpression {
    return nil, nil, false
  }
  obj := object.AsObjectLiteralExpression()
  if obj == nil || obj.Properties == nil {
    return nil, nil, false
  }
  for _, prop := range obj.Properties.Nodes {
    if prop == nil || prop.Kind != shimast.KindPropertyAssignment {
      continue
    }
    assignment := prop.AsPropertyAssignment()
    if assignment == nil || storybookPropertyName(assignment.Name()) != name {
      continue
    }
    return prop, assignment.Initializer, true
  }
  for _, prop := range obj.Properties.Nodes {
    if prop == nil || prop.Kind != shimast.KindShorthandPropertyAssignment {
      continue
    }
    assignment := prop.AsShorthandPropertyAssignment()
    if assignment != nil && storybookPropertyName(assignment.Name()) == name {
      return prop, nil, true
    }
  }
  return nil, nil, false
}

func storybookPropertyName(node *shimast.Node) string {
  if text := identifierText(node); text != "" {
    return text
  }
  return storybookLiteralString(node)
}

func storybookLiteralString(node *shimast.Node) string {
  node = stripParens(node)
  if node == nil {
    return ""
  }
  switch node.Kind {
  case shimast.KindStringLiteral:
    if lit := node.AsStringLiteral(); lit != nil {
      return lit.Text
    }
  case shimast.KindNoSubstitutionTemplateLiteral:
    if lit := node.AsNoSubstitutionTemplateLiteral(); lit != nil {
      return lit.Text
    }
  }
  return ""
}

func storybookIsInlineMetaValue(node *shimast.Node) bool {
  node = stripParens(node)
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindObjectLiteralExpression,
    shimast.KindArrayLiteralExpression,
    shimast.KindStringLiteral,
    shimast.KindNoSubstitutionTemplateLiteral,
    shimast.KindNumericLiteral,
    shimast.KindTrueKeyword,
    shimast.KindFalseKeyword,
    shimast.KindNullKeyword:
    return true
  }
  return false
}

func storybookNamedExports(file *shimast.SourceFile) []storybookNamedExport {
  if file == nil || file.Statements == nil {
    return nil
  }
  exports := []storybookNamedExport{}
  for _, stmt := range file.Statements.Nodes {
    if stmt == nil {
      continue
    }
    switch stmt.Kind {
    case shimast.KindVariableStatement:
      if !hasModifier(stmt, shimast.KindExportKeyword) || hasModifier(stmt, shimast.KindDefaultKeyword) {
        continue
      }
      varStmt := stmt.AsVariableStatement()
      if varStmt == nil || varStmt.DeclarationList == nil {
        continue
      }
      list := varStmt.DeclarationList.AsVariableDeclarationList()
      if list == nil || list.Declarations == nil {
        continue
      }
      for _, item := range list.Declarations.Nodes {
        decl := item.AsVariableDeclaration()
        if decl == nil {
          continue
        }
        if name := identifierText(decl.Name()); name != "" {
          exports = append(exports, storybookNamedExport{Name: name, Node: decl.Name(), Init: decl.Initializer})
        }
      }
    case shimast.KindFunctionDeclaration, shimast.KindClassDeclaration:
      if hasModifier(stmt, shimast.KindExportKeyword) && !hasModifier(stmt, shimast.KindDefaultKeyword) {
        if name := identifierText(stmt.Name()); name != "" {
          exports = append(exports, storybookNamedExport{Name: name, Node: stmt.Name()})
        }
      }
    case shimast.KindExportDeclaration:
      decl := stmt.AsExportDeclaration()
      if decl == nil || decl.ModuleSpecifier != nil || decl.ExportClause == nil || decl.ExportClause.Kind != shimast.KindNamedExports {
        continue
      }
      named := decl.ExportClause.AsNamedExports()
      if named == nil || named.Elements == nil {
        continue
      }
      for _, item := range named.Elements.Nodes {
        spec := item.AsExportSpecifier()
        if spec == nil || spec.IsTypeOnly {
          continue
        }
        if name := identifierText(spec.Name()); name != "" {
          exports = append(exports, storybookNamedExport{Name: name, Node: spec.Name()})
        }
      }
    }
  }
  return exports
}

func storybookStoryFilters(meta *storybookMetaInfo) storybookStoryFiltersInfo {
  filters := storybookStoryFiltersInfo{}
  if meta == nil || meta.Object == nil {
    return filters
  }
  if _, value, ok := storybookObjectProperty(meta.Object, "includeStories"); ok {
    filters.Include = storybookDescriptors(meta.File, value)
  }
  if _, value, ok := storybookObjectProperty(meta.Object, "excludeStories"); ok {
    filters.Exclude = storybookDescriptors(meta.File, value)
  }
  return filters
}

func storybookDescriptors(file *shimast.SourceFile, node *shimast.Node) []storybookDescriptor {
  node = stripParens(node)
  if node == nil {
    return nil
  }
  if node.Kind == shimast.KindArrayLiteralExpression {
    arr := node.AsArrayLiteralExpression()
    if arr == nil || arr.Elements == nil {
      return nil
    }
    out := []storybookDescriptor{}
    for _, item := range arr.Elements.Nodes {
      out = append(out, storybookDescriptorFromNode(file, item)...)
    }
    return out
  }
  return storybookDescriptorFromNode(file, node)
}

func storybookDescriptorFromNode(file *shimast.SourceFile, node *shimast.Node) []storybookDescriptor {
  if text := storybookLiteralString(node); text != "" {
    return []storybookDescriptor{{Text: text}}
  }
  if node != nil && node.Kind == shimast.KindRegularExpressionLiteral {
    text := nodeText(file, node)
    if pattern, ok := storybookRegexpPattern(text); ok {
      if compiled, err := regexp.Compile(pattern); err == nil {
        return []storybookDescriptor{{Pattern: compiled}}
      }
    }
  }
  return nil
}

func storybookRegexpPattern(text string) (string, bool) {
  if !strings.HasPrefix(text, "/") {
    return "", false
  }
  last := strings.LastIndex(text, "/")
  if last <= 0 {
    return "", false
  }
  return text[1:last], true
}

func storybookIsStoryExport(name string, filters storybookStoryFiltersInfo) bool {
  if name == "" || name == "__namedExportsOrder" || strings.HasPrefix(name, "_") {
    return false
  }
  if len(filters.Include) > 0 && !storybookDescriptorsMatch(filters.Include, name) {
    return false
  }
  if len(filters.Exclude) > 0 && storybookDescriptorsMatch(filters.Exclude, name) {
    return false
  }
  return true
}

func storybookDescriptorsMatch(descriptors []storybookDescriptor, name string) bool {
  for _, descriptor := range descriptors {
    if descriptor.Text != "" && descriptor.Text == name {
      return true
    }
    if descriptor.Pattern != nil && descriptor.Pattern.MatchString(name) {
      return true
    }
  }
  return false
}

func storybookHasStoriesOfImport(file *shimast.SourceFile) bool {
  return storybookHasNamedImport(file, "storiesOf", "@storybook/react", "@storybook/vue", "@storybook/vue3", "@storybook/angular", "@storybook/svelte", "@storybook/html", "@storybook/web-components")
}

func storybookHasNamedImport(file *shimast.SourceFile, name string, modules ...string) bool {
  wantedModules := map[string]struct{}{}
  for _, module := range modules {
    wantedModules[module] = struct{}{}
  }
  if file == nil || file.Statements == nil {
    return false
  }
  for _, stmt := range file.Statements.Nodes {
    if stmt == nil || stmt.Kind != shimast.KindImportDeclaration {
      continue
    }
    decl := stmt.AsImportDeclaration()
    if decl == nil {
      continue
    }
    if _, ok := wantedModules[storybookLiteralString(decl.ModuleSpecifier)]; !ok {
      continue
    }
    if storybookImportHasSpecifier(decl, name) {
      return true
    }
  }
  return false
}

func storybookImportHasSpecifier(decl *shimast.ImportDeclaration, name string) bool {
  if decl == nil || decl.ImportClause == nil {
    return false
  }
  clause := decl.ImportClause.AsImportClause()
  if clause == nil || clause.NamedBindings == nil || clause.NamedBindings.Kind != shimast.KindNamedImports {
    return false
  }
  named := clause.NamedBindings.AsNamedImports()
  if named == nil || named.Elements == nil {
    return false
  }
  for _, item := range named.Elements.Nodes {
    spec := item.AsImportSpecifier()
    if spec != nil && storybookImportSpecifierImportedName(spec) == name {
      return true
    }
  }
  return false
}

func storybookImportSpecifierImportedName(spec *shimast.ImportSpecifier) string {
  if spec == nil {
    return ""
  }
  if spec.PropertyName != nil {
    return storybookPropertyName(spec.PropertyName)
  }
  return identifierText(spec.Name())
}

func storybookHasCsf4MetaCall(file *shimast.SourceFile) bool {
  if file == nil || file.Statements == nil {
    return false
  }
  for _, stmt := range file.Statements.Nodes {
    found := false
    walkDescendants(stmt, func(node *shimast.Node) {
      if found || node == nil || node.Kind != shimast.KindCallExpression {
        return
      }
      call := node.AsCallExpression()
      if call == nil {
        return
      }
      _, prop := storybookPropertyAccessParts(call.Expression)
      found = prop == "meta"
    })
    if found {
      return true
    }
  }
  return false
}

func storybookFirstNonImportStatement(file *shimast.SourceFile, fallback *shimast.Node) *shimast.Node {
  if file == nil || file.Statements == nil {
    return fallback
  }
  for _, stmt := range file.Statements.Nodes {
    if stmt != nil && stmt.Kind != shimast.KindImportDeclaration {
      return stmt
    }
  }
  if len(file.Statements.Nodes) > 0 && file.Statements.Nodes[0] != nil {
    return file.Statements.Nodes[0]
  }
  return fallback
}

func storybookPropertyAccessParts(node *shimast.Node) (string, string) {
  node = stripParens(node)
  if node == nil || node.Kind != shimast.KindPropertyAccessExpression {
    return "", ""
  }
  access := node.AsPropertyAccessExpression()
  if access == nil {
    return "", ""
  }
  return identifierText(access.Expression), identifierText(access.Name())
}

func storybookIsPlayCall(node *shimast.Node) bool {
  _, prop := storybookPropertyAccessParts(node)
  if prop == "play" {
    return true
  }
  if node != nil && node.Kind == shimast.KindNonNullExpression {
    nonNull := node.AsNonNullExpression()
    if nonNull != nil {
      _, prop = storybookPropertyAccessParts(nonNull.Expression)
      return prop == "play"
    }
  }
  return false
}

func storybookEnclosingFunctionContextName(node *shimast.Node) string {
  for cur := node.Parent; cur != nil; cur = cur.Parent {
    if !isFunctionLikeKind(cur) {
      continue
    }
    params := cur.Parameters()
    if len(params) == 0 {
      return ""
    }
    param := params[0].AsParameterDeclaration()
    if param == nil {
      return ""
    }
    return storybookContextNameFromBinding(param.Name())
  }
  return ""
}

func storybookContextNameFromBinding(node *shimast.Node) string {
  if name := identifierText(node); name != "" {
    return name
  }
  if node == nil || node.Kind != shimast.KindObjectBindingPattern {
    return ""
  }
  children := node.Children()
  if children == nil {
    return ""
  }
  for _, child := range children.Nodes {
    if child == nil || child.Kind != shimast.KindBindingElement {
      continue
    }
    binding := child.AsBindingElement()
    if binding == nil {
      continue
    }
    if identifierText(binding.Name()) == "context" || storybookPropertyName(binding.PropertyName) == "context" {
      return "context"
    }
    if binding.DotDotDotToken != nil {
      return identifierText(binding.Name())
    }
  }
  return ""
}

func storybookCallPassesContext(call *shimast.CallExpression, contextName string) bool {
  if call == nil || call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
    return false
  }
  first := stripParens(call.Arguments.Nodes[0])
  if identifierText(first) == contextName {
    return true
  }
  if first == nil || first.Kind != shimast.KindObjectLiteralExpression {
    return false
  }
  obj := first.AsObjectLiteralExpression()
  if obj == nil || obj.Properties == nil {
    return false
  }
  for _, prop := range obj.Properties.Nodes {
    if prop != nil && prop.Kind == shimast.KindSpreadAssignment {
      spread := prop.AsSpreadAssignment()
      if spread != nil && identifierText(spread.Expression) == contextName {
        return true
      }
    }
  }
  return false
}

func storybookAwaitedMethodName(call *shimast.CallExpression) string {
  if call == nil || call.Expression == nil {
    return ""
  }
  callee := stripParens(call.Expression)
  if name := identifierText(callee); storybookShouldAwaitName(name) {
    return name
  }
  if object, prop := storybookPropertyAccessParts(callee); storybookShouldAwaitName(object) {
    return object
  } else if storybookShouldAwaitName(prop) {
    return prop
  }
  if callee != nil && callee.Kind == shimast.KindPropertyAccessExpression {
    access := callee.AsPropertyAccessExpression()
    if access != nil && access.Expression != nil && access.Expression.Kind == shimast.KindCallExpression {
      nested := access.Expression.AsCallExpression()
      if nested != nil && identifierText(nested.Expression) == "expect" {
        return identifierText(access.Name())
      }
    }
  }
  return ""
}

func storybookShouldAwaitName(name string) bool {
  if strings.HasPrefix(name, "findBy") {
    return true
  }
  switch name {
  case "waitFor", "waitForElementToBeRemoved", "wait", "waitForElement", "waitForDomChange", "userEvent", "play":
    return true
  }
  return false
}

func storybookCallIsAwaited(node *shimast.Node) bool {
  parent := node.Parent
  for parent != nil && parent.Kind == shimast.KindParenthesizedExpression {
    parent = parent.Parent
  }
  return parent != nil && parent.Kind == shimast.KindAwaitExpression
}

func storybookCallIsReturned(node *shimast.Node) bool {
  parent := node.Parent
  for parent != nil && parent.Kind == shimast.KindParenthesizedExpression {
    parent = parent.Parent
  }
  return parent != nil && (parent.Kind == shimast.KindReturnStatement || parent.Kind == shimast.KindArrowFunction)
}

func storybookNameFromExport(name string) string {
  if name == "" {
    return ""
  }
  name = strings.ReplaceAll(name, "_", " ")
  name = strings.ReplaceAll(name, "-", " ")
  var out []rune
  prev := rune(0)
  for i, r := range name {
    if i > 0 && unicode.IsUpper(r) && (unicode.IsLower(prev) || unicode.IsDigit(prev)) {
      out = append(out, ' ')
    }
    out = append(out, r)
    prev = r
  }
  fields := strings.Fields(string(out))
  for i, field := range fields {
    if field == "" {
      continue
    }
    runes := []rune(field)
    runes[0] = unicode.ToUpper(runes[0])
    fields[i] = string(runes)
  }
  return strings.Join(fields, " ")
}

func storybookIsPascalCase(name string) bool {
  if name == "" {
    return false
  }
  first := rune(name[0])
  return first >= 'A' && first <= 'Z' && !strings.ContainsAny(name, "-_ ")
}

func storybookAddonEntries(file *shimast.SourceFile) []storybookAddonEntry {
  if file == nil {
    return nil
  }
  entries := []storybookAddonEntry{}
  walkDescendants(file.AsNode(), func(node *shimast.Node) {
    if node == nil || node.Kind != shimast.KindPropertyAssignment {
      return
    }
    prop := node.AsPropertyAssignment()
    if prop == nil || storybookPropertyName(prop.Name()) != "addons" {
      return
    }
    entries = append(entries, storybookAddonEntriesFromArray(prop.Initializer)...)
  })
  for _, story := range storybookNamedExports(file) {
    if story.Name == "addons" {
      entries = append(entries, storybookAddonEntriesFromArray(story.Init)...)
    }
  }
  return entries
}

func storybookAddonEntriesFromArray(node *shimast.Node) []storybookAddonEntry {
  node = stripParens(node)
  if node == nil || node.Kind != shimast.KindArrayLiteralExpression {
    return nil
  }
  arr := node.AsArrayLiteralExpression()
  if arr == nil || arr.Elements == nil {
    return nil
  }
  entries := []storybookAddonEntry{}
  for _, item := range arr.Elements.Nodes {
    if name := storybookLiteralString(item); name != "" {
      entries = append(entries, storybookAddonEntry{Name: name, Node: item})
      continue
    }
    if item == nil || item.Kind != shimast.KindObjectLiteralExpression {
      continue
    }
    _, value, ok := storybookObjectProperty(item, "name")
    if ok {
      if name := storybookLiteralString(value); name != "" {
        entries = append(entries, storybookAddonEntry{Name: name, Node: value})
      }
    }
  }
  return entries
}

func storybookInstalledPackages(file *shimast.SourceFile, explicit string) map[string]struct{} {
  location := explicit
  if location == "" {
    location = storybookFindPackageJSON(file)
  }
  if location == "" {
    return nil
  }
  data, err := os.ReadFile(location)
  if err != nil {
    return nil
  }
  var pkg struct {
    Dependencies    map[string]json.RawMessage `json:"dependencies"`
    DevDependencies map[string]json.RawMessage `json:"devDependencies"`
  }
  if err := json.Unmarshal(data, &pkg); err != nil {
    return nil
  }
  installed := map[string]struct{}{}
  for name := range pkg.Dependencies {
    installed[name] = struct{}{}
  }
  for name := range pkg.DevDependencies {
    installed[name] = struct{}{}
  }
  return installed
}

func storybookFindPackageJSON(file *shimast.SourceFile) string {
  if file == nil {
    return ""
  }
  dir := filepath.Dir(file.FileName())
  for {
    candidate := filepath.Join(dir, "package.json")
    if _, err := os.Stat(candidate); err == nil {
      return candidate
    }
    parent := filepath.Dir(dir)
    if parent == dir {
      return ""
    }
    dir = parent
  }
}

func storybookNormalizeAddonName(name string) string {
  name = strings.TrimSuffix(name, ".mjs")
  name = strings.TrimSuffix(name, ".cjs")
  name = strings.TrimSuffix(name, ".js")
  name = strings.TrimSuffix(name, "/register")
  name = strings.TrimSuffix(name, "/preset")
  return name
}

func storybookIsLocalAddon(name string) bool {
  return strings.HasPrefix(name, ".") ||
    strings.HasPrefix(name, "/") ||
    strings.HasPrefix(name, "\\") ||
    regexp.MustCompile(`^[A-Za-z]:`).MatchString(name)
}

func init() {
  Register(storybookAwaitInteractions{})
  Register(storybookContextInPlayFunction{})
  Register(storybookCsfComponent{})
  Register(storybookDefaultExports{})
  Register(storybookHierarchySeparator{})
  Register(storybookMetaInlineProperties{})
  Register(storybookMetaSatisfiesType{})
  Register(storybookNoRedundantStoryName{})
  Register(storybookNoRendererPackages{})
  Register(storybookNoStoriesOf{})
  Register(storybookNoTitlePropertyInMeta{})
  Register(storybookNoUninstalledAddons{})
  Register(storybookPreferPascalCase{})
  Register(storybookStoryExports{})
  Register(storybookUseStorybookExpect{})
  Register(storybookUseStorybookTestingLibrary{})
}
