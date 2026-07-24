package lspserver

import (
  "encoding/json"
  "fmt"
  "path"
  "path/filepath"
  "runtime"
  "sort"
  "strings"
)

// LSPProjectInputSnapshot is the normalized external filesystem topology
// published by project-rule contributors.
type LSPProjectInputSnapshot struct {
  Root  string   `json:"root"`
  Files []string `json:"files"`
  Globs []string `json:"globs"`
}

type projectInputRecord struct {
  generation uint64
  snapshot   LSPProjectInputSnapshot
}

// ProjectInputs returns a stable copy of the current merged dependency
// snapshot.
func (s *NativePluginSource) ProjectInputs() LSPProjectInputSnapshot {
  if s == nil {
    return LSPProjectInputSnapshot{}
  }
  s.projectInputsMu.RLock()
  defer s.projectInputsMu.RUnlock()
  return copyProjectInputSnapshot(s.projectInputs)
}

// ProjectInputMatchesURI reports whether a watched-file URI belongs to a
// declared exact dependency or glob population.
func (s *NativePluginSource) ProjectInputMatchesURI(uri string) bool {
  if s == nil {
    return false
  }
  location, ok := filePathFromURI(uri)
  if !ok {
    return false
  }
  candidate := projectInputPathKey(realProjectInputPath(location))
  s.projectInputsMu.RLock()
  defer s.projectInputsMu.RUnlock()
  return projectInputSnapshotMatchesCandidate(s.projectInputs, candidate)
}

// ProjectInputOwnersForURI returns the stable plugin keys whose latest
// successful snapshots match uri. Ownership is retained past the flattened
// client registration so an external edit refreshes only the contributors that
// declared it.
func (s *NativePluginSource) ProjectInputOwnersForURI(uri string) []string {
  if s == nil {
    return nil
  }
  location, ok := filePathFromURI(uri)
  if !ok {
    return nil
  }
  candidate := projectInputPathKey(realProjectInputPath(location))
  s.projectInputsMu.RLock()
  defer s.projectInputsMu.RUnlock()
  owners := []string{}
  seen := map[string]struct{}{}
  for _, plugin := range s.plugins {
    key := pluginKey(plugin)
    if _, duplicate := seen[key]; duplicate {
      continue
    }
    seen[key] = struct{}{}
    record, ok := s.pluginProjectInputs[key]
    if !ok || !projectInputSnapshotMatchesCandidate(record.snapshot, candidate) {
      continue
    }
    owners = append(owners, key)
  }
  return owners
}

func projectInputSnapshotMatchesCandidate(
  snapshot LSPProjectInputSnapshot,
  candidate string,
) bool {
  for _, file := range snapshot.Files {
    if projectInputPathKey(file) == candidate {
      return true
    }
  }
  for _, pattern := range snapshot.Globs {
    if matchProjectInputGlob(
      strings.Split(projectInputPathKey(pattern), "/"),
      strings.Split(candidate, "/"),
    ) {
      return true
    }
  }
  return false
}

// RefreshProjectInputs schedules a coalesced dependency rediscovery after a
// configuration input changes.
func (s *NativePluginSource) RefreshProjectInputs() {
  if s == nil {
    return
  }
  s.projectInputsRefresh.schedule(s.discoverProjectInputs)
}

// SetProjectInputsObserver registers the proxy callback that replaces the
// client's dynamic watched-file registration after a successful topology
// change.
func (s *NativePluginSource) SetProjectInputsObserver(observer func()) {
  if s == nil {
    return
  }
  s.projectInputsMu.Lock()
  s.projectInputsObserver = observer
  s.projectInputsMu.Unlock()
}

func (s *NativePluginSource) discoverProjectInputs(generation uint64) {
  changed := false
  for _, plugin := range s.plugins {
    if !plugin.ProjectInputs {
      continue
    }
    body, err := s.run(plugin, "project-inputs")
    if err != nil {
      s.log("%v", err)
      continue
    }
    var snapshot LSPProjectInputSnapshot
    if err := json.Unmarshal(body, &snapshot); err != nil {
      s.log(
        "ttscserver: %s project-inputs returned invalid JSON: %v",
        pluginLabel(plugin),
        err,
      )
      continue
    }
    snapshot, err = normalizeLSPProjectInputSnapshot(snapshot, s.cwd)
    if err != nil {
      s.log(
        "ttscserver: %s project-inputs returned an invalid snapshot: %v",
        pluginLabel(plugin),
        err,
      )
      continue
    }
    if s.storeProjectInputs(plugin, generation, snapshot) {
      changed = true
    }
  }
  if changed {
    s.projectInputsMu.RLock()
    observer := s.projectInputsObserver
    s.projectInputsMu.RUnlock()
    if observer != nil {
      observer()
    }
  }
}

func (s *NativePluginSource) storeProjectInputs(
  plugin NativeLSPPluginEntry,
  generation uint64,
  snapshot LSPProjectInputSnapshot,
) bool {
  key := pluginKey(plugin)
  s.projectInputsMu.Lock()
  defer s.projectInputsMu.Unlock()
  if existing, ok := s.pluginProjectInputs[key]; ok &&
    generation < existing.generation {
    return false
  }
  if s.pluginProjectInputs == nil {
    s.pluginProjectInputs = map[string]projectInputRecord{}
  }
  existing, existed := s.pluginProjectInputs[key]
  s.pluginProjectInputs[key] = projectInputRecord{
    generation: generation,
    snapshot:   snapshot,
  }
  if existed && projectInputSnapshotsEqual(existing.snapshot, snapshot) {
    return false
  }
  s.projectInputs = s.flattenProjectInputsLocked()
  return true
}

func (s *NativePluginSource) flattenProjectInputsLocked() LSPProjectInputSnapshot {
  files := map[string]string{}
  globs := map[string]string{}
  root := ""
  seen := map[string]struct{}{}
  for _, plugin := range s.plugins {
    key := pluginKey(plugin)
    if _, duplicate := seen[key]; duplicate {
      continue
    }
    seen[key] = struct{}{}
    snapshot := s.pluginProjectInputs[key].snapshot
    if root == "" && snapshot.Root != "" {
      root = snapshot.Root
    }
    for _, file := range snapshot.Files {
      files[projectInputPathKey(file)] = file
    }
    for _, pattern := range snapshot.Globs {
      globs[projectInputPathKey(pattern)] = pattern
    }
  }
  out := LSPProjectInputSnapshot{Root: root}
  for _, file := range files {
    out.Files = append(out.Files, file)
  }
  for _, pattern := range globs {
    out.Globs = append(out.Globs, pattern)
  }
  sort.Strings(out.Files)
  sort.Strings(out.Globs)
  return out
}

func normalizeLSPProjectInputSnapshot(
  snapshot LSPProjectInputSnapshot,
  expectedRoot string,
) (LSPProjectInputSnapshot, error) {
  if strings.TrimSpace(snapshot.Root) == "" ||
    !isAbsoluteLocalLSPProjectInputPath(snapshot.Root, runtime.GOOS) {
    return LSPProjectInputSnapshot{}, fmt.Errorf(
      "root %q is not an absolute local path",
      snapshot.Root,
    )
  }
  root := filepath.ToSlash(realProjectInputPath(snapshot.Root))
  if strings.TrimSpace(expectedRoot) != "" &&
    projectInputPathKey(root) !=
      projectInputPathKey(realProjectInputPath(expectedRoot)) {
    return LSPProjectInputSnapshot{}, fmt.Errorf(
      "root %q differs from selected project root %q",
      root,
      filepath.ToSlash(realProjectInputPath(expectedRoot)),
    )
  }
  files := map[string]string{}
  for _, file := range snapshot.Files {
    if strings.TrimSpace(file) == "" ||
      !isAbsoluteLocalLSPProjectInputPath(file, runtime.GOOS) {
      return LSPProjectInputSnapshot{}, fmt.Errorf(
        "file %q is not an absolute local path",
        file,
      )
    }
    normalized := filepath.ToSlash(realProjectInputPath(file))
    files[projectInputPathKey(normalized)] = normalized
  }
  globs := map[string]string{}
  for _, pattern := range snapshot.Globs {
    native := projectInputFilesystemPath(pattern)
    if strings.TrimSpace(pattern) == "" ||
      !isAbsoluteLocalLSPProjectInputPath(pattern, runtime.GOOS) {
      return LSPProjectInputSnapshot{}, fmt.Errorf(
        "glob %q is not an absolute local path",
        pattern,
      )
    }
    normalized := filepath.ToSlash(filepath.Clean(native))
    globs[projectInputPathKey(normalized)] = normalized
  }
  out := LSPProjectInputSnapshot{Root: root}
  for _, file := range files {
    out.Files = append(out.Files, file)
  }
  for _, pattern := range globs {
    out.Globs = append(out.Globs, pattern)
  }
  sort.Strings(out.Files)
  sort.Strings(out.Globs)
  return out, nil
}

func isAbsoluteLocalLSPProjectInputPath(
  location string,
  goos string,
) bool {
  if strings.ContainsRune(location, '\x00') {
    return false
  }
  if goos != "windows" {
    return path.IsAbs(location)
  }
  normalized := strings.ReplaceAll(location, "/", `\`)
  if strings.HasPrefix(normalized, `\\?\`) {
    extended := strings.TrimPrefix(normalized, `\\?\`)
    if isWindowsDrivePath(extended) {
      return true
    }
    if strings.HasPrefix(strings.ToLower(extended), `unc\`) {
      return isWindowsUNCPath(extended[4:])
    }
    return false
  }
  if strings.HasPrefix(normalized, `\\.\`) {
    return false
  }
  return isWindowsDrivePath(normalized) ||
    (strings.HasPrefix(normalized, `\\`) &&
      isWindowsUNCPath(strings.TrimPrefix(normalized, `\\`)))
}

func isWindowsDrivePath(location string) bool {
  return len(location) >= 3 &&
    ((location[0] >= 'A' && location[0] <= 'Z') ||
      (location[0] >= 'a' && location[0] <= 'z')) &&
    location[1] == ':' &&
    location[2] == '\\'
}

func isWindowsUNCPath(location string) bool {
  components := strings.Split(location, `\`)
  return len(components) >= 2 &&
    isWindowsUNCVolumeSegment(components[0]) &&
    isWindowsUNCVolumeSegment(components[1])
}

func isWindowsUNCVolumeSegment(segment string) bool {
  return segment != "" &&
    segment != "." &&
    segment != ".." &&
    !strings.ContainsAny(segment, "\x00<>:\"/\\|?*")
}

func copyProjectInputSnapshot(
  snapshot LSPProjectInputSnapshot,
) LSPProjectInputSnapshot {
  return LSPProjectInputSnapshot{
    Root:  snapshot.Root,
    Files: append([]string(nil), snapshot.Files...),
    Globs: append([]string(nil), snapshot.Globs...),
  }
}

func projectInputSnapshotsEqual(
  left LSPProjectInputSnapshot,
  right LSPProjectInputSnapshot,
) bool {
  if projectInputPathKey(left.Root) != projectInputPathKey(right.Root) ||
    len(left.Files) != len(right.Files) ||
    len(left.Globs) != len(right.Globs) {
    return false
  }
  for index := range left.Files {
    if projectInputPathKey(left.Files[index]) !=
      projectInputPathKey(right.Files[index]) {
      return false
    }
  }
  for index := range left.Globs {
    if projectInputPathKey(left.Globs[index]) !=
      projectInputPathKey(right.Globs[index]) {
      return false
    }
  }
  return true
}

func realProjectInputPath(location string) string {
  absolute, err := filepath.Abs(projectInputFilesystemPath(location))
  if err != nil {
    return filepath.Clean(filepath.FromSlash(location))
  }
  probe := absolute
  suffix := []string{}
  for {
    resolved, err := filepath.EvalSymlinks(probe)
    if err == nil {
      for index := len(suffix) - 1; index >= 0; index-- {
        resolved = filepath.Join(resolved, suffix[index])
      }
      return filepath.Clean(resolved)
    }
    parent := filepath.Dir(probe)
    if parent == probe {
      return filepath.Clean(absolute)
    }
    suffix = append(suffix, filepath.Base(probe))
    probe = parent
  }
}

func projectInputFilesystemPath(location string) string {
  if runtime.GOOS != "windows" {
    return filepath.FromSlash(location)
  }
  normalized := strings.ReplaceAll(location, "/", `\`)
  if strings.HasPrefix(strings.ToLower(normalized), `\\?\unc\`) {
    return `\\` + normalized[8:]
  }
  if strings.HasPrefix(normalized, `\\?\`) &&
    isWindowsDrivePath(normalized[4:]) {
    return normalized[4:]
  }
  return normalized
}

func projectInputPathKey(location string) string {
  key := filepath.ToSlash(filepath.Clean(filepath.FromSlash(location)))
  if runtime.GOOS == "windows" {
    key = strings.ToLower(key)
  }
  return key
}

func matchProjectInputGlob(pattern []string, candidate []string) bool {
  type position struct {
    pattern   int
    candidate int
  }
  memo := map[position]bool{}
  visited := map[position]bool{}
  var visit func(int, int) bool
  visit = func(patternIndex int, candidateIndex int) bool {
    key := position{pattern: patternIndex, candidate: candidateIndex}
    if visited[key] {
      return memo[key]
    }
    visited[key] = true
    var matched bool
    switch {
    case patternIndex == len(pattern):
      matched = candidateIndex == len(candidate)
    case pattern[patternIndex] == "**":
      matched = visit(patternIndex+1, candidateIndex) ||
        (candidateIndex != len(candidate) &&
          visit(patternIndex, candidateIndex+1))
    case candidateIndex != len(candidate):
      matched = matchProjectInputGlobSegment(
        pattern[patternIndex],
        candidate[candidateIndex],
      ) && visit(patternIndex+1, candidateIndex+1)
    }
    memo[key] = matched
    return matched
  }
  return visit(0, 0)
}

func matchProjectInputGlobSegment(pattern string, candidate string) bool {
  expression := []rune(pattern)
  input := []rune(candidate)
  matches := make([][]bool, len(expression)+1)
  for index := range matches {
    matches[index] = make([]bool, len(input)+1)
  }
  matches[0][0] = true
  for patternIndex, char := range expression {
    if char == '*' {
      matches[patternIndex+1][0] = matches[patternIndex][0]
    }
    for inputIndex := range input {
      switch char {
      case '*':
        matches[patternIndex+1][inputIndex+1] =
          matches[patternIndex][inputIndex+1] ||
            matches[patternIndex+1][inputIndex]
      case '?':
        matches[patternIndex+1][inputIndex+1] =
          matches[patternIndex][inputIndex]
      default:
        matches[patternIndex+1][inputIndex+1] =
          char == input[inputIndex] &&
            matches[patternIndex][inputIndex]
      }
    }
  }
  return matches[len(expression)][len(input)]
}
