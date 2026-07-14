// Config and custom-stats discovery for the browserslist port
// (`polyfill_browserslist.go`): a transliteration of browserslist 4.28.6
// `node.js` — `loadConfig`, `findConfig(File)`, `parseConfig`,
// `parsePackage`, `pickEnv`, `getStat`, and `normalizeStats` — minus the
// process-level caches (every lookup re-reads the filesystem so long-lived
// hosts never serve stale config) and minus `extends` / regional loaders,
// which need a JS runtime or data ttsc does not embed.
package linthost

import (
  "encoding/json"
  "fmt"
  "os"
  "path/filepath"
  "regexp"
  "sort"
  "strings"
)

// browserslistSectionValue is one config section: either a query array or the
// raw string form package.json allows (`"browserslist": "query"`), whose JS
// falsiness when empty decides fallbacks.
type browserslistSectionValue struct {
  queries  []string
  isString bool
  str      string
}

// browserslistPackageConfig is a parsed config file: env sections plus the
// `invalid` marker for truthy non-config `browserslist` values, which
// upstream carries through and fails on only when the config is used.
type browserslistPackageConfig struct {
  sections map[string]browserslistSectionValue
  invalid  bool
}

var browserslistSectionPattern = regexp.MustCompile(`^\s*\[(.+)]\s*$`)
var browserslistCommentPattern = regexp.MustCompile(`#[^\n]*`)

// browserslistLoadConfig mirrors loadConfig: the BROWSERSLIST /
// BROWSERSLIST_CONFIG environment overrides, then config discovery from the
// path. `found` reports a JS-truthy config (an empty query array is still
// truthy, and resolves to an empty browser list).
func browserslistLoadConfig(opts browserslistOpts) (queries []string, found bool, err error) {
  if value := os.Getenv("BROWSERSLIST"); value != "" {
    return []string{value}, true, nil
  }
  if file := os.Getenv("BROWSERSLIST_CONFIG"); file != "" {
    config, parseErr := browserslistParsePackageOrReadConfig(file)
    if parseErr != nil {
      return nil, false, parseErr
    }
    return browserslistPickEnv(config, opts)
  }
  if opts.path != "" {
    config, findErr := browserslistFindConfig(opts.path)
    if findErr != nil {
      return nil, false, findErr
    }
    return browserslistPickEnv(config, opts)
  }
  return nil, false, nil
}

// browserslistPickEnv mirrors pickEnv over the parsed sections, using JS
// truthiness: a section holding an empty string falls through to `defaults`,
// and an empty-string result reads as "no config".
func browserslistPickEnv(config *browserslistPackageConfig, opts browserslistOpts) ([]string, bool, error) {
  if config == nil {
    return nil, false, nil
  }
  if config.invalid {
    return nil, false, newBrowserslistError(
      "Browserslist config should be a string or an array of strings with browser queries")
  }
  name := opts.env
  if name == "" {
    name = os.Getenv("BROWSERSLIST_ENV")
  }
  if name == "" {
    name = os.Getenv("NODE_ENV")
  }
  if name == "" {
    name = "production"
  }
  section, ok := config.sections[name]
  if !ok || browserslistSectionFalsy(section) {
    section, ok = config.sections["defaults"]
    if !ok || browserslistSectionFalsy(section) {
      return nil, false, nil
    }
  }
  if section.isString {
    return []string{section.str}, true, nil
  }
  if section.queries == nil {
    return []string{}, true, nil
  }
  return section.queries, true, nil
}

// browserslistSectionFalsy reports the JS falsiness of a section value: only
// the empty string is falsy (an empty array is truthy).
func browserslistSectionFalsy(section browserslistSectionValue) bool {
  return section.isString && section.str == ""
}

func browserslistParsePackageOrReadConfig(file string) (*browserslistPackageConfig, error) {
  if filepath.Base(file) == "package.json" {
    return browserslistParsePackage(file)
  }
  return browserslistReadConfig(file)
}

// browserslistParsePackage mirrors parsePackage. Config-shape problems come
// back as *browserslistConfigError (findConfigFile re-throws those) while
// unreadable / unparsable JSON comes back as a generic error (findConfigFile
// treats the directory as config-free, like upstream's warn-and-ignore).
func browserslistParsePackage(file string) (*browserslistPackageConfig, error) {
  text, err := os.ReadFile(file)
  if err != nil {
    return nil, fmt.Errorf("could not read %s: %w", file, err)
  }
  body := strings.TrimPrefix(string(text), "\uFEFF")
  if strings.Contains(body, `"browserslist"`) {
    var parsed struct {
      Browserslist json.RawMessage `json:"browserslist"`
    }
    if jsonErr := json.Unmarshal([]byte(body), &parsed); jsonErr != nil {
      return nil, fmt.Errorf("could not parse %s: %w", file, jsonErr)
    }
    return browserslistNormalizePackageValue(parsed.Browserslist)
  }
  if strings.Contains(body, `"browserlist"`) {
    var parsed struct {
      Browserlist json.RawMessage `json:"browserlist"`
    }
    if jsonErr := json.Unmarshal([]byte(body), &parsed); jsonErr != nil {
      return nil, fmt.Errorf("could not parse %s: %w", file, jsonErr)
    }
    if browserslistJSONTruthy(parsed.Browserlist) {
      return nil, newBrowserslistError(
        "`browserlist` key instead of `browserslist` in %s", file)
    }
  }
  return nil, nil
}

// browserslistNormalizePackageValue turns the raw `browserslist` package.json
// value into sections, mirroring the string/array wrapping and the `check()`
// validation. Truthy scalars become the deferred `invalid` config; falsy ones
// read as "no config here".
func browserslistNormalizePackageValue(raw json.RawMessage) (*browserslistPackageConfig, error) {
  trimmed := strings.TrimSpace(string(raw))
  if trimmed == "" || trimmed == "null" {
    return nil, nil
  }
  switch trimmed[0] {
  case '"':
    var value string
    if err := json.Unmarshal(raw, &value); err != nil {
      return nil, fmt.Errorf("invalid browserslist string: %w", err)
    }
    return &browserslistPackageConfig{
      sections: map[string]browserslistSectionValue{
        "defaults": {isString: true, str: value},
      },
    }, nil
  case '[':
    queries, err := browserslistDecodeQueryArray(raw)
    if err != nil {
      return nil, err
    }
    return &browserslistPackageConfig{
      sections: map[string]browserslistSectionValue{"defaults": {queries: queries}},
    }, nil
  case '{':
    var sections map[string]json.RawMessage
    if err := json.Unmarshal(raw, &sections); err != nil {
      return nil, fmt.Errorf("invalid browserslist sections: %w", err)
    }
    config := &browserslistPackageConfig{sections: map[string]browserslistSectionValue{}}
    for name, value := range sections {
      valueTrimmed := strings.TrimSpace(string(value))
      if strings.HasPrefix(valueTrimmed, `"`) {
        var str string
        if err := json.Unmarshal(value, &str); err != nil {
          return nil, fmt.Errorf("invalid browserslist section: %w", err)
        }
        config.sections[name] = browserslistSectionValue{isString: true, str: str}
        continue
      }
      queries, err := browserslistDecodeQueryArray(value)
      if err != nil {
        return nil, err
      }
      config.sections[name] = browserslistSectionValue{queries: queries}
    }
    return config, nil
  default:
    // Scalar: JS keeps falsy values as "no config" and carries truthy ones
    // until `pickEnv` / query checking fails on them.
    if trimmed == "false" || trimmed == "0" {
      return nil, nil
    }
    return &browserslistPackageConfig{invalid: true}, nil
  }
}

// browserslistDecodeQueryArray mirrors check(): a section must be an array
// whose every element is a string (the string form is handled by callers).
func browserslistDecodeQueryArray(raw json.RawMessage) ([]string, error) {
  var elements []json.RawMessage
  if !strings.HasPrefix(strings.TrimSpace(string(raw)), "[") {
    return nil, newBrowserslistError(
      "Browserslist config should be a string or an array of strings with browser queries")
  }
  if err := json.Unmarshal(raw, &elements); err != nil {
    return nil, newBrowserslistError(
      "Browserslist config should be a string or an array of strings with browser queries")
  }
  queries := make([]string, 0, len(elements))
  for _, element := range elements {
    var query string
    if err := json.Unmarshal(element, &query); err != nil {
      return nil, newBrowserslistError(
        "Browserslist config should be a string or an array of strings with browser queries")
    }
    queries = append(queries, query)
  }
  return queries, nil
}

func browserslistJSONTruthy(raw json.RawMessage) bool {
  trimmed := strings.TrimSpace(string(raw))
  switch trimmed {
  case "", "null", "false", "0", `""`:
    return false
  }
  return true
}

// browserslistParseConfig mirrors parseConfig for `browserslist` /
// `.browserslistrc` files: strip `#` comments, split lines on newlines AND
// commas, and route queries into `[section]` groups.
func browserslistParseConfig(text string) (*browserslistPackageConfig, error) {
  config := &browserslistPackageConfig{
    sections: map[string]browserslistSectionValue{"defaults": {queries: []string{}}},
  }
  sections := []string{"defaults"}
  body := browserslistCommentPattern.ReplaceAllString(text, "")
  for _, line := range strings.FieldsFunc(body, func(r rune) bool { return r == '\n' || r == ',' }) {
    line = strings.TrimSpace(line)
    if line == "" {
      continue
    }
    if match := browserslistSectionPattern.FindStringSubmatch(line); match != nil {
      sections = strings.Split(strings.TrimSpace(match[1]), " ")
      for _, section := range sections {
        if _, duplicate := config.sections[section]; duplicate {
          return nil, newBrowserslistError(
            "Duplicate section %s in Browserslist config", section)
        }
        config.sections[section] = browserslistSectionValue{queries: []string{}}
      }
      continue
    }
    for _, section := range sections {
      value := config.sections[section]
      value.queries = append(value.queries, line)
      config.sections[section] = value
    }
  }
  return config, nil
}

func browserslistReadConfig(file string) (*browserslistPackageConfig, error) {
  if !browserslistIsFile(file) {
    return nil, newBrowserslistError("Can't read %s config", file)
  }
  text, err := os.ReadFile(file)
  if err != nil {
    return nil, newBrowserslistError("Can't read %s config", file)
  }
  return browserslistParseConfig(string(text))
}

func browserslistIsFile(path string) bool {
  stat, err := os.Stat(path)
  return err == nil && stat.Mode().IsRegular()
}

func browserslistIsDirectory(path string) bool {
  stat, err := os.Stat(path)
  return err == nil && stat.IsDir()
}

// browserslistPathInRoot mirrors pathInRoot: BROWSERSLIST_ROOT_PATH bounds
// upward walks.
func browserslistPathInRoot(p string) bool {
  root := os.Getenv("BROWSERSLIST_ROOT_PATH")
  if root == "" {
    return true
  }
  rootAbs, err := filepath.Abs(root)
  if err != nil {
    return true
  }
  relative, err := filepath.Rel(rootAbs, p)
  if err != nil {
    // Different volumes: node's path.relative returns the target itself,
    // which never starts with "..".
    return true
  }
  return !strings.HasPrefix(relative, "..")
}

// browserslistEachParent mirrors eachParent without the process cache: walk
// from `file` to the filesystem root, invoking the callback on directories.
func browserslistEachParent(file string, callback func(dir string) (string, bool, error)) (string, error) {
  loc, err := filepath.Abs(file)
  if err != nil {
    return "", nil
  }
  loc = filepath.Clean(loc)
  for {
    if !browserslistPathInRoot(loc) {
      return "", nil
    }
    if browserslistIsDirectory(loc) {
      result, done, callbackErr := callback(loc)
      if callbackErr != nil {
        return "", callbackErr
      }
      if done {
        return result, nil
      }
    }
    parent := filepath.Dir(loc)
    if parent == loc {
      return "", nil
    }
    loc = parent
  }
}

// browserslistFindConfigFile mirrors findConfigFile, including the
// conflicting-config errors and the "ignore unparsable package.json" rule.
func browserslistFindConfigFile(from string) (string, error) {
  return browserslistEachParent(from, func(dir string) (string, bool, error) {
    config := filepath.Join(dir, "browserslist")
    pkg := filepath.Join(dir, "package.json")
    rc := filepath.Join(dir, ".browserslistrc")

    var pkgBrowserslist *browserslistPackageConfig
    if browserslistIsFile(pkg) {
      parsed, err := browserslistParsePackage(pkg)
      if err != nil {
        if _, isBrowserslistError := err.(*browserslistConfigError); isBrowserslistError {
          return "", false, err
        }
        // Upstream warns and ignores package.json files it cannot parse.
      } else {
        pkgBrowserslist = parsed
      }
    }

    configIsFile := browserslistIsFile(config)
    rcIsFile := browserslistIsFile(rc)
    switch {
    case configIsFile && pkgBrowserslist != nil:
      return "", false, newBrowserslistError(
        "%s contains both browserslist and package.json with browsers", dir)
    case rcIsFile && pkgBrowserslist != nil:
      return "", false, newBrowserslistError(
        "%s contains both .browserslistrc and package.json with browsers", dir)
    case configIsFile && rcIsFile:
      return "", false, newBrowserslistError(
        "%s contains both .browserslistrc and browserslist", dir)
    case configIsFile:
      return config, true, nil
    case rcIsFile:
      return rc, true, nil
    case pkgBrowserslist != nil:
      return pkg, true, nil
    }
    return "", false, nil
  })
}

func browserslistFindConfig(from string) (*browserslistPackageConfig, error) {
  configFile, err := browserslistFindConfigFile(from)
  if err != nil || configFile == "" {
    return nil, err
  }
  return browserslistParsePackageOrReadConfig(configFile)
}

// --- custom usage stats -------------------------------------------------------

// browserslistGetStat mirrors getStat + normalizeStats + fillUsage: locate a
// browserslist-stats.json (env override or upward walk), then flatten it into
// "browser version" usage keys preserving JS object iteration order. JSON
// null usage values are tracked separately because they skip percentage
// filters yet still occupy coverage slots.
func browserslistGetStat(opts browserslistOpts) (map[string]float64, []string, map[string]bool, error) {
  statsPath := os.Getenv("BROWSERSLIST_STATS")
  if statsPath == "" && opts.path != "" {
    found, err := browserslistEachParent(opts.path, func(dir string) (string, bool, error) {
      candidate := filepath.Join(dir, "browserslist-stats.json")
      if browserslistIsFile(candidate) {
        return candidate, true, nil
      }
      return "", false, nil
    })
    if err != nil {
      return nil, nil, nil, err
    }
    statsPath = found
  }
  if statsPath == "" {
    return nil, nil, nil, nil
  }
  content, err := os.ReadFile(statsPath)
  if err != nil {
    return nil, nil, nil, newBrowserslistError("Can't read %s", statsPath)
  }
  root, err := browserslistParseOrderedJSON(content)
  if err != nil {
    return nil, nil, nil, newBrowserslistError("Can't read %s", statsPath)
  }
  stats, ok := root.(*browserslistOrderedObject)
  if !ok {
    // `'dataByBrowser' in stats` throws on JSON null / scalars upstream.
    return nil, nil, nil, newBrowserslistError("Can't read %s", statsPath)
  }
  if inner, has := stats.get("dataByBrowser"); has {
    innerObject, isObject := inner.(*browserslistOrderedObject)
    if !isObject {
      return nil, nil, nil, nil
    }
    stats = innerObject
  }

  data := browserslistData()
  values := map[string]float64{}
  var order []string
  nulls := map[string]bool{}
  for _, browser := range stats.keys {
    browserStats, isObject := stats.values[browser].(*browserslistOrderedObject)
    if !isObject {
      continue
    }
    versions := browserStats.keys
    // normalizeStats: a one-version stat for a one-version browser is
    // rekeyed onto the browser's canonical version.
    if len(versions) == 1 {
      if agent, known := data.data[browser]; known && len(agent.versions) == 1 {
        key := browser + " " + agent.versions[0]
        browserslistAppendStat(values, &order, nulls, key, browserStats.values[versions[0]])
        continue
      }
    }
    for _, version := range versions {
      key := browser + " " + version
      browserslistAppendStat(values, &order, nulls, key, browserStats.values[version])
    }
  }
  return values, order, nulls, nil
}

func browserslistAppendStat(values map[string]float64, order *[]string, nulls map[string]bool, key string, value interface{}) {
  if _, dup := values[key]; dup {
    // fillUsage overwrites, keeping first key position.
    switch typed := value.(type) {
    case float64:
      values[key] = typed
      delete(nulls, key)
    case nil:
      values[key] = 0
      nulls[key] = true
    }
    return
  }
  switch typed := value.(type) {
  case float64:
    values[key] = typed
  case nil:
    values[key] = 0
    nulls[key] = true
  default:
    // Non-numeric usage values behave like null in the percentage filters.
    values[key] = 0
    nulls[key] = true
  }
  *order = append(*order, key)
}

// --- ordered JSON --------------------------------------------------------------

// browserslistOrderedObject preserves JS object key semantics for
// runtime-parsed JSON: canonical array indexes first in ascending order, then
// the remaining keys in document order.
type browserslistOrderedObject struct {
  keys   []string
  values map[string]interface{}
}

func (o *browserslistOrderedObject) get(key string) (interface{}, bool) {
  value, ok := o.values[key]
  return value, ok
}

var browserslistArrayIndexPattern = regexp.MustCompile(`^(0|[1-9][0-9]*)$`)

// browserslistParseOrderedJSON decodes JSON keeping object key order.
func browserslistParseOrderedJSON(content []byte) (interface{}, error) {
  decoder := json.NewDecoder(strings.NewReader(string(content)))
  decoder.UseNumber()
  value, err := browserslistDecodeOrderedValue(decoder)
  if err != nil {
    return nil, err
  }
  if decoder.More() {
    return nil, newBrowserslistError("trailing JSON content")
  }
  return value, nil
}

func browserslistDecodeOrderedValue(decoder *json.Decoder) (interface{}, error) {
  token, err := decoder.Token()
  if err != nil {
    return nil, err
  }
  switch typed := token.(type) {
  case json.Delim:
    switch typed {
    case '{':
      object := &browserslistOrderedObject{values: map[string]interface{}{}}
      for decoder.More() {
        keyToken, keyErr := decoder.Token()
        if keyErr != nil {
          return nil, keyErr
        }
        key := keyToken.(string)
        value, valueErr := browserslistDecodeOrderedValue(decoder)
        if valueErr != nil {
          return nil, valueErr
        }
        if _, dup := object.values[key]; !dup {
          object.keys = append(object.keys, key)
        }
        object.values[key] = value
      }
      if _, err := decoder.Token(); err != nil { // consume '}'
        return nil, err
      }
      browserslistApplyJSKeyOrder(object)
      return object, nil
    case '[':
      var array []interface{}
      for decoder.More() {
        value, valueErr := browserslistDecodeOrderedValue(decoder)
        if valueErr != nil {
          return nil, valueErr
        }
        array = append(array, value)
      }
      if _, err := decoder.Token(); err != nil { // consume ']'
        return nil, err
      }
      return array, nil
    }
    return nil, newBrowserslistError("unexpected JSON delimiter")
  case json.Number:
    parsed, parseErr := typed.Float64()
    if parseErr != nil {
      return nil, parseErr
    }
    return parsed, nil
  default:
    return token, nil // string, bool, nil
  }
}

// browserslistApplyJSKeyOrder reorders object keys the way JS property
// enumeration does: integer-like keys ascending before insertion-ordered
// string keys.
func browserslistApplyJSKeyOrder(object *browserslistOrderedObject) {
  var indexKeys []string
  var stringKeys []string
  for _, key := range object.keys {
    if browserslistArrayIndexPattern.MatchString(key) && len(key) <= 10 {
      indexKeys = append(indexKeys, key)
    } else {
      stringKeys = append(stringKeys, key)
    }
  }
  sort.Slice(indexKeys, func(i, j int) bool {
    return jsParseInt(indexKeys[i]) < jsParseInt(indexKeys[j])
  })
  object.keys = append(indexKeys, stringKeys...)
}
