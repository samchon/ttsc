// boundaries/dependencies is the unified, direction-aware boundary policy.
// It keeps the repository's project-local element declarations while following
// upstream's policy order: the last matching policy wins, and a disallow match
// takes precedence over allow within one policy. String selectors remain the
// shorthand for element types; object selectors add origin, source, path,
// entry/private/unknown state, and dependency metadata without coupling the
// rule to a particular repository layout.
//
// Module targets come from the TypeScript checker when available. That makes
// tsconfig path aliases and re-exports classify by their resolved source file,
// while the filesystem resolver remains the AST-only fallback used by the
// legacy boundary rules and focused tests.
// https://github.com/javierbrea/eslint-plugin-boundaries/blob/master/packages/website/docs/rules/dependencies.md
package linthost

import (
  "bytes"
  "encoding/json"
  "fmt"
  "path/filepath"
  "sort"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type boundariesDependencies struct{}

type boundaryDependenciesOptions struct {
  Elements           []boundaryElement
  Policies           []boundaryDependenciesPolicy
  Default            string
  Message            string
  CheckAllOrigins    bool
  CheckUnknownLocals bool
  CheckInternals     bool
}

type boundaryDependenciesPolicy struct {
  From       []boundaryDependenciesEntitySelector
  To         []boundaryDependenciesEntitySelector
  Dependency []boundaryDependenciesInfoSelector
  Allow      []boundaryDependenciesSelector
  Disallow   []boundaryDependenciesSelector
  ImportKind string
  Message    string
}

type boundaryDependenciesEntitySelector struct {
  Types    boundaryStringList
  Origins  boundaryStringList
  Sources  boundaryStringList
  Paths    boundaryStringList
  Entry    *bool
  Private  *bool
  Unknown  *bool
}

type boundaryDependenciesInfoSelector struct {
  Kinds      boundaryStringList
  Sources    boundaryStringList
  NodeKinds  boundaryStringList
  Specifiers boundaryStringList
}

type boundaryDependenciesSelector struct {
  From       []boundaryDependenciesEntitySelector
  To         []boundaryDependenciesEntitySelector
  Dependency []boundaryDependenciesInfoSelector
}

type boundaryDependenciesEntity struct {
  Type       string
  Origin     string
  Source     string
  Path       string
  Entry      bool
  Private    bool
  Unknown    bool
  boundary   *boundaryFile
}

type boundaryDependenciesDescription struct {
  From       boundaryDependenciesEntity
  To         boundaryDependenciesEntity
  Dependency boundaryDependency
  Internal   bool
}

type boundaryDependenciesEvaluation struct {
  allowed     bool
  policyIndex int
  policy      *boundaryDependenciesPolicy
}

func (boundariesDependencies) NeedsTypeChecker() bool { return true }

func (boundariesDependencies) ValidateOptions(raw json.RawMessage) error {
  _, err := parseBoundaryDependenciesOptions(raw)
  return err
}

func (boundariesDependencies) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || node == nil {
    return
  }
  options, err := parseBoundaryDependenciesOptions(ctx.Options)
  if err != nil {
    return
  }
  source := classifyBoundaryFile(ctx.File.FileName(), options.Elements)
  if source == nil {
    return
  }

  for _, dependency := range collectBoundaryDependencies(node) {
    if boundaryDependenciesShadowedRequire(ctx, dependency) {
      continue
    }
    description := describeBoundaryDependency(ctx, options, source, dependency)
    if description.To.Origin != "local" && !options.CheckAllOrigins {
      continue
    }
    if description.To.Origin == "local" && description.To.Unknown && !options.CheckUnknownLocals {
      continue
    }
    if description.Internal && !options.CheckInternals {
      continue
    }

    evaluation := evaluateBoundaryDependencies(options, description)
    if evaluation.allowed {
      continue
    }
    message := boundaryDependenciesMessage(options, description, evaluation)
    reportBoundaryDependency(ctx, dependency, message)
  }
}

func parseBoundaryDependenciesOptions(raw json.RawMessage) (boundaryDependenciesOptions, error) {
  options := boundaryDependenciesOptions{Default: "disallow"}
  raw = bytes.TrimSpace(raw)
  if len(raw) == 0 {
    return options, nil
  }
  fields, err := boundaryDependenciesObject(raw, "options")
  if err != nil {
    return options, err
  }
  if err := boundaryDependenciesRejectUnknown(
    fields,
    "elements",
    "policies",
    "rules",
    "default",
    "message",
    "checkAllOrigins",
    "checkUnknownLocals",
    "checkInternals",
  ); err != nil {
    return options, err
  }

  if value, present := fields["default"]; present {
    options.Default, err = boundaryDependenciesString(value, "default")
    if err != nil {
      return options, err
    }
    if options.Default != "allow" && options.Default != "disallow" {
      return options, fmt.Errorf("option %q must be %q or %q", "default", "allow", "disallow")
    }
  }
  if value, present := fields["message"]; present {
    options.Message, err = boundaryDependenciesString(value, "message")
    if err != nil {
      return options, err
    }
  }
  if value, present := fields["checkAllOrigins"]; present {
    options.CheckAllOrigins, err = boundaryDependenciesBool(value, "checkAllOrigins")
    if err != nil {
      return options, err
    }
  }
  if value, present := fields["checkUnknownLocals"]; present {
    options.CheckUnknownLocals, err = boundaryDependenciesBool(value, "checkUnknownLocals")
    if err != nil {
      return options, err
    }
  }
  if value, present := fields["checkInternals"]; present {
    options.CheckInternals, err = boundaryDependenciesBool(value, "checkInternals")
    if err != nil {
      return options, err
    }
  }
  if value, present := fields["elements"]; present {
    options.Elements, err = parseBoundaryDependenciesElements(value)
    if err != nil {
      return options, err
    }
  }

  policiesRaw, hasPolicies := fields["policies"]
  rulesRaw, hasRules := fields["rules"]
  if hasPolicies && hasRules {
    return options, fmt.Errorf("options %q and %q cannot be combined", "policies", "rules")
  }
  if !hasPolicies {
    policiesRaw = rulesRaw
  }
  if hasPolicies || hasRules {
    options.Policies, err = parseBoundaryDependenciesPolicies(policiesRaw)
    if err != nil {
      return options, err
    }
  }
  return options, nil
}

func parseBoundaryDependenciesElements(raw json.RawMessage) ([]boundaryElement, error) {
  entries, err := boundaryDependenciesArray(raw, "elements")
  if err != nil {
    return nil, err
  }
  elements := make([]boundaryElement, 0, len(entries))
  for index, entry := range entries {
    path := fmt.Sprintf("elements[%d]", index)
    fields, err := boundaryDependenciesObject(entry, path)
    if err != nil {
      return nil, err
    }
    if err := boundaryDependenciesRejectUnknown(fields, "type", "pattern", "entry", "private"); err != nil {
      return nil, fmt.Errorf("%s: %w", path, err)
    }
    typeRaw, hasType := fields["type"]
    patternRaw, hasPattern := fields["pattern"]
    if !hasType || !hasPattern {
      return nil, fmt.Errorf("%s requires non-empty %q and %q", path, "type", "pattern")
    }
    element := boundaryElement{}
    if element.Type, err = boundaryDependenciesString(typeRaw, path+".type"); err != nil {
      return nil, err
    }
    if element.Pattern, err = boundaryDependenciesString(patternRaw, path+".pattern"); err != nil {
      return nil, err
    }
    if element.Type == "" || element.Pattern == "" {
      return nil, fmt.Errorf("%s requires non-empty %q and %q", path, "type", "pattern")
    }
    if value, present := fields["entry"]; present {
      element.Entry, err = boundaryDependenciesStringList(value, path+".entry")
      if err != nil {
        return nil, err
      }
    }
    if value, present := fields["private"]; present {
      element.Private, err = boundaryDependenciesStringList(value, path+".private")
      if err != nil {
        return nil, err
      }
    }
    elements = append(elements, element)
  }
  return elements, nil
}

func parseBoundaryDependenciesPolicies(raw json.RawMessage) ([]boundaryDependenciesPolicy, error) {
  entries, err := boundaryDependenciesArray(raw, "policies")
  if err != nil {
    return nil, err
  }
  policies := make([]boundaryDependenciesPolicy, 0, len(entries))
  for index, entry := range entries {
    policy, err := parseBoundaryDependenciesPolicy(entry, index)
    if err != nil {
      return nil, err
    }
    policies = append(policies, policy)
  }
  return policies, nil
}

func parseBoundaryDependenciesPolicy(raw json.RawMessage, index int) (boundaryDependenciesPolicy, error) {
  var policy boundaryDependenciesPolicy
  path := fmt.Sprintf("policies[%d]", index)
  fields, err := boundaryDependenciesObject(raw, path)
  if err != nil {
    return policy, err
  }
  if err := boundaryDependenciesRejectUnknown(
    fields,
    "from",
    "to",
    "dependency",
    "allow",
    "disallow",
    "importKind",
    "message",
  ); err != nil {
    return policy, fmt.Errorf("%s: %w", path, err)
  }
  if value, present := fields["from"]; present {
    policy.From, err = parseBoundaryDependenciesEntitySelectors(value, path+".from")
    if err != nil {
      return policy, err
    }
  }
  if value, present := fields["to"]; present {
    policy.To, err = parseBoundaryDependenciesEntitySelectors(value, path+".to")
    if err != nil {
      return policy, err
    }
  }
  if value, present := fields["dependency"]; present {
    policy.Dependency, err = parseBoundaryDependenciesInfoSelectors(value, path+".dependency")
    if err != nil {
      return policy, err
    }
  }
  if value, present := fields["allow"]; present {
    policy.Allow, err = parseBoundaryDependenciesEffect(value, path+".allow")
    if err != nil {
      return policy, err
    }
  }
  if value, present := fields["disallow"]; present {
    policy.Disallow, err = parseBoundaryDependenciesEffect(value, path+".disallow")
    if err != nil {
      return policy, err
    }
  }
  if len(policy.Allow) == 0 && len(policy.Disallow) == 0 {
    return policy, fmt.Errorf("%s requires at least one of %q or %q", path, "allow", "disallow")
  }
  if value, present := fields["importKind"]; present {
    policy.ImportKind, err = boundaryDependenciesString(value, path+".importKind")
    if err != nil {
      return policy, err
    }
    if !boundaryDependenciesValidKind(policy.ImportKind) {
      return policy, fmt.Errorf("%s.importKind must be %q, %q, or %q", path, "value", "type", "typeof")
    }
  }
  if value, present := fields["message"]; present {
    policy.Message, err = boundaryDependenciesString(value, path+".message")
    if err != nil {
      return policy, err
    }
  }
  return policy, nil
}

func parseBoundaryDependenciesEntitySelectors(raw json.RawMessage, path string) ([]boundaryDependenciesEntitySelector, error) {
  raw = bytes.TrimSpace(raw)
  if len(raw) == 0 {
    return nil, fmt.Errorf("%s must be an entity selector", path)
  }
  switch raw[0] {
  case '"':
    value, err := boundaryDependenciesString(raw, path)
    if err != nil {
      return nil, err
    }
    if value == "" {
      return nil, fmt.Errorf("%s must not be empty", path)
    }
    return []boundaryDependenciesEntitySelector{{Types: boundaryStringList{value}}}, nil
  case '[':
    entries, err := boundaryDependenciesArray(raw, path)
    if err != nil {
      return nil, err
    }
    if len(entries) == 0 {
      return nil, fmt.Errorf("%s must not be empty", path)
    }
    selectors := make([]boundaryDependenciesEntitySelector, 0, len(entries))
    for index, entry := range entries {
      parsed, err := parseBoundaryDependenciesEntitySelectors(entry, fmt.Sprintf("%s[%d]", path, index))
      if err != nil {
        return nil, err
      }
      selectors = append(selectors, parsed...)
    }
    return selectors, nil
  case '{':
    selector, err := parseBoundaryDependenciesEntitySelectorObject(raw, path)
    if err != nil {
      return nil, err
    }
    return []boundaryDependenciesEntitySelector{selector}, nil
  default:
    return nil, fmt.Errorf("%s must be a string, object, or array of selectors", path)
  }
}

func parseBoundaryDependenciesEntitySelectorObject(raw json.RawMessage, path string) (boundaryDependenciesEntitySelector, error) {
  var selector boundaryDependenciesEntitySelector
  fields, err := boundaryDependenciesObject(raw, path)
  if err != nil {
    return selector, err
  }
  if err := boundaryDependenciesRejectUnknown(fields, "type", "origin", "source", "path", "entry", "private", "unknown"); err != nil {
    return selector, fmt.Errorf("%s: %w", path, err)
  }
  if value, present := fields["type"]; present {
    selector.Types, err = boundaryDependenciesStringList(value, path+".type")
    if err != nil {
      return selector, err
    }
  }
  if value, present := fields["origin"]; present {
    selector.Origins, err = boundaryDependenciesStringList(value, path+".origin")
    if err != nil {
      return selector, err
    }
  }
  if value, present := fields["source"]; present {
    selector.Sources, err = boundaryDependenciesStringList(value, path+".source")
    if err != nil {
      return selector, err
    }
  }
  if value, present := fields["path"]; present {
    selector.Paths, err = boundaryDependenciesStringList(value, path+".path")
    if err != nil {
      return selector, err
    }
  }
  if value, present := fields["entry"]; present {
    selected, err := boundaryDependenciesBool(value, path+".entry")
    if err != nil {
      return selector, err
    }
    selector.Entry = &selected
  }
  if value, present := fields["private"]; present {
    selected, err := boundaryDependenciesBool(value, path+".private")
    if err != nil {
      return selector, err
    }
    selector.Private = &selected
  }
  if value, present := fields["unknown"]; present {
    selected, err := boundaryDependenciesBool(value, path+".unknown")
    if err != nil {
      return selector, err
    }
    selector.Unknown = &selected
  }
  return selector, nil
}

func parseBoundaryDependenciesInfoSelectors(raw json.RawMessage, path string) ([]boundaryDependenciesInfoSelector, error) {
  raw = bytes.TrimSpace(raw)
  if len(raw) == 0 {
    return nil, fmt.Errorf("%s must be a dependency selector", path)
  }
  if raw[0] == '[' {
    entries, err := boundaryDependenciesArray(raw, path)
    if err != nil {
      return nil, err
    }
    if len(entries) == 0 {
      return nil, fmt.Errorf("%s must not be empty", path)
    }
    selectors := make([]boundaryDependenciesInfoSelector, 0, len(entries))
    for index, entry := range entries {
      parsed, err := parseBoundaryDependenciesInfoSelectors(entry, fmt.Sprintf("%s[%d]", path, index))
      if err != nil {
        return nil, err
      }
      selectors = append(selectors, parsed...)
    }
    return selectors, nil
  }
  fields, err := boundaryDependenciesObject(raw, path)
  if err != nil {
    return nil, err
  }
  if err := boundaryDependenciesRejectUnknown(fields, "kind", "source", "nodeKind", "specifiers"); err != nil {
    return nil, fmt.Errorf("%s: %w", path, err)
  }
  selector := boundaryDependenciesInfoSelector{}
  if value, present := fields["kind"]; present {
    selector.Kinds, err = boundaryDependenciesStringList(value, path+".kind")
    if err != nil {
      return nil, err
    }
    for _, kind := range selector.Kinds {
      if kind != "*" && !boundaryDependenciesValidKind(kind) {
        return nil, fmt.Errorf("%s.kind contains unsupported value %q", path, kind)
      }
    }
  }
  if value, present := fields["source"]; present {
    selector.Sources, err = boundaryDependenciesStringList(value, path+".source")
    if err != nil {
      return nil, err
    }
  }
  if value, present := fields["nodeKind"]; present {
    selector.NodeKinds, err = boundaryDependenciesStringList(value, path+".nodeKind")
    if err != nil {
      return nil, err
    }
  }
  if value, present := fields["specifiers"]; present {
    selector.Specifiers, err = boundaryDependenciesStringList(value, path+".specifiers")
    if err != nil {
      return nil, err
    }
  }
  return []boundaryDependenciesInfoSelector{selector}, nil
}

func parseBoundaryDependenciesEffect(raw json.RawMessage, path string) ([]boundaryDependenciesSelector, error) {
  raw = bytes.TrimSpace(raw)
  if len(raw) == 0 {
    return nil, fmt.Errorf("%s must be a selector", path)
  }
  if raw[0] == '[' {
    entries, err := boundaryDependenciesArray(raw, path)
    if err != nil {
      return nil, err
    }
    if len(entries) == 0 {
      return nil, fmt.Errorf("%s must not be empty", path)
    }
    selectors := make([]boundaryDependenciesSelector, 0, len(entries))
    for index, entry := range entries {
      parsed, err := parseBoundaryDependenciesEffect(entry, fmt.Sprintf("%s[%d]", path, index))
      if err != nil {
        return nil, err
      }
      selectors = append(selectors, parsed...)
    }
    return selectors, nil
  }
  if raw[0] == '{' {
    fields, err := boundaryDependenciesObject(raw, path)
    if err != nil {
      return nil, err
    }
    _, hasFrom := fields["from"]
    _, hasTo := fields["to"]
    _, hasDependency := fields["dependency"]
    if hasFrom || hasTo || hasDependency {
      if err := boundaryDependenciesRejectUnknown(fields, "from", "to", "dependency"); err != nil {
        return nil, fmt.Errorf("%s: %w", path, err)
      }
      selector := boundaryDependenciesSelector{}
      if hasFrom {
        selector.From, err = parseBoundaryDependenciesEntitySelectors(fields["from"], path+".from")
        if err != nil {
          return nil, err
        }
      }
      if hasTo {
        selector.To, err = parseBoundaryDependenciesEntitySelectors(fields["to"], path+".to")
        if err != nil {
          return nil, err
        }
      }
      if hasDependency {
        selector.Dependency, err = parseBoundaryDependenciesInfoSelectors(fields["dependency"], path+".dependency")
        if err != nil {
          return nil, err
        }
      }
      return []boundaryDependenciesSelector{selector}, nil
    }
  }
  entities, err := parseBoundaryDependenciesEntitySelectors(raw, path)
  if err != nil {
    return nil, err
  }
  selectors := make([]boundaryDependenciesSelector, 0, len(entities))
  for _, entity := range entities {
    selectors = append(selectors, boundaryDependenciesSelector{To: []boundaryDependenciesEntitySelector{entity}})
  }
  return selectors, nil
}

func describeBoundaryDependency(
  ctx *Context,
  options boundaryDependenciesOptions,
  source *boundaryFile,
  dependency boundaryDependency,
) boundaryDependenciesDescription {
  from := boundaryDependenciesEntityFromFile(source, ctx.File.FileName(), "local")
  resolvedPath, resolved := resolveBoundaryDependencyPath(ctx, dependency)
  local := dependency.relative || (resolved && boundaryDependenciesProjectLocalPath(ctx.CurrentDirectory, resolvedPath))
  if local {
    if !resolved && dependency.relative {
      resolvedPath = filepath.Clean(filepath.Join(filepath.Dir(ctx.File.FileName()), filepath.FromSlash(dependency.specifier)))
    }
    target := classifyBoundaryFile(resolvedPath, options.Elements)
    to := boundaryDependenciesEntityFromFile(target, resolvedPath, "local")
    to.Source = dependency.specifier
    to.Unknown = target == nil
    return boundaryDependenciesDescription{
      From:       from,
      To:         to,
      Dependency: dependency,
      Internal:   target != nil && source.RootPath != "" && source.RootPath == target.RootPath,
    }
  }

  origin := "external"
  if strings.HasPrefix(dependency.specifier, "node:") {
    origin = "core"
  }
  return boundaryDependenciesDescription{
    From: from,
    To: boundaryDependenciesEntity{
      Origin: origin,
      Source: dependency.specifier,
      Path:   dependency.specifier,
    },
    Dependency: dependency,
  }
}

func boundaryDependenciesEntityFromFile(file *boundaryFile, path, origin string) boundaryDependenciesEntity {
  entity := boundaryDependenciesEntity{
    Origin: origin,
    Source: normalizeBoundaryPath(path),
    Path:   boundaryDisplayPath(path),
    boundary: file,
  }
  if file == nil {
    return entity
  }
  entity.Type = file.Type
  entity.Path = file.LocalPath
  if entity.Path == "" {
    entity.Path = file.RelativePath
  }
  entity.Entry = matchBoundaryElementLocalPattern(file.Entry, file)
  entity.Private = matchBoundaryElementLocalPattern(file.Private, file)
  return entity
}

func resolveBoundaryDependencyPath(ctx *Context, dependency boundaryDependency) (string, bool) {
  if ctx != nil && ctx.Checker != nil && dependency.node != nil {
    symbol := ctx.Checker.GetSymbolAtLocation(dependency.node)
    if symbol != nil && symbol.Flags&shimast.SymbolFlagsAlias != 0 {
      symbol = ctx.Checker.GetAliasedSymbol(symbol)
    }
    if symbol != nil {
      for _, declaration := range symbol.Declarations {
        source := sourceFileForBoundaryDeclaration(declaration)
        if source == nil || source.FileName() == "" {
          continue
        }
        return filepath.Clean(source.FileName()), true
      }
    }
  }
  if ctx != nil && ctx.File != nil {
    return resolveBoundaryImport(ctx.File.FileName(), dependency.specifier)
  }
  return "", false
}

func sourceFileForBoundaryDeclaration(node *shimast.Node) *shimast.SourceFile {
  for current := node; current != nil; current = current.Parent {
    if current.Kind == shimast.KindSourceFile {
      return current.AsSourceFile()
    }
  }
  return nil
}

func boundaryDependenciesProjectLocalPath(root, path string) bool {
  if root == "" || path == "" || boundaryDependenciesPathHasSegment(path, "node_modules") {
    return false
  }
  relative, err := filepath.Rel(filepath.Clean(root), filepath.Clean(path))
  if err != nil || filepath.IsAbs(relative) {
    return false
  }
  return relative != ".." && !strings.HasPrefix(relative, ".."+string(filepath.Separator))
}

func boundaryDependenciesPathHasSegment(path, segment string) bool {
  normalized := strings.ToLower(filepath.ToSlash(filepath.Clean(path)))
  segment = "/" + strings.ToLower(strings.Trim(segment, "/")) + "/"
  return strings.Contains("/"+strings.Trim(normalized, "/")+"/", segment)
}

func boundaryDependenciesShadowedRequire(ctx *Context, dependency boundaryDependency) bool {
  if ctx == nil || ctx.Checker == nil || dependency.nodeKind != "RequireCall" || dependency.node == nil || dependency.node.Parent == nil {
    return false
  }
  call := dependency.node.Parent.AsCallExpression()
  if call == nil || call.Expression == nil {
    return false
  }
  symbol := ctx.Checker.GetSymbolAtLocation(call.Expression)
  if symbol == nil {
    return false
  }
  for _, declaration := range symbol.Declarations {
    source := sourceFileForBoundaryDeclaration(declaration)
    if source != nil && boundaryDependenciesProjectLocalPath(ctx.CurrentDirectory, source.FileName()) {
      return true
    }
  }
  return false
}

func evaluateBoundaryDependencies(
  options boundaryDependenciesOptions,
  description boundaryDependenciesDescription,
) boundaryDependenciesEvaluation {
  evaluation := boundaryDependenciesEvaluation{
    allowed:     options.Default == "allow",
    policyIndex: -1,
  }
  for index := range options.Policies {
    policy := &options.Policies[index]
    if !boundaryDependenciesEntitiesMatch(policy.From, description.From) ||
      !boundaryDependenciesEntitiesMatch(policy.To, description.To) ||
      !boundaryDependenciesInfoMatches(policy.Dependency, description.Dependency) {
      continue
    }
    if boundaryDependenciesEffectsMatch(policy, policy.Disallow, description) {
      evaluation.allowed = false
      evaluation.policyIndex = index
      evaluation.policy = policy
      continue
    }
    if boundaryDependenciesEffectsMatch(policy, policy.Allow, description) {
      evaluation.allowed = true
      evaluation.policyIndex = index
      evaluation.policy = policy
    }
  }
  return evaluation
}

func boundaryDependenciesEffectsMatch(
  policy *boundaryDependenciesPolicy,
  selectors []boundaryDependenciesSelector,
  description boundaryDependenciesDescription,
) bool {
  for _, selector := range selectors {
    if !boundaryDependenciesEntitiesMatch(selector.From, description.From) ||
      !boundaryDependenciesEntitiesMatch(selector.To, description.To) ||
      !boundaryDependenciesInfoMatches(selector.Dependency, description.Dependency) {
      continue
    }
    if policy.ImportKind != "" &&
      !boundaryDependenciesInfoHasKind(policy.Dependency) &&
      !boundaryDependenciesInfoHasKind(selector.Dependency) &&
      policy.ImportKind != description.Dependency.kind {
      continue
    }
    return true
  }
  return false
}

func boundaryDependenciesEntitiesMatch(selectors []boundaryDependenciesEntitySelector, entity boundaryDependenciesEntity) bool {
  if len(selectors) == 0 {
    return true
  }
  for _, selector := range selectors {
    if boundaryDependenciesEntityMatches(selector, entity) {
      return true
    }
  }
  return false
}

func boundaryDependenciesEntityMatches(selector boundaryDependenciesEntitySelector, entity boundaryDependenciesEntity) bool {
  if len(selector.Types) > 0 && !matchAnyBoundaryPattern(selector.Types, entity.Type) {
    return false
  }
  if len(selector.Origins) > 0 && !matchAnyBoundaryPattern(selector.Origins, entity.Origin) {
    return false
  }
  if len(selector.Sources) > 0 && !matchAnyBoundaryPattern(
    selector.Sources,
    entity.Source,
    boundaryPackageName(entity.Source),
  ) {
    return false
  }
  if len(selector.Paths) > 0 && !matchAnyBoundaryPattern(
    selector.Paths,
    entity.Path,
    filepath.Base(entity.Path),
  ) {
    return false
  }
  if selector.Entry != nil && *selector.Entry != entity.Entry {
    return false
  }
  if selector.Private != nil && *selector.Private != entity.Private {
    return false
  }
  if selector.Unknown != nil && *selector.Unknown != entity.Unknown {
    return false
  }
  return true
}

func boundaryDependenciesInfoMatches(selectors []boundaryDependenciesInfoSelector, dependency boundaryDependency) bool {
  if len(selectors) == 0 {
    return true
  }
  for _, selector := range selectors {
    if len(selector.Kinds) > 0 && !matchAnyBoundaryPattern(selector.Kinds, dependency.kind) {
      continue
    }
    if len(selector.Sources) > 0 && !matchAnyBoundaryPattern(
      selector.Sources,
      dependency.specifier,
      boundaryPackageName(dependency.specifier),
    ) {
      continue
    }
    if len(selector.NodeKinds) > 0 && !matchAnyBoundaryPattern(selector.NodeKinds, dependency.nodeKind) {
      continue
    }
    if len(selector.Specifiers) > 0 && !matchAnyBoundaryPattern(selector.Specifiers, dependency.specifiers...) {
      continue
    }
    return true
  }
  return false
}

func boundaryDependenciesInfoHasKind(selectors []boundaryDependenciesInfoSelector) bool {
  for _, selector := range selectors {
    if len(selector.Kinds) > 0 {
      return true
    }
  }
  return false
}

func boundaryDependenciesMessage(
  options boundaryDependenciesOptions,
  description boundaryDependenciesDescription,
  evaluation boundaryDependenciesEvaluation,
) string {
  custom := options.Message
  if evaluation.policy != nil && evaluation.policy.Message != "" {
    custom = evaluation.policy.Message
  }
  if custom != "" {
    return boundaryDependenciesRenderMessage(custom, description, evaluation.policyIndex)
  }
  from := boundaryDependenciesEntityLabel(description.From)
  to := boundaryDependenciesEntityLabel(description.To)
  if evaluation.policyIndex >= 0 {
    return fmt.Sprintf("Dependency from %s to %s is not allowed by policy at index %d.", from, to, evaluation.policyIndex)
  }
  return fmt.Sprintf("There is no policy allowing dependencies from %s to %s.", from, to)
}

func boundaryDependenciesEntityLabel(entity boundaryDependenciesEntity) string {
  switch entity.Origin {
  case "external", "core":
    return fmt.Sprintf("%s module %q", entity.Origin, entity.Source)
  }
  if entity.Unknown {
    return fmt.Sprintf("unknown local target %q", entity.Source)
  }
  return fmt.Sprintf("boundary element %q", entity.Type)
}

func boundaryDependenciesRenderMessage(
  message string,
  description boundaryDependenciesDescription,
  policyIndex int,
) string {
  return strings.NewReplacer(
    "{{from.type}}", description.From.Type,
    "{{from.path}}", description.From.Path,
    "{{from.origin}}", description.From.Origin,
    "{{to.type}}", description.To.Type,
    "{{to.path}}", description.To.Path,
    "{{to.origin}}", description.To.Origin,
    "{{dependency.source}}", description.Dependency.specifier,
    "{{dependency.kind}}", description.Dependency.kind,
    "{{dependency.nodeKind}}", description.Dependency.nodeKind,
    "{{policy.index}}", fmt.Sprintf("%d", policyIndex),
  ).Replace(message)
}

func boundaryDependenciesObject(raw json.RawMessage, path string) (map[string]json.RawMessage, error) {
  raw = bytes.TrimSpace(raw)
  if len(raw) == 0 || raw[0] != '{' {
    return nil, fmt.Errorf("%s must be an object", path)
  }
  var fields map[string]json.RawMessage
  if err := json.Unmarshal(raw, &fields); err != nil {
    return nil, fmt.Errorf("%s must be an object: %w", path, err)
  }
  if fields == nil {
    return nil, fmt.Errorf("%s must be an object", path)
  }
  return fields, nil
}

func boundaryDependenciesArray(raw json.RawMessage, path string) ([]json.RawMessage, error) {
  raw = bytes.TrimSpace(raw)
  if len(raw) == 0 || raw[0] != '[' {
    return nil, fmt.Errorf("%s must be an array", path)
  }
  var values []json.RawMessage
  if err := json.Unmarshal(raw, &values); err != nil {
    return nil, fmt.Errorf("%s must be an array: %w", path, err)
  }
  return values, nil
}

func boundaryDependenciesString(raw json.RawMessage, path string) (string, error) {
  var value string
  if err := json.Unmarshal(raw, &value); err != nil {
    return "", fmt.Errorf("%s must be a string", path)
  }
  return value, nil
}

func boundaryDependenciesStringList(raw json.RawMessage, path string) (boundaryStringList, error) {
  raw = bytes.TrimSpace(raw)
  if len(raw) == 0 {
    return nil, fmt.Errorf("%s must be a string or array of strings", path)
  }
  if raw[0] == '"' {
    value, err := boundaryDependenciesString(raw, path)
    if err != nil {
      return nil, err
    }
    if value == "" {
      return nil, fmt.Errorf("%s must not be empty", path)
    }
    return boundaryStringList{value}, nil
  }
  entries, err := boundaryDependenciesArray(raw, path)
  if err != nil {
    return nil, fmt.Errorf("%s must be a string or array of strings", path)
  }
  if len(entries) == 0 {
    return nil, fmt.Errorf("%s must not be empty", path)
  }
  values := make(boundaryStringList, 0, len(entries))
  seen := make(map[string]struct{}, len(entries))
  for index, entry := range entries {
    value, err := boundaryDependenciesString(entry, fmt.Sprintf("%s[%d]", path, index))
    if err != nil {
      return nil, err
    }
    if value == "" {
      return nil, fmt.Errorf("%s[%d] must not be empty", path, index)
    }
    if _, duplicate := seen[value]; duplicate {
      return nil, fmt.Errorf("%s contains duplicate value %q", path, value)
    }
    seen[value] = struct{}{}
    values = append(values, value)
  }
  return values, nil
}

func boundaryDependenciesBool(raw json.RawMessage, path string) (bool, error) {
  var value bool
  if err := json.Unmarshal(raw, &value); err != nil {
    return false, fmt.Errorf("%s must be a boolean", path)
  }
  return value, nil
}

func boundaryDependenciesRejectUnknown(fields map[string]json.RawMessage, allowed ...string) error {
  known := make(map[string]struct{}, len(allowed))
  for _, name := range allowed {
    known[name] = struct{}{}
  }
  unknown := make([]string, 0)
  for name := range fields {
    if _, ok := known[name]; !ok {
      unknown = append(unknown, name)
    }
  }
  if len(unknown) == 0 {
    return nil
  }
  sort.Strings(unknown)
  return fmt.Errorf("unknown option %q", unknown[0])
}

func boundaryDependenciesValidKind(kind string) bool {
  return kind == "value" || kind == "type" || kind == "typeof"
}
