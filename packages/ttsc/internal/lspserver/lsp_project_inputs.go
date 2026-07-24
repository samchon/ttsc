package lspserver

import (
  "crypto/sha256"
  "encoding/json"
  "fmt"
  "os"
  "path"
  "path/filepath"
  "runtime"
  "sort"
  "strings"
)

// LSPProjectInputSnapshot is the normalized external filesystem topology
// published by project-rule contributors.
type LSPProjectInputSnapshot struct {
  Root              string   `json:"root"`
  Files             []string `json:"files"`
  Globs             []string `json:"globs"`
  ReloadFiles       []string `json:"reloadFiles,omitempty"`
  ReloadDirectories []string `json:"reloadDirectories,omitempty"`

  reloadDirectoryDigests map[string]string
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

// ProjectInputReloadMatchesURI reports whether uri names an exact reload file,
// a reload directory, or one of that directory's immediate entries. Callers
// with an LSP change event should use ProjectInputReloadMatchesChange so an
// ordinary content edit inside a topology directory does not force a restart.
func (s *NativePluginSource) ProjectInputReloadMatchesURI(uri string) bool {
  if s == nil {
    return false
  }
  location, ok := filePathFromURI(uri)
  if !ok {
    return false
  }
  candidate := realProjectInputPath(location)
  candidateEntry := realProjectInputEntryPath(location)
  candidateKey := projectInputPathKey(candidate)
  candidateEntryKey := projectInputPathKey(candidateEntry)
  s.projectInputsMu.RLock()
  defer s.projectInputsMu.RUnlock()
  for _, file := range s.projectInputs.ReloadFiles {
    fileKey := projectInputPathKey(file)
    if fileKey == candidateKey || fileKey == candidateEntryKey {
      return true
    }
  }
  for _, directory := range s.projectInputs.ReloadDirectories {
    if projectInputDirectoryContainsImmediate(directory, candidateEntry) {
      return true
    }
  }
  return false
}

// ProjectInputReloadMatchesChange reports whether an LSP filesystem change
// invalidates executable plugin selection. Exact reload files are content
// inputs. Reload directories are topology inputs, so only a change to the
// directory itself or an immediate entry can qualify, and it qualifies only
// when the current name/type/symlink-target digest differs from the snapshot.
func (s *NativePluginSource) ProjectInputReloadMatchesChange(
  uri string,
  _ *int,
) bool {
  if s == nil {
    return false
  }
  location, ok := filePathFromURI(uri)
  if !ok {
    return false
  }
  candidate := realProjectInputPath(location)
  candidateEntry := realProjectInputEntryPath(location)
  candidateKey := projectInputPathKey(candidate)
  candidateEntryKey := projectInputPathKey(candidateEntry)
  s.projectInputsMu.RLock()
  snapshot := copyProjectInputSnapshot(s.projectInputs)
  s.projectInputsMu.RUnlock()
  for _, file := range snapshot.ReloadFiles {
    fileKey := projectInputPathKey(file)
    if fileKey == candidateKey || fileKey == candidateEntryKey {
      return true
    }
  }
  for _, directory := range snapshot.ReloadDirectories {
    if !projectInputDirectoryContainsImmediate(directory, candidateEntry) {
      continue
    }
    key := projectInputPathKey(directory)
    return projectInputReloadDirectoryDigest(directory) !=
      snapshot.reloadDirectoryDigests[key]
  }
  return false
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
  for _, plugin := range selectPluginTransports(
    s.plugins,
    nil,
    s.projectContextJSON,
  ) {
    key := pluginKey(plugin, s.projectContextJSON)
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
  for _, plugin := range selectPluginTransports(
    s.plugins,
    func(plugin NativeLSPPluginEntry) bool {
      return plugin.ProjectInputs
    },
    s.projectContextJSON,
  ) {
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
  key := pluginKey(plugin, s.projectContextJSON)
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
  reloadFiles := map[string]string{}
  reloadDirectories := map[string]string{}
  reloadDirectoryDigests := map[string]string{}
  root := ""
  for _, plugin := range selectPluginTransports(
    s.plugins,
    nil,
    s.projectContextJSON,
  ) {
    key := pluginKey(plugin, s.projectContextJSON)
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
    for _, file := range snapshot.ReloadFiles {
      reloadFiles[projectInputPathKey(file)] = file
    }
    for _, directory := range snapshot.ReloadDirectories {
      directoryKey := projectInputPathKey(directory)
      reloadDirectories[directoryKey] = directory
      reloadDirectoryDigests[directoryKey] =
        snapshot.reloadDirectoryDigests[directoryKey]
    }
  }
  out := LSPProjectInputSnapshot{
    Root:                   root,
    reloadDirectoryDigests: reloadDirectoryDigests,
  }
  for _, file := range files {
    out.Files = append(out.Files, file)
  }
  for _, pattern := range globs {
    out.Globs = append(out.Globs, pattern)
  }
  for _, file := range reloadFiles {
    out.ReloadFiles = append(out.ReloadFiles, file)
  }
  for _, directory := range reloadDirectories {
    out.ReloadDirectories = append(out.ReloadDirectories, directory)
  }
  sort.Strings(out.Files)
  sort.Strings(out.Globs)
  sort.Strings(out.ReloadFiles)
  sort.Strings(out.ReloadDirectories)
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
  reloadFiles := map[string]string{}
  for _, file := range snapshot.ReloadFiles {
    if strings.TrimSpace(file) == "" ||
      !isAbsoluteLocalLSPProjectInputPath(file, runtime.GOOS) {
      return LSPProjectInputSnapshot{}, fmt.Errorf(
        "reload file %q is not an absolute local path",
        file,
      )
    }
    normalized := filepath.ToSlash(realProjectInputPath(file))
    reloadFiles[projectInputPathKey(normalized)] = normalized
  }
  reloadDirectories := map[string]string{}
  for _, directory := range snapshot.ReloadDirectories {
    if strings.TrimSpace(directory) == "" ||
      !isAbsoluteLocalLSPProjectInputPath(directory, runtime.GOOS) {
      return LSPProjectInputSnapshot{}, fmt.Errorf(
        "reload directory %q is not an absolute local path",
        directory,
      )
    }
    normalized := filepath.ToSlash(realProjectInputPath(directory))
    reloadDirectories[projectInputPathKey(normalized)] = normalized
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
  out := LSPProjectInputSnapshot{
    Root:                   root,
    reloadDirectoryDigests: map[string]string{},
  }
  for _, file := range files {
    out.Files = append(out.Files, file)
  }
  for _, pattern := range globs {
    out.Globs = append(out.Globs, pattern)
  }
  for _, file := range reloadFiles {
    out.ReloadFiles = append(out.ReloadFiles, file)
  }
  for _, directory := range reloadDirectories {
    out.ReloadDirectories = append(out.ReloadDirectories, directory)
    out.reloadDirectoryDigests[projectInputPathKey(directory)] =
      projectInputReloadDirectoryDigest(directory)
  }
  sort.Strings(out.Files)
  sort.Strings(out.Globs)
  sort.Strings(out.ReloadFiles)
  sort.Strings(out.ReloadDirectories)
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
  copied := LSPProjectInputSnapshot{
    Root:              snapshot.Root,
    Files:             append([]string(nil), snapshot.Files...),
    Globs:             append([]string(nil), snapshot.Globs...),
    ReloadFiles:       append([]string(nil), snapshot.ReloadFiles...),
    ReloadDirectories: append([]string(nil), snapshot.ReloadDirectories...),
  }
  if snapshot.reloadDirectoryDigests != nil {
    copied.reloadDirectoryDigests = make(
      map[string]string,
      len(snapshot.reloadDirectoryDigests),
    )
    for key, digest := range snapshot.reloadDirectoryDigests {
      copied.reloadDirectoryDigests[key] = digest
    }
  }
  return copied
}

func projectInputSnapshotsEqual(
  left LSPProjectInputSnapshot,
  right LSPProjectInputSnapshot,
) bool {
  if projectInputPathKey(left.Root) != projectInputPathKey(right.Root) ||
    len(left.Files) != len(right.Files) ||
    len(left.Globs) != len(right.Globs) ||
    len(left.ReloadFiles) != len(right.ReloadFiles) ||
    len(left.ReloadDirectories) != len(right.ReloadDirectories) {
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
  for index := range left.ReloadFiles {
    if projectInputPathKey(left.ReloadFiles[index]) !=
      projectInputPathKey(right.ReloadFiles[index]) {
      return false
    }
  }
  for index := range left.ReloadDirectories {
    if projectInputPathKey(left.ReloadDirectories[index]) !=
      projectInputPathKey(right.ReloadDirectories[index]) {
      return false
    }
    key := projectInputPathKey(left.ReloadDirectories[index])
    if left.reloadDirectoryDigests[key] != right.reloadDirectoryDigests[key] {
      return false
    }
  }
  return true
}

func projectInputDirectoryContainsImmediate(
  directory string,
  candidate string,
) bool {
  relative, err := filepath.Rel(
    projectInputFilesystemPath(directory),
    projectInputFilesystemPath(candidate),
  )
  if err != nil || filepath.IsAbs(relative) {
    return false
  }
  relativeKey := projectInputPathKey(relative)
  if relativeKey == "." {
    return projectInputPathKey(directory) == projectInputPathKey(candidate)
  }
  return relativeKey != ".." &&
    !strings.HasPrefix(relativeKey, "../") &&
    !strings.Contains(relativeKey, "/")
}

func projectInputReloadDirectoryDigest(directory string) string {
  entries, err := os.ReadDir(projectInputFilesystemPath(directory))
  if err != nil {
    return "error:" + err.Error()
  }
  digest := sha256.New()
  for index, entry := range entries {
    kind := "other"
    info, err := entry.Info()
    if err != nil {
      return "error:" + err.Error()
    }
    switch {
    case info.Mode()&os.ModeSymlink != 0:
      kind = "symlink"
    case info.IsDir():
      kind = "directory"
    case info.Mode().IsRegular():
      kind = "file"
    }
    target := ""
    if kind == "symlink" {
      target, err = os.Readlink(
        filepath.Join(projectInputFilesystemPath(directory), entry.Name()),
      )
      if err != nil {
        target = "<unreadable>"
      }
    }
    digest.Write([]byte(entry.Name()))
    digest.Write([]byte{0})
    digest.Write([]byte(kind))
    digest.Write([]byte{0})
    digest.Write([]byte(target))
    if index+1 != len(entries) {
      digest.Write([]byte{0})
    }
  }
  return fmt.Sprintf("%x", digest.Sum(nil))
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

func realProjectInputEntryPath(location string) string {
  native := projectInputFilesystemPath(location)
  return filepath.Join(
    realProjectInputPath(filepath.Dir(native)),
    filepath.Base(native),
  )
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
