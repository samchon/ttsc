package evidence

import (
  "encoding/json"
  "os"
  "path"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// importBinding is one name a module brings into scope, and where it came from.
//
// Imported is empty for a namespace import, which contributes no segment of its
// own: `import * as api` makes `api.functional` mean `functional` inside the
// resolved module, while `import { ISale }` makes `ISale` mean `ISale` there.
type importBinding struct {
  Local     string
  Specifier string
  Imported  string
  Namespace bool
  TypeOnly  bool
}

// collectImportBindings indexes a file's imports by the local name each binds.
//
// Type-only imports are included deliberately. A citation-only import should be
// `import type`, because it is erased at emit and creates no runtime dependency
// or cycle — so the form the rule recommends must be the form it can resolve.
func collectImportBindings(file *shimast.SourceFile) map[string]importBinding {
  bindings := map[string]importBinding{}
  if file == nil || file.Statements == nil {
    return bindings
  }
  for _, statement := range file.Statements.Nodes {
    if statement == nil || statement.Kind != shimast.KindImportDeclaration {
      continue
    }
    declaration := statement.AsImportDeclaration()
    if declaration == nil || declaration.ImportClause == nil {
      continue
    }
    specifier := stringLiteralText(declaration.ModuleSpecifier)
    if specifier == "" {
      continue
    }
    clause := declaration.ImportClause.AsImportClause()
    if clause == nil {
      continue
    }
    if name := declarationName(declaration.ImportClause.Name()); name != "" {
      bindings[name] = importBinding{
        Local:     name,
        Specifier: specifier,
        Imported:  "default",
        TypeOnly:  clause.IsTypeOnly(),
      }
    }
    if clause.NamedBindings == nil {
      continue
    }
    switch clause.NamedBindings.Kind {
    case shimast.KindNamespaceImport:
      if name := declarationName(clause.NamedBindings.Name()); name != "" {
        bindings[name] = importBinding{
          Local:     name,
          Specifier: specifier,
          Namespace: true,
          TypeOnly:  clause.IsTypeOnly(),
        }
      }
    case shimast.KindNamedImports:
      named := clause.NamedBindings.AsNamedImports()
      if named == nil || named.Elements == nil {
        continue
      }
      for _, element := range named.Elements.Nodes {
        if element == nil || element.Kind != shimast.KindImportSpecifier {
          continue
        }
        specifierNode := element.AsImportSpecifier()
        if specifierNode == nil {
          continue
        }
        local := declarationName(element.Name())
        imported := local
        if specifierNode.PropertyName != nil {
          imported = declarationName(specifierNode.PropertyName)
        }
        if local == "" || imported == "" {
          continue
        }
        bindings[local] = importBinding{
          Local:     local,
          Specifier: specifier,
          Imported:  imported,
          TypeOnly:  clause.IsTypeOnly() || specifierNode.IsTypeOnly,
        }
      }
    }
  }
  return bindings
}

func stringLiteralText(node *shimast.Node) string {
  if node == nil || node.Kind != shimast.KindStringLiteral {
    return ""
  }
  return node.Text()
}

// typeScriptModuleExtensions are tried in the order TypeScript itself prefers.
var typeScriptModuleExtensions = []string{
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".d.ts",
  ".d.mts",
  ".d.cts",
}

// splitPackageSpecifier separates a package name from a deep-import subpath,
// keeping the leading segment of a scoped name attached to its scope.
// moduleCandidates lists the files a specifier may denote, most specific first.
//
// The `.js` rewrite is not a convenience: under `nodenext` a TypeScript source
// must spell its sibling as `./x.js`, so refusing to map it back would make the
// correct import form unresolvable.
func moduleCandidates(base string) []string {
  if isTypeScriptPath(base) {
    return []string{base}
  }
  substitutions := map[string][]string{
    ".js":  {".ts", ".tsx", ".d.ts"},
    ".mjs": {".mts", ".d.mts"},
    ".cjs": {".cts", ".d.cts"},
  }
  if extensions, emitted := substitutions[path.Ext(base)]; emitted {
    stripped := strings.TrimSuffix(base, path.Ext(base))
    candidates := make([]string, 0, len(extensions))
    for _, extension := range extensions {
      candidates = append(candidates, stripped+extension)
    }
    return candidates
  }
  candidates := []string{}
  for _, extension := range typeScriptModuleExtensions {
    candidates = append(candidates, base+extension)
  }
  for _, extension := range typeScriptModuleExtensions {
    candidates = append(candidates, path.Join(base, "index"+extension))
  }
  return candidates
}

func splitPackageSpecifier(specifier string) (string, string) {
  segments := strings.Split(specifier, "/")
  if len(segments) == 0 || segments[0] == "" {
    return "", ""
  }
  count := 1
  if strings.HasPrefix(segments[0], "@") {
    if len(segments) < 2 {
      return "", ""
    }
    count = 2
  }
  name := strings.Join(segments[:count], "/")
  subpath := strings.Join(segments[count:], "/")
  if subpath != "" {
    subpath = "./" + subpath
  }
  return name, subpath
}

func readPackageManifest(root string, relative string) map[string]json.RawMessage {
  content, err := os.ReadFile(path.Join(strings.ReplaceAll(root, "\\", "/"), relative))
  if err != nil {
    return nil
  }
  manifest := map[string]json.RawMessage{}
  if err := json.Unmarshal(content, &manifest); err != nil {
    return nil
  }
  return manifest
}

func packageTypeEntry(
  manifest map[string]json.RawMessage,
  subpath string,
) string {
  if manifest == nil {
    return ""
  }
  key := "."
  if subpath != "" {
    key = subpath
  }
  if entry := exportsTypeEntry(manifest["exports"], key); entry != "" {
    return entry
  }
  if entry := typesVersionsEntry(manifest["typesVersions"], key); entry != "" {
    return entry
  }
  if subpath == "" {
    for _, field := range []string{"types", "typings"} {
      var value string
      if err := json.Unmarshal(manifest[field], &value); err == nil && value != "" {
        return value
      }
    }
  }
  // Every declaration channel above has been asked first, because a package
  // that names one has said where its declarations are and its runtime entry
  // is not it. Only when none answers is the runtime entry considered, and
  // only when it names TypeScript: a source-first workspace package has no
  // other way to say where its entry is.
  if entry := exportsRuntimeEntry(manifest["exports"], key); entry != "" {
    return entry
  }
  if subpath != "" {
    return ""
  }
  var main string
  if err := json.Unmarshal(manifest["main"], &main); err == nil {
    return typeScriptEntryTarget(main)
  }
  return ""
}

// typeScriptEntryTarget returns target when it names TypeScript itself.
//
// A published package points its runtime entry at emitted JavaScript and keeps
// its declarations behind a `types` condition, so following that entry would
// address the wrong file. A source-first workspace package has no emit to point
// at: pnpm links `packages/api` into `node_modules`, and its entry names
// `./src/index.ts`, which is both what a consumer imports and where the
// declarations are. Refusing it there leaves a linked package with no
// resolvable entry, and a reference that cannot find its entry publishes its
// units under the module that matched instead — which is how
// `functional.health.get` collapses to `get`.
func typeScriptEntryTarget(target string) string {
  for _, extension := range typeScriptModuleExtensions {
    if strings.HasSuffix(target, extension) {
      return target
    }
  }
  return ""
}

// exportsTypeEntry reads the `types` condition of an exports map.
//
// The map may be a bare string, a condition object, or a subpath object whose
// values are either. Only the `types` condition is followed, because a
// citation addresses declarations rather than the runtime entry `import` and
// `require` name. [exportsRuntimeEntry] answers for the package that has no
// declaration channel at all.
func exportsTypeEntry(raw json.RawMessage, key string) string {
  if len(raw) == 0 {
    return ""
  }
  // A bare-string exports map names the runtime entry only, and a citation
  // addresses declarations, so there is nothing here to follow.
  var direct string
  if err := json.Unmarshal(raw, &direct); err == nil {
    return ""
  }
  object := map[string]json.RawMessage{}
  if err := json.Unmarshal(raw, &object); err != nil {
    return ""
  }
  if _, subpaths := object["."]; subpaths || strings.HasPrefix(key, "./") {
    entry, exists := object[key]
    if !exists {
      return ""
    }
    return exportsConditionEntry(entry)
  }
  if key != "." {
    return ""
  }
  return exportsConditionEntry(raw)
}

func exportsConditionEntry(raw json.RawMessage) string {
  if len(raw) == 0 {
    return ""
  }
  var direct string
  if err := json.Unmarshal(raw, &direct); err == nil {
    return ""
  }
  object := map[string]json.RawMessage{}
  if err := json.Unmarshal(raw, &object); err != nil {
    return ""
  }
  if types, exists := object["types"]; exists {
    var value string
    if err := json.Unmarshal(types, &value); err == nil {
      return value
    }
    return exportsConditionEntry(types)
  }
  for _, condition := range []string{"import", "default"} {
    if nested, exists := object[condition]; exists {
      if entry := exportsConditionEntry(nested); entry != "" {
        return entry
      }
    }
  }
  return ""
}

// exportsRuntimeEntry reads the runtime entry of an exports map, and returns
// it only when it names TypeScript.
//
// It mirrors [exportsTypeEntry] over the same three shapes, following the
// target a consumer actually imports rather than the `types` condition. That
// target is the declarations exactly when it is TypeScript, which is the
// source-first workspace package [typeScriptEntryTarget] describes.
func exportsRuntimeEntry(raw json.RawMessage, key string) string {
  if len(raw) == 0 {
    return ""
  }
  var direct string
  if err := json.Unmarshal(raw, &direct); err == nil {
    if key != "." {
      return ""
    }
    return typeScriptEntryTarget(direct)
  }
  object := map[string]json.RawMessage{}
  if err := json.Unmarshal(raw, &object); err != nil {
    return ""
  }
  if _, subpaths := object["."]; subpaths || strings.HasPrefix(key, "./") {
    entry, exists := object[key]
    if !exists {
      return ""
    }
    return runtimeConditionEntry(entry)
  }
  if key != "." {
    return ""
  }
  return runtimeConditionEntry(raw)
}

func runtimeConditionEntry(raw json.RawMessage) string {
  if len(raw) == 0 {
    return ""
  }
  var direct string
  if err := json.Unmarshal(raw, &direct); err == nil {
    return typeScriptEntryTarget(direct)
  }
  object := map[string]json.RawMessage{}
  if err := json.Unmarshal(raw, &object); err != nil {
    return ""
  }
  for _, condition := range []string{"import", "default", "require"} {
    if nested, exists := object[condition]; exists {
      if entry := runtimeConditionEntry(nested); entry != "" {
        return entry
      }
    }
  }
  return ""
}

func typesVersionsEntry(raw json.RawMessage, key string) string {
  if len(raw) == 0 || key != "." {
    return ""
  }
  versions := map[string]map[string][]string{}
  if err := json.Unmarshal(raw, &versions); err != nil {
    return ""
  }
  for _, mapping := range versions {
    if entries, exists := mapping["*"]; exists && len(entries) != 0 {
      return entries[0]
    }
  }
  return ""
}
