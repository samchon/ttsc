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
  Root                   string            `json:"root"`
  Files                  []string          `json:"files"`
  Globs                  []string          `json:"globs"`
  ReloadFiles            []string          `json:"reloadFiles,omitempty"`
  ReloadDirectories      []string          `json:"reloadDirectories,omitempty"`
  ReloadFileDigests      map[string]string `json:"reloadFileDigests,omitempty"`
  ReloadDirectoryDigests map[string]string `json:"reloadDirectoryDigests,omitempty"`
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

// ProjectInputReloadFingerprintsAreCurrent reports whether the retained
// selection-time baseline still matches the filesystem. The proxy checks this
// after the client confirms dynamic watcher registration, closing the interval
// between construction-time validation and active event delivery.
func (s *NativePluginSource) ProjectInputReloadFingerprintsAreCurrent() bool {
  if s == nil {
    return true
  }
  s.projectInputsMu.RLock()
  snapshot := copyProjectInputSnapshot(s.projectInputs)
  s.projectInputsMu.RUnlock()
  return projectInputReloadFingerprintsAreCurrent(snapshot)
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
    // The candidate is resolved physically, so the declaration has to be too;
    // a Windows short component or a symlinked ancestor otherwise never matches.
    fileKey := projectInputPathKey(realProjectInputPath(file))
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
  changeType *int,
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
    // The candidate is resolved physically, so the declaration has to be too;
    // a Windows short component or a symlinked ancestor otherwise never matches.
    fileKey := projectInputPathKey(realProjectInputPath(file))
    if fileKey == candidateKey || fileKey == candidateEntryKey {
      return true
    }
  }
  matched := false
  for _, directory := range snapshot.ReloadDirectories {
    if !projectInputDirectoryContainsImmediate(directory, candidateEntry) {
      continue
    }
    key := projectInputPathKey(directory)
    // The digest map is keyed by the declared spelling, so that lookup keeps
    // it. The identity comparison is against a physically resolved candidate
    // and has to resolve too, or a directory recreated with identical topology
    // under an aliased spelling would fall through to the digest compare and
    // report no change at all.
    if projectInputPathKey(realProjectInputPath(directory)) ==
      candidateEntryKey &&
      (changeType == nil || *changeType != fileChangeTypeChanged) {
      return true
    }
    if projectInputReloadDirectoryDigest(directory) !=
      snapshot.ReloadDirectoryDigests[key] {
      matched = true
    }
  }
  return matched
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

// projectInputSnapshotMatchesCandidate compares a declaration against a
// candidate both sides of which have been resolved to one filesystem identity.
//
// The candidate arrives from an editor URI and is resolved physically, so a
// declaration compared lexically can never match it wherever the two spellings
// differ: a Windows short (8.3) component, which `%TEMP%` routinely carries, or
// a symlinked ancestor such as macOS `/var`. Resolving here rather than when
// the snapshot is stored keeps the declared spelling available to the client
// registration that also reads it, and lets a retargeted link be recognized on
// the event that follows it.
func projectInputSnapshotMatchesCandidate(
  snapshot LSPProjectInputSnapshot,
  candidate string,
) bool {
  for _, file := range snapshot.Files {
    if projectInputPathKey(realProjectInputPath(file)) == candidate {
      return true
    }
  }
  for _, pattern := range snapshot.Globs {
    // A pattern has no filesystem object of its own; realProjectInputPath
    // resolves its longest existing prefix and rejoins the wildcards.
    if matchProjectInputGlob(
      strings.Split(projectInputPathKey(realProjectInputPath(pattern)), "/"),
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
  if existed {
    preserveProjectInputReloadFingerprints(existing.snapshot, &snapshot)
  }
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
  reloadFileDigests := map[string]string{}
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
      fileKey := projectInputPathKey(file)
      reloadFiles[fileKey] = file
      reloadFileDigests[fileKey] = snapshot.ReloadFileDigests[fileKey]
    }
    for _, directory := range snapshot.ReloadDirectories {
      directoryKey := projectInputPathKey(directory)
      reloadDirectories[directoryKey] = directory
      reloadDirectoryDigests[directoryKey] =
        snapshot.ReloadDirectoryDigests[directoryKey]
    }
  }
  out := LSPProjectInputSnapshot{
    Root:                   root,
    ReloadFileDigests:      reloadFileDigests,
    ReloadDirectoryDigests: reloadDirectoryDigests,
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
    normalized := filepath.ToSlash(realProjectInputEntryPath(file))
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
    ReloadFileDigests:      map[string]string{},
    ReloadDirectoryDigests: map[string]string{},
  }
  for _, file := range files {
    out.Files = append(out.Files, file)
  }
  for _, pattern := range globs {
    out.Globs = append(out.Globs, pattern)
  }
  for _, file := range reloadFiles {
    out.ReloadFiles = append(out.ReloadFiles, file)
    key := projectInputPathKey(file)
    digest, ok := projectInputSnapshotDigest(snapshot.ReloadFileDigests, file)
    if !ok {
      if snapshot.ReloadFileDigests != nil {
        return LSPProjectInputSnapshot{}, fmt.Errorf(
          "reload file %q is missing its selection fingerprint",
          file,
        )
      }
      digest = projectInputReloadFileDigest(file)
    }
    if !validProjectInputFingerprint(digest) {
      return LSPProjectInputSnapshot{}, fmt.Errorf(
        "reload file %q has an invalid fingerprint",
        file,
      )
    }
    out.ReloadFileDigests[key] = digest
  }
  for _, directory := range reloadDirectories {
    out.ReloadDirectories = append(out.ReloadDirectories, directory)
    key := projectInputPathKey(directory)
    digest, ok := projectInputSnapshotDigest(
      snapshot.ReloadDirectoryDigests,
      directory,
    )
    if !ok {
      if snapshot.ReloadDirectoryDigests != nil {
        return LSPProjectInputSnapshot{}, fmt.Errorf(
          "reload directory %q is missing its selection fingerprint",
          directory,
        )
      }
      digest = projectInputReloadDirectoryDigest(directory)
    }
    if !validProjectInputFingerprint(digest) {
      return LSPProjectInputSnapshot{}, fmt.Errorf(
        "reload directory %q has an invalid fingerprint",
        directory,
      )
    }
    out.ReloadDirectoryDigests[key] = digest
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
  if snapshot.ReloadFileDigests != nil {
    copied.ReloadFileDigests = make(
      map[string]string,
      len(snapshot.ReloadFileDigests),
    )
    for key, digest := range snapshot.ReloadFileDigests {
      copied.ReloadFileDigests[key] = digest
    }
  }
  if snapshot.ReloadDirectoryDigests != nil {
    copied.ReloadDirectoryDigests = make(
      map[string]string,
      len(snapshot.ReloadDirectoryDigests),
    )
    for key, digest := range snapshot.ReloadDirectoryDigests {
      copied.ReloadDirectoryDigests[key] = digest
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
    key := projectInputPathKey(left.ReloadFiles[index])
    if left.ReloadFileDigests[key] != right.ReloadFileDigests[key] {
      return false
    }
  }
  for index := range left.ReloadDirectories {
    if projectInputPathKey(left.ReloadDirectories[index]) !=
      projectInputPathKey(right.ReloadDirectories[index]) {
      return false
    }
    key := projectInputPathKey(left.ReloadDirectories[index])
    if left.ReloadDirectoryDigests[key] != right.ReloadDirectoryDigests[key] {
      return false
    }
  }
  return true
}

func projectInputDirectoryContainsImmediate(
  directory string,
  candidate string,
) bool {
  // Both operands are resolved physically before they are compared. Callers
  // pass a candidate that already went through that resolution, so leaving the
  // declared directory lexical would never match it under a Windows short
  // component or a symlinked ancestor.
  resolvedDirectory := realProjectInputPath(directory)
  relative, err := filepath.Rel(
    projectInputFilesystemPath(resolvedDirectory),
    projectInputFilesystemPath(candidate),
  )
  if err != nil || filepath.IsAbs(relative) {
    return false
  }
  relativeKey := projectInputPathKey(relative)
  if relativeKey == "." {
    return projectInputPathKey(resolvedDirectory) ==
      projectInputPathKey(candidate)
  }
  return relativeKey != ".." &&
    !strings.HasPrefix(relativeKey, "../") &&
    !strings.Contains(relativeKey, "/")
}

func preserveProjectInputReloadFingerprints(
  baseline LSPProjectInputSnapshot,
  current *LSPProjectInputSnapshot,
) {
  if current == nil {
    return
  }
  for _, file := range current.ReloadFiles {
    key := projectInputPathKey(file)
    if digest := baseline.ReloadFileDigests[key]; digest != "" {
      current.ReloadFileDigests[key] = digest
    }
  }
  for _, directory := range current.ReloadDirectories {
    key := projectInputPathKey(directory)
    if digest := baseline.ReloadDirectoryDigests[key]; digest != "" {
      current.ReloadDirectoryDigests[key] = digest
    }
  }
}

func projectInputReloadFingerprintsAreCurrent(
  snapshot LSPProjectInputSnapshot,
) bool {
  for _, file := range snapshot.ReloadFiles {
    key := projectInputPathKey(file)
    if snapshot.ReloadFileDigests[key] != projectInputReloadFileDigest(file) {
      return false
    }
  }
  for _, directory := range snapshot.ReloadDirectories {
    key := projectInputPathKey(directory)
    if snapshot.ReloadDirectoryDigests[key] !=
      projectInputReloadDirectoryDigest(directory) {
      return false
    }
  }
  return true
}

func projectInputSnapshotDigest(
  fingerprints map[string]string,
  location string,
) (string, bool) {
  if fingerprints == nil {
    return "", false
  }
  if digest, ok := fingerprints[location]; ok {
    return digest, true
  }
  wanted := projectInputPathKey(location)
  for candidate, digest := range fingerprints {
    if projectInputPathKey(realProjectInputPath(candidate)) == wanted ||
      projectInputPathKey(realProjectInputEntryPath(candidate)) == wanted {
      return digest, true
    }
  }
  return "", false
}

func validProjectInputFingerprint(digest string) bool {
  if len(digest) != sha256.Size*2 || strings.ToLower(digest) != digest {
    return false
  }
  for _, char := range digest {
    if (char < '0' || char > '9') && (char < 'a' || char > 'f') {
      return false
    }
  }
  return true
}

func projectInputReloadDirectoryDigest(directory string) string {
  entries, err := os.ReadDir(projectInputFilesystemPath(directory))
  if err != nil {
    missing := sha256.Sum256([]byte("missing\x00"))
    return fmt.Sprintf("%x", missing[:])
  }
  digest := sha256.New()
  for index, entry := range entries {
    kind := "other"
    info, err := entry.Info()
    if err != nil {
      missing := sha256.Sum256([]byte("missing\x00"))
      return fmt.Sprintf("%x", missing[:])
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

func projectInputReloadFileDigest(location string) string {
  native := projectInputFilesystemPath(location)
  info, err := os.Lstat(native)
  if err != nil {
    missing := sha256.Sum256([]byte("missing\x00"))
    return fmt.Sprintf("%x", missing[:])
  }
  if info.Mode()&os.ModeSymlink != 0 {
    target, err := os.Readlink(native)
    if err != nil {
      target = "<unreadable>"
    }
    content := []byte("missing\x00")
    if body, readErr := os.ReadFile(native); readErr == nil {
      content = append([]byte("file\x00"), body...)
    }
    digest := sha256.New()
    digest.Write([]byte("symlink\x00"))
    digest.Write([]byte(target))
    digest.Write([]byte{0})
    digest.Write(content)
    return fmt.Sprintf("%x", digest.Sum(nil))
  }
  if info.Mode().IsRegular() {
    body, err := os.ReadFile(native)
    if err != nil {
      missing := sha256.Sum256([]byte("missing\x00"))
      return fmt.Sprintf("%x", missing[:])
    }
    digest := sha256.New()
    digest.Write([]byte("file\x00"))
    digest.Write(body)
    return fmt.Sprintf("%x", digest.Sum(nil))
  }
  other := sha256.Sum256([]byte("other\x00"))
  return fmt.Sprintf("%x", other[:])
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
