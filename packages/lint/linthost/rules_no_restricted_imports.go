// noRestrictedImports enforces the exact paths and path patterns supplied by
// the user. With no options it is a no-op: the rule contains no project policy
// of its own.
//
// The option surface mirrors ESLint's current core rule, including positional
// path entries, the {paths, patterns} object form, import-name restrictions,
// custom messages, case sensitivity, regular-expression patterns, and
// type-only exemptions.
// https://eslint.org/docs/latest/rules/no-restricted-imports
package linthost

import (
  "bytes"
  "encoding/json"
  "fmt"
  "regexp"
  "sort"
  "strings"
  "unicode"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

type noRestrictedImports struct{}

type noRestrictedImportsOptions struct {
  paths    []noRestrictedImportsPath
  patterns []noRestrictedImportsPattern
}

type noRestrictedImportsNameControl struct {
  importNames            []string
  hasImportNames         bool
  allowImportNames       []string
  hasAllowImportNames    bool
  importNamePattern      *regexp.Regexp
  importNamePatternText  string
  allowImportNamePattern *regexp.Regexp
  allowImportNameText    string
}

type noRestrictedImportsPath struct {
  name             string
  message          string
  allowTypeImports bool
  names            noRestrictedImportsNameControl
}

type noRestrictedImportsPattern struct {
  group            []noRestrictedImportsGlob
  expression       *regexp.Regexp
  message          string
  allowTypeImports bool
  names            noRestrictedImportsNameControl
}

type noRestrictedImportsGlob struct {
  expression    *regexp.Regexp
  negated       bool
  directoryOnly bool
}

type noRestrictedImportsReference struct {
  source        string
  sourceNode    *shimast.Node
  names         []noRestrictedImportsImportedName
  wholeTypeOnly bool
}

type noRestrictedImportsImportedName struct {
  name     string
  node     *shimast.Node
  pos      int
  end      int
  typeOnly bool
}

func (noRestrictedImports) Name() string { return "no-restricted-imports" }
func (noRestrictedImports) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindImportDeclaration,
    shimast.KindExportDeclaration,
    shimast.KindImportEqualsDeclaration,
  }
}

func (noRestrictedImports) ValidateOptions(raw json.RawMessage) error {
  _, err := parseNoRestrictedImportsOptions(raw)
  return err
}

func (noRestrictedImports) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || node == nil {
    return
  }
  options, err := parseNoRestrictedImportsOptions(ctx.Options)
  if err != nil || (len(options.paths) == 0 && len(options.patterns) == 0) {
    return
  }
  reference, ok := noRestrictedImportsReferenceOf(ctx.File, node)
  if !ok {
    return
  }

  for _, restricted := range options.paths {
    if reference.source == restricted.name {
      reportNoRestrictedImportsPath(ctx, reference, restricted)
    }
  }
  for _, restricted := range options.patterns {
    if restricted.matches(reference.source) {
      reportNoRestrictedImportsPattern(ctx, reference, restricted)
    }
  }
}

func parseNoRestrictedImportsOptions(raw json.RawMessage) (noRestrictedImportsOptions, error) {
  var options noRestrictedImportsOptions
  raw = bytes.TrimSpace(raw)
  if len(raw) == 0 {
    return options, nil
  }

  switch raw[0] {
  case '"':
    name, err := noRestrictedImportsDecodeString(raw, "path")
    if err != nil {
      return options, err
    }
    options.paths = append(options.paths, noRestrictedImportsPath{name: name})
    return options, nil
  case '{':
    object, err := noRestrictedImportsDecodeObject(raw, "options")
    if err != nil {
      return options, err
    }
    _, hasPaths := object["paths"]
    _, hasPatterns := object["patterns"]
    if len(object) == 0 || hasPaths || hasPatterns {
      return parseNoRestrictedImportsObjectOptions(object)
    }
    path, err := parseNoRestrictedImportsPathObject(object)
    if err != nil {
      return options, err
    }
    options.paths = append(options.paths, path)
    return options, nil
  case '[':
    entries, err := noRestrictedImportsDecodeArray(raw, "paths")
    if err != nil {
      return options, err
    }
    if err := noRestrictedImportsRequireUnique(entries, "paths"); err != nil {
      return options, err
    }
    options.paths, err = parseNoRestrictedImportsPaths(entries)
    return options, err
  default:
    return options, fmt.Errorf("options must be path entries or an object with %q and/or %q", "paths", "patterns")
  }
}

func parseNoRestrictedImportsObjectOptions(object map[string]json.RawMessage) (noRestrictedImportsOptions, error) {
  var options noRestrictedImportsOptions
  if err := noRestrictedImportsRejectUnknown(object, "paths", "patterns"); err != nil {
    return options, err
  }
  if raw, present := object["paths"]; present {
    entries, err := noRestrictedImportsDecodeArray(raw, "paths")
    if err != nil {
      return options, err
    }
    if err := noRestrictedImportsRequireUnique(entries, "paths"); err != nil {
      return options, err
    }
    options.paths, err = parseNoRestrictedImportsPaths(entries)
    if err != nil {
      return options, err
    }
  }
  if raw, present := object["patterns"]; present {
    entries, err := noRestrictedImportsDecodeArray(raw, "patterns")
    if err != nil {
      return options, err
    }
    if err := noRestrictedImportsRequireUnique(entries, "patterns"); err != nil {
      return options, err
    }
    options.patterns, err = parseNoRestrictedImportsPatterns(entries)
    if err != nil {
      return options, err
    }
  }
  return options, nil
}

func parseNoRestrictedImportsPaths(entries []json.RawMessage) ([]noRestrictedImportsPath, error) {
  paths := make([]noRestrictedImportsPath, 0, len(entries))
  for index, raw := range entries {
    raw = bytes.TrimSpace(raw)
    if len(raw) == 0 {
      return nil, fmt.Errorf("paths[%d] must be a string or object", index)
    }
    switch raw[0] {
    case '"':
      name, err := noRestrictedImportsDecodeString(raw, fmt.Sprintf("paths[%d]", index))
      if err != nil {
        return nil, err
      }
      paths = append(paths, noRestrictedImportsPath{name: name})
    case '{':
      object, err := noRestrictedImportsDecodeObject(raw, fmt.Sprintf("paths[%d]", index))
      if err != nil {
        return nil, err
      }
      path, err := parseNoRestrictedImportsPathObject(object)
      if err != nil {
        return nil, fmt.Errorf("paths[%d]: %w", index, err)
      }
      paths = append(paths, path)
    default:
      return nil, fmt.Errorf("paths[%d] must be a string or object", index)
    }
  }
  return paths, nil
}

func parseNoRestrictedImportsPathObject(object map[string]json.RawMessage) (noRestrictedImportsPath, error) {
  var path noRestrictedImportsPath
  if err := noRestrictedImportsRejectUnknown(
    object,
    "name",
    "message",
    "importNames",
    "allowImportNames",
    "allowTypeImports",
  ); err != nil {
    return path, err
  }
  rawName, present := object["name"]
  if !present {
    return path, fmt.Errorf("path object requires %q", "name")
  }
  var err error
  if path.name, err = noRestrictedImportsDecodeString(rawName, "name"); err != nil {
    return path, err
  }
  if raw, present := object["message"]; present {
    path.message, err = noRestrictedImportsDecodeString(raw, "message")
    if err != nil {
      return path, err
    }
    if path.message == "" {
      return path, fmt.Errorf("option %q must not be empty", "message")
    }
  }
  if raw, present := object["allowTypeImports"]; present {
    path.allowTypeImports, err = noRestrictedImportsDecodeBool(raw, "allowTypeImports")
    if err != nil {
      return path, err
    }
  }
  if raw, present := object["importNames"]; present {
    path.names.importNames, err = noRestrictedImportsStringList(raw, "importNames", false, false)
    if err != nil {
      return path, err
    }
    path.names.hasImportNames = true
  }
  if raw, present := object["allowImportNames"]; present {
    path.names.allowImportNames, err = noRestrictedImportsStringList(raw, "allowImportNames", false, false)
    if err != nil {
      return path, err
    }
    path.names.hasAllowImportNames = true
  }
  if path.names.hasImportNames && path.names.hasAllowImportNames {
    return path, fmt.Errorf("options %q and %q cannot be combined", "importNames", "allowImportNames")
  }
  return path, nil
}

func parseNoRestrictedImportsPatterns(entries []json.RawMessage) ([]noRestrictedImportsPattern, error) {
  if len(entries) == 0 {
    return nil, nil
  }
  first := bytes.TrimSpace(entries[0])
  if len(first) == 0 {
    return nil, fmt.Errorf("patterns[0] must be a string or object")
  }

  if first[0] == '"' {
    group := make([]string, 0, len(entries))
    for index, raw := range entries {
      text, err := noRestrictedImportsDecodeString(raw, fmt.Sprintf("patterns[%d]", index))
      if err != nil {
        return nil, fmt.Errorf("patterns must contain only strings or only objects: %w", err)
      }
      group = append(group, text)
    }
    compiled, err := noRestrictedImportsCompileGlobGroup(group, false)
    if err != nil {
      return nil, err
    }
    return []noRestrictedImportsPattern{{group: compiled}}, nil
  }
  if first[0] != '{' {
    return nil, fmt.Errorf("patterns[0] must be a string or object")
  }

  patterns := make([]noRestrictedImportsPattern, 0, len(entries))
  for index, raw := range entries {
    object, err := noRestrictedImportsDecodeObject(raw, fmt.Sprintf("patterns[%d]", index))
    if err != nil {
      return nil, fmt.Errorf("patterns must contain only strings or only objects: %w", err)
    }
    pattern, err := parseNoRestrictedImportsPatternObject(object)
    if err != nil {
      return nil, fmt.Errorf("patterns[%d]: %w", index, err)
    }
    patterns = append(patterns, pattern)
  }
  return patterns, nil
}

func parseNoRestrictedImportsPatternObject(object map[string]json.RawMessage) (noRestrictedImportsPattern, error) {
  var pattern noRestrictedImportsPattern
  if err := noRestrictedImportsRejectUnknown(
    object,
    "group",
    "regex",
    "message",
    "caseSensitive",
    "importNames",
    "allowImportNames",
    "importNamePattern",
    "allowImportNamePattern",
    "allowTypeImports",
  ); err != nil {
    return pattern, err
  }
  rawGroup, hasGroup := object["group"]
  rawRegex, hasRegex := object["regex"]
  if hasGroup == hasRegex {
    return pattern, fmt.Errorf("pattern object must contain exactly one of %q or %q", "group", "regex")
  }

  var err error
  caseSensitive := false
  if raw, present := object["caseSensitive"]; present {
    caseSensitive, err = noRestrictedImportsDecodeBool(raw, "caseSensitive")
    if err != nil {
      return pattern, err
    }
  }
  if raw, present := object["allowTypeImports"]; present {
    pattern.allowTypeImports, err = noRestrictedImportsDecodeBool(raw, "allowTypeImports")
    if err != nil {
      return pattern, err
    }
  }

  if hasGroup {
    group, err := noRestrictedImportsStringList(rawGroup, "group", true, true)
    if err != nil {
      return pattern, err
    }
    pattern.group, err = noRestrictedImportsCompileGlobGroup(group, caseSensitive)
    if err != nil {
      return pattern, err
    }
  } else {
    expression, err := noRestrictedImportsDecodeString(rawRegex, "regex")
    if err != nil {
      return pattern, err
    }
    pattern.expression, err = noRestrictedImportsCompileRegexp(expression, caseSensitive)
    if err != nil {
      return pattern, fmt.Errorf("option %q must be a valid regular expression: %w", "regex", err)
    }
  }
  if raw, present := object["message"]; present {
    pattern.message, err = noRestrictedImportsDecodeString(raw, "message")
    if err != nil {
      return pattern, err
    }
    if pattern.message == "" {
      return pattern, fmt.Errorf("option %q must not be empty", "message")
    }
  }
  if raw, present := object["importNames"]; present {
    pattern.names.importNames, err = noRestrictedImportsStringList(raw, "importNames", true, true)
    if err != nil {
      return pattern, err
    }
    pattern.names.hasImportNames = true
  }
  if raw, present := object["allowImportNames"]; present {
    pattern.names.allowImportNames, err = noRestrictedImportsStringList(raw, "allowImportNames", true, true)
    if err != nil {
      return pattern, err
    }
    pattern.names.hasAllowImportNames = true
  }
  if raw, present := object["importNamePattern"]; present {
    pattern.names.importNamePatternText, err = noRestrictedImportsDecodeString(raw, "importNamePattern")
    if err != nil {
      return pattern, err
    }
    pattern.names.importNamePattern, err = noRestrictedImportsCompileRegexp(pattern.names.importNamePatternText, true)
    if err != nil {
      return pattern, fmt.Errorf("option %q must be a valid regular expression: %w", "importNamePattern", err)
    }
  }
  if raw, present := object["allowImportNamePattern"]; present {
    pattern.names.allowImportNameText, err = noRestrictedImportsDecodeString(raw, "allowImportNamePattern")
    if err != nil {
      return pattern, err
    }
    pattern.names.allowImportNamePattern, err = noRestrictedImportsCompileRegexp(pattern.names.allowImportNameText, true)
    if err != nil {
      return pattern, fmt.Errorf("option %q must be a valid regular expression: %w", "allowImportNamePattern", err)
    }
  }
  if err := pattern.names.validatePatternCombinations(); err != nil {
    return pattern, err
  }
  return pattern, nil
}

func (control noRestrictedImportsNameControl) validatePatternCombinations() error {
  if control.hasImportNames && control.hasAllowImportNames {
    return fmt.Errorf("options %q and %q cannot be combined", "importNames", "allowImportNames")
  }
  if control.importNamePattern != nil && control.allowImportNamePattern != nil {
    return fmt.Errorf("options %q and %q cannot be combined", "importNamePattern", "allowImportNamePattern")
  }
  if control.hasImportNames && control.allowImportNamePattern != nil {
    return fmt.Errorf("options %q and %q cannot be combined", "importNames", "allowImportNamePattern")
  }
  if control.importNamePattern != nil && control.hasAllowImportNames {
    return fmt.Errorf("options %q and %q cannot be combined", "importNamePattern", "allowImportNames")
  }
  if control.hasAllowImportNames && control.allowImportNamePattern != nil {
    return fmt.Errorf("options %q and %q cannot be combined", "allowImportNames", "allowImportNamePattern")
  }
  return nil
}

func noRestrictedImportsDecodeObject(raw json.RawMessage, name string) (map[string]json.RawMessage, error) {
  var object map[string]json.RawMessage
  if err := json.Unmarshal(raw, &object); err != nil || object == nil {
    return nil, fmt.Errorf("%s must be an object", name)
  }
  return object, nil
}

func noRestrictedImportsDecodeArray(raw json.RawMessage, name string) ([]json.RawMessage, error) {
  var entries []json.RawMessage
  if err := json.Unmarshal(raw, &entries); err != nil || entries == nil {
    return nil, fmt.Errorf("option %q must be an array", name)
  }
  return entries, nil
}

func noRestrictedImportsDecodeString(raw json.RawMessage, name string) (string, error) {
  var decoded any
  if err := json.Unmarshal(raw, &decoded); err != nil {
    return "", fmt.Errorf("option %q must be a string", name)
  }
  value, ok := decoded.(string)
  if !ok {
    return "", fmt.Errorf("option %q must be a string", name)
  }
  return value, nil
}

func noRestrictedImportsDecodeBool(raw json.RawMessage, name string) (bool, error) {
  var decoded any
  if err := json.Unmarshal(raw, &decoded); err != nil {
    return false, fmt.Errorf("option %q must be a boolean", name)
  }
  value, ok := decoded.(bool)
  if !ok {
    return false, fmt.Errorf("option %q must be a boolean", name)
  }
  return value, nil
}

func noRestrictedImportsStringList(raw json.RawMessage, name string, nonEmpty, unique bool) ([]string, error) {
  entries, err := noRestrictedImportsDecodeArray(raw, name)
  if err != nil {
    return nil, err
  }
  if nonEmpty && len(entries) == 0 {
    return nil, fmt.Errorf("option %q must contain at least one string", name)
  }
  values := make([]string, 0, len(entries))
  seen := make(map[string]struct{}, len(entries))
  for index, rawEntry := range entries {
    value, err := noRestrictedImportsDecodeString(rawEntry, fmt.Sprintf("%s[%d]", name, index))
    if err != nil {
      return nil, err
    }
    if unique {
      if _, duplicate := seen[value]; duplicate {
        return nil, fmt.Errorf("option %q contains duplicate value %q", name, value)
      }
      seen[value] = struct{}{}
    }
    values = append(values, value)
  }
  return values, nil
}

func noRestrictedImportsRejectUnknown(object map[string]json.RawMessage, allowed ...string) error {
  known := make(map[string]struct{}, len(allowed))
  for _, name := range allowed {
    known[name] = struct{}{}
  }
  unknown := make([]string, 0)
  for name := range object {
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

func noRestrictedImportsRequireUnique(entries []json.RawMessage, name string) error {
  seen := make(map[string]struct{}, len(entries))
  for index, raw := range entries {
    var value any
    if err := json.Unmarshal(raw, &value); err != nil {
      return fmt.Errorf("%s[%d] must be valid JSON: %w", name, index, err)
    }
    canonical, err := json.Marshal(value)
    if err != nil {
      return fmt.Errorf("%s[%d] cannot be normalized: %w", name, index, err)
    }
    key := string(canonical)
    if _, duplicate := seen[key]; duplicate {
      return fmt.Errorf("option %q contains a duplicate entry at index %d", name, index)
    }
    seen[key] = struct{}{}
  }
  return nil
}

func noRestrictedImportsCompileRegexp(expression string, caseSensitive bool) (*regexp.Regexp, error) {
  if !caseSensitive {
    expression = "(?i:" + expression + ")"
  }
  return regexp.Compile(expression)
}

func noRestrictedImportsCompileGlobGroup(patterns []string, caseSensitive bool) ([]noRestrictedImportsGlob, error) {
  group := make([]noRestrictedImportsGlob, 0, len(patterns))
  for index, pattern := range patterns {
    compiled, active, err := noRestrictedImportsCompileGlob(pattern, caseSensitive)
    if err != nil {
      return nil, fmt.Errorf("option %q[%d] is not a valid pattern: %w", "group", index, err)
    }
    if active {
      group = append(group, compiled)
    }
  }
  return group, nil
}

func noRestrictedImportsCompileGlob(raw string, caseSensitive bool) (noRestrictedImportsGlob, bool, error) {
  var glob noRestrictedImportsGlob
  pattern := strings.TrimPrefix(raw, "\uFEFF")
  pattern = noRestrictedImportsTrimPattern(pattern)
  if pattern == "" || strings.HasPrefix(pattern, "#") {
    return glob, false, nil
  }
  if strings.HasPrefix(pattern, `\#`) || strings.HasPrefix(pattern, `\!`) {
    pattern = pattern[1:]
  } else if strings.HasPrefix(pattern, "!") {
    glob.negated = true
    pattern = pattern[1:]
  }
  if pattern == "" {
    return glob, false, nil
  }
  glob.directoryOnly = strings.HasSuffix(pattern, "/")
  pattern = strings.TrimSuffix(pattern, "/")
  rooted := strings.HasPrefix(pattern, "/")
  pattern = strings.TrimPrefix(pattern, "/")
  if pattern == "" {
    return glob, false, nil
  }

  body, err := noRestrictedImportsGlobRegexp(pattern, rooted)
  if err != nil {
    return glob, false, err
  }
  if !rooted && !strings.Contains(pattern, "/") {
    body = `(^|/)` + body
  } else {
    body = `^` + body
  }
  body += `$`
  glob.expression, err = noRestrictedImportsCompileRegexp(body, caseSensitive)
  if err != nil {
    return glob, false, err
  }
  return glob, true, nil
}

func noRestrictedImportsTrimPattern(pattern string) string {
  runes := []rune(pattern)
  for len(runes) > 0 && unicode.IsSpace(runes[len(runes)-1]) {
    slashCount := 0
    for index := len(runes) - 2; index >= 0 && runes[index] == '\\'; index-- {
      slashCount++
    }
    if slashCount%2 == 1 {
      runes = append(runes[:len(runes)-2], runes[len(runes)-1])
      break
    }
    runes = runes[:len(runes)-1]
  }
  return string(runes)
}

func noRestrictedImportsGlobRegexp(pattern string, rooted bool) (string, error) {
  runes := []rune(pattern)
  var expression strings.Builder
  for index := 0; index < len(runes); index++ {
    current := runes[index]
    switch current {
    case '\\':
      if index+1 < len(runes) {
        index++
        expression.WriteString(regexp.QuoteMeta(string(runes[index])))
      } else {
        expression.WriteString(`\\`)
      }
    case '*':
      start := index
      for index+1 < len(runes) && runes[index+1] == '*' {
        index++
      }
      count := index - start + 1
      previousSlash := start > 0 && runes[start-1] == '/'
      nextSlash := index+1 < len(runes) && runes[index+1] == '/'
      if count == 2 && nextSlash && (start == 0 || previousSlash) {
        index++
        expression.WriteString(`(?:[^/]+/)*`)
      } else if count == 2 && previousSlash && index == len(runes)-1 {
        expression.WriteString(`.+`)
      } else if count == 1 && index == len(runes)-1 && (previousSlash || (rooted && start == 0)) {
        expression.WriteString(`[^/]+`)
      } else {
        expression.WriteString(`[^/]*`)
      }
    case '?':
      expression.WriteString(`[^/]`)
    case '[':
      closeIndex := index + 1
      for closeIndex < len(runes) && runes[closeIndex] != ']' {
        closeIndex++
      }
      if closeIndex == len(runes) {
        expression.WriteString(`\[`)
        continue
      }
      class := string(runes[index+1 : closeIndex])
      if strings.HasPrefix(class, "!") {
        class = "^/" + class[1:]
      } else if strings.HasPrefix(class, "^") {
        class = `\^` + class[1:]
      }
      characterClass := "[" + class + "]"
      if _, err := regexp.Compile(characterClass); err != nil {
        // Gitignore accepts malformed or descending ranges as patterns and
        // treats an unusable range as non-matching instead of rejecting the
        // entire configuration.
        expression.WriteString(`(?:\b\B)`)
      } else {
        expression.WriteString(characterClass)
      }
      index = closeIndex
    default:
      expression.WriteString(regexp.QuoteMeta(string(current)))
    }
  }
  return expression.String(), nil
}

func (pattern noRestrictedImportsPattern) matches(source string) bool {
  if pattern.expression != nil {
    return pattern.expression.MatchString(source)
  }
  if len(pattern.group) == 0 {
    return false
  }
  parts := strings.Split(source, "/")
  for index := range parts {
    candidate := strings.Join(parts[:index+1], "/")
    directory := index < len(parts)-1
    ignored := false
    for _, glob := range pattern.group {
      if glob.directoryOnly && !directory {
        continue
      }
      if glob.expression.MatchString(candidate) {
        ignored = !glob.negated
      }
    }
    if ignored {
      return true
    }
  }
  return false
}

func noRestrictedImportsReferenceOf(file *shimast.SourceFile, node *shimast.Node) (noRestrictedImportsReference, bool) {
  var reference noRestrictedImportsReference
  if node == nil {
    return reference, false
  }
  switch node.Kind {
  case shimast.KindImportDeclaration:
    declaration := node.AsImportDeclaration()
    if declaration == nil || declaration.ModuleSpecifier == nil {
      return reference, false
    }
    reference.sourceNode = declaration.ModuleSpecifier
    reference.names, reference.wholeTypeOnly = noRestrictedImportsImportNames(declaration)
  case shimast.KindExportDeclaration:
    declaration := node.AsExportDeclaration()
    if declaration == nil || declaration.ModuleSpecifier == nil {
      return reference, false
    }
    reference.sourceNode = declaration.ModuleSpecifier
    reference.names, reference.wholeTypeOnly = noRestrictedImportsExportNames(file, node, declaration)
  case shimast.KindImportEqualsDeclaration:
    declaration := node.AsImportEqualsDeclaration()
    if declaration == nil || declaration.ModuleReference == nil ||
      declaration.ModuleReference.Kind != shimast.KindExternalModuleReference {
      return reference, false
    }
    module := declaration.ModuleReference.AsExternalModuleReference()
    if module == nil || module.Expression == nil {
      return reference, false
    }
    reference.sourceNode = module.Expression
    reference.wholeTypeOnly = declaration.IsTypeOnly
  default:
    return reference, false
  }
  reference.source = stringLiteralText(reference.sourceNode)
  return reference, true
}

func noRestrictedImportsImportNames(declaration *shimast.ImportDeclaration) ([]noRestrictedImportsImportedName, bool) {
  if declaration == nil || declaration.ImportClause == nil {
    return nil, false
  }
  clauseNode := declaration.ImportClause
  clause := clauseNode.AsImportClause()
  if clause == nil {
    return nil, false
  }
  clauseTypeOnly := clauseNode.IsTypeOnly()
  names := make([]noRestrictedImportsImportedName, 0)
  if name := clause.Name(); name != nil {
    names = append(names, noRestrictedImportsImportedName{name: "default", node: name, typeOnly: clauseTypeOnly})
  }
  if bindings := clause.NamedBindings; bindings != nil {
    switch bindings.Kind {
    case shimast.KindNamespaceImport:
      names = append(names, noRestrictedImportsImportedName{name: "*", node: bindings, typeOnly: clauseTypeOnly})
    case shimast.KindNamedImports:
      named := bindings.AsNamedImports()
      if named != nil && named.Elements != nil {
        for _, element := range named.Elements.Nodes {
          specifier := element.AsImportSpecifier()
          if specifier == nil {
            continue
          }
          imported := specifier.PropertyName
          if imported == nil {
            imported = specifier.Name()
          }
          names = append(names, noRestrictedImportsImportedName{
            name:     noRestrictedImportsModuleExportName(imported),
            node:     element,
            typeOnly: clauseTypeOnly || specifier.IsTypeOnly,
          })
        }
      }
    }
  }
  return names, clauseTypeOnly || noRestrictedImportsAllNamesTypeOnly(names)
}

func noRestrictedImportsExportNames(
  file *shimast.SourceFile,
  node *shimast.Node,
  declaration *shimast.ExportDeclaration,
) ([]noRestrictedImportsImportedName, bool) {
  if declaration == nil {
    return nil, false
  }
  declarationTypeOnly := declaration.IsTypeOnly
  clause := declaration.ExportClause
  if clause == nil {
    pos, end := noRestrictedImportsExportStarRange(file, node, declaration.ModuleSpecifier)
    return []noRestrictedImportsImportedName{{name: "*", pos: pos, end: end, typeOnly: declarationTypeOnly}}, declarationTypeOnly
  }
  if clause.Kind == shimast.KindNamespaceExport {
    pos, end := noRestrictedImportsExportStarRange(file, node, declaration.ModuleSpecifier)
    return []noRestrictedImportsImportedName{{name: "*", pos: pos, end: end, typeOnly: declarationTypeOnly}}, declarationTypeOnly
  }
  if clause.Kind != shimast.KindNamedExports {
    return nil, declarationTypeOnly
  }
  named := clause.AsNamedExports()
  if named == nil || named.Elements == nil {
    return nil, declarationTypeOnly
  }
  names := make([]noRestrictedImportsImportedName, 0, len(named.Elements.Nodes))
  for _, element := range named.Elements.Nodes {
    specifier := element.AsExportSpecifier()
    if specifier == nil {
      continue
    }
    imported := specifier.PropertyName
    if imported == nil {
      imported = specifier.Name()
    }
    names = append(names, noRestrictedImportsImportedName{
      name:     noRestrictedImportsModuleExportName(imported),
      node:     element,
      typeOnly: declarationTypeOnly || specifier.IsTypeOnly,
    })
  }
  return names, declarationTypeOnly || noRestrictedImportsAllNamesTypeOnly(names)
}

func noRestrictedImportsModuleExportName(node *shimast.Node) string {
  if name := identifierText(node); name != "" {
    return name
  }
  return stringLiteralText(node)
}

func noRestrictedImportsAllNamesTypeOnly(names []noRestrictedImportsImportedName) bool {
  if len(names) == 0 {
    return false
  }
  for _, name := range names {
    if !name.typeOnly {
      return false
    }
  }
  return true
}

func noRestrictedImportsExportStarRange(
  file *shimast.SourceFile,
  declaration *shimast.Node,
  moduleSpecifier *shimast.Node,
) (int, int) {
  if file == nil || declaration == nil {
    return -1, -1
  }
  source := file.Text()
  start, _ := tokenRange(file, declaration)
  limit, _ := tokenRange(file, moduleSpecifier)
  if start < 0 || limit < start || limit > len(source) {
    return -1, -1
  }
  scanner := shimscanner.NewScanner()
  scanner.SetText(source[start:limit])
  scanner.SetSkipTrivia(true)
  for {
    switch scanner.Scan() {
    case shimast.KindAsteriskToken:
      return start + scanner.TokenStart(), start + scanner.TokenEnd()
    case shimast.KindEndOfFile:
      return -1, -1
    }
  }
}

func reportNoRestrictedImportsPath(ctx *Context, reference noRestrictedImportsReference, restricted noRestrictedImportsPath) {
  if restricted.allowTypeImports && reference.wholeTypeOnly {
    return
  }
  if !restricted.names.hasRestrictions() {
    message := fmt.Sprintf("'%s' import is restricted from being used.", reference.source)
    ctx.Report(reference.sourceNode, noRestrictedImportsCustomMessage(message, restricted.message))
    return
  }
  reportNoRestrictedImportsNames(ctx, reference, restricted.names, restricted.message, false, restricted.allowTypeImports)
}

func reportNoRestrictedImportsPattern(ctx *Context, reference noRestrictedImportsReference, restricted noRestrictedImportsPattern) {
  if restricted.allowTypeImports && reference.wholeTypeOnly {
    return
  }
  if !restricted.names.hasRestrictions() {
    message := fmt.Sprintf("'%s' import is restricted from being used by a pattern.", reference.source)
    ctx.Report(reference.sourceNode, noRestrictedImportsCustomMessage(message, restricted.message))
    return
  }
  reportNoRestrictedImportsNames(ctx, reference, restricted.names, restricted.message, true, restricted.allowTypeImports)
}

func (control noRestrictedImportsNameControl) hasRestrictions() bool {
  return control.hasImportNames || control.hasAllowImportNames ||
    control.importNamePattern != nil || control.allowImportNamePattern != nil
}

func reportNoRestrictedImportsNames(
  ctx *Context,
  reference noRestrictedImportsReference,
  control noRestrictedImportsNameControl,
  customMessage string,
  pattern bool,
  allowTypeImports bool,
) {
  for _, imported := range reference.names {
    if allowTypeImports && imported.typeOnly {
      continue
    }
    if imported.name == "*" {
      message := noRestrictedImportsNamespaceMessage(reference.source, control, pattern)
      imported.report(ctx, noRestrictedImportsCustomMessage(message, customMessage))
      continue
    }
    restricted := control.hasImportNames && noRestrictedImportsContains(control.importNames, imported.name)
    restricted = restricted || (control.importNamePattern != nil && control.importNamePattern.MatchString(imported.name))
    if restricted {
      message := fmt.Sprintf("'%s' import from '%s' is restricted.", imported.name, reference.source)
      if pattern {
        message = fmt.Sprintf("'%s' import from '%s' is restricted from being used by a pattern.", imported.name, reference.source)
      }
      imported.report(ctx, noRestrictedImportsCustomMessage(message, customMessage))
    }
    if control.hasAllowImportNames && !noRestrictedImportsContains(control.allowImportNames, imported.name) {
      message := fmt.Sprintf(
        "'%s' import from '%s' is restricted because only %s %s allowed.",
        imported.name,
        reference.source,
        noRestrictedImportsFormatNames(control.allowImportNames),
        noRestrictedImportsIsOrAre(control.allowImportNames),
      )
      imported.report(ctx, noRestrictedImportsCustomMessage(message, customMessage))
    } else if control.allowImportNamePattern != nil && !control.allowImportNamePattern.MatchString(imported.name) {
      message := fmt.Sprintf(
        "'%s' import from '%s' is restricted because only imports that match the pattern '%s' are allowed from '%s'.",
        imported.name,
        reference.source,
        control.allowImportNameText,
        reference.source,
      )
      imported.report(ctx, noRestrictedImportsCustomMessage(message, customMessage))
    }
  }
}

func noRestrictedImportsNamespaceMessage(source string, control noRestrictedImportsNameControl, pattern bool) string {
  if control.hasImportNames {
    suffix := "restricted"
    if pattern {
      suffix = "restricted from being used by a pattern"
    }
    return fmt.Sprintf(
      "* import is invalid because %s from '%s' %s %s.",
      noRestrictedImportsFormatNames(control.importNames),
      source,
      noRestrictedImportsIsOrAre(control.importNames),
      suffix,
    )
  }
  if control.hasAllowImportNames {
    return fmt.Sprintf(
      "* import is invalid because only %s from '%s' %s allowed.",
      noRestrictedImportsFormatNames(control.allowImportNames),
      source,
      noRestrictedImportsIsOrAre(control.allowImportNames),
    )
  }
  if control.allowImportNamePattern != nil {
    return fmt.Sprintf(
      "* import is invalid because only imports that match the pattern '%s' from '%s' are allowed.",
      control.allowImportNameText,
      source,
    )
  }
  return fmt.Sprintf(
    "* import is invalid because import name matching '%s' pattern from '%s' is restricted from being used.",
    control.importNamePatternText,
    source,
  )
}

func (imported noRestrictedImportsImportedName) report(ctx *Context, message string) {
  if imported.node != nil {
    ctx.Report(imported.node, message)
    return
  }
  if imported.pos >= 0 && imported.end > imported.pos {
    ctx.ReportRange(imported.pos, imported.end, message)
  }
}

func noRestrictedImportsContains(values []string, value string) bool {
  for _, candidate := range values {
    if candidate == value {
      return true
    }
  }
  return false
}

func noRestrictedImportsFormatNames(names []string) string {
  quoted := make([]string, len(names))
  for index, name := range names {
    quoted[index] = "'" + name + "'"
  }
  switch len(quoted) {
  case 0:
    return ""
  case 1:
    return quoted[0]
  case 2:
    return quoted[0] + " and " + quoted[1]
  default:
    return strings.Join(quoted[:len(quoted)-1], ", ") + ", and " + quoted[len(quoted)-1]
  }
}

func noRestrictedImportsIsOrAre(names []string) string {
  if len(names) == 1 {
    return "is"
  }
  return "are"
}

func noRestrictedImportsCustomMessage(message, custom string) string {
  if custom == "" {
    return message
  }
  return message + " " + custom
}

func init() {
  Register(noRestrictedImports{})
}
