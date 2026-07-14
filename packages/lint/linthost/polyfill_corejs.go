// Go port of the core-js-compat 3.49.0 pieces `unicorn/no-unnecessary-
// polyfills` consumes — the targets parser, the sloppy SemVer comparator, and
// the unavailable-module computation — plus the upstream rule's polyfill
// pattern/token tables (built from the same pinned `data.json` key order and
// a port of change-case 5.4.4 `camelCase`). The generated fixture
// `test/testdata/polyfills/upstream-patterns.json` pins the table
// construction byte-for-byte against the real upstream packages, and
// `corejs-compat-cases.json` pins the compat computation.
package linthost

import (
  "fmt"
  "math"
  "regexp"
  "sort"
  "strconv"
  "strings"
  "sync"
  "time"
)

// --- change-case camelCase port ----------------------------------------------

var (
  polyfillSplitLowerUpperPattern = regexp.MustCompile(`([\p{Ll}\d])(\p{Lu})`)
  polyfillSplitUpperUpperPattern = regexp.MustCompile(`(\p{Lu})(\p{Lu}\p{Ll})`)
  polyfillSplitStripPattern      = regexp.MustCompile(`[^\p{L}\d]+`)
)

// polyfillChangeCaseSplit ports change-case's split(): mark case and
// separator boundaries with NUL, then split.
func polyfillChangeCaseSplit(value string) []string {
  result := strings.TrimSpace(value)
  result = polyfillSplitLowerUpperPattern.ReplaceAllString(result, "${1}\x00${2}")
  result = polyfillSplitUpperUpperPattern.ReplaceAllString(result, "${1}\x00${2}")
  result = polyfillSplitStripPattern.ReplaceAllString(result, "\x00")
  result = strings.Trim(result, "\x00")
  if result == "" {
    return nil
  }
  return strings.Split(result, "\x00")
}

// polyfillCamelCase ports change-case's camelCase(), including the
// underscore it inserts before digit-initial words.
func polyfillCamelCase(input string) string {
  words := polyfillChangeCaseSplit(input)
  var builder strings.Builder
  for index, word := range words {
    if index == 0 {
      builder.WriteString(strings.ToLower(word))
      continue
    }
    runes := []rune(word)
    if runes[0] >= '0' && runes[0] <= '9' {
      builder.WriteByte('_')
      builder.WriteRune(runes[0])
    } else {
      builder.WriteString(strings.ToUpper(string(runes[0])))
    }
    builder.WriteString(strings.ToLower(string(runes[1:])))
  }
  return builder.String()
}

// --- core-js-compat sloppy SemVer ---------------------------------------------

var polyfillSemverPattern = regexp.MustCompile(`(\d+)(?:\.(\d+))?(?:\.(\d+))?`)

// polyfillParseSemver mirrors core-js-compat's SemVer: the FIRST digit run
// anywhere in the string is the major version (">=18" parses as 18.0.0), and
// inputs without digits are invalid.
func polyfillParseSemver(input string) ([3]int, error) {
  match := polyfillSemverPattern.FindStringSubmatch(input)
  if match == nil {
    return [3]int{}, fmt.Errorf("invalid version: %s", input)
  }
  var parsed [3]int
  for i := 0; i < 3; i++ {
    if match[i+1] == "" {
      continue
    }
    value, err := strconv.Atoi(match[i+1])
    if err != nil {
      return [3]int{}, fmt.Errorf("invalid version: %s", input)
    }
    parsed[i] = value
  }
  return parsed, nil
}

// polyfillCompareSemver mirrors compare($a, operator, $b).
func polyfillCompareSemver(a, operator, b string) (bool, error) {
  parsedA, err := polyfillParseSemver(a)
  if err != nil {
    return false, err
  }
  parsedB, err := polyfillParseSemver(b)
  if err != nil {
    return false, err
  }
  for i := 0; i < 3; i++ {
    if parsedA[i] < parsedB[i] {
      return operator == "<" || operator == "<=" || operator == "!=", nil
    }
    if parsedA[i] > parsedB[i] {
      return operator == ">" || operator == ">=" || operator == "!=", nil
    }
  }
  return operator == "==" || operator == "<=" || operator == ">=", nil
}

// --- targets parsing -----------------------------------------------------------

// polyfillTargetEntry is one parsed [engine, version] target.
type polyfillTargetEntry struct {
  engine  string
  version string
}

// polyfillJSString mirrors String(value) over decoded ordered-JSON values.
func polyfillJSString(value interface{}) string {
  switch typed := value.(type) {
  case string:
    return typed
  case float64:
    return polyfillJSNumberString(typed)
  case bool:
    if typed {
      return "true"
    }
    return "false"
  case nil:
    return "null"
  case []interface{}:
    parts := make([]string, len(typed))
    for i, element := range typed {
      if element == nil {
        parts[i] = ""
        continue
      }
      parts[i] = polyfillJSString(element)
    }
    return strings.Join(parts, ",")
  case *browserslistOrderedObject:
    return "[object Object]"
  default:
    return fmt.Sprintf("%v", typed)
  }
}

func polyfillJSNumberString(value float64) string {
  if value == math.Trunc(value) && math.Abs(value) < 1e21 {
    return strconv.FormatFloat(value, 'f', -1, 64)
  }
  return strconv.FormatFloat(value, 'g', -1, 64)
}

// polyfillParseTargets ports core-js-compat's targets-parser: normalize the
// targets input into deduplicated, alias-resolved, lowest-version [engine,
// version] pairs. `cwd` stands in for process.cwd() when a `browsers` query
// needs resolving, `now` feeds time-dependent browserslist queries.
func polyfillParseTargets(targets interface{}, cwd string, now func() time.Time) ([]polyfillTargetEntry, error) {
  data := loadPolyfillData()

  var browsers interface{}
  var esmodules interface{}
  var node interface{}
  var rest [][2]interface{}

  object, isObject := targets.(*browserslistOrderedObject)
  if !isObject {
    if _, isArray := targets.([]interface{}); !isArray {
      if _, isString := targets.(string); !isString {
        if targets == nil {
          return nil, fmt.Errorf("targets must not be null")
        }
        // JS spreads non-object targets into {browsers: targets}; a
        // non-string/array browsers value fails browserslist's query check.
        return nil, fmt.Errorf("browser queries must be an array or string")
      }
    }
    browsers = targets
  } else {
    lowered := &browserslistOrderedObject{values: map[string]interface{}{}}
    for _, key := range object.keys {
      lowerKey := strings.ToLower(key)
      if _, exists := lowered.values[lowerKey]; !exists {
        lowered.keys = append(lowered.keys, lowerKey)
      }
      lowered.values[lowerKey] = object.values[key]
    }
    for _, key := range lowered.keys {
      switch key {
      case "browsers":
        browsers = lowered.values[key]
      case "esmodules":
        esmodules = lowered.values[key]
      case "node":
        node = lowered.values[key]
      default:
        rest = append(rest, [2]interface{}{key, lowered.values[key]})
      }
    }
  }

  var list [][2]interface{}
  list = append(list, rest...)

  esmodulesIntersect := false
  esmodulesTrue := false
  if esString, isString := esmodules.(string); isString && esString == "intersect" {
    esmodulesIntersect = true
  } else if polyfillJSTruthy(esmodules) {
    esmodulesTrue = true
  }

  if polyfillJSTruthy(browsers) && !esmodulesTrue {
    switch typed := browsers.(type) {
    case string:
      resolved, err := browserslistResolve([]string{typed}, true, browserslistOpts{path: cwd, now: now})
      if err != nil {
        return nil, err
      }
      for _, item := range resolved {
        engine, version, _ := strings.Cut(item, " ")
        list = append(list, [2]interface{}{engine, version})
      }
    case []interface{}:
      queries := make([]string, len(typed))
      for i, element := range typed {
        query, isString := element.(string)
        if !isString {
          return nil, fmt.Errorf("browser queries must be strings")
        }
        queries[i] = query
      }
      resolved, err := browserslistResolve(queries, true, browserslistOpts{path: cwd, now: now})
      if err != nil {
        return nil, err
      }
      for _, item := range resolved {
        engine, version, _ := strings.Cut(item, " ")
        list = append(list, [2]interface{}{engine, version})
      }
    case *browserslistOrderedObject:
      for _, key := range typed.keys {
        list = append(list, [2]interface{}{key, typed.values[key]})
      }
    default:
      return nil, fmt.Errorf("browser queries must be an array or string")
    }
  }

  if esmodulesTrue {
    for _, engine := range polyfillSortedKeys(data.EsModulesTargets) {
      list = append(list, [2]interface{}{engine, data.EsModulesTargets[engine]})
    }
  }

  if polyfillJSTruthy(node) {
    if nodeString, isString := node.(string); isString && nodeString == "current" {
      return nil, fmt.Errorf(
        "`node: \"current\"` is not supported by the ttsc port: the lint host does not run inside Node.js")
    }
    list = append(list, [2]interface{}{"node", node})
  }

  type namedEntry struct {
    engine  string
    version string
  }
  normalized := make([]namedEntry, 0, len(list))
  for _, pair := range list {
    engine := polyfillJSString(pair[0])
    if alias, ok := data.Browserslist.Aliases[engine]; ok {
      engine = alias
    }
    if alias, ok := data.CoreJs.Aliases[engine]; ok {
      engine = alias
    }
    valid := false
    for _, target := range data.CoreJs.ValidTargets {
      if target == engine {
        valid = true
        break
      }
    }
    if !valid {
      continue
    }
    normalized = append(normalized, namedEntry{engine: engine, version: polyfillJSString(pair[1])})
  }
  sort.SliceStable(normalized, func(i, j int) bool {
    return normalized[i].engine < normalized[j].engine
  })

  var order []string
  reduced := map[string]string{}
  for _, entry := range normalized {
    current, exists := reduced[entry.engine]
    if !exists {
      order = append(order, entry.engine)
      reduced[entry.engine] = entry.version
      continue
    }
    lower, err := polyfillCompareSemver(entry.version, "<=", current)
    if err != nil {
      return nil, err
    }
    if lower {
      reduced[entry.engine] = entry.version
    }
  }

  result := make([]polyfillTargetEntry, 0, len(order))
  if esmodulesIntersect {
    for _, engine := range order {
      moduleVersion, supported := data.EsModulesTargets[engine]
      if !supported {
        continue
      }
      version := reduced[engine]
      higher, err := polyfillCompareSemver(moduleVersion, ">", version)
      if err != nil {
        return nil, err
      }
      if higher {
        version = moduleVersion
      }
      result = append(result, polyfillTargetEntry{engine: engine, version: version})
    }
    return result, nil
  }
  for _, engine := range order {
    result = append(result, polyfillTargetEntry{engine: engine, version: reduced[engine]})
  }
  return result, nil
}

// polyfillJSTruthy mirrors JS truthiness over decoded ordered-JSON values.
func polyfillJSTruthy(value interface{}) bool {
  switch typed := value.(type) {
  case nil:
    return false
  case bool:
    return typed
  case string:
    return typed != ""
  case float64:
    return typed != 0 && !math.IsNaN(typed)
  default:
    return true
  }
}

// polyfillSortedKeys returns map keys sorted lexicographically; the
// esmodules table is iterated through Object.entries whose keys are
// non-numeric and therefore insertion-ordered, but the emitted artifact is a
// JSON object, so a canonical order keeps the port deterministic. The pairs
// feed a full sort in the targets parser, so the choice is unobservable.
func polyfillSortedKeys(table map[string]string) []string {
  keys := make([]string, 0, len(table))
  for key := range table {
    keys = append(keys, key)
  }
  sort.Strings(keys)
  return keys
}

// --- unavailable module computation ---------------------------------------------

var (
  polyfillFilteredModulesOnce  sync.Once
  polyfillFilteredModulesValue []string
)

// polyfillFilteredModules mirrors filterOutStabilizedProposals over the full
// module list: esnext.* entries with a stabilized es.* twin are dropped.
func polyfillFilteredModules() []string {
  polyfillFilteredModulesOnce.Do(func() {
    data := loadPolyfillData()
    modules := make(map[string]struct{}, len(data.Modules))
    for _, module := range data.Modules {
      modules[module] = struct{}{}
    }
    for _, module := range data.Modules {
      if !strings.HasPrefix(module, "esnext.") {
        continue
      }
      if _, stabilized := modules["es."+strings.TrimPrefix(module, "esnext.")]; stabilized {
        delete(modules, module)
      }
    }
    filtered := make([]string, 0, len(modules))
    for _, module := range data.Modules {
      if _, kept := modules[module]; kept {
        filtered = append(filtered, module)
      }
    }
    polyfillFilteredModulesValue = filtered
  })
  return polyfillFilteredModulesValue
}

// polyfillCompatList mirrors `coreJsCompat({targets}).list`: the modules some
// target still requires, in data.json order.
func polyfillCompatList(targets []polyfillTargetEntry) ([]string, error) {
  data := loadPolyfillData()
  var list []string
  for _, module := range polyfillFilteredModules() {
    requirements := data.Compat[module]
    required := false
    for _, target := range targets {
      requiredVersion, supported := requirements[target.engine]
      if !supported {
        required = true
        continue
      }
      below, err := polyfillCompareSemver(target.version, "<", requiredVersion)
      if err != nil {
        return nil, err
      }
      if below {
        required = true
      }
    }
    if required {
      list = append(list, module)
    }
  }
  return list, nil
}

// polyfillUnavailableFeatureSet resolves and caches the unavailable-feature
// set for one targets value, mirroring the upstream rule's module-level
// `unavailableFeatureSetByTargets` cache (failed resolutions cache too). The
// key derives from the resolved targets content, so editing a Browserslist
// config or package.json always produces a fresh entry.
func polyfillUnavailableFeatureSet(cacheKey string, targets interface{}, cwd string, now func() time.Time) map[string]struct{} {
  polyfillUnavailableCacheMutex.Lock()
  cached, hit := polyfillUnavailableCache[cacheKey]
  polyfillUnavailableCacheMutex.Unlock()
  if hit {
    return cached
  }
  var set map[string]struct{}
  if entries, err := polyfillParseTargets(targets, cwd, now); err == nil {
    if list, listErr := polyfillCompatList(entries); listErr == nil {
      set = make(map[string]struct{}, len(list))
      for _, module := range list {
        set[module] = struct{}{}
      }
    }
  }
  polyfillUnavailableCacheMutex.Lock()
  polyfillUnavailableCache[cacheKey] = set
  polyfillUnavailableCacheMutex.Unlock()
  return set
}

var (
  polyfillUnavailableCacheMutex sync.Mutex
  polyfillUnavailableCache      = map[string]map[string]struct{}{}
)

// --- polyfill pattern / token tables ----------------------------------------------

// polyfillPattern is one feature's matching data from the upstream rule's
// module-level `polyfills` table.
type polyfillPattern struct {
  feature       string
  segments      int
  patternSource string
  pattern       *regexp.Regexp
  tokens        []string
}

type polyfillPatternTables struct {
  polyfills           []*polyfillPattern
  byToken             map[string][]*polyfillPattern
  tokensByFirstChar   map[byte][]string
  esConstructorTokens map[string]struct{}
}

var (
  polyfillPatternOnce        sync.Once
  polyfillPatternTablesValue *polyfillPatternTables
)

// polyfillAdditionalModules mirrors additionalPolyfillModules.
var polyfillAdditionalModules = map[string][]string{
  "es.promise.finally":         {"p-finally"},
  "es.object.set-prototype-of": {"setprototypeof"},
  "es.string.code-point-at":    {"code-point-at"},
}

// polyfillDirectFeatureCheck mirrors directFeatureCheckPolyfills.
var polyfillDirectFeatureCheck = map[string]struct{}{
  "es6-symbol":       {},
  "promise-polyfill": {},
  "es6-promise":      {},
  "weakmap-polyfill": {},
}

const (
  polyfillPrefixesPattern  = "(mdn-polyfills/|polyfill-)"
  polyfillSuffixesPattern  = "(-polyfill)"
  polyfillDelimiterPattern = `(\.|-|\.prototype\.|/)?`
)

// polyfillGetFirstSegment mirrors getFirstSegment: the substring before the
// first `-`, `.`, or `/`.
func polyfillGetFirstSegment(value string) string {
  if index := strings.IndexAny(value, "-./"); index >= 0 {
    return value[:index]
  }
  return value
}

func polyfillAddToken(seen map[string]struct{}, tokens *[]string, value string) {
  if value == "" {
    return
  }
  add := func(token string) {
    if _, dup := seen[token]; dup {
      return
    }
    seen[token] = struct{}{}
    *tokens = append(*tokens, token)
  }
  lowercase := strings.ToLower(value)
  add(lowercase)
  add(polyfillGetFirstSegment(lowercase))
  camel := strings.ToLower(polyfillCamelCase(value))
  add(camel)
  add(polyfillGetFirstSegment(camel))
}

// polyfillPatterns builds the pattern/token tables from the embedded compat
// module list, transliterating the upstream rule's module-level setup.
func polyfillPatterns() *polyfillPatternTables {
  polyfillPatternOnce.Do(func() {
    data := loadPolyfillData()
    tables := &polyfillPatternTables{
      byToken:             map[string][]*polyfillPattern{},
      tokensByFirstChar:   map[byte][]string{},
      esConstructorTokens: map[string]struct{}{},
    }
    seenByFirstChar := map[byte]map[string]struct{}{}
    for _, feature := range data.Modules {
      parts := strings.Split(feature, ".")
      rawEcmaVersion := parts[0]
      rawConstructorName := ""
      if len(parts) > 1 {
        rawConstructorName = parts[1]
      }
      rawMethodName := ""
      if len(parts) > 2 {
        rawMethodName = parts[2]
      }

      ecmaVersion := rawEcmaVersion
      if ecmaVersion == "es" {
        ecmaVersion = `(es\d*)`
      }
      constructorName := "(" + rawConstructorName + "|" + polyfillCamelCase(rawConstructorName) + ")"
      methodName := ""
      if rawMethodName != "" {
        methodName = "(" + rawMethodName + "|" + polyfillCamelCase(rawMethodName) + ")"
      }
      methodOrConstructor := methodName
      if methodOrConstructor == "" {
        methodOrConstructor = constructorName
      }
      additionalPattern := ""
      if modules, ok := polyfillAdditionalModules[feature]; ok {
        additionalPattern = "|(" + strings.Join(modules, "|") + ")"
      }
      var patternBuilder strings.Builder
      patternBuilder.WriteString("^((" + polyfillPrefixesPattern + "?(")
      if methodName != "" {
        patternBuilder.WriteString("(" + ecmaVersion + polyfillDelimiterPattern + constructorName + polyfillDelimiterPattern + methodName + ")|")
        patternBuilder.WriteString("(" + constructorName + polyfillDelimiterPattern + methodName + ")|")
      }
      patternBuilder.WriteString("(" + ecmaVersion + polyfillDelimiterPattern + constructorName + "))")
      patternBuilder.WriteString(polyfillSuffixesPattern + "?)|")
      patternBuilder.WriteString("(" + polyfillPrefixesPattern + methodOrConstructor + "|" + methodOrConstructor + polyfillSuffixesPattern + ")")
      patternBuilder.WriteString(additionalPattern + ")$")
      patternSource := patternBuilder.String()

      seen := map[string]struct{}{}
      var tokens []string
      if rawEcmaVersion == "es" {
        seen["es"] = struct{}{}
        tokens = append(tokens, "es")
      } else {
        polyfillAddToken(seen, &tokens, rawEcmaVersion)
      }
      polyfillAddToken(seen, &tokens, rawConstructorName)
      polyfillAddToken(seen, &tokens, rawMethodName)
      for _, module := range polyfillAdditionalModules[feature] {
        polyfillAddToken(seen, &tokens, module)
      }

      entry := &polyfillPattern{
        feature:       feature,
        segments:      len(parts),
        patternSource: patternSource,
        pattern:       regexp.MustCompile("(?i)" + patternSource),
        tokens:        tokens,
      }
      tables.polyfills = append(tables.polyfills, entry)

      if rawEcmaVersion == "es" {
        tables.esConstructorTokens[strings.ToLower(rawConstructorName)] = struct{}{}
        tables.esConstructorTokens[strings.ToLower(polyfillCamelCase(rawConstructorName))] = struct{}{}
      }
      for _, token := range tokens {
        if token == "" {
          continue
        }
        tables.byToken[token] = append(tables.byToken[token], entry)
        firstChar := token[0]
        if seenByFirstChar[firstChar] == nil {
          seenByFirstChar[firstChar] = map[string]struct{}{}
        }
        if _, dup := seenByFirstChar[firstChar][token]; !dup {
          seenByFirstChar[firstChar][token] = struct{}{}
          tables.tokensByFirstChar[firstChar] = append(tables.tokensByFirstChar[firstChar], token)
        }
      }
    }
    polyfillPatternTablesValue = tables
  })
  return polyfillPatternTablesValue
}

// polyfillStripPrefix mirrors stripPolyfillPrefix.
func polyfillStripPrefix(value string) string {
  if strings.HasPrefix(value, "polyfill-") {
    return value[len("polyfill-"):]
  }
  if strings.HasPrefix(value, "mdn-polyfills/") {
    return value[len("mdn-polyfills/"):]
  }
  return value
}

// polyfillHasEsConstructorPrefix mirrors hasEsConstructorPrefix.
func polyfillHasEsConstructorPrefix(tables *polyfillPatternTables, value string) bool {
  for token := range tables.esConstructorTokens {
    if strings.HasPrefix(value, token) {
      return true
    }
  }
  return false
}

// polyfillIsPotentialEsPrefix mirrors isPotentialEsPrefix.
func polyfillIsPotentialEsPrefix(tables *polyfillPatternTables, importedModule string) bool {
  if !strings.HasPrefix(importedModule, "es") {
    return false
  }
  index := 2
  for index < len(importedModule) && importedModule[index] >= '0' && importedModule[index] <= '9' {
    index++
  }
  if strings.HasPrefix(importedModule[index:], ".prototype.") {
    index += len(".prototype.")
  } else if index < len(importedModule) &&
    (importedModule[index] == '.' || importedModule[index] == '-' || importedModule[index] == '/') {
    index++
  }
  if index > len(importedModule) {
    return false
  }
  return polyfillHasEsConstructorPrefix(tables, importedModule[index:])
}

// polyfillGetCandidates mirrors getPolyfillCandidates: the token prefilter
// that selects which patterns are worth testing, preserving upstream's
// candidate iteration order (it breaks best-match ties).
func polyfillGetCandidates(normalizedImportedModule string) []*polyfillPattern {
  tables := polyfillPatterns()
  stripped := polyfillStripPrefix(normalizedImportedModule)
  if stripped == "" {
    return nil
  }
  tokens, ok := tables.tokensByFirstChar[stripped[0]]
  if !ok {
    return nil
  }
  var candidates []*polyfillPattern
  seen := map[*polyfillPattern]struct{}{}
  add := func(entries []*polyfillPattern) {
    for _, entry := range entries {
      if _, dup := seen[entry]; dup {
        continue
      }
      seen[entry] = struct{}{}
      candidates = append(candidates, entry)
    }
  }
  firstSegment := polyfillGetFirstSegment(stripped)
  if firstSegment == stripped {
    for _, token := range tokens {
      if token == "es" {
        if !polyfillIsPotentialEsPrefix(tables, stripped) {
          continue
        }
      } else if !strings.HasPrefix(stripped, token) {
        continue
      }
      add(tables.byToken[token])
    }
  } else {
    for _, token := range tokens {
      if token == "es" || !strings.HasPrefix(firstSegment, token) {
        continue
      }
      add(tables.byToken[token])
    }
  }
  if polyfillIsPotentialEsPrefix(tables, stripped) {
    add(tables.byToken["es"])
  }
  if len(candidates) == 0 {
    return nil
  }
  return candidates
}

// polyfillBestMatch mirrors getBestMatchingPolyfill: the least specific
// (fewest feature segments) candidate whose pattern matches, first-wins on
// ties.
func polyfillBestMatch(candidates []*polyfillPattern, importedModule string) *polyfillPattern {
  var best *polyfillPattern
  bestSegments := int(^uint(0) >> 1)
  for _, candidate := range candidates {
    if !candidate.pattern.MatchString(importedModule) {
      continue
    }
    if candidate.segments < bestSegments {
      best = candidate
      bestSegments = candidate.segments
    }
  }
  return best
}
