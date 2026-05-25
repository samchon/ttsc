package linthost

import (
  "fmt"
  "strings"
  "unicode"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type tanstackQueryRule struct {
  name string
  run  func(*Context, *shimast.Node)
}

func (r tanstackQueryRule) Name() string           { return "@tanstack/query/" + r.name }
func (r tanstackQueryRule) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (r tanstackQueryRule) Check(ctx *Context, node *shimast.Node) {
  if r.run != nil {
    r.run(ctx, node)
  }
}

type tanstackImports struct {
  values     map[string]string
  namespaces map[string]bool
  imports    map[string]bool
}

func collectTanstackImports(root *shimast.Node) tanstackImports {
  imports := tanstackImports{
    values:     map[string]string{},
    namespaces: map[string]bool{},
    imports:    map[string]bool{},
  }
  walkDescendants(root, func(node *shimast.Node) {
    if node.Kind != shimast.KindImportDeclaration {
      return
    }
    decl := node.AsImportDeclaration()
    if decl == nil || decl.ImportClause == nil {
      return
    }
    clause := decl.ImportClause.AsImportClause()
    if clause == nil {
      return
    }
    module := stringLiteralText(decl.ModuleSpecifier)
    if !isTanstackQueryModule(module) {
      return
    }
    if name := identifierText(clause.Name()); name != "" {
      imports.values[name] = "default"
      imports.imports[name] = true
    }
    if clause.NamedBindings == nil {
      return
    }
    switch clause.NamedBindings.Kind {
    case shimast.KindNamedImports:
      named := clause.NamedBindings.AsNamedImports()
      if named == nil || named.Elements == nil {
        return
      }
      for _, specNode := range named.Elements.Nodes {
        spec := specNode.AsImportSpecifier()
        if spec == nil {
          continue
        }
        local := identifierText(spec.Name())
        if local == "" {
          continue
        }
        imported := local
        if spec.PropertyName != nil {
          imported = identifierText(spec.PropertyName)
        }
        imports.values[local] = imported
        imports.imports[local] = true
      }
    case shimast.KindNamespaceImport:
      ns := clause.NamedBindings.AsNamespaceImport()
      if ns != nil {
        if name := identifierText(ns.Name()); name != "" {
          imports.namespaces[name] = true
          imports.imports[name] = true
        }
      }
    }
  })
  return imports
}

func collectImportNames(root *shimast.Node) map[string]bool {
  names := map[string]bool{}
  walkDescendants(root, func(node *shimast.Node) {
    if node.Kind != shimast.KindImportDeclaration {
      return
    }
    decl := node.AsImportDeclaration()
    if decl == nil || decl.ImportClause == nil {
      return
    }
    clause := decl.ImportClause.AsImportClause()
    if clause == nil {
      return
    }
    if name := identifierText(clause.Name()); name != "" {
      names[name] = true
    }
    if clause.NamedBindings == nil {
      return
    }
    switch clause.NamedBindings.Kind {
    case shimast.KindNamedImports:
      named := clause.NamedBindings.AsNamedImports()
      if named == nil || named.Elements == nil {
        return
      }
      for _, specNode := range named.Elements.Nodes {
        spec := specNode.AsImportSpecifier()
        if spec != nil {
          if name := identifierText(spec.Name()); name != "" {
            names[name] = true
          }
        }
      }
    case shimast.KindNamespaceImport:
      ns := clause.NamedBindings.AsNamespaceImport()
      if ns != nil {
        if name := identifierText(ns.Name()); name != "" {
          names[name] = true
        }
      }
    }
  })
  return names
}

func isTanstackQueryModule(module string) bool {
  return module == "@tanstack/react-query" ||
    module == "@tanstack/query-core" ||
    (strings.HasPrefix(module, "@tanstack/") && strings.Contains(module, "query"))
}

func tanstackCalleeName(expr *shimast.Node, imports tanstackImports) string {
  expr = stripParens(expr)
  if name := identifierText(expr); name != "" {
    if imported := imports.values[name]; imported != "" {
      return imported
    }
    return ""
  }
  if expr == nil || expr.Kind != shimast.KindPropertyAccessExpression {
    return ""
  }
  access := expr.AsPropertyAccessExpression()
  if access == nil || access.Expression == nil {
    return ""
  }
  if ns := identifierText(access.Expression); ns != "" && imports.namespaces[ns] {
    return identifierText(access.Name())
  }
  return ""
}

func callTanstackName(call *shimast.CallExpression, imports tanstackImports) string {
  if call == nil {
    return ""
  }
  return tanstackCalleeName(call.Expression, imports)
}

func newTanstackName(expr *shimast.NewExpression, imports tanstackImports) string {
  if expr == nil {
    return ""
  }
  return tanstackCalleeName(expr.Expression, imports)
}

func isQueryResultHook(name string) bool {
  switch name {
  case "useQuery",
    "useQueries",
    "useInfiniteQuery",
    "useSuspenseQuery",
    "useSuspenseQueries",
    "useSuspenseInfiniteQuery",
    "useMutation":
    return true
  }
  return false
}

func isQueryHook(name string) bool {
  switch name {
  case "useQuery",
    "useQueries",
    "useInfiniteQuery",
    "useSuspenseQuery",
    "useSuspenseQueries",
    "useSuspenseInfiniteQuery":
    return true
  }
  return false
}

func isUseQueriesHook(name string) bool {
  return name == "useQueries" || name == "useSuspenseQueries"
}

func firstArgumentObject(call *shimast.CallExpression) *shimast.Node {
  if call == nil || call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
    return nil
  }
  node := stripParens(call.Arguments.Nodes[0])
  if node == nil || node.Kind != shimast.KindObjectLiteralExpression {
    return nil
  }
  return node
}

func objectProperty(file *shimast.SourceFile, object *shimast.Node, key string) *shimast.Node {
  if object == nil {
    return nil
  }
  if object.Kind != shimast.KindObjectLiteralExpression {
    return nil
  }
  obj := object.AsObjectLiteralExpression()
  if obj == nil || obj.Properties == nil {
    return nil
  }
  for _, prop := range obj.Properties.Nodes {
    if propertyKey(file, prop) == key {
      return prop
    }
  }
  return nil
}

func objectPropertyInitializer(file *shimast.SourceFile, object *shimast.Node, key string) *shimast.Node {
  prop := objectProperty(file, object, key)
  if prop == nil || prop.Kind != shimast.KindPropertyAssignment {
    return nil
  }
  assignment := prop.AsPropertyAssignment()
  if assignment == nil {
    return nil
  }
  return stripParens(assignment.Initializer)
}

func objectHasProperty(file *shimast.SourceFile, object *shimast.Node, key string) bool {
  return objectProperty(file, object, key) != nil
}

func objectPropertyIndexes(file *shimast.SourceFile, object *shimast.Node, keys ...string) map[string]int {
  indexes := map[string]int{}
  if object == nil {
    return indexes
  }
  if object.Kind != shimast.KindObjectLiteralExpression {
    return indexes
  }
  obj := object.AsObjectLiteralExpression()
  if obj == nil || obj.Properties == nil {
    return indexes
  }
  for i, prop := range obj.Properties.Nodes {
    key := propertyKey(file, prop)
    for _, want := range keys {
      if key == want {
        indexes[key] = i
      }
    }
  }
  return indexes
}

func arrayElements(node *shimast.Node) []*shimast.Node {
  if node == nil {
    return nil
  }
  if node.Kind != shimast.KindArrayLiteralExpression {
    return nil
  }
  arr := node.AsArrayLiteralExpression()
  if arr == nil || arr.Elements == nil {
    return nil
  }
  return arr.Elements.Nodes
}

func bindingPatternHasObjectRest(node *shimast.Node) bool {
  node = stripParens(node)
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindObjectBindingPattern:
    pattern := node.AsBindingPattern()
    if pattern == nil || pattern.Elements == nil {
      return false
    }
    for _, elementNode := range pattern.Elements.Nodes {
      if elementNode.Kind != shimast.KindBindingElement {
        continue
      }
      element := elementNode.AsBindingElement()
      if element == nil {
        continue
      }
      if element.DotDotDotToken != nil {
        return true
      }
      if bindingPatternHasObjectRest(element.Name()) {
        return true
      }
    }
  case shimast.KindArrayBindingPattern:
    pattern := node.AsBindingPattern()
    if pattern == nil || pattern.Elements == nil {
      return false
    }
    for _, elementNode := range pattern.Elements.Nodes {
      if elementNode.Kind != shimast.KindBindingElement {
        continue
      }
      element := elementNode.AsBindingElement()
      if element != nil && bindingPatternHasObjectRest(element.Name()) {
        return true
      }
    }
  }
  return false
}

func collectBindingIdentifierNames(node *shimast.Node, names map[string]bool, includeObjectPattern bool) {
  if node == nil {
    return
  }
  if name := identifierText(node); name != "" {
    names[name] = true
    return
  }
  switch node.Kind {
  case shimast.KindArrayBindingPattern:
    pattern := node.AsBindingPattern()
    if pattern == nil || pattern.Elements == nil {
      return
    }
    for _, elementNode := range pattern.Elements.Nodes {
      if elementNode.Kind != shimast.KindBindingElement {
        continue
      }
      element := elementNode.AsBindingElement()
      if element != nil {
        collectBindingIdentifierNames(element.Name(), names, includeObjectPattern)
      }
    }
  case shimast.KindObjectBindingPattern:
    if !includeObjectPattern {
      return
    }
    pattern := node.AsBindingPattern()
    if pattern == nil || pattern.Elements == nil {
      return
    }
    for _, elementNode := range pattern.Elements.Nodes {
      if elementNode.Kind != shimast.KindBindingElement {
        continue
      }
      element := elementNode.AsBindingElement()
      if element != nil {
        collectBindingIdentifierNames(element.Name(), names, includeObjectPattern)
      }
    }
  }
}

func runNoRestDestructuring(ctx *Context, root *shimast.Node) {
  imports := collectTanstackImports(root)
  tracked := map[string]bool{}

  walkDescendants(root, func(node *shimast.Node) {
    if node.Kind != shimast.KindVariableDeclaration {
      return
    }
    decl := node.AsVariableDeclaration()
    if decl == nil || decl.Initializer == nil {
      return
    }
    init := stripParens(decl.Initializer)
    if init == nil || init.Kind != shimast.KindCallExpression {
      return
    }
    call := init.AsCallExpression()
    if call == nil {
      return
    }
    name := callTanstackName(call, imports)
    if !isQueryHook(name) {
      return
    }
    if bindingPatternHasObjectRest(decl.Name()) {
      ctx.Report(decl.Name(), "Object rest destructuring on a TanStack Query result observes all result changes.")
      return
    }
    if id := identifierText(decl.Name()); id != "" {
      tracked[id] = true
    }
  })

  walkDescendants(root, func(node *shimast.Node) {
    switch node.Kind {
    case shimast.KindVariableDeclaration:
      decl := node.AsVariableDeclaration()
      if decl == nil || decl.Initializer == nil {
        return
      }
      if tracked[identifierText(stripParens(decl.Initializer))] && bindingPatternHasObjectRest(decl.Name()) {
        ctx.Report(decl.Name(), "Object rest destructuring on a TanStack Query result observes all result changes.")
      }
    case shimast.KindSpreadAssignment:
      spread := node.AsSpreadAssignment()
      if spread != nil && tracked[identifierText(stripParens(spread.Expression))] {
        ctx.Report(node, "Spreading a TanStack Query result observes all result changes.")
      }
    }
  })
}

func runStableQueryClient(ctx *Context, root *shimast.Node) {
  imports := collectTanstackImports(root)
  walkDescendants(root, func(node *shimast.Node) {
    if node.Kind != shimast.KindNewExpression {
      return
    }
    expr := node.AsNewExpression()
    if expr == nil || newTanstackName(expr, imports) != "QueryClient" {
      return
    }
    fn := nearestFunction(node)
    if fn == nil || hasAsyncModifier(fn) {
      return
    }
    if name := functionLikeName(fn); !isReactComponentOrHookName(name) {
      return
    }
    ctx.Report(node, "QueryClient is not stable inside this component or hook. Move it outside or initialize it with useState.")
  })
}

func nearestFunction(node *shimast.Node) *shimast.Node {
  for cur := node.Parent; cur != nil; cur = cur.Parent {
    if isFunctionLikeKind(cur) {
      return cur
    }
  }
  return nil
}

func functionLikeName(node *shimast.Node) string {
  if node == nil {
    return ""
  }
  switch node.Kind {
  case shimast.KindFunctionDeclaration:
    return identifierText(node.AsFunctionDeclaration().Name())
  case shimast.KindFunctionExpression:
    expr := node.AsFunctionExpression()
    if expr != nil {
      if name := identifierText(expr.Name()); name != "" {
        return name
      }
    }
  }
  for cur := node.Parent; cur != nil; cur = cur.Parent {
    if cur.Kind != shimast.KindVariableDeclaration {
      continue
    }
    if decl := cur.AsVariableDeclaration(); decl != nil && stripParens(decl.Initializer) == node {
      return identifierText(decl.Name())
    }
  }
  return ""
}

func isReactComponentOrHookName(name string) bool {
  if name == "" {
    return false
  }
  first, _ := utf8FirstRune(name)
  return unicode.IsUpper(first) || (strings.HasPrefix(name, "use") && len(name) > 3)
}

func utf8FirstRune(text string) (rune, int) {
  for i, r := range text {
    return r, i
  }
  return 0, 0
}

func runNoUnstableDeps(ctx *Context, root *shimast.Node) {
  imports := collectTanstackImports(root)
  tracked := map[string]bool{}

  walkDescendants(root, func(node *shimast.Node) {
    if node.Kind != shimast.KindVariableDeclaration {
      return
    }
    decl := node.AsVariableDeclaration()
    if decl == nil || decl.Initializer == nil {
      return
    }
    init := stripParens(decl.Initializer)
    if init == nil || init.Kind != shimast.KindCallExpression {
      return
    }
    call := init.AsCallExpression()
    if call == nil {
      return
    }
    name := callTanstackName(call, imports)
    if !isQueryResultHook(name) {
      return
    }
    if isUseQueriesHook(name) {
      if arg := firstArgumentObject(call); objectHasProperty(ctx.File, arg, "combine") {
        return
      }
    }
    collectBindingIdentifierNames(decl.Name(), tracked, false)
  })

  walkDescendants(root, func(node *shimast.Node) {
    if node.Kind != shimast.KindCallExpression {
      return
    }
    call := node.AsCallExpression()
    if call == nil || call.Arguments == nil || len(call.Arguments.Nodes) < 2 || !isReactDepsHook(call.Expression) {
      return
    }
    deps := stripParens(call.Arguments.Nodes[1])
    if deps == nil || deps.Kind != shimast.KindArrayLiteralExpression {
      return
    }
    for _, element := range arrayElements(deps) {
      if tracked[identifierText(stripParens(element))] {
        ctx.Report(element, "TanStack Query hook results are not referentially stable. Destructure the result before using it in a dependency array.")
      }
    }
  })
}

func isReactDepsHook(expr *shimast.Node) bool {
  if name := identifierText(stripParens(expr)); name == "useEffect" || name == "useCallback" || name == "useMemo" {
    return true
  }
  expr = stripParens(expr)
  if expr == nil || expr.Kind != shimast.KindPropertyAccessExpression {
    return false
  }
  access := expr.AsPropertyAccessExpression()
  if access == nil {
    return false
  }
  name := identifierText(access.Name())
  return (identifierText(access.Expression) == "React" || identifierText(access.Expression) == "react") &&
    (name == "useEffect" || name == "useCallback" || name == "useMemo")
}

func runInfiniteQueryPropertyOrder(ctx *Context, root *shimast.Node) {
  imports := collectTanstackImports(root)
  walkDescendants(root, func(node *shimast.Node) {
    if node.Kind != shimast.KindCallExpression {
      return
    }
    call := node.AsCallExpression()
    name := callTanstackName(call, imports)
    if name != "infiniteQueryOptions" && name != "useInfiniteQuery" && name != "useSuspenseInfiniteQuery" {
      return
    }
    object := firstArgumentObject(call)
    if object == nil {
      return
    }
    indexes := objectPropertyIndexes(ctx.File, object, "queryFn", "getPreviousPageParam", "getNextPageParam")
    queryFn, ok := indexes["queryFn"]
    if !ok {
      return
    }
    for _, key := range []string{"getPreviousPageParam", "getNextPageParam"} {
      if index, ok := indexes[key]; ok && index < queryFn {
        ctx.Report(objectProperty(ctx.File, object, key), "`queryFn` must be declared before `"+key+"` in infinite query options.")
      }
    }
  })
}

func runMutationPropertyOrder(ctx *Context, root *shimast.Node) {
  imports := collectTanstackImports(root)
  walkDescendants(root, func(node *shimast.Node) {
    if node.Kind != shimast.KindCallExpression {
      return
    }
    call := node.AsCallExpression()
    if callTanstackName(call, imports) != "useMutation" {
      return
    }
    object := firstArgumentObject(call)
    if object == nil {
      return
    }
    indexes := objectPropertyIndexes(ctx.File, object, "onMutate", "onError", "onSettled")
    onMutate, ok := indexes["onMutate"]
    if !ok {
      return
    }
    for _, key := range []string{"onError", "onSettled"} {
      if index, ok := indexes[key]; ok && index < onMutate {
        ctx.Report(objectProperty(ctx.File, object, key), "`onMutate` must be declared before `"+key+"` in mutation options.")
      }
    }
  })
}

func runNoVoidQueryFn(ctx *Context, root *shimast.Node) {
  imports := collectTanstackImports(root)
  walkDescendants(root, func(node *shimast.Node) {
    if node.Kind != shimast.KindPropertyAssignment {
      return
    }
    prop := node.AsPropertyAssignment()
    if prop == nil || propertyKey(ctx.File, node) != "queryFn" {
      return
    }
    parent := node.Parent
    if parent == nil || parent.Kind != shimast.KindObjectLiteralExpression {
      return
    }
    if !objectHasProperty(ctx.File, parent, "queryKey") && !isTanstackOptionsArgument(parent, imports) {
      return
    }
    if functionReturnsOnlyVoid(stripParens(prop.Initializer)) {
      ctx.Report(prop.Initializer, "TanStack Query queryFn must return a value.")
    }
  })
}

func isTanstackOptionsArgument(object *shimast.Node, imports tanstackImports) bool {
  if object == nil || object.Parent == nil {
    return false
  }
  if object.Parent.Kind != shimast.KindCallExpression {
    return false
  }
  call := object.Parent.AsCallExpression()
  if call == nil {
    return false
  }
  name := callTanstackName(call, imports)
  return isQueryHook(name) || name == "queryOptions" || name == "infiniteQueryOptions"
}

func functionReturnsOnlyVoid(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  var body *shimast.Node
  switch node.Kind {
  case shimast.KindArrowFunction:
    arrow := node.AsArrowFunction()
    if arrow == nil {
      return false
    }
    body = arrow.Body
  case shimast.KindFunctionExpression:
    body = node.Body()
  default:
    return false
  }
  body = stripParens(body)
  if body == nil {
    return false
  }
  if body.Kind != shimast.KindBlock {
    return isUndefinedLike(body)
  }
  hasReturn := false
  returnsValue := false
  walkDescendants(body, func(child *shimast.Node) {
    if child == body || child.Kind != shimast.KindReturnStatement {
      return
    }
    if nearestFunction(child) != node {
      return
    }
    hasReturn = true
    ret := child.AsReturnStatement()
    if ret != nil && ret.Expression != nil && !isUndefinedLike(stripParens(ret.Expression)) {
      returnsValue = true
    }
  })
  return !hasReturn || !returnsValue
}

func isUndefinedLike(node *shimast.Node) bool {
  if node == nil {
    return true
  }
  if identifierText(node) == "undefined" {
    return true
  }
  return node.Kind == shimast.KindVoidExpression
}

func runPreferQueryOptions(ctx *Context, root *shimast.Node) {
  imports := collectTanstackImports(root)
  walkDescendants(root, func(node *shimast.Node) {
    if node.Kind != shimast.KindCallExpression {
      return
    }
    call := node.AsCallExpression()
    name := callTanstackName(call, imports)
    if name == "" || call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
      return
    }
    if isQueryHook(name) {
      object := firstArgumentObject(call)
      if object != nil && (objectHasProperty(ctx.File, object, "queryKey") || objectHasProperty(ctx.File, object, "queryFn")) {
        ctx.Report(object, "Prefer extracting TanStack Query options with queryOptions().")
      }
    }
  })
}

func runExhaustiveDeps(ctx *Context, root *shimast.Node) {
  imports := collectTanstackImports(root)
  importNames := collectImportNames(root)
  walkDescendants(root, func(node *shimast.Node) {
    if node.Kind != shimast.KindObjectLiteralExpression {
      return
    }
    object := node.AsObjectLiteralExpression()
    if object == nil || !isTanstackOptionsArgument(node, imports) {
      return
    }
    queryKey := objectPropertyInitializer(ctx.File, node, "queryKey")
    queryFn := objectPropertyInitializer(ctx.File, node, "queryFn")
    if queryKey == nil || queryKey.Kind != shimast.KindArrayLiteralExpression || queryFn == nil {
      return
    }
    if queryFn.Kind != shimast.KindArrowFunction && queryFn.Kind != shimast.KindFunctionExpression {
      return
    }
    keyDeps := map[string]bool{}
    collectQueryKeyDeps(queryKey, keyDeps)
    freeDeps := collectQueryFnFreeDeps(queryFn, importNames)
    for dep, depNode := range freeDeps {
      if keyDeps[dep] {
        continue
      }
      ctx.Report(depNode, fmt.Sprintf("TanStack Query queryKey is missing dependency `%s` used by queryFn.", dep))
    }
  })
}

func collectQueryKeyDeps(node *shimast.Node, deps map[string]bool) {
  walkDescendants(node, func(child *shimast.Node) {
    if name := identifierText(child); name != "" {
      deps[name] = true
    }
  })
}

func collectQueryFnFreeDeps(fn *shimast.Node, imports map[string]bool) map[string]*shimast.Node {
  locals := map[string]bool{}
  for _, paramNode := range fn.Parameters() {
    if paramNode.Kind != shimast.KindParameter {
      continue
    }
    param := paramNode.AsParameterDeclaration()
    if param != nil {
      collectBindingIdentifierNames(param.Name(), locals, true)
    }
  }
  walkDescendants(fn.Body(), func(child *shimast.Node) {
    if child == nil || child == fn {
      return
    }
    if child.Kind == shimast.KindVariableDeclaration {
      decl := child.AsVariableDeclaration()
      collectBindingIdentifierNames(decl.Name(), locals, true)
    }
    if child.Kind == shimast.KindFunctionDeclaration {
      decl := child.AsFunctionDeclaration()
      if name := identifierText(decl.Name()); name != "" {
        locals[name] = true
      }
    }
  })

  deps := map[string]*shimast.Node{}
  walkDescendants(fn.Body(), func(child *shimast.Node) {
    name := identifierText(child)
    if name == "" || locals[name] || imports[name] || isKnownStableIdentifier(name) {
      return
    }
    if isPropertyAccessName(child) {
      return
    }
    deps[name] = child
  })
  return deps
}

func isPropertyAccessName(node *shimast.Node) bool {
  if node == nil || node.Parent == nil || node.Parent.Kind != shimast.KindPropertyAccessExpression {
    return false
  }
  access := node.Parent.AsPropertyAccessExpression()
  return access != nil && access.Name() == node
}

func isKnownStableIdentifier(name string) bool {
  switch name {
  case "undefined", "null", "true", "false", "Promise", "JSON", "Math", "Date", "console", "window", "document":
    return true
  }
  return false
}

func init() {
  Register(tanstackQueryRule{name: "exhaustive-deps", run: runExhaustiveDeps})
  Register(tanstackQueryRule{name: "stable-query-client", run: runStableQueryClient})
  Register(tanstackQueryRule{name: "no-rest-destructuring", run: runNoRestDestructuring})
  Register(tanstackQueryRule{name: "no-unstable-deps", run: runNoUnstableDeps})
  Register(tanstackQueryRule{name: "infinite-query-property-order", run: runInfiniteQueryPropertyOrder})
  Register(tanstackQueryRule{name: "mutation-property-order", run: runMutationPropertyOrder})
  Register(tanstackQueryRule{name: "no-void-query-fn", run: runNoVoidQueryFn})
  Register(tanstackQueryRule{name: "prefer-query-options", run: runPreferQueryOptions})
}
