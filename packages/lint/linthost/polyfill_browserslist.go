// Go port of the browserslist 4.28.6 query engine and config discovery used
// by `unicorn/no-unnecessary-polyfills`.
//
// The port transliterates browserslist's `index.js`, `parse.js`, and
// `node.js` against the pinned dataset embedded in
// `polyfill_data_gen.json`, preserving JS numeric semantics (`parseInt` /
// `parseFloat` prefixes, NaN comparisons) and JS object-key iteration order
// wherever they leak into observable output. Fidelity notes:
//
//   - Queries that require inputs a native host does not have are rejected
//     with an error instead of resolving: `extends <pkg>` (executes JS),
//     `supports <feature>` and regional `in XX` usage (caniuse feature and
//     region tables are not embedded), `baseline ...`
//     (baseline-browser-mapping is not embedded), and `current node` (there
//     is no Node.js process). The calling rule treats every resolver error
//     the way upstream's `try/catch` does: the rule stays silent.
//   - Filesystem discovery (config files, custom stats) is re-read on every
//     resolution instead of being process-cached, so long-lived hosts (LSP)
//     always honor config edits. Content-derived results are still cached by
//     the rule keyed on the resolved targets.
//   - `oldDataWarning` and the `console.warn` on malformed package.json are
//     not emitted; the dataset ships pinned with ttsc and warnings from a
//     lint sidecar would only add noise.
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

const browserslistYearMs = 365.259641 * 24 * 60 * 60 * 1000

// browserslistConfigError mirrors upstream's BrowserslistError: config-shape
// problems that `findConfigFile` re-throws while other parse failures are
// ignored.
type browserslistConfigError struct{ message string }

func (e *browserslistConfigError) Error() string { return e.message }

func newBrowserslistError(format string, args ...interface{}) error {
  return &browserslistConfigError{message: fmt.Sprintf(format, args...)}
}

// browserslistBrowser is browserslist.data[name]: one agent's normalized
// version lists and release dates.
type browserslistBrowser struct {
  name        string
  versions    []string
  released    []string
  releaseDate []polyfillReleaseDateEntry
}

// browserslistDataSet is the decoded artifact indexed the way the query
// engine consumes it.
type browserslistDataSet struct {
  constants      polyfillBrowserslistConstants
  agentOrder     []string
  data           map[string]*browserslistBrowser
  usageOrder     []string
  usageGlobal    map[string]float64
  versionAliases map[string]map[string]string
  nodeVersions   []string
  schedule       map[string]polyfillNodeScheduleEntry
  e2cOrder       []string
  e2c            map[string]string
}

var (
  browserslistDataOnce  sync.Once
  browserslistDataValue *browserslistDataSet
)

// browserslistData builds the runtime indexes from the embedded artifact
// once, mirroring browserslist's module-load initialization (version aliases
// from joined versions, `firefox esr` alias, global usage table).
func browserslistData() *browserslistDataSet {
  browserslistDataOnce.Do(func() {
    artifact := loadPolyfillData()
    set := &browserslistDataSet{
      constants:      artifact.Browserslist,
      data:           map[string]*browserslistBrowser{},
      usageGlobal:    map[string]float64{},
      versionAliases: map[string]map[string]string{},
      nodeVersions:   artifact.NodeVersions,
      schedule:       artifact.NodeSchedule,
      e2c:            map[string]string{},
    }
    for _, agent := range artifact.Agents {
      set.agentOrder = append(set.agentOrder, agent.Name)
      set.data[agent.Name] = &browserslistBrowser{
        name:        agent.Name,
        versions:    agent.Versions,
        released:    agent.Released,
        releaseDate: agent.ReleaseDate,
      }
      for _, usage := range agent.Usage {
        set.usageOrder = append(set.usageOrder, agent.Name+" "+usage.Version)
        set.usageGlobal[agent.Name+" "+usage.Version] = usage.Usage
      }
      aliases := map[string]string{}
      for _, full := range agent.Versions {
        if !strings.Contains(full, "-") {
          continue
        }
        for _, part := range strings.Split(full, "-") {
          aliases[part] = full
        }
      }
      set.versionAliases[agent.Name] = aliases
    }
    if set.versionAliases["firefox"] == nil {
      set.versionAliases["firefox"] = map[string]string{}
    }
    set.versionAliases["firefox"]["esr"] = artifact.Browserslist.FirefoxEsr
    for _, pair := range artifact.ElectronToChromium {
      set.e2cOrder = append(set.e2cOrder, pair[0])
      set.e2c[pair[0]] = pair[1]
    }
    browserslistDataValue = set
  })
  return browserslistDataValue
}

// browserslistOpts mirrors the `opts` object the rule passes to browserslist:
// a discovery path, an environment name, and (for tests) an injectable clock.
type browserslistOpts struct {
  path string
  env  string
  now  func() time.Time
}

func (o browserslistOpts) clock() time.Time {
  if o.now != nil {
    return o.now()
  }
  return time.Now()
}

// browserslistContext is the per-resolution context: the discovery path (only
// when some parsed query needs it), custom usage stats, and the clock.
type browserslistContext struct {
  path        string
  env         string
  now         func() time.Time
  customUsage map[string]float64
  customOrder []string
  customNull  map[string]bool
  data        *browserslistDataSet
}

func (c *browserslistContext) clock() time.Time {
  if c.now != nil {
    return c.now()
  }
  return time.Now()
}

// browserslistQueryNode is one parsed query: parse.js's node object.
type browserslistQueryNode struct {
  query     string
  not       bool
  compose   string
  typeIndex int
  matches   []string
}

// browserslistQueryDef is one QUERIES table entry.
type browserslistQueryDef struct {
  name      string
  re        *regexp.Regexp
  needsPath bool
  selectFn  func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error)
}

var (
  browserslistAndPattern = regexp.MustCompile(`(?i)^\s+and\s+(.*)`)
  browserslistOrPattern  = regexp.MustCompile(`(?i)^(?:,\s*|\s+or\s+)(.*)`)
)

// --- JS numeric semantics -------------------------------------------------

// jsParseInt mirrors JS parseInt(string): parse an optionally signed decimal
// integer prefix; NaN when no digits lead the (trimmed) string.
func jsParseInt(s string) float64 {
  s = strings.TrimSpace(s)
  i := 0
  if i < len(s) && (s[i] == '+' || s[i] == '-') {
    i++
  }
  start := i
  for i < len(s) && s[i] >= '0' && s[i] <= '9' {
    i++
  }
  if i == start {
    return math.NaN()
  }
  value := 0.0
  negative := s[0] == '-'
  for _, ch := range s[start:i] {
    value = value*10 + float64(ch-'0')
  }
  if negative {
    return -value
  }
  return value
}

// jsParseFloat mirrors JS parseFloat(string): parse a decimal float prefix;
// NaN when no numeric prefix exists.
func jsParseFloat(s string) float64 {
  s = strings.TrimSpace(s)
  end := 0
  seenDigit := false
  seenDot := false
  for end < len(s) {
    ch := s[end]
    if ch >= '0' && ch <= '9' {
      seenDigit = true
    } else if ch == '.' && !seenDot {
      seenDot = true
    } else if (ch == '+' || ch == '-') && end == 0 {
      // sign
    } else {
      break
    }
    end++
  }
  if !seenDigit {
    return math.NaN()
  }
  value, err := strconv.ParseFloat(strings.TrimSuffix(s[:end], "."), 64)
  if err != nil {
    return math.NaN()
  }
  return value
}

// jsCompare mirrors browserslist's compare(): NaN comparisons yield 0.
func jsCompare(a, b float64) int {
  if a < b {
    return -1
  }
  if a > b {
    return 1
  }
  return 0
}

// browserslistGetMajor mirrors getMajor: parseInt of the first dot segment.
func browserslistGetMajor(version string) float64 {
  return jsParseInt(strings.SplitN(version, ".", 2)[0])
}

// browserslistCompareSemver mirrors compareSemver over up-to-three parseInt'd
// segments with missing segments read as 0.
func browserslistCompareSemver(a, b []float64) int {
  for i := 0; i < 3; i++ {
    if c := jsCompare(browserslistSegment(a, i), browserslistSegment(b, i)); c != 0 {
      return c
    }
  }
  return 0
}

func browserslistSegment(parts []float64, index int) float64 {
  if index < len(parts) {
    return parts[index]
  }
  return 0
}

func browserslistSplitSemver(version string) []float64 {
  segments := strings.Split(version, ".")
  parts := make([]float64, len(segments))
  for i, segment := range segments {
    parts[i] = jsParseInt(segment)
  }
  return parts
}

// browserslistParseLatestFloat mirrors generateFilter's parseLatestFloat:
// the float after the dash of a joined version, else the whole version.
func browserslistParseLatestFloat(v string) float64 {
  if _, after, found := strings.Cut(v, "-"); found && after != "" {
    return jsParseFloat(after)
  }
  return jsParseFloat(v)
}

// browserslistFloatFilter mirrors generateFilter(sign, version).
func browserslistFloatFilter(sign, version string) func(string) bool {
  switch sign {
  case ">":
    limit := browserslistParseLatestFloat(version)
    return func(v string) bool { return browserslistParseLatestFloat(v) > limit }
  case ">=":
    limit := browserslistParseLatestFloat(version)
    return func(v string) bool { return browserslistParseLatestFloat(v) >= limit }
  case "<":
    limit := jsParseFloat(version)
    return func(v string) bool { return jsParseFloat(v) < limit }
  default:
    limit := jsParseFloat(version)
    return func(v string) bool { return jsParseFloat(v) <= limit }
  }
}

// browserslistSemverFilter mirrors generateSemverFilter(sign, version).
func browserslistSemverFilter(sign, version string) func(string) bool {
  limit := browserslistSplitSemver(version)
  for len(limit) < 3 {
    limit = append(limit, 0)
  }
  for i := 1; i < 3; i++ {
    if math.IsNaN(limit[i]) {
      limit[i] = 0
    }
  }
  switch sign {
  case ">":
    return func(v string) bool {
      return browserslistCompareSemver(browserslistSplitSemver(v), limit) > 0
    }
  case ">=":
    return func(v string) bool {
      return browserslistCompareSemver(browserslistSplitSemver(v), limit) >= 0
    }
  case "<":
    return func(v string) bool {
      return browserslistCompareSemver(limit, browserslistSplitSemver(v)) > 0
    }
  default:
    return func(v string) bool {
      return browserslistCompareSemver(limit, browserslistSplitSemver(v)) >= 0
    }
  }
}

// browserslistSemverFilterLoose mirrors semverFilterLoose: npm-style ranges
// where a missing minor is a wildcard.
func browserslistSemverFilterLoose(operator, rangeVersion string) func(string) bool {
  rangeParts := browserslistSplitSemver(rangeVersion)
  minorWildcard := len(rangeParts) < 2
  compareLoose := func(version []float64) int {
    versionMajor := browserslistSegment(version, 0)
    rangeMajor := browserslistSegment(rangeParts, 0)
    if versionMajor != rangeMajor {
      if versionMajor < rangeMajor {
        return -1
      }
      return 1
    }
    if minorWildcard {
      return 0
    }
    versionMinor := math.NaN()
    if len(version) > 1 {
      versionMinor = version[1]
    }
    rangeMinor := math.NaN()
    if len(rangeParts) > 1 {
      rangeMinor = rangeParts[1]
    }
    if versionMinor != rangeMinor {
      if versionMinor < rangeMinor {
        return -1
      }
      return 1
    }
    return 0
  }
  if operator == "<=" {
    return func(v string) bool { return compareLoose(browserslistSplitSemver(v)) <= 0 }
  }
  return func(v string) bool { return compareLoose(browserslistSplitSemver(v)) >= 0 }
}

// --- data helpers ----------------------------------------------------------

// browserslistIsVersionsMatch mirrors isVersionsMatch: dotted prefix match.
func browserslistIsVersionsMatch(versionA, versionB string) bool {
  return strings.HasPrefix(versionA+".", versionB+".")
}

// browserslistByName mirrors byName without the mobileToDesktop branches the
// rule never enables.
func browserslistByName(ctx *browserslistContext, name string) *browserslistBrowser {
  name = strings.ToLower(name)
  if alias, ok := ctx.data.constants.Aliases[name]; ok {
    name = alias
  }
  return ctx.data.data[name]
}

func browserslistCheckName(ctx *browserslistContext, name string) (*browserslistBrowser, error) {
  data := browserslistByName(ctx, name)
  if data == nil {
    return nil, newBrowserslistError("Unknown browser %s", name)
  }
  return data, nil
}

// browserslistNormalizeElectron mirrors normalizeElectron: three-part
// versions drop the patch segment.
func browserslistNormalizeElectron(version string) string {
  parts := strings.Split(version, ".")
  if len(parts) == 3 {
    return strings.Join(parts[:2], ".")
  }
  return version
}

func browserslistResolveVersion(ctx *browserslistContext, data *browserslistBrowser, version string) string {
  for _, v := range data.versions {
    if v == version {
      return version
    }
  }
  if alias := ctx.data.versionAliases[data.name][version]; alias != "" {
    return alias
  }
  return ""
}

func browserslistNormalizeVersion(ctx *browserslistContext, data *browserslistBrowser, version string) string {
  if resolved := browserslistResolveVersion(ctx, data, version); resolved != "" {
    return resolved
  }
  if len(data.versions) == 1 {
    return data.versions[0]
  }
  return ""
}

func browserslistNameMapper(name string, versions []string) []string {
  mapped := make([]string, len(versions))
  for i, version := range versions {
    mapped[i] = name + " " + version
  }
  return mapped
}

// browserslistGetMajorVersions mirrors getMajorVersions with JS falsiness:
// a missing, zero, or NaN minimum returns the whole released list.
func browserslistGetMajorVersions(released []string, number int) []string {
  if len(released) == 0 {
    return []string{}
  }
  var majors []float64
  for _, version := range released {
    major := browserslistGetMajor(version)
    seen := false
    for _, existing := range majors {
      if existing == major { // NaN != NaN keeps NaN duplicates, like indexOf
        seen = true
        break
      }
    }
    if !seen {
      majors = append(majors, major)
    }
  }
  index := len(majors) - number
  if index < 0 {
    return released
  }
  minimum := majors[index]
  if minimum == 0 || math.IsNaN(minimum) {
    return released
  }
  var selected []string
  for i := len(released) - 1; i >= 0; i-- {
    if minimum > browserslistGetMajor(released[i]) {
      break
    }
    selected = append([]string{released[i]}, selected...)
  }
  return selected
}

// browserslistFilterJumps mirrors filterJumps for android / op_mob version
// jumps in caniuse data (mobileToDesktop is never set by the rule).
func browserslistFilterJumps(ctx *browserslistContext, list []string, name string, nVersions int) []string {
  jump := 1
  switch name {
  case "android":
    released := ctx.data.data["chrome"].released
    index := -1
    for i, version := range released {
      if version == ctx.data.constants.AndroidEvergreenFirst {
        index = i
        break
      }
    }
    jump = len(released) - index
  case "op_mob":
    released := ctx.data.data["op_mob"].released
    latest := ""
    if len(released) > 0 {
      latest = released[len(released)-1]
    }
    jump = int(browserslistGetMajor(latest)) - ctx.data.constants.OpMobBlinkFirst + 1
  default:
    return list
  }
  if nVersions <= jump {
    if len(list) == 0 {
      return list
    }
    return list[len(list)-1:]
  }
  start := len(list) + jump - 1 - nVersions
  if start < 0 {
    start = 0
  }
  return list[start:]
}

// browserslistFilterByYear mirrors filterByYear over the ordered release
// dates of every agent.
func browserslistFilterByYear(ctx *browserslistContext, sinceMs float64) []string {
  since := sinceMs / 1000
  var selected []string
  for _, name := range ctx.data.agentOrder {
    data := browserslistByName(ctx, name)
    if data == nil {
      continue
    }
    for _, entry := range data.releaseDate {
      if entry.Date >= since {
        selected = append(selected, data.name+" "+entry.Version)
      }
    }
  }
  return selected
}

func browserslistUniq(list []string) []string {
  seen := make(map[string]struct{}, len(list))
  out := make([]string, 0, len(list))
  for _, item := range list {
    if _, dup := seen[item]; dup {
      continue
    }
    seen[item] = struct{}{}
    out = append(out, item)
  }
  return out
}

// --- parse.js port ----------------------------------------------------------

func browserslistParseQueries(queries []string) []*browserslistQueryNode {
  var out []*browserslistQueryNode
  for _, block := range queries {
    var qs []*browserslistQueryNode
    for {
      block = browserslistMatchBlock(block, &qs)
      if block == "" {
        break
      }
    }
    out = append(out, qs...)
  }
  return out
}

func browserslistMatchBlock(s string, qs *[]*browserslistQueryNode) string {
  max := len(s)
  for n := 1; n <= max; n++ {
    parsed := s[max-n:]
    if m := browserslistAndPattern.FindStringSubmatch(parsed); m != nil {
      node := browserslistMatchQuery(m[1])
      node.compose = "and"
      *qs = append([]*browserslistQueryNode{node}, *qs...)
      return s[:max-n]
    }
    if m := browserslistOrPattern.FindStringSubmatch(parsed); m != nil {
      node := browserslistMatchQuery(m[1])
      node.compose = "or"
      *qs = append([]*browserslistQueryNode{node}, *qs...)
      return s[:max-n]
    }
    if n == max {
      node := browserslistMatchQuery(strings.TrimSpace(parsed))
      node.compose = "or"
      *qs = append([]*browserslistQueryNode{node}, *qs...)
      return ""
    }
  }
  return ""
}

func browserslistMatchQuery(query string) *browserslistQueryNode {
  node := &browserslistQueryNode{query: query, typeIndex: -1}
  stripped := query
  if strings.HasPrefix(stripped, "not ") {
    node.not = true
    stripped = stripped[4:]
  }
  for i, def := range browserslistQueries {
    if m := def.re.FindStringSubmatch(stripped); m != nil {
      node.typeIndex = i
      node.matches = m[1:]
      return node
    }
  }
  return node
}

// --- resolve ----------------------------------------------------------------

func browserslistResolveNodes(nodes []*browserslistQueryNode, ctx *browserslistContext) ([]string, error) {
  result := []string{}
  for index, node := range nodes {
    if node.not && index == 0 {
      return nil, newBrowserslistError(
        "Write any browsers query (for instance, `defaults`) before `%s`", node.query)
    }
    var array []string
    var err error
    if node.typeIndex < 0 {
      err = browserslistUnknownQueryError(ctx, node)
    } else {
      array, err = browserslistQueries[node.typeIndex].selectFn(ctx, node)
    }
    if err != nil {
      return nil, err
    }
    for i, item := range array {
      name, version, found := strings.Cut(item, " ")
      if found && version == "0" {
        data := browserslistByName(ctx, name)
        if data == nil || len(data.versions) == 0 {
          return nil, newBrowserslistError("Unknown browser %s", name)
        }
        array[i] = name + " " + data.versions[0]
      }
    }
    if node.compose == "and" {
      allowed := make(map[string]struct{}, len(array))
      for _, item := range array {
        allowed[item] = struct{}{}
      }
      filtered := result[:0]
      for _, item := range result {
        if _, in := allowed[item]; in != node.not {
          filtered = append(filtered, item)
        }
      }
      result = filtered
    } else if node.not {
      blocked := make(map[string]struct{}, len(array))
      for _, item := range array {
        blocked[item] = struct{}{}
      }
      filtered := result[:0]
      for _, item := range result {
        if _, in := blocked[item]; !in {
          filtered = append(filtered, item)
        }
      }
      result = filtered
    } else {
      result = append(result, array...)
    }
  }
  return result, nil
}

// browserslistUnknownQueryError mirrors the `unknown` QUERIES entry plus the
// fallthrough for queries no regexp matched.
func browserslistUnknownQueryError(ctx *browserslistContext, node *browserslistQueryNode) error {
  if browserslistByName(ctx, node.query) != nil {
    return newBrowserslistError(
      "Specify versions in Browserslist query for browser %s", node.query)
  }
  return newBrowserslistError(
    "Unknown browser query `%s`. Maybe you are using old Browserslist or made typo in query.",
    node.query)
}

// browserslistResolve resolves explicit queries the way `browserslist(queries,
// opts)` does; queries == nil resolves the discovered config or the defaults.
func browserslistResolve(queries []string, hasQueries bool, opts browserslistOpts) ([]string, error) {
  data := browserslistData()
  if !hasQueries {
    config, found, err := browserslistLoadConfig(opts)
    if err != nil {
      return nil, err
    }
    if found {
      queries = config
    } else {
      queries = data.constants.Defaults
    }
  }
  nodes := browserslistParseQueries(queries)
  ctx := &browserslistContext{env: opts.env, now: opts.now, data: data}
  for _, node := range nodes {
    if node.typeIndex >= 0 && browserslistQueries[node.typeIndex].needsPath {
      ctx.path = opts.path
      break
    }
  }
  statsValues, statsOrder, statsNull, err := browserslistGetStat(opts)
  if err != nil {
    return nil, err
  }
  if statsValues != nil {
    ctx.customUsage = statsValues
    ctx.customOrder = statsOrder
    ctx.customNull = statsNull
  }
  resolved, err := browserslistResolveNodes(nodes, ctx)
  if err != nil {
    return nil, err
  }
  result := browserslistUniq(resolved)
  sort.SliceStable(result, func(i, j int) bool {
    name1, version1, _ := strings.Cut(result[i], " ")
    name2, version2, _ := strings.Cut(result[j], " ")
    if name1 == name2 {
      v1 := strings.SplitN(version1, "-", 2)[0]
      v2 := strings.SplitN(version2, "-", 2)[0]
      return browserslistCompareSemver(
        browserslistSplitSemver(v2),
        browserslistSplitSemver(v1),
      ) < 0
    }
    return name1 < name2
  })
  return result, nil
}

// --- usage-based selects ----------------------------------------------------

func browserslistUsageSource(ctx *browserslistContext, custom bool) (map[string]float64, []string, map[string]bool, error) {
  if custom {
    if ctx.customUsage == nil {
      return nil, nil, nil, newBrowserslistError("Custom usage statistics was not provided")
    }
    return ctx.customUsage, ctx.customOrder, ctx.customNull, nil
  }
  return ctx.data.usageGlobal, ctx.data.usageOrder, nil, nil
}

func browserslistPopularitySelect(custom bool) func(*browserslistContext, *browserslistQueryNode) ([]string, error) {
  return func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
    sign := node.matches[0]
    popularity := jsParseFloat(node.matches[1])
    usage, order, nulls, err := browserslistUsageSource(ctx, custom)
    if err != nil {
      return nil, err
    }
    var result []string
    for _, version := range order {
      if custom && nulls[version] {
        continue
      }
      percentage := usage[version]
      keep := false
      switch sign {
      case ">":
        keep = percentage > popularity
      case "<":
        keep = percentage < popularity
      case "<=":
        keep = percentage <= popularity
      default:
        keep = percentage >= popularity
      }
      if keep {
        result = append(result, version)
      }
    }
    return result, nil
  }
}

var browserslistMyStatsPattern = regexp.MustCompile(`(?i)^my\s+stats$`)

func browserslistCoverSelect(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
  coverage := jsParseFloat(node.matches[0])
  usage := ctx.data.usageGlobal
  order := ctx.data.usageOrder
  var nulls map[string]bool
  if len(node.matches) > 1 && node.matches[1] != "" {
    place := node.matches[1]
    if browserslistMyStatsPattern.MatchString(place) {
      if ctx.customUsage == nil {
        return nil, newBrowserslistError("Custom usage statistics was not provided")
      }
      usage, order, nulls = ctx.customUsage, ctx.customOrder, ctx.customNull
    } else {
      return nil, newBrowserslistError(
        "Regional usage data is not supported by the ttsc browserslist port")
    }
  } else if len(node.matches) > 2 && node.matches[2] != "" {
    return nil, newBrowserslistError(
      "Package-provided usage statistics are not supported by the ttsc browserslist port")
  }
  versions := append([]string(nil), order...)
  sort.SliceStable(versions, func(i, j int) bool {
    if nulls != nil && (nulls[versions[i]] || nulls[versions[j]]) {
      return false
    }
    return usage[versions[j]] < usage[versions[i]]
  })
  covered := 0.0
  var result []string
  for _, version := range versions {
    if nulls == nil || !nulls[version] {
      if usage[version] == 0 {
        break
      }
      covered += usage[version]
    }
    result = append(result, version)
    if covered >= coverage {
      break
    }
  }
  return result, nil
}

// --- node / electron selects -------------------------------------------------

func browserslistNodeQuery(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
  version := node.matches[0]
  var matched []string
  for _, candidate := range ctx.data.nodeVersions {
    if browserslistIsVersionsMatch(candidate, version) {
      matched = append(matched, candidate)
    }
  }
  if len(matched) == 0 {
    return nil, newBrowserslistError("Unknown version %s of Node.js", version)
  }
  return []string{"node " + matched[len(matched)-1]}, nil
}

func browserslistSinceQuery(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
  year := int(jsParseInt(node.matches[0]))
  // Date.UTC treats two-digit years as 1900-based.
  if year >= 0 && year <= 99 {
    year += 1900
  }
  month := 1
  if len(node.matches) > 1 && node.matches[1] != "" {
    month = int(jsParseInt(node.matches[1]))
  }
  day := 1
  if len(node.matches) > 2 && node.matches[2] != "" {
    day = int(jsParseInt(node.matches[2]))
  }
  since := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)
  return browserslistFilterByYear(ctx, float64(since.UnixMilli())), nil
}

// --- QUERIES table (exact upstream order) ------------------------------------

// browserslistQueries is assigned in init() because several selects
// (`defaults`, `dead`, `maintained node versions`) recursively parse queries,
// which would otherwise form a compile-time initialization cycle.
var browserslistQueries []browserslistQueryDef

func init() {
  browserslistQueries = []browserslistQueryDef{
  {
    name: "last_major_versions",
    re:   regexp.MustCompile(`(?i)^last\s+(\d+)\s+major\s+versions?$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      count := int(jsParseInt(node.matches[0]))
      var selected []string
      for _, name := range ctx.data.agentOrder {
        data := browserslistByName(ctx, name)
        if data == nil {
          continue
        }
        list := browserslistGetMajorVersions(data.released, count)
        list = browserslistNameMapper(data.name, list)
        list = browserslistFilterJumps(ctx, list, data.name, count)
        selected = append(selected, list...)
      }
      return selected, nil
    },
  },
  {
    name: "last_versions",
    re:   regexp.MustCompile(`(?i)^last\s+(\d+)\s+versions?$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      count := int(jsParseInt(node.matches[0]))
      var selected []string
      for _, name := range ctx.data.agentOrder {
        data := browserslistByName(ctx, name)
        if data == nil {
          continue
        }
        list := browserslistLastSlice(data.released, count)
        list = browserslistNameMapper(data.name, list)
        list = browserslistFilterJumps(ctx, list, data.name, count)
        selected = append(selected, list...)
      }
      return selected, nil
    },
  },
  {
    name: "last_electron_major_versions",
    re:   regexp.MustCompile(`(?i)^last\s+(\d+)\s+electron\s+major\s+versions?$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      count := int(jsParseInt(node.matches[0]))
      valid := browserslistGetMajorVersions(ctx.data.e2cOrder, count)
      result := make([]string, len(valid))
      for i, version := range valid {
        result[i] = "chrome " + ctx.data.e2c[version]
      }
      return result, nil
    },
  },
  {
    name: "last_node_major_versions",
    re:   regexp.MustCompile(`(?i)^last\s+(\d+)\s+node\s+major\s+versions?$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      count := int(jsParseInt(node.matches[0]))
      return browserslistNameMapper("node", browserslistGetMajorVersions(ctx.data.nodeVersions, count)), nil
    },
  },
  {
    name: "last_browser_major_versions",
    re:   regexp.MustCompile(`(?i)^last\s+(\d+)\s+(\w+)\s+major\s+versions?$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      count := int(jsParseInt(node.matches[0]))
      data, err := browserslistCheckName(ctx, node.matches[1])
      if err != nil {
        return nil, err
      }
      list := browserslistGetMajorVersions(data.released, count)
      mapped := browserslistNameMapper(data.name, list)
      return browserslistFilterJumps(ctx, mapped, data.name, count), nil
    },
  },
  {
    name: "last_electron_versions",
    re:   regexp.MustCompile(`(?i)^last\s+(\d+)\s+electron\s+versions?$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      count := int(jsParseInt(node.matches[0]))
      versions := browserslistLastSlice(ctx.data.e2cOrder, count)
      result := make([]string, len(versions))
      for i, version := range versions {
        result[i] = "chrome " + ctx.data.e2c[version]
      }
      return result, nil
    },
  },
  {
    name: "last_node_versions",
    re:   regexp.MustCompile(`(?i)^last\s+(\d+)\s+node\s+versions?$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      count := int(jsParseInt(node.matches[0]))
      return browserslistNameMapper("node", browserslistLastSlice(ctx.data.nodeVersions, count)), nil
    },
  },
  {
    name: "last_browser_versions",
    re:   regexp.MustCompile(`(?i)^last\s+(\d+)\s+(\w+)\s+versions?$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      count := int(jsParseInt(node.matches[0]))
      data, err := browserslistCheckName(ctx, node.matches[1])
      if err != nil {
        return nil, err
      }
      list := browserslistLastSlice(data.released, count)
      mapped := browserslistNameMapper(data.name, list)
      return browserslistFilterJumps(ctx, mapped, data.name, count), nil
    },
  },
  {
    name: "unreleased_versions",
    re:   regexp.MustCompile(`(?i)^unreleased\s+versions$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      var selected []string
      for _, name := range ctx.data.agentOrder {
        data := browserslistByName(ctx, name)
        if data == nil {
          continue
        }
        for _, version := range data.versions {
          if !browserslistContains(data.released, version) {
            selected = append(selected, data.name+" "+version)
          }
        }
      }
      return selected, nil
    },
  },
  {
    name: "unreleased_electron_versions",
    re:   regexp.MustCompile(`(?i)^unreleased\s+electron\s+versions?$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      return nil, nil
    },
  },
  {
    name: "unreleased_browser_versions",
    re:   regexp.MustCompile(`(?i)^unreleased\s+(\w+)\s+versions?$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      data, err := browserslistCheckName(ctx, node.matches[0])
      if err != nil {
        return nil, err
      }
      var selected []string
      for _, version := range data.versions {
        if !browserslistContains(data.released, version) {
          selected = append(selected, data.name+" "+version)
        }
      }
      return selected, nil
    },
  },
  {
    name: "last_years",
    re:   regexp.MustCompile(`(?i)^last\s+((\d+\.)?\d+)\s+years?$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      years := jsParseFloat(node.matches[0])
      nowMs := float64(ctx.clock().UnixMilli())
      return browserslistFilterByYear(ctx, nowMs-browserslistYearMs*years), nil
    },
  },
  {
    name:     "since_y",
    re:       regexp.MustCompile(`(?i)^since (\d+)$`),
    selectFn: browserslistSinceQuery,
  },
  {
    name:     "since_y_m",
    re:       regexp.MustCompile(`(?i)^since (\d+)-(\d+)$`),
    selectFn: browserslistSinceQuery,
  },
  {
    name:     "since_y_m_d",
    re:       regexp.MustCompile(`(?i)^since (\d+)-(\d+)-(\d+)$`),
    selectFn: browserslistSinceQuery,
  },
  {
    name: "baseline",
    re: regexp.MustCompile(
      `(?i)^baseline\s+(?:(\d+)|(newly|widely)\s+available(?:\s+on\s+(\d{4}-\d{2}-\d{2}))?)?(\s+with\s+downstream)?(\s+including\s+kaios)?$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      return nil, newBrowserslistError(
        "`baseline` queries are not supported by the ttsc browserslist port")
    },
  },
  {
    name:     "popularity",
    re:       regexp.MustCompile(`^(>=?|<=?)\s*(\d+|\d+\.\d+|\.\d+)%$`),
    selectFn: browserslistPopularitySelect(false),
  },
  {
    name:     "popularity_in_my_stats",
    re:       regexp.MustCompile(`^(>=?|<=?)\s*(\d+|\d+\.\d+|\.\d+)%\s+in\s+my\s+stats$`),
    selectFn: browserslistPopularitySelect(true),
  },
  {
    name: "popularity_in_config_stats",
    re:   regexp.MustCompile(`^(>=?|<=?)\s*(\d+|\d+\.\d+|\.\d+)%\s+in\s+(\S+)\s+stats$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      return nil, newBrowserslistError(
        "Package-provided usage statistics are not supported by the ttsc browserslist port")
    },
  },
  {
    name: "popularity_in_place",
    re:   regexp.MustCompile(`^(>=?|<=?)\s*(\d+|\d+\.\d+|\.\d+)%\s+in\s+((alt-)?\w\w)$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      return nil, newBrowserslistError(
        "Regional usage data is not supported by the ttsc browserslist port")
    },
  },
  {
    name: "cover",
    re:   regexp.MustCompile(`(?i)^cover\s+(\d+|\d+\.\d+|\.\d+)%$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      return browserslistCoverSelect(ctx, node)
    },
  },
  {
    name: "cover_in",
    re:   regexp.MustCompile(`(?i)^cover\s+(\d+|\d+\.\d+|\.\d+)%\s+in\s+(my\s+stats|(alt-)?\w\w)$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      return browserslistCoverSelect(ctx, node)
    },
  },
  {
    name: "cover_config",
    re:   regexp.MustCompile(`(?i)^cover\s+(\d+|\d+\.\d+|\.\d+)%\s+in\s+(\S+)\s+stats$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      return nil, newBrowserslistError(
        "Package-provided usage statistics are not supported by the ttsc browserslist port")
    },
  },
  {
    name: "supports",
    re:   regexp.MustCompile(`^(?:(fully|partially)\s+)?supports\s+([\w-]+)$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      return nil, newBrowserslistError(
        "`supports` queries are not supported by the ttsc browserslist port")
    },
  },
  {
    name: "electron_range",
    re:   regexp.MustCompile(`(?i)^electron\s+([\d.]+)\s*-\s*([\d.]+)$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      from := browserslistNormalizeElectron(node.matches[0])
      to := browserslistNormalizeElectron(node.matches[1])
      if _, ok := ctx.data.e2c[from]; !ok {
        return nil, newBrowserslistError("Unknown version %s of electron", node.matches[0])
      }
      if _, ok := ctx.data.e2c[to]; !ok {
        return nil, newBrowserslistError("Unknown version %s of electron", node.matches[1])
      }
      lower := browserslistSemverFilterLoose(">=", node.matches[0])
      upper := browserslistSemverFilterLoose("<=", node.matches[1])
      var result []string
      for _, version := range ctx.data.e2cOrder {
        if lower(version) && upper(version) {
          result = append(result, "chrome "+ctx.data.e2c[version])
        }
      }
      return result, nil
    },
  },
  {
    name: "node_range",
    re:   regexp.MustCompile(`(?i)^node\s+([\d.]+)\s*-\s*([\d.]+)$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      lower := browserslistSemverFilterLoose(">=", node.matches[0])
      upper := browserslistSemverFilterLoose("<=", node.matches[1])
      var result []string
      for _, version := range ctx.data.nodeVersions {
        if lower(version) && upper(version) {
          result = append(result, "node "+version)
        }
      }
      return result, nil
    },
  },
  {
    name: "browser_range",
    re:   regexp.MustCompile(`(?i)^(\w+)\s+([\d.]+)\s*-\s*([\d.]+)$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      data, err := browserslistCheckName(ctx, node.matches[0])
      if err != nil {
        return nil, err
      }
      fromVersion := browserslistNormalizeVersion(ctx, data, node.matches[1])
      if fromVersion == "" {
        fromVersion = node.matches[1]
      }
      toVersion := browserslistNormalizeVersion(ctx, data, node.matches[2])
      if toVersion == "" {
        toVersion = node.matches[2]
      }
      from := jsParseFloat(fromVersion)
      to := jsParseFloat(toVersion)
      var result []string
      for _, version := range data.released {
        parsed := jsParseFloat(version)
        if parsed >= from && parsed <= to {
          result = append(result, data.name+" "+version)
        }
      }
      return result, nil
    },
  },
  {
    name: "electron_ray",
    re:   regexp.MustCompile(`(?i)^electron\s*(>=?|<=?)\s*([\d.]+)$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      version := browserslistNormalizeElectron(node.matches[1])
      filter := browserslistFloatFilter(node.matches[0], version)
      var result []string
      for _, candidate := range ctx.data.e2cOrder {
        if filter(candidate) {
          result = append(result, "chrome "+ctx.data.e2c[candidate])
        }
      }
      return result, nil
    },
  },
  {
    name: "node_ray",
    re:   regexp.MustCompile(`(?i)^node\s*(>=?|<=?)\s*([\d.]+)$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      filter := browserslistSemverFilter(node.matches[0], node.matches[1])
      var result []string
      for _, version := range ctx.data.nodeVersions {
        if filter(version) {
          result = append(result, "node "+version)
        }
      }
      return result, nil
    },
  },
  {
    name: "browser_ray",
    re:   regexp.MustCompile(`(?i)^(\w+)\s*(>=?|<=?)\s*([\d.]+|esr)$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      version := node.matches[2]
      data, err := browserslistCheckName(ctx, node.matches[0])
      if err != nil {
        return nil, err
      }
      if alias := ctx.data.versionAliases[data.name][strings.ToLower(version)]; alias != "" {
        version = alias
      }
      if !browserslistHasDigitOrDot(version) {
        return nil, newBrowserslistError("Unknown version %s of %s", version, node.matches[0])
      }
      filter := browserslistFloatFilter(node.matches[1], version)
      var result []string
      for _, candidate := range data.released {
        if filter(candidate) {
          result = append(result, data.name+" "+candidate)
        }
      }
      return result, nil
    },
  },
  {
    name: "firefox_esr",
    re:   regexp.MustCompile(`(?i)^(firefox|ff|fx)\s+esr$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      return []string{"firefox " + ctx.data.constants.FirefoxEsr}, nil
    },
  },
  {
    name: "opera_mini_all",
    re:   regexp.MustCompile(`(?i)(operamini|op_mini)\s+all`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      return []string{"op_mini all"}, nil
    },
  },
  {
    name: "electron_version",
    re:   regexp.MustCompile(`(?i)^electron\s+([\d.]+)$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      version := browserslistNormalizeElectron(node.matches[0])
      chrome, ok := ctx.data.e2c[version]
      if !ok {
        return nil, newBrowserslistError("Unknown version %s of electron", node.matches[0])
      }
      return []string{"chrome " + chrome}, nil
    },
  },
  {
    name:     "node_major_version",
    re:       regexp.MustCompile(`(?i)^node\s+(\d+)$`),
    selectFn: browserslistNodeQuery,
  },
  {
    name:     "node_minor_version",
    re:       regexp.MustCompile(`(?i)^node\s+(\d+\.\d+)$`),
    selectFn: browserslistNodeQuery,
  },
  {
    name:     "node_patch_version",
    re:       regexp.MustCompile(`(?i)^node\s+(\d+\.\d+\.\d+)$`),
    selectFn: browserslistNodeQuery,
  },
  {
    name: "current_node",
    re:   regexp.MustCompile(`(?i)^current\s+node$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      return nil, newBrowserslistError(
        "`current node` is not supported by the ttsc browserslist port: the lint host does not run inside Node.js")
    },
  },
  {
    name: "maintained_node",
    re:   regexp.MustCompile(`(?i)^maintained\s+node\s+versions$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      now := ctx.clock().UnixMilli()
      var queries []string
      for key, schedule := range ctx.data.schedule {
        start, startErr := browserslistParseScheduleDate(schedule.Start)
        end, endErr := browserslistParseScheduleDate(schedule.End)
        if startErr != nil || endErr != nil {
          continue
        }
        if now < end && now > start && browserslistIsEolReleased(ctx, key) {
          queries = append(queries, "node "+strings.TrimPrefix(key, "v"))
        }
      }
      return browserslistResolveNodes(browserslistParseQueries(queries), ctx)
    },
  },
  {
    name: "phantomjs_1_9",
    re:   regexp.MustCompile(`(?i)^phantomjs\s+1.9$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      return []string{"safari 5"}, nil
    },
  },
  {
    name: "phantomjs_2_1",
    re:   regexp.MustCompile(`(?i)^phantomjs\s+2.1$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      return []string{"safari 6"}, nil
    },
  },
  {
    name: "browser_version",
    re:   regexp.MustCompile(`(?i)^(\w+)\s+(tp|[\d.]+)$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      version := node.matches[1]
      if strings.EqualFold(version, "tp") {
        version = "TP"
      }
      data, err := browserslistCheckName(ctx, node.matches[0])
      if err != nil {
        return nil, err
      }
      alias := browserslistNormalizeVersion(ctx, data, version)
      if alias != "" {
        version = alias
      } else {
        if !strings.Contains(version, ".") {
          alias = version + ".0"
        } else {
          alias = strings.TrimSuffix(version, ".0")
        }
        alias = browserslistNormalizeVersion(ctx, data, alias)
        if alias == "" {
          return nil, newBrowserslistError(
            "Unknown version %s of %s", version, node.matches[0])
        }
        version = alias
      }
      return []string{data.name + " " + version}, nil
    },
  },
  {
    name:      "browserslist_config",
    re:        regexp.MustCompile(`(?i)^browserslist config$`),
    needsPath: true,
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      return browserslistResolve(nil, false, browserslistOpts{
        path: ctx.path,
        env:  ctx.env,
        now:  ctx.now,
      })
    },
  },
  {
    name:      "extends",
    re:        regexp.MustCompile(`(?i)^extends (.+)$`),
    needsPath: true,
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      return nil, newBrowserslistError(
        "`extends` queries are not supported by the ttsc browserslist port: shareable configs are JavaScript modules")
    },
  },
  {
    name: "defaults",
    re:   regexp.MustCompile(`(?i)^defaults$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      return browserslistResolveNodes(
        browserslistParseQueries(ctx.data.constants.Defaults), ctx)
    },
  },
  {
    name: "dead",
    re:   regexp.MustCompile(`(?i)^dead$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      return browserslistResolveNodes(
        browserslistParseQueries(ctx.data.constants.Dead), ctx)
    },
  },
  {
    name: "unknown",
    re:   regexp.MustCompile(`(?i)^(\w+)$`),
    selectFn: func(ctx *browserslistContext, node *browserslistQueryNode) ([]string, error) {
      return nil, browserslistUnknownQueryError(ctx, node)
    },
  },
  }
}

func browserslistLastSlice(list []string, count int) []string {
  if count >= len(list) {
    return list
  }
  if count <= 0 {
    // JS slice(-0) returns the whole array; negative counts cannot occur
    // because the capture is \d+.
    return list
  }
  return list[len(list)-count:]
}

func browserslistContains(list []string, item string) bool {
  for _, candidate := range list {
    if candidate == item {
      return true
    }
  }
  return false
}

var browserslistDigitOrDotPattern = regexp.MustCompile(`[\d.]+`)

func browserslistHasDigitOrDot(version string) bool {
  return browserslistDigitOrDotPattern.MatchString(version)
}

func browserslistParseScheduleDate(value string) (int64, error) {
  parsed, err := time.Parse("2006-01-02", value)
  if err != nil {
    return 0, err
  }
  return parsed.UnixMilli(), nil
}

func browserslistIsEolReleased(ctx *browserslistContext, name string) bool {
  version := strings.TrimPrefix(name, "v")
  for _, candidate := range ctx.data.nodeVersions {
    if browserslistIsVersionsMatch(candidate, version) {
      return true
    }
  }
  return false
}
