package linthost

import (
  "net/url"
  "path/filepath"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type nextjsRule struct {
  name  string
  check func(*Context, *shimast.Node)
}

func (r nextjsRule) Name() string { return "nextjs/" + r.name }
func (r nextjsRule) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (r nextjsRule) Check(ctx *Context, node *shimast.Node) { r.check(ctx, node) }

type nextjsImports struct {
  headFromNextHead      map[string]bool
  headFromNextDocument  map[string]bool
  scriptFromNextScript  map[string]bool
  importsNextDocument   []*shimast.Node
  importsNextHead       []*shimast.Node
}

func nextjsGoogleFontDisplay(ctx *Context, file *shimast.Node) {
  nextjsWalkOpeningLike(file, func(opening *shimast.Node) {
    if nextjsJSXName(opening) != "link" {
      return
    }
    href := nextjsJSXAttrString(opening, "href")
    if !strings.HasPrefix(href, "https://fonts.googleapis.com/css") {
      return
    }
    u, err := url.Parse(href)
    if err != nil {
      return
    }
    display := u.Query().Get("display")
    switch display {
    case "", "auto", "block", "fallback":
      ctx.Report(opening, "Add a supported `display` query value to Google Fonts stylesheet links.")
    }
  })
}

func nextjsGoogleFontPreconnect(ctx *Context, file *shimast.Node) {
  nextjsWalkOpeningLike(file, func(opening *shimast.Node) {
    if nextjsJSXName(opening) != "link" || !strings.HasPrefix(nextjsJSXAttrString(opening, "href"), "https://fonts.gstatic.com") {
      return
    }
    if strings.ToLower(nextjsJSXAttrString(opening, "rel")) != "preconnect" {
      ctx.Report(opening, "Use `rel=\"preconnect\"` when linking to fonts.gstatic.com.")
    }
  })
}

func nextjsInlineScriptID(ctx *Context, file *shimast.Node) {
  imports := nextjsCollectImports(file)
  if len(imports.scriptFromNextScript) == 0 {
    return
  }
  walkDescendants(file, func(node *shimast.Node) {
    if node.Kind != shimast.KindJsxElement {
      return
    }
    opening := node.AsJsxElement().OpeningElement
    if !imports.scriptFromNextScript[nextjsJSXName(opening)] || nextjsJSXHasAttr(opening, "id") {
      return
    }
    if nextjsJSXHasAttr(opening, "dangerouslySetInnerHTML") || nextjsJSXElementHasContent(ctx.File, node) {
      ctx.Report(opening, "Inline `next/script` content must include a stable `id` attribute.")
    }
  })
}

func nextjsNextScriptForGA(ctx *Context, file *shimast.Node) {
  imports := nextjsCollectImports(file)
  if len(imports.scriptFromNextScript) == 0 {
    return
  }
  walkDescendants(file, func(node *shimast.Node) {
    if node.Kind != shimast.KindJsxElement && node.Kind != shimast.KindJsxSelfClosingElement {
      return
    }
    opening := nextjsOpeningLike(node)
    if !imports.scriptFromNextScript[nextjsJSXName(opening)] {
      return
    }
    src := nextjsJSXAttrString(opening, "src")
    if strings.Contains(src, "googletagmanager.com/gtag/js") || strings.Contains(src, "googletagmanager.com/gtm.js") {
      ctx.Report(opening, "Use Next.js Google Analytics helpers instead of hand-written gtag scripts.")
      return
    }
    if node.Kind == shimast.KindJsxElement {
      text := nodeText(ctx.File, node)
      if strings.Contains(text, "gtag(") || strings.Contains(text, "GTM-") {
        ctx.Report(opening, "Use Next.js Google Analytics helpers instead of hand-written gtag scripts.")
      }
    }
  })
}

func nextjsNoAssignModuleVariable(ctx *Context, file *shimast.Node) {
  walkDescendants(file, func(node *shimast.Node) {
    if node.Kind != shimast.KindVariableDeclaration {
      return
    }
    if identifierText(node.AsVariableDeclaration().Name()) == "module" {
      ctx.Report(node.AsVariableDeclaration().Name(), "Do not assign the reserved `module` variable name.")
    }
  })
}

func nextjsNoAsyncClientComponent(ctx *Context, file *shimast.Node) {
  if !nextjsHasUseClientDirective(file) {
    return
  }
  asyncBindings := map[string]*shimast.Node{}
  for _, stmt := range file.Statements() {
    if stmt == nil {
      continue
    }
    if stmt.Kind == shimast.KindFunctionDeclaration {
      name := identifierText(stmt.AsFunctionDeclaration().Name())
      if name != "" && nextjsHasModifier(stmt, shimast.KindAsyncKeyword) {
        asyncBindings[name] = stmt
      }
      if nextjsHasModifier(stmt, shimast.KindDefaultKeyword) && nextjsHasModifier(stmt, shimast.KindAsyncKeyword) && (name == "" || nextjsIsCapitalized(name)) {
        ctx.Report(stmt, "Client components must not be async functions.")
      }
      continue
    }
    if stmt.Kind == shimast.KindVariableStatement {
      decls := stmt.AsVariableStatement().DeclarationList.AsVariableDeclarationList().Declarations
      if decls == nil {
        continue
      }
      for _, decl := range decls.Nodes {
        name := identifierText(decl.AsVariableDeclaration().Name())
        if name == "" || !nextjsIsAsyncFunctionLike(decl.AsVariableDeclaration().Initializer) {
          continue
        }
        asyncBindings[name] = decl
      }
    }
  }
  for _, stmt := range file.Statements() {
    if stmt == nil || stmt.Kind != shimast.KindExportAssignment {
      continue
    }
    export := stmt.AsExportAssignment()
    if export == nil || export.IsExportEquals || export.Expression == nil {
      continue
    }
    expr := stripParens(export.Expression)
    if nextjsIsAsyncFunctionLike(expr) {
      ctx.Report(expr, "Client components must not be async functions.")
      continue
    }
    name := identifierText(expr)
    if nextjsIsCapitalized(name) && asyncBindings[name] != nil {
      ctx.Report(expr, "Client components must not be async functions.")
    }
  }
}

func nextjsNoBeforeInteractiveScriptOutsideDocument(ctx *Context, file *shimast.Node) {
  if nextjsIsDocumentFile(ctx.File) {
    return
  }
  imports := nextjsCollectImports(file)
  if len(imports.scriptFromNextScript) == 0 {
    return
  }
  nextjsWalkOpeningLike(file, func(opening *shimast.Node) {
    if imports.scriptFromNextScript[nextjsJSXName(opening)] && nextjsJSXAttrString(opening, "strategy") == "beforeInteractive" {
      ctx.Report(opening, "`beforeInteractive` scripts belong in pages/_document.")
    }
  })
}

func nextjsNoCSSTags(ctx *Context, file *shimast.Node) {
  nextjsWalkOpeningLike(file, func(opening *shimast.Node) {
    if nextjsJSXName(opening) == "link" && strings.ToLower(nextjsJSXAttrString(opening, "rel")) == "stylesheet" && nextjsJSXAttrString(opening, "href") != "" {
      ctx.Report(opening, "Import stylesheets through Next.js-supported CSS imports instead of raw `<link>` tags.")
    }
  })
}

func nextjsNoDocumentImportInPage(ctx *Context, file *shimast.Node) {
  if !nextjsIsPagesFile(ctx.File) || nextjsIsDocumentFile(ctx.File) {
    return
  }
  for _, node := range nextjsCollectImports(file).importsNextDocument {
    ctx.Report(node, "`next/document` may only be imported from pages/_document.")
  }
}

func nextjsNoDuplicateHead(ctx *Context, file *shimast.Node) {
  if !nextjsIsDocumentFile(ctx.File) {
    return
  }
  imports := nextjsCollectImports(file)
  var seen bool
  nextjsWalkOpeningLike(file, func(opening *shimast.Node) {
    if !imports.headFromNextDocument[nextjsJSXName(opening)] {
      return
    }
    if seen {
      ctx.Report(opening, "pages/_document must not render more than one `Head` from next/document.")
      return
    }
    seen = true
  })
}

func nextjsNoHeadElement(ctx *Context, file *shimast.Node) {
  if nextjsIsAppDirFile(ctx.File) {
    return
  }
  nextjsWalkOpeningLike(file, func(opening *shimast.Node) {
    if nextjsJSXName(opening) == "head" {
      ctx.Report(opening, "Use Next.js head management instead of a raw `<head>` element.")
    }
  })
}

func nextjsNoHeadImportInDocument(ctx *Context, file *shimast.Node) {
  if !nextjsIsDocumentFile(ctx.File) {
    return
  }
  for _, node := range nextjsCollectImports(file).importsNextHead {
    ctx.Report(node, "Import `Head` from next/document inside pages/_document, not next/head.")
  }
}

func nextjsNoHTMLLinkForPages(ctx *Context, file *shimast.Node) {
  nextjsWalkOpeningLike(file, func(opening *shimast.Node) {
    href := nextjsJSXAttrString(opening, "href")
    if nextjsJSXName(opening) == "a" && nextjsIsInternalPageHref(href) {
      ctx.Report(opening, "Use `next/link` for internal page navigation.")
    }
  })
}

func nextjsNoImgElement(ctx *Context, file *shimast.Node) {
  nextjsWalkOpeningLike(file, func(opening *shimast.Node) {
    if nextjsJSXName(opening) == "img" && !nextjsIsInsideJSXElement(opening, "picture") {
      ctx.Report(opening, "Use `next/image` instead of a raw `<img>` element.")
    }
  })
}

func nextjsNoPageCustomFont(ctx *Context, file *shimast.Node) {
  if !nextjsIsPagesFile(ctx.File) || nextjsIsDocumentFile(ctx.File) {
    return
  }
  nextjsWalkOpeningLike(file, func(opening *shimast.Node) {
    if nextjsJSXName(opening) == "link" && strings.HasPrefix(nextjsJSXAttrString(opening, "href"), "https://fonts.googleapis.com/css") {
      ctx.Report(opening, "Place custom Google font links in pages/_document so they load on every page.")
    }
  })
}

func nextjsNoScriptComponentInHead(ctx *Context, file *shimast.Node) {
  imports := nextjsCollectImports(file)
  if len(imports.headFromNextHead) == 0 || len(imports.scriptFromNextScript) == 0 {
    return
  }
  walkDescendants(file, func(node *shimast.Node) {
    if node.Kind != shimast.KindJsxElement {
      return
    }
    opening := node.AsJsxElement().OpeningElement
    if !imports.headFromNextHead[nextjsJSXName(opening)] {
      return
    }
    walkDescendants(node, func(child *shimast.Node) {
      if child == node || (child.Kind != shimast.KindJsxElement && child.Kind != shimast.KindJsxSelfClosingElement) {
        return
      }
      childOpening := nextjsOpeningLike(child)
      if imports.scriptFromNextScript[nextjsJSXName(childOpening)] {
        ctx.Report(childOpening, "Do not place `next/script` inside `next/head`.")
      }
    })
  })
}

func nextjsNoStyledJSXInDocument(ctx *Context, file *shimast.Node) {
  if !nextjsIsDocumentFile(ctx.File) {
    return
  }
  nextjsWalkOpeningLike(file, func(opening *shimast.Node) {
    if nextjsJSXName(opening) == "style" && nextjsJSXHasAttr(opening, "jsx") {
      ctx.Report(opening, "Do not use styled-jsx inside pages/_document.")
    }
  })
}

func nextjsNoSyncScripts(ctx *Context, file *shimast.Node) {
  nextjsWalkOpeningLike(file, func(opening *shimast.Node) {
    if nextjsJSXName(opening) == "script" && nextjsJSXAttrString(opening, "src") != "" && !nextjsJSXHasAttr(opening, "async") && !nextjsJSXHasAttr(opening, "defer") {
      ctx.Report(opening, "Add `async` or `defer` to external `<script>` tags.")
    }
  })
}

func nextjsNoTitleInDocumentHead(ctx *Context, file *shimast.Node) {
  if !nextjsIsDocumentFile(ctx.File) {
    return
  }
  imports := nextjsCollectImports(file)
  walkDescendants(file, func(node *shimast.Node) {
    if node.Kind != shimast.KindJsxElement {
      return
    }
    opening := node.AsJsxElement().OpeningElement
    if !imports.headFromNextDocument[nextjsJSXName(opening)] {
      return
    }
    walkDescendants(node, func(child *shimast.Node) {
      if child != node && (child.Kind == shimast.KindJsxElement || child.Kind == shimast.KindJsxSelfClosingElement) && nextjsJSXName(nextjsOpeningLike(child)) == "title" {
        ctx.Report(nextjsOpeningLike(child), "Do not render `<title>` inside pages/_document Head.")
      }
    })
  })
}

func nextjsNoTypos(ctx *Context, file *shimast.Node) {
  if !nextjsIsPagesFile(ctx.File) || nextjsIsAPIPagesFile(ctx.File) {
    return
  }
  wanted := []string{"getStaticProps", "getStaticPaths", "getServerSideProps"}
  for _, stmt := range file.Statements() {
    if stmt == nil {
      continue
    }
    nameNode := nextjsExportedNameNode(stmt)
    name := identifierText(nameNode)
    if name == "" {
      continue
    }
    for _, target := range wanted {
      if name != target && nextjsEditDistance(name, target) == 1 {
        ctx.Report(nameNode, "Possible typo in Next.js data-fetching export name.")
      }
    }
  }
}

func nextjsNoUnwantedPolyfillIO(ctx *Context, file *shimast.Node) {
  imports := nextjsCollectImports(file)
  nextjsWalkOpeningLike(file, func(opening *shimast.Node) {
    name := nextjsJSXName(opening)
    if name != "script" && !imports.scriptFromNextScript[name] {
      return
    }
    src := nextjsJSXAttrString(opening, "src")
    if strings.Contains(src, "polyfill.io") || strings.Contains(src, "polyfill-fastly.io") {
      ctx.Report(opening, "Avoid Polyfill.io scripts in Next.js pages.")
    }
  })
}

func nextjsCollectImports(file *shimast.Node) nextjsImports {
  imports := nextjsImports{
    headFromNextHead:     map[string]bool{},
    headFromNextDocument: map[string]bool{},
    scriptFromNextScript: map[string]bool{},
  }
  for _, stmt := range file.Statements() {
    if stmt == nil || stmt.Kind != shimast.KindImportDeclaration {
      continue
    }
    decl := stmt.AsImportDeclaration()
    mod := stringLiteralText(decl.ModuleSpecifier)
    switch mod {
    case "next/head":
      imports.importsNextHead = append(imports.importsNextHead, stmt)
      nextjsCollectDefaultImportName(decl, imports.headFromNextHead)
    case "next/document":
      imports.importsNextDocument = append(imports.importsNextDocument, stmt)
      nextjsCollectNamedImportName(decl, "Head", imports.headFromNextDocument)
    case "next/script":
      nextjsCollectDefaultImportName(decl, imports.scriptFromNextScript)
    }
  }
  return imports
}

func nextjsCollectDefaultImportName(decl *shimast.ImportDeclaration, names map[string]bool) {
  if decl == nil || decl.ImportClause == nil {
    return
  }
  clause := decl.ImportClause.AsImportClause()
  if clause != nil && clause.Name() != nil {
    names[identifierText(clause.Name())] = true
  }
}

func nextjsCollectNamedImportName(decl *shimast.ImportDeclaration, imported string, names map[string]bool) {
  if decl == nil || decl.ImportClause == nil {
    return
  }
  clause := decl.ImportClause.AsImportClause()
  if clause == nil || clause.NamedBindings == nil || clause.NamedBindings.Kind != shimast.KindNamedImports {
    return
  }
  named := clause.NamedBindings.AsNamedImports()
  if named == nil || named.Elements == nil {
    return
  }
  for _, spec := range named.Elements.Nodes {
    s := spec.AsImportSpecifier()
    if s == nil {
      continue
    }
    importedName := identifierText(s.Name())
    if s.PropertyName != nil {
      importedName = identifierText(s.PropertyName)
    }
    if importedName == imported {
      names[identifierText(s.Name())] = true
    }
  }
}

func nextjsWalkOpeningLike(file *shimast.Node, visit func(*shimast.Node)) {
  walkDescendants(file, func(node *shimast.Node) {
    switch node.Kind {
    case shimast.KindJsxOpeningElement, shimast.KindJsxSelfClosingElement:
      visit(node)
    }
  })
}

func nextjsOpeningLike(node *shimast.Node) *shimast.Node {
  if node == nil {
    return nil
  }
  switch node.Kind {
  case shimast.KindJsxElement:
    return node.AsJsxElement().OpeningElement
  case shimast.KindJsxOpeningElement, shimast.KindJsxSelfClosingElement:
    return node
  }
  return nil
}

func nextjsJSXName(opening *shimast.Node) string {
  if opening == nil {
    return ""
  }
  switch opening.Kind {
  case shimast.KindJsxOpeningElement:
    return shimast.NodeText(opening.AsJsxOpeningElement().TagName)
  case shimast.KindJsxSelfClosingElement:
    return shimast.NodeText(opening.AsJsxSelfClosingElement().TagName)
  }
  return ""
}

func nextjsJSXAttrs(opening *shimast.Node) []*shimast.Node {
  var attrs *shimast.Node
  switch {
  case opening == nil:
    return nil
  case opening.Kind == shimast.KindJsxOpeningElement:
    attrs = opening.AsJsxOpeningElement().Attributes
  case opening.Kind == shimast.KindJsxSelfClosingElement:
    attrs = opening.AsJsxSelfClosingElement().Attributes
  }
  if attrs == nil {
    return nil
  }
  jsxs := attrs.AsJsxAttributes()
  if jsxs == nil || jsxs.Properties == nil {
    return nil
  }
  return jsxs.Properties.Nodes
}

func nextjsJSXAttr(opening *shimast.Node, name string) *shimast.Node {
  for _, attrNode := range nextjsJSXAttrs(opening) {
    if attrNode.Kind != shimast.KindJsxAttribute {
      continue
    }
    attr := attrNode.AsJsxAttribute()
    if shimast.NodeText(attr.Name()) == name {
      return attrNode
    }
  }
  return nil
}

func nextjsJSXHasAttr(opening *shimast.Node, name string) bool {
  return nextjsJSXAttr(opening, name) != nil
}

func nextjsJSXAttrString(opening *shimast.Node, name string) string {
  attrNode := nextjsJSXAttr(opening, name)
  if attrNode == nil {
    return ""
  }
  init := attrNode.AsJsxAttribute().Initializer
  if init == nil {
    return "true"
  }
  if text := stringLiteralText(init); text != "" {
    return text
  }
  if init.Kind == shimast.KindJsxExpression {
    expr := init.AsJsxExpression().Expression
    if text := stringLiteralText(expr); text != "" {
      return text
    }
  }
  return ""
}

func nextjsJSXElementHasContent(file *shimast.SourceFile, node *shimast.Node) bool {
  if node == nil || node.Kind != shimast.KindJsxElement {
    return false
  }
  children := node.AsJsxElement().Children
  if children == nil {
    return false
  }
  for _, child := range children.Nodes {
    if child == nil {
      continue
    }
    switch child.Kind {
    case shimast.KindJsxText, shimast.KindJsxTextAllWhiteSpaces:
      if strings.TrimSpace(nodeText(file, child)) != "" {
        return true
      }
    case shimast.KindJsxExpression:
      if child.AsJsxExpression().Expression != nil {
        return true
      }
    default:
      return true
    }
  }
  return false
}

func nextjsIsInsideJSXElement(node *shimast.Node, name string) bool {
  for cur := node; cur != nil; cur = cur.Parent {
    if cur.Kind == shimast.KindJsxElement && nextjsJSXName(cur.AsJsxElement().OpeningElement) == name {
      return true
    }
  }
  return false
}

func nextjsHasUseClientDirective(file *shimast.Node) bool {
  for _, stmt := range file.Statements() {
    if stmt == nil || stmt.Kind != shimast.KindExpressionStatement {
      return false
    }
    expr := stripParens(stmt.AsExpressionStatement().Expression)
    if stringLiteralText(expr) == "use client" {
      return true
    }
    if stringLiteralText(expr) == "" {
      return false
    }
  }
  return false
}

func nextjsIsAsyncFunctionLike(node *shimast.Node) bool {
  node = stripParens(node)
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindFunctionExpression, shimast.KindArrowFunction, shimast.KindFunctionDeclaration:
    return nextjsHasModifier(node, shimast.KindAsyncKeyword)
  }
  return false
}

func nextjsHasModifier(node *shimast.Node, kind shimast.Kind) bool {
  if node == nil || node.Modifiers() == nil {
    return false
  }
  for _, mod := range node.Modifiers().Nodes {
    if mod != nil && mod.Kind == kind {
      return true
    }
  }
  return false
}

func nextjsIsCapitalized(name string) bool {
  return name != "" && name[0] >= 'A' && name[0] <= 'Z'
}

func nextjsFilePath(file *shimast.SourceFile) string {
  if file == nil {
    return ""
  }
  return filepath.ToSlash(file.FileName())
}

func nextjsIsPagesFile(file *shimast.SourceFile) bool {
  path := nextjsFilePath(file)
  return strings.Contains(path, "/pages/") || strings.HasSuffix(path, "/pages.tsx") || strings.HasSuffix(path, "/pages.ts")
}

func nextjsIsAPIPagesFile(file *shimast.SourceFile) bool {
  return strings.Contains(nextjsFilePath(file), "/pages/api/")
}

func nextjsIsDocumentFile(file *shimast.SourceFile) bool {
  path := nextjsFilePath(file)
  return strings.Contains(path, "/pages/_document.") || strings.HasSuffix(path, "/pages/_document")
}

func nextjsIsAppDirFile(file *shimast.SourceFile) bool {
  return strings.Contains(nextjsFilePath(file), "/app/")
}

func nextjsIsInternalPageHref(href string) bool {
  return strings.HasPrefix(href, "/") && !strings.HasPrefix(href, "//") && !strings.Contains(href, ".")
}

func nextjsExportedNameNode(stmt *shimast.Node) *shimast.Node {
  switch stmt.Kind {
  case shimast.KindFunctionDeclaration:
    if nextjsHasModifier(stmt, shimast.KindExportKeyword) {
      return stmt.AsFunctionDeclaration().Name()
    }
  case shimast.KindVariableStatement:
    if !nextjsHasModifier(stmt, shimast.KindExportKeyword) {
      return nil
    }
    decls := stmt.AsVariableStatement().DeclarationList.AsVariableDeclarationList().Declarations
    if decls != nil && len(decls.Nodes) == 1 {
      return decls.Nodes[0].AsVariableDeclaration().Name()
    }
  }
  return nil
}

func nextjsEditDistance(a, b string) int {
  prev := make([]int, len(b)+1)
  for j := range prev {
    prev[j] = j
  }
  for i := 1; i <= len(a); i++ {
    cur := make([]int, len(b)+1)
    cur[0] = i
    for j := 1; j <= len(b); j++ {
      cost := 0
      if a[i-1] != b[j-1] {
        cost = 1
      }
      cur[j] = min(prev[j]+1, cur[j-1]+1, prev[j-1]+cost)
    }
    prev = cur
  }
  return prev[len(b)]
}

func init() {
  Register(nextjsRule{name: "google-font-display", check: nextjsGoogleFontDisplay})
  Register(nextjsRule{name: "google-font-preconnect", check: nextjsGoogleFontPreconnect})
  Register(nextjsRule{name: "inline-script-id", check: nextjsInlineScriptID})
  Register(nextjsRule{name: "next-script-for-ga", check: nextjsNextScriptForGA})
  Register(nextjsRule{name: "no-assign-module-variable", check: nextjsNoAssignModuleVariable})
  Register(nextjsRule{name: "no-async-client-component", check: nextjsNoAsyncClientComponent})
  Register(nextjsRule{name: "no-before-interactive-script-outside-document", check: nextjsNoBeforeInteractiveScriptOutsideDocument})
  Register(nextjsRule{name: "no-css-tags", check: nextjsNoCSSTags})
  Register(nextjsRule{name: "no-document-import-in-page", check: nextjsNoDocumentImportInPage})
  Register(nextjsRule{name: "no-duplicate-head", check: nextjsNoDuplicateHead})
  Register(nextjsRule{name: "no-head-element", check: nextjsNoHeadElement})
  Register(nextjsRule{name: "no-head-import-in-document", check: nextjsNoHeadImportInDocument})
  Register(nextjsRule{name: "no-html-link-for-pages", check: nextjsNoHTMLLinkForPages})
  Register(nextjsRule{name: "no-img-element", check: nextjsNoImgElement})
  Register(nextjsRule{name: "no-page-custom-font", check: nextjsNoPageCustomFont})
  Register(nextjsRule{name: "no-script-component-in-head", check: nextjsNoScriptComponentInHead})
  Register(nextjsRule{name: "no-styled-jsx-in-document", check: nextjsNoStyledJSXInDocument})
  Register(nextjsRule{name: "no-sync-scripts", check: nextjsNoSyncScripts})
  Register(nextjsRule{name: "no-title-in-document-head", check: nextjsNoTitleInDocumentHead})
  Register(nextjsRule{name: "no-typos", check: nextjsNoTypos})
  Register(nextjsRule{name: "no-unwanted-polyfillio", check: nextjsNoUnwantedPolyfillIO})
}
