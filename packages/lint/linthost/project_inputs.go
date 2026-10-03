package linthost

import (
  "errors"
  "fmt"
  "net/url"
  "os"
  slashpath "path"
  "path/filepath"
  "sort"
  "strings"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// ProjectInputSnapshot is the normalized filesystem dependency publication
// shared by the CLI launcher and ttscserver.
//
// @evidence contracts/common.md#principled-implementation Root, exact files, glob populations and reload topology preserve separate dependency and execution-selection channels even when inputs are missing.
// @evidence contracts/common.md#clear-and-simple-design One snapshot groups normalized dependency declarations without including a TypeScript Program or watcher implementation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The snapshot describes configured topology rather than inferring dependencies only from successful reads.
// @evidence contracts/common.md#meaningful-documentation Native members identify physical-root spelling, exact and glob dependencies and reload effects; member gaps and tags follow documentation guidance.
// @evidence contracts/portability.md#os-neutral-implementation Root and dependency patterns carry native filesystem identity with forward-slash protocol spelling, not remote URLs or a universal case-folded identity. Producers normalize exact paths and nonwildcard glob prefixes through physical-path helpers while preserving missing suffixes and case-distinct spellings; each consumer resolves actual aliases/case policy and owns watching/reload behavior. The DTO introduces no process executable or argument representation.
// @evidenceExclude contracts/performance.md#efficient-algorithms ProjectInputSnapshot is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ProjectInputSnapshot is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ProjectInputSnapshot is a declaration of data shape; the code that holds its values owns their lifetime.
type ProjectInputSnapshot struct {
  // Root is the normalized physical dependency root with forward-slash spelling.
  Root              string   `json:"root"`

  // Files contains exact dependencies, including currently missing paths.
  Files             []string `json:"files"`

  // Globs contains changing dependency populations, including empty matches.
  Globs             []string `json:"globs"`

  // ReloadFiles also trigger reconsideration of execution selection.
  ReloadFiles       []string `json:"reloadFiles,omitempty"`

  // ReloadDirectories observe changes that can introduce a nearer config.
  ReloadDirectories []string `json:"reloadDirectories,omitempty"`
}

// RunProjectInputs prints the enabled ProjectRule dependency snapshot without
// loading a TypeScript Program.
//
// @evidence contracts/common.md#principled-implementation Resolved rule settings and physical identity determine normalized exact-file and glob declarations before Program loading; publisher and normalization failures are aggregated rather than reporting partial topology as complete.
// @evidence contracts/common.md#clear-and-simple-design CLI parsing and JSON output reuse one dependency collector, with per-input normalization and duplicate sorting owned by helpers.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Dependencies survive missing files and empty populations instead of being restricted to successful Check reads; unsupported remote URLs produce explicit errors.
// @evidence contracts/common.md#meaningful-documentation Native prose states pre-Program publication and snapshot members explain reload topology; paragraphs, member gaps and tags follow documentation guidance.
// @evidence contracts/portability.md#os-neutral-implementation RunProjectInputs obtains native project/config identity through shared parsing/acquisition. Exact dependencies and nonwildcard glob prefixes resolve physical ancestors while missing suffixes remain declared; HTTP(S) URLs are rejected. Published strings use forward slashes and preserve case-distinct spellings instead of inferring directory case policy from OS names. Watchers and matching consumers own actual capability/alias decisions.
// @evidence contracts/performance.md#efficient-algorithms The command parses options and loads config without building a Program, then scans configured project publishers and collects their input records under protected calls. Per-input native normalization/physical resolution and option/record copies add byte/filesystem work; four dependency populations are deduplicated and sorted, costing name hashing/comparison bytes as well as record visits. Provider work and JSON payload size remain additional dimensions. Globs are declared patterns, not expanded match populations here; no fixed complete-command bound is claimed.
// @evidence contracts/performance.md#reuse-equivalent-work acquireRules shares a dependency-validated resolver memo when installed by the resident host and delegates executable evaluation cache premises otherwise. Project-input providers receive current resolved policy each query; this entry adds no independent topology-response cache or Program cache. Equivalent caller reuse must include rule/config/declared-input validity, not only matching project-root spelling.
// @evidence contracts/performance.md#bound-retention-and-release-resources Input contexts/options, copied declaration records, deduplication maps, normalized arrays and JSON buffers are temporary for the query; the published snapshot transfers plain path/pattern data rather than a Program/watcher lease. Provider-owned data and config/resident memo state have separate lifetimes. The operation creates no watcher or child task directly, but delegated evaluation owns its resources; no dependency/byte cap, cache eviction or caller deadline is introduced.
func RunProjectInputs(args []string) int {
  opts, ok := parseLSPCommandOptions("project-inputs", args)
  if !ok {
    return 2
  }
  snapshot, code := computeProjectInputs(opts)
  if code != 0 {
    return code
  }
  return writeJSON(snapshot)
}

// computeProjectInputs builds the dependency snapshot for one project. Split
// from RunProjectInputs so the resident daemon can answer the same verb without
// a process per question, the same split hints and graph-nodes take.
func computeProjectInputs(opts *lspCommandOptions) (ProjectInputSnapshot, int) {
  resolver, err := acquireRules(opts.pluginsJSON, opts.cwd, opts.tsconfig)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return ProjectInputSnapshot{}, 2
  }
  identity := normalizeProjectIdentity(
    opts.projectIdentity,
    opts.cwd,
    opts.tsconfig,
  )
  snapshot, err := collectProjectInputs(resolver, identity)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return ProjectInputSnapshot{}, 2
  }
  return snapshot, 0
}

func collectProjectInputs(
  resolver RuleResolver,
  identity publicrule.ProjectIdentity,
) (ProjectInputSnapshot, error) {
  engine := NewEngineWithResolver(resolver)
  if err := engine.ConfigError(); err != nil {
    return ProjectInputSnapshot{}, err
  }
  root := identity.PhysicalProjectRoot
  if root == "" {
    root = identity.LogicalProjectRoot
  }
  if root == "" {
    root = identity.InvocationCwd
  }
  if root == "" {
    return ProjectInputSnapshot{}, errors.New("@ttsc/lint: project inputs require a project root")
  }
  root = realProjectPath(root)
  snapshot := ProjectInputSnapshot{Root: filepath.ToSlash(root)}
  if source, ok := resolver.(interface{ ConfigPaths() []string }); ok {
    for _, location := range source.ConfigPaths() {
      normalized := filepath.ToSlash(realProjectPath(location))
      // Keep configs in Files for older/LSP consumers that do not decode
      // ReloadFiles yet, while CLI watch can classify the same path as an
      // execution-selection transition.
      snapshot.Files = append(snapshot.Files, normalized)
      snapshot.ReloadFiles = append(snapshot.ReloadFiles, normalized)
    }
  }
  if source, ok := resolver.(interface{ ConfigDirectories() []string }); ok {
    for _, location := range source.ConfigDirectories() {
      normalized := filepath.ToSlash(realProjectPath(location))
      snapshot.ReloadDirectories = append(
        snapshot.ReloadDirectories,
        normalized,
      )
    }
  }
  var joined error
  for _, name := range allProjectRuleNames() {
    setting := engine.projectSettings[name]
    if !setting.Declared || setting.Severity == SeverityOff {
      continue
    }
    adapter := registeredProjectRules[name]
    publisher, ok := adapter.inner.(publicrule.ProjectInputRule)
    if !ok {
      continue
    }
    inputs, err := callProjectInputs(
      publisher,
      publicrule.NewProjectInputContext(
        identity,
        publicrule.Severity(setting.Severity),
        setting.Options,
      ),
    )
    if err != nil {
      joined = errors.Join(joined, fmt.Errorf("project rule %q inputs: %w", name, err))
      continue
    }
    for _, input := range inputs {
      normalized, err := normalizeProjectInput(root, input)
      if err != nil {
        joined = errors.Join(joined, fmt.Errorf("project rule %q input: %w", name, err))
        continue
      }
      switch input.Kind {
      case publicrule.ProjectInputFile:
        snapshot.Files = append(snapshot.Files, normalized)
      case publicrule.ProjectInputGlob:
        snapshot.Globs = append(snapshot.Globs, normalized)
      }
    }
  }
  snapshot.Files = uniqueProjectInputPatterns(snapshot.Files)
  snapshot.Globs = uniqueProjectInputPatterns(snapshot.Globs)
  snapshot.ReloadFiles = uniqueProjectInputPatterns(snapshot.ReloadFiles)
  snapshot.ReloadDirectories = uniqueProjectInputPatterns(
    snapshot.ReloadDirectories,
  )
  if joined != nil {
    return ProjectInputSnapshot{}, joined
  }
  return snapshot, nil
}

func callProjectInputs(
  publisher publicrule.ProjectInputRule,
  context *publicrule.ProjectInputContext,
) (inputs []publicrule.ProjectInput, err error) {
  defer func() {
    if recovered := recover(); recovered != nil {
      err = fmt.Errorf("panicked while declaring inputs: %v", recovered)
    }
  }()
  return append([]publicrule.ProjectInput(nil), publisher.ProjectInputs(context)...), nil
}

func normalizeProjectInput(root string, input publicrule.ProjectInput) (string, error) {
  if input.Kind != publicrule.ProjectInputFile && input.Kind != publicrule.ProjectInputGlob {
    return "", fmt.Errorf("kind %q is not file or glob", input.Kind)
  }
  pattern := strings.TrimSpace(input.Pattern)
  if pattern == "" {
    return "", errors.New("pattern must not be empty")
  }
  if parsed, err := url.Parse(pattern); err == nil &&
    (strings.EqualFold(parsed.Scheme, "http") || strings.EqualFold(parsed.Scheme, "https")) {
    return "", fmt.Errorf("remote URL %q is not a filesystem dependency", pattern)
  }
  pattern = filepath.FromSlash(pattern)
  if !filepath.IsAbs(pattern) {
    pattern = filepath.Join(root, pattern)
  }
  if input.Kind == publicrule.ProjectInputFile {
    return filepath.ToSlash(realProjectPath(pattern)), nil
  }
  return filepath.ToSlash(realProjectGlob(pattern)), nil
}

func realProjectGlob(pattern string) string {
  clean := filepath.Clean(pattern)
  volume := filepath.VolumeName(clean)
  remainder := strings.TrimPrefix(clean, volume)
  segments := strings.FieldsFunc(remainder, func(r rune) bool {
    return r == '/' || r == '\\'
  })
  prefixCount := 0
  for prefixCount < len(segments) && !strings.ContainsAny(segments[prefixCount], "*?") {
    prefixCount++
  }
  prefix := volume + string(filepath.Separator)
  if prefixCount > 0 {
    prefix = filepath.Join(prefix, filepath.Join(segments[:prefixCount]...))
  }
  resolved := realProjectPath(prefix)
  if prefixCount == len(segments) {
    return resolved
  }
  return filepath.Join(resolved, filepath.Join(segments[prefixCount:]...))
}

func uniqueProjectInputPatterns(patterns []string) []string {
  return uniqueProjectInputPatternsForFilesystem(
    patterns,
    usesWindowsPathSyntax(),
  )
}

func uniqueProjectInputPatternsForFilesystem(
  patterns []string,
  windowsPaths bool,
) []string {
  seen := map[string]string{}
  for _, pattern := range patterns {
    normalized := normalizeProjectInputPattern(pattern, windowsPaths)
    // The producer cannot decide Windows identity globally: a directory can
    // opt into case-sensitive lookup. Preserve every normalized spelling and
    // let each consumer resolve aliases against that directory's semantics.
    seen[normalized] = normalized
  }
  out := make([]string, 0, len(seen))
  for _, pattern := range seen {
    out = append(out, pattern)
  }
  sort.Strings(out)
  return out
}

func normalizeProjectInputPattern(
  pattern string,
  windowsPaths bool,
) string {
  if !windowsPaths {
    return filepath.ToSlash(filepath.Clean(filepath.FromSlash(pattern)))
  }
  slashed := strings.ReplaceAll(pattern, "\\", "/")
  unc := strings.HasPrefix(slashed, "//")
  normalized := slashpath.Clean(slashed)
  if unc && !strings.HasPrefix(normalized, "//") {
    normalized = "/" + normalized
  }
  return normalized
}

func usesWindowsPathSyntax() bool {
  return filepath.Separator == '\\'
}
