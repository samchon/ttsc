// unicorn/no-unnecessary-polyfills: rejects imports of polyfill packages
// (`core-js/…`, `object-assign`, `es6-promise`, …) for APIs every targeted
// runtime already supports natively. The signal is "this dependency is dead
// weight for our `engines.node` / Browserslist floor".
//
// Port of eslint-plugin-unicorn 71.1.0 `rules/no-unnecessary-polyfills.js`
// backed by the pinned dataset in `polyfill_data_gen.json` (see
// `packages/lint/tools/polyfilldata/generate.mjs` for provenance and
// regeneration). Target resolution follows upstream exactly:
//
//  1. The `targets` option: a Browserslist query string or array is resolved
//     against the linted file's directory with the `production` environment;
//     a targets object goes to the core-js-compat targets parser directly.
//  2. Without the option, standard Browserslist config discovery from the
//     file's directory (`browserslist` / `.browserslistrc` files,
//     `package.json` `browserslist` keys and env sections, `BROWSERSLIST*`
//     environment overrides).
//  3. As a last resort, the `engines` field of the nearest `package.json`.
//
// Any resolution error leaves the rule silent for the file, mirroring
// upstream's try/catch; queries that need inputs a native host lacks
// (`extends`, `supports`, regional usage, `baseline`, `current node`) resolve
// as errors — see `polyfill_browserslist.go`. Unavailable-feature sets are
// cached by resolved-targets content (never by location), and every
// filesystem lookup re-reads the disk, so config edits are honored by
// long-lived hosts.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unnecessary-polyfills.md
package linthost

import (
  "encoding/json"
  "fmt"
  "os"
  "path/filepath"
  "strings"
  "time"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

const unicornNoUnnecessaryPolyfillsUseBuiltIn = "Use built-in instead."

func unicornNoUnnecessaryPolyfillsCoreJsMessage(coreJsModule string) string {
  return "All polyfilled features imported from `" + coreJsModule +
    "` are available as built-ins. Use the built-ins instead."
}

type unicornNoUnnecessaryPolyfills struct{}

func (unicornNoUnnecessaryPolyfills) Name() string { return "unicorn/no-unnecessary-polyfills" }
func (unicornNoUnnecessaryPolyfills) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindImportDeclaration, shimast.KindCallExpression}
}

type unicornNoUnnecessaryPolyfillsOptions struct {
  Targets json.RawMessage `json:"targets"`
}

func (unicornNoUnnecessaryPolyfills) ValidateOptions(raw json.RawMessage) error {
  _, err := unicornNoUnnecessaryPolyfillsDecodeOptions(raw)
  return err
}

// unicornNoUnnecessaryPolyfillsDecodeOptions enforces the upstream JSON
// schema: one object whose only property is `targets`, itself a string,
// array, or object.
func unicornNoUnnecessaryPolyfillsDecodeOptions(raw json.RawMessage) (unicornNoUnnecessaryPolyfillsOptions, error) {
  options := unicornNoUnnecessaryPolyfillsOptions{}
  trimmed := strings.TrimSpace(string(raw))
  if trimmed == "" || trimmed == "null" {
    return options, nil
  }
  if trimmed[0] != '{' {
    return options, fmt.Errorf("unicorn/no-unnecessary-polyfills options must be an object")
  }
  if err := decodeStrictJSON(raw, &options); err != nil {
    return options, fmt.Errorf(
      "unicorn/no-unnecessary-polyfills options may contain only `targets`: %w", err)
  }
  targets := strings.TrimSpace(string(options.Targets))
  if targets == "" {
    return options, nil
  }
  switch targets[0] {
  case '"', '[', '{':
    return options, nil
  }
  return options, fmt.Errorf(
    "unicorn/no-unnecessary-polyfills `targets` must be a Browserslist query string, an array of queries, or a targets object")
}

func (unicornNoUnnecessaryPolyfills) Check(ctx *Context, node *shimast.Node) {
  literal := unicornNoUnnecessaryPolyfillsSpecifier(node)
  if literal == nil {
    return
  }
  importedModule := stringLiteralText(literal)
  if strings.HasPrefix(importedModule, ".") || strings.HasPrefix(importedModule, "/") {
    return
  }

  options, err := unicornNoUnnecessaryPolyfillsDecodeOptions(ctx.Options)
  if err != nil {
    // Engine construction already reported malformed options as a
    // configuration error; stay side-effect-free here.
    return
  }
  unavailable, ok := unicornNoUnnecessaryPolyfillsUnavailableSet(ctx, options)
  if !ok {
    return
  }

  data := loadPolyfillData()
  coreJsModule := strings.Replace(importedModule, "core-js-pure", "core-js", 1)
  if features, isEntry := data.Entries[coreJsModule]; isEntry {
    if len(features) > 1 {
      if unicornNoUnnecessaryPolyfillsFeaturesAvailable(features, unavailable) {
        ctx.Report(literal, unicornNoUnnecessaryPolyfillsCoreJsMessage(importedModule))
      }
    } else if len(features) == 0 || !unicornNoUnnecessaryPolyfillsHas(unavailable, features[0]) {
      ctx.Report(literal, unicornNoUnnecessaryPolyfillsUseBuiltIn)
    }
    return
  }

  normalizedImportedModule := strings.ToLower(importedModule)
  candidates := polyfillGetCandidates(normalizedImportedModule)
  if candidates == nil {
    return
  }
  polyfill := polyfillBestMatch(candidates, importedModule)
  if polyfill == nil {
    return
  }

  if _, direct := polyfillDirectFeatureCheck[normalizedImportedModule]; direct {
    // These legacy aliases target one built-in feature, while the matching
    // `core-js/full/*` module now bundles extra `esnext` features that can
    // still be unavailable.
    if !unicornNoUnnecessaryPolyfillsHas(unavailable, polyfill.feature) {
      ctx.Report(literal, unicornNoUnnecessaryPolyfillsUseBuiltIn)
    }
    return
  }

  parts := strings.Split(polyfill.feature, ".")
  namespace := ""
  if len(parts) > 1 {
    namespace = parts[1]
  }
  method := ""
  if len(parts) > 2 {
    method = parts[2]
  }
  entryKey := "core-js/full/" + namespace
  if method != "" {
    entryKey += "/" + method
  }
  if matched, isEntry := data.Entries[entryKey]; isEntry &&
    unicornNoUnnecessaryPolyfillsFeaturesAvailable(matched, unavailable) {
    ctx.Report(literal, unicornNoUnnecessaryPolyfillsUseBuiltIn)
  }
}

// unicornNoUnnecessaryPolyfillsSpecifier extracts the checked module
// specifier: a static import's source, a dynamic `import(...)` source, or a
// static `require(...)` argument — string literals only, like upstream's
// Literal listener.
func unicornNoUnnecessaryPolyfillsSpecifier(node *shimast.Node) *shimast.Node {
  switch node.Kind {
  case shimast.KindImportDeclaration:
    imp := node.AsImportDeclaration()
    if imp == nil || imp.ModuleSpecifier == nil || imp.ModuleSpecifier.Kind != shimast.KindStringLiteral {
      return nil
    }
    return imp.ModuleSpecifier
  case shimast.KindCallExpression:
    call := node.AsCallExpression()
    if call == nil || call.Expression == nil || call.Arguments == nil {
      return nil
    }
    if call.Expression.Kind == shimast.KindImportKeyword {
      if len(call.Arguments.Nodes) < 1 {
        return nil
      }
      if source := call.Arguments.Nodes[0]; source != nil && source.Kind == shimast.KindStringLiteral {
        return source
      }
      return nil
    }
    // isStaticRequire: a plain, non-optional `require` call with exactly one
    // string-literal argument.
    if identifierText(call.Expression) != "require" || call.QuestionDotToken != nil {
      return nil
    }
    if len(call.Arguments.Nodes) != 1 {
      return nil
    }
    if argument := call.Arguments.Nodes[0]; argument != nil && argument.Kind == shimast.KindStringLiteral {
      return argument
    }
  }
  return nil
}

// unicornNoUnnecessaryPolyfillsUnavailableSet resolves the targets for the
// linted file (option → Browserslist config discovery → package.json
// engines) and returns the cached unavailable-feature set. `ok` is false when
// no targets resolve, which silences the rule like upstream's early returns
// and catch blocks.
func unicornNoUnnecessaryPolyfillsUnavailableSet(ctx *Context, options unicornNoUnnecessaryPolyfillsOptions) (map[string]struct{}, bool) {
  dirname := filepath.Dir(ctx.File.FileName())
  browserslistOptions := browserslistOpts{path: dirname, env: "production"}

  var targets interface{}
  rawTargets := strings.TrimSpace(string(options.Targets))
  switch {
  case rawTargets != "" && rawTargets != "null" && (rawTargets[0] == '"' || rawTargets[0] == '['):
    var queries []string
    if rawTargets[0] == '"' {
      var query string
      if err := json.Unmarshal(options.Targets, &query); err != nil {
        return nil, false
      }
      queries = []string{query}
    } else if err := json.Unmarshal(options.Targets, &queries); err != nil {
      return nil, false
    }
    resolved, err := browserslistResolve(queries, true, browserslistOptions)
    if err != nil {
      return nil, false
    }
    targets = unicornNoUnnecessaryPolyfillsBrowserList(resolved)
  case rawTargets != "" && rawTargets != "null" && rawTargets[0] == '{':
    parsed, err := browserslistParseOrderedJSON(options.Targets)
    if err != nil {
      return nil, false
    }
    targets = parsed
  default:
    config, found, err := browserslistLoadConfig(browserslistOptions)
    if err != nil {
      return nil, false
    }
    if found {
      resolved, resolveErr := browserslistResolve(config, true, browserslistOptions)
      if resolveErr != nil {
        return nil, false
      }
      targets = unicornNoUnnecessaryPolyfillsBrowserList(resolved)
    } else {
      engines, enginesFound := unicornNoUnnecessaryPolyfillsEngines(dirname)
      if !enginesFound {
        return nil, false
      }
      targets = engines
    }
  }

  cacheKey := polyfillCanonicalKey(targets)
  set := polyfillUnavailableFeatureSet(cacheKey, targets, ctx.CurrentDirectory, time.Now)
  if set == nil {
    return nil, false
  }
  return set, true
}

// unicornNoUnnecessaryPolyfillsBrowserList converts a resolved Browserslist
// result into the value shape the targets parser re-resolves, mirroring
// upstream where `getTargets` hands the raw array back to core-js-compat.
func unicornNoUnnecessaryPolyfillsBrowserList(resolved []string) []interface{} {
  list := make([]interface{}, len(resolved))
  for i, item := range resolved {
    list[i] = item
  }
  return list
}

// unicornNoUnnecessaryPolyfillsEngines mirrors readPackageJson().engines: the
// nearest package.json above the file, parsed leniently (failures read as "no
// package.json").
func unicornNoUnnecessaryPolyfillsEngines(dirname string) (interface{}, bool) {
  packageJsonPath, err := browserslistEachParent(dirname, func(dir string) (string, bool, error) {
    candidate := filepath.Join(dir, "package.json")
    if browserslistIsFile(candidate) {
      return candidate, true, nil
    }
    return "", false, nil
  })
  if err != nil || packageJsonPath == "" {
    return nil, false
  }
  content, readErr := os.ReadFile(packageJsonPath)
  if readErr != nil {
    return nil, false
  }
  parsed, parseErr := browserslistParseOrderedJSON(content)
  if parseErr != nil {
    return nil, false
  }
  object, isObject := parsed.(*browserslistOrderedObject)
  if !isObject {
    return nil, false
  }
  engines, has := object.get("engines")
  if !has || !polyfillJSTruthy(engines) {
    return nil, false
  }
  return engines, true
}

// unicornNoUnnecessaryPolyfillsFeaturesAvailable mirrors
// areFeaturesAvailable: every feature must be available, where an
// unavailable esnext.* feature listed next to its stabilized es.* twin is
// read as available (core-js-compat only reports the es.* form).
func unicornNoUnnecessaryPolyfillsFeaturesAvailable(features []string, unavailable map[string]struct{}) bool {
  for _, feature := range features {
    if !unicornNoUnnecessaryPolyfillsHas(unavailable, feature) {
      continue
    }
    if strings.HasPrefix(feature, "esnext.") {
      stabilized := "es." + strings.TrimPrefix(feature, "esnext.")
      twinListed := false
      for _, candidate := range features {
        if candidate == stabilized {
          twinListed = true
          break
        }
      }
      if twinListed {
        continue
      }
    }
    return false
  }
  return true
}

func unicornNoUnnecessaryPolyfillsHas(set map[string]struct{}, feature string) bool {
  _, has := set[feature]
  return has
}

// polyfillCanonicalKey serializes a targets value deterministically for the
// unavailable-set cache; ordered objects keep their JS key order.
func polyfillCanonicalKey(value interface{}) string {
  var builder strings.Builder
  polyfillWriteCanonicalKey(&builder, value)
  return builder.String()
}

func polyfillWriteCanonicalKey(builder *strings.Builder, value interface{}) {
  switch typed := value.(type) {
  case *browserslistOrderedObject:
    builder.WriteByte('{')
    for i, key := range typed.keys {
      if i > 0 {
        builder.WriteByte(',')
      }
      encoded, _ := json.Marshal(key)
      builder.Write(encoded)
      builder.WriteByte(':')
      polyfillWriteCanonicalKey(builder, typed.values[key])
    }
    builder.WriteByte('}')
  case []interface{}:
    builder.WriteByte('[')
    for i, element := range typed {
      if i > 0 {
        builder.WriteByte(',')
      }
      polyfillWriteCanonicalKey(builder, element)
    }
    builder.WriteByte(']')
  default:
    encoded, err := json.Marshal(typed)
    if err != nil {
      builder.WriteString(fmt.Sprintf("%v", typed))
      return
    }
    builder.Write(encoded)
  }
}

func init() {
  Register(unicornNoUnnecessaryPolyfills{})
}
