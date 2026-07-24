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
type ProjectInputSnapshot struct {
  Root        string   `json:"root"`
  Files       []string `json:"files"`
  Globs       []string `json:"globs"`
  ReloadFiles []string `json:"reloadFiles,omitempty"`
}

// RunProjectInputs prints the enabled ProjectRule dependency snapshot without
// loading a TypeScript Program.
func RunProjectInputs(args []string) int {
  opts, ok := parseLSPCommandOptions("project-inputs", args)
  if !ok {
    return 2
  }
  resolver, err := loadRules(opts.pluginsJSON, opts.cwd, opts.tsconfig)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  identity := normalizeProjectIdentity(
    opts.projectIdentity,
    opts.cwd,
    opts.tsconfig,
  )
  snapshot, err := collectProjectInputs(resolver, identity)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  return writeJSON(snapshot)
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
    isCaseInsensitiveFilesystem(),
  )
}

func uniqueProjectInputPatternsForFilesystem(
  patterns []string,
  caseInsensitive bool,
) []string {
  seen := map[string]string{}
  for _, pattern := range patterns {
    normalized := normalizeProjectInputPattern(pattern, caseInsensitive)
    key := normalized
    if caseInsensitive {
      key = strings.ToLower(key)
    }
    seen[key] = normalized
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
  caseInsensitive bool,
) string {
  if !caseInsensitive {
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

func isCaseInsensitiveFilesystem() bool {
  return filepath.Separator == '\\'
}
