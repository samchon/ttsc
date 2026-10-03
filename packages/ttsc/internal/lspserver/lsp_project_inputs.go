package lspserver

import (
  "crypto/sha256"
  "encoding/json"
  "fmt"
  "io"
  "os"
  "path"
  "path/filepath"
  "runtime"
  "sort"
  "strings"
)

// LSPProjectInputSnapshot is the normalized external filesystem topology
// published by project-rule contributors.
//
// Files and Globs describe dependencies; reload paths and digests describe the
// executable-selection baseline whose change requires a launcher restart.
//
// @evidence contracts/common.md#principled-implementation Dependency populations remain distinct from reload fingerprints; host-only watcher directories cannot enter through contributor JSON.
// @evidence contracts/common.md#clear-and-simple-design One normalized snapshot carries root, dependencies and selection baseline without a watcher backend.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Reload state comes from actual contributors and launcher selection rather than known project filenames.
// @evidence contracts/common.md#meaningful-documentation Native prose explains dependency versus restart meaning and host-only fields, following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Native paths and digest keys are normalized by host identity helpers rather than interpreted as URI spelling or blindly folded by OS name.
// @evidenceExclude contracts/performance.md#efficient-algorithms Normalization and matching choose processing algorithms.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This value carries baseline inputs without coordinating reuse.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Source stores and watcher registration own lifetimes, not this wire value.
type LSPProjectInputSnapshot struct {
  Root                   string            `json:"root"`
  Files                  []string          `json:"files"`
  Globs                  []string          `json:"globs"`
  ReloadFiles            []string          `json:"reloadFiles,omitempty"`
  ReloadDirectories      []string          `json:"reloadDirectories,omitempty"`
  ReloadFileDigests      map[string]string `json:"reloadFileDigests,omitempty"`
  ReloadDirectoryDigests map[string]string `json:"reloadDirectoryDigests,omitempty"`

  // WatchDirectories are directories whose entries the client must report
  // without their listing being a reload input of its own: the directories of
  // the plugin selection inputs, which judge their own changes.
  // Never read from a contributor.
  WatchDirectories []string `json:"-"`
}

type projectInputRecord struct {
  generation uint64
  snapshot   LSPProjectInputSnapshot
}

// ProjectInputs returns a stable copy of the current merged dependency
// snapshot. The copy isolates mutable collections, not source acquisition time:
// retained producer records can come from different refresh generations.
//
// @evidence contracts/common.md#principled-implementation Locked copies of every path slice and digest map isolate consumer mutations from the merged snapshot.
// @evidence contracts/common.md#clear-and-simple-design A shared copy helper exposes the ready aggregate without rebuilding producer order.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Accepted producer records supply the snapshot instead of guessed filesystem populations.
// @evidence contracts/common.md#meaningful-documentation Native prose states stable-copy behavior, following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation The accessor copies normalized values without interpreting native capabilities.
// @evidence contracts/performance.md#efficient-algorithms Slice copying transfers string headers and digest-map copying additionally hashes key bytes; immutable string contents are shared rather than deep-copied. The read lock can wait for native-key aggregation/equality work held by a writer, so entry counts do not bound elapsed time by themselves.
// @evidence contracts/performance.md#reuse-equivalent-work Callers share the ready aggregate of per-producer retained records. Successful stores can publish individually and failed producers keep prior records; sharing does not certify one capture, complete current declarations or latest native topology.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returned slices and maps belong to the caller; source stores own retained aggregates.
func (s *NativePluginSource) ProjectInputs() LSPProjectInputSnapshot {
  if s == nil {
    return LSPProjectInputSnapshot{}
  }
  s.projectInputsMu.RLock()
  defer s.projectInputsMu.RUnlock()
  return copyProjectInputSnapshot(s.projectInputs)
}

// ProjectInputReloadFingerprintsAreCurrent reports whether the retained
// selected baseline digests still compare equal under the native probe policy.
// The proxy checks after watcher-registration acceptance, but probes are
// sequential rather than one atomic filesystem capture. Equal failure markers
// can compare equal, and nil/empty selection is not proof of global freshness.
//
// @evidence contracts/common.md#principled-implementation Selected file/topology digests and launcher-selection records are compared after copying the baseline under lock. Missing/unreadable probe markers, sequential acquisition and a vacuously empty population limit what equality certifies; it is not an atomic complete-project freshness proof.
// @evidence contracts/common.md#clear-and-simple-design Contributor reload and launcher selection checks share watcher-registration acceptance.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Bytes and topology are observed rather than accepting a quiet watcher as proof of freshness.
// @evidence contracts/common.md#meaningful-documentation Native prose explains the startup-to-registration interval, following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Native stat/readlink/content reads and owning-directory case queries supply selected evidence. Identity can fall back to lexical spelling and unreadable inputs use markers; neither an unknown flag nor marker equality authenticates current physical contents.
// @evidence contracts/performance.md#efficient-algorithms Costs include copying all snapshot slices/digest maps, path-key byte/native queries, selected file-byte hashing, and sorted immediate directory listings/stat/readlink checks. Launcher selection also checks recorded files and can search recorded names per listed entry. No recursive content walk is required, but selected file bytes, listing populations and native IO latency have no independent bound here.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Current native state must be observed without a filesystem generation token that could validate an earlier observation.
// @evidence contracts/performance.md#bound-retention-and-release-resources Snapshot/map/listing copies and hashing state are invocation-local without a separate population budget. File reads and Windows identity probes acquire deferred-closed handles with close errors ignored; the method adds no read deadline or cancellation. It retains no query history and does not advance the source baseline on equality.
func (s *NativePluginSource) ProjectInputReloadFingerprintsAreCurrent() bool {
  if s == nil {
    return true
  }
  s.projectInputsMu.RLock()
  snapshot := copyProjectInputSnapshot(s.projectInputs)
  selection := s.selection
  s.projectInputsMu.RUnlock()
  return projectInputReloadFingerprintsAreCurrent(snapshot) && selection.current()
}

// ProjectInputMatchesURI tests a watched URI against retained dependency/glob
// declarations for invalidation routing. Native resolution can fall back to
// lexical spelling; unknown Windows glob case capability admits both spellings.
// A match is not proof of physical dependency ownership or current declaration
// completeness, and the operation does not query the producer again.
//
// @evidence contracts/common.md#principled-implementation Parsed file URIs are tested against retained exact/glob declarations; URI decode failures return false. Conservative native-fallback and unknown-case routing can admit a candidate without certifying actual physical dependency membership.
// @evidence contracts/common.md#clear-and-simple-design Shared URI decoding precedes the snapshot owner's path and glob matching.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Membership follows declared populations rather than assumed contributor extensions.
// @evidence contracts/common.md#meaningful-documentation Native prose states declared dependency membership, following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Exact keys use native realpath/ancestor fallback and preserve unobserved Windows case distinctions. Glob routing uses owning-directory flags when known and broadens unknown sensitivity; that policy is separate from permission to merge physical identities. Non-Windows globs use case-sensitive normalized spelling without certifying mount-specific case behavior.
// @evidence contracts/performance.md#efficient-algorithms Exact entries precede globs, but native candidate/file/pattern identity and path-byte work are repeated while holding the snapshot read lock. Component recursion memoizes up to pattern-by-candidate index pairs and consumes recursive depth; each segment allocates rune arrays plus an O(N) DP row for O(MN) rune comparisons. There is no independent input/DP budget, and native IO can block beyond those processing counts.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Native identity may change across calls without an immutable filesystem epoch.
// @evidence contracts/performance.md#bound-retention-and-release-resources Query path/rune/DP/memo state grows with declaration and path dimensions without an independent cap, then becomes reclaimable. Windows identity helpers acquire read-attribute handles and defer CloseHandle with errors ignored. The method keeps no queried-URI history, owns no producer process and adds no native-query deadline.
func (s *NativePluginSource) ProjectInputMatchesURI(uri string) bool {
  if s == nil {
    return false
  }
  location, ok := filePathFromURI(uri)
  if !ok {
    return false
  }
  s.projectInputsMu.RLock()
  defer s.projectInputsMu.RUnlock()
  return projectInputSnapshotMatchesCandidate(s.projectInputs, location)
}

// ProjectInputReloadMatchesURI reports whether uri names an exact reload file,
// a reload directory, or one of that directory's immediate entries. Callers
// with an LSP change event should use ProjectInputReloadMatchesChange so an
// ordinary content edit inside a topology directory does not force a restart.
//
// @evidence contracts/common.md#principled-implementation Exact reload files, reload directories and immediate directory entries conservatively identify the legacy reload population without an event digest decision.
// @evidence contracts/common.md#clear-and-simple-design This compatibility matcher shares native path and immediate-containment helpers with change-aware matching.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Conservative legacy membership is an explicit API difference; event consumers use the digest-aware method.
// @evidence contracts/common.md#meaningful-documentation Native prose directs event callers to the change-aware operation and explains false restarts, following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Candidate and declaration comparisons attempt native physical/leaf-entry resolution, including link ancestors and Windows short names. Failed observation falls back to lexical spelling or unknown-case distinctions; a match is routing policy rather than proof of complete physical identity.
// @evidence contracts/performance.md#efficient-algorithms Reload entry scanning is linear in declared population plus native identity resolution cost.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Physical identities are freshly observed and cannot be cached without native invalidation proof.
// @evidence contracts/performance.md#bound-retention-and-release-resources Temporary path/key state grows with declared entries and path lengths, with no independent query budget. Windows read-attribute handles are deferred-closed with errors ignored; no query history is stored and no native-query deadline is added.
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
    if projectInputPathKey(realProjectInputEntryPath(directory)) ==
      candidateEntryKey {
      return true
    }
    if projectInputDirectoryContainsImmediate(directory, candidateEntry) {
      return true
    }
  }
  return false
}

// ProjectInputReloadMatchesChange reports whether an LSP filesystem change
// invalidates executable plugin selection. Exact reload files are content
// inputs. Reload directories are topology inputs, so only a change to the
// directory itself always qualifies. An immediate entry qualifies only when
// the current name/type/symlink-target digest differs from the snapshot and
// the entry is not data territory under a declared glob's literal root.
// changeType is accepted for compatibility but is not inspected; the recorded
// selection, URI and current probe results determine the decision. Probe failures
// can yield markers rather than an independently reported observation error.
//
// @evidence contracts/common.md#principled-implementation Exact reload identities and changed immediate topology trigger restart; declared data territory can explain a directory transition without advancing the executable baseline.
// @evidence contracts/common.md#clear-and-simple-design Contributor inputs and immutable launcher selection are checked at one restart boundary.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Data exemptions follow actual declared glob roots and recorded digests rather than expected file answers.
// @evidence contracts/common.md#meaningful-documentation Native prose explains exact content inputs and topology transitions, following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Link-leaf and target identity comparisons remain separate, using native metadata/case queries when available and lexical or unknown-case fallback otherwise. Digest markers for failed reads are not physical-content authentication.
// @evidence contracts/performance.md#efficient-algorithms The method copies all snapshot slices/maps, resolves candidate/reload identities, and checks relevant launcher-selection file bytes/listings before reload directory topology. Glob-root exemptions add declared-pattern/path scans and key queries. Immediate listings are sorted and their metadata/link targets hashed; no recursive descendant-content walk is performed, but file-byte, text/population and native IO costs remain.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work An earlier URI match does not establish continued validity of current native topology.
// @evidence contracts/performance.md#bound-retention-and-release-resources Baseline copies, directory listings and path/key state are invocation-local with no independent budget. Selection content reads and Windows probes acquire deferred-closed handles with close errors ignored; no read deadline or cancellation is supplied. Retained baseline ownership remains with the source and is not updated by this query.
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
  selection := s.selection
  s.projectInputsMu.RUnlock()
  // What the plugin selection was loaded from is a reload input too.
  if selection.matchesChange(location) {
    return true
  }
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
    if projectInputPathKey(realProjectInputEntryPath(directory)) ==
      candidateEntryKey {
      return true
    }
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
      candidateEntryKey {
      return true
    }
    // A glob root appearing immediately inside a resolution directory is a
    // data-population transition, not a plugin-selection transition. The data
    // watcher already reports it and invalidates the Program in the resident
    // process. Only a root strictly below this directory can explain away its
    // digest delta; a glob rooted on or above the directory cannot.
    if projectInputGlobExemptsReloadEntry(
      snapshot,
      directory,
      candidate,
    ) {
      continue
    }
    if projectInputReloadDirectoryDigest(directory) !=
      snapshot.ReloadDirectoryDigests[key] {
      matched = true
    }
  }
  return matched
}

// ProjectInputOwnersForURI returns the stable plugin keys whose latest
// successful retained snapshots match uri under the routing policy. These keys
// do not certify fresh or complete physical ownership. Ownership is retained past the flattened
// client registration so an external edit refreshes only the contributors that
// declared it.
//
// @evidence contracts/common.md#principled-implementation Each producer's accepted snapshot yields its matching transport key once in descriptor order for owner-scoped invalidation.
// @evidence contracts/common.md#clear-and-simple-design Owner discovery reuses snapshot matching rather than maintaining another membership model.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Owners follow actual contributor declarations, not filename-to-plugin guesses.
// @evidence contracts/common.md#meaningful-documentation Native prose explains why ownership survives flattened client registration, following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation URI decoding and native helpers observe realpath/owning-directory flags when possible. Lexical fallback and unknown-case glob broadening are conservative notification policies, not authenticated physical snapshot ownership.
// @evidence contracts/performance.md#efficient-algorithms Transport traversal hashes binary/context-mode key bytes and tests retained records without rerunning producers. Each record repeats candidate/declaration native identity work and glob memo/rune/DP processing under the read lock, with costs depending on path text, component counts and segment lengths rather than producer count alone.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Native membership has no immutable epoch permitting cross-call memoization.
// @evidence contracts/performance.md#bound-retention-and-release-resources Local transport/routing/path/DP state and returned key storage grow with descriptors and declaration dimensions without a separate cap. Windows read-attribute handles are deferred-closed with errors ignored; no query deadline or producer process is owned here. Returned strings transfer to callers and no queried-URI history is retained by this method.
func (s *NativePluginSource) ProjectInputOwnersForURI(uri string) []string {
  if s == nil {
    return nil
  }
  location, ok := filePathFromURI(uri)
  if !ok {
    return nil
  }
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
    if !ok || !projectInputSnapshotMatchesCandidate(record.snapshot, location) {
      continue
    }
    owners = append(owners, key)
  }
  return owners
}

// projectInputSnapshotMatchesCandidate compares each declaration and candidate
// in one filesystem identity domain.
//
// An editor URI may use a Windows short component or a symlinked ancestor such
// as macOS `/var`. Exact files resolve both spellings physically. Glob matching
// additionally retains the candidate path so Windows can apply the semantics
// of the directory that owns each matched segment.
func projectInputSnapshotMatchesCandidate(
  snapshot LSPProjectInputSnapshot,
  candidate string,
) bool {
  candidateKey := projectInputPathKey(realProjectInputPath(candidate))
  for _, file := range snapshot.Files {
    if projectInputPathKey(realProjectInputPath(file)) == candidateKey {
      return true
    }
  }
  for _, pattern := range snapshot.Globs {
    if projectInputGlobMatchesCandidate(pattern, candidate) {
      return true
    }
  }
  return false
}

// RefreshProjectInputs schedules a coalesced dependency rediscovery after a
// configuration input changes.
//
// @evidence contracts/common.md#principled-implementation Successful decoded/normalized records replace their producer generation, preserving prior digests for still-selected reload keys. Publication is per producer and failed queries keep prior records; accepted path/fingerprint syntax is not authentication of the producer's claimed input capture.
// @evidence contracts/common.md#clear-and-simple-design A dedicated scheduler separates dependency refresh from completion publication.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Refresh does not advance executable baselines to conceal selection changes.
// @evidence contracts/common.md#meaningful-documentation Native prose states asynchronous discovery, following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Normalization checks absolute native path syntax and selected-root key equality, using link/ancestor resolution and owning-directory flags when observable. Lexical fallback, unknown case and accepted digest markers remain observation limits rather than proof of physical capture.
// @evidence contracts/performance.md#efficient-algorithms Each selected transport issues a direct project-inputs query, followed by JSON decoding, path-key/ancestor/case normalization, digest-map fallback searches and potentially selected file-byte/topology hashing. A changed store compares/preserves prior keys and rebuilds/deduplicates/sorts the full aggregate under its write lock, potentially once per producer; observer/log/trace IO add their own costs.
// @evidence contracts/performance.md#reuse-equivalent-work Notifications share one active cycle and one rerun; flattened accepted snapshots serve matching and watcher consumers.
// @evidence contracts/performance.md#bound-retention-and-release-resources One active worker and one queued rerun bound simultaneous scheduling, not total cycles or native runtime. Per-command response caps do not independently bound normalized/retained aggregate entries, path bytes or last-good age. File/Windows normalization probes are deferred-closed with errors ignored; Close requests process cancellation and rejects schedules without joining the running refresh/observer or clearing retained snapshots, and no computation deadline is imposed here.
func (s *NativePluginSource) RefreshProjectInputs() {
  if s == nil {
    return
  }
  s.projectInputsRefresh.schedule(s.discoverProjectInputs)
}

// SetProjectInputsObserver registers the proxy callback that replaces the
// client's dynamic watched-file registration when accepted stores change the
// merged declaration view. A notification does not certify all producers succeeded
// or that the view came from one input capture.
// A nil observer removes future notifications; a callback already copied by a
// refresh may still finish.
//
// @evidence contracts/common.md#principled-implementation Locked replacement atomically changes the callback; an already copied callback may finish after removal.
// @evidence contracts/common.md#clear-and-simple-design One observer connects source publication to watcher reconciliation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The proxy observes through the supported seam rather than patching refresh internals.
// @evidence contracts/common.md#meaningful-documentation Native prose states observer timing and nil removal, following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Callback registration performs no native interpretation.
// @evidenceExclude contracts/performance.md#efficient-algorithms Assigning a callback chooses no processing algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The source scheduler owns shared refresh work.
// @evidence contracts/performance.md#bound-retention-and-release-resources One callback reference is replaced or cleared under projectInputsMu, but its reachable captures have no imposed byte budget. Previously copied callbacks can still begin or finish after replacement; the setter does not join execution, cancel effects or release source-owned retained snapshots.
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
  out.WatchDirectories = s.selection.watchDirectories()
  sort.Strings(out.Files)
  sort.Strings(out.Globs)
  sort.Strings(out.ReloadFiles)
  sort.Strings(out.ReloadDirectories)
  sort.Strings(out.WatchDirectories)
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
    for _, normalized := range []string{
      filepath.ToSlash(realProjectInputPath(directory)),
      filepath.ToSlash(realProjectInputEntryPath(directory)),
    } {
      reloadDirectories[projectInputPathKey(normalized)] = normalized
    }
  }
  globs := map[string]string{}
  for _, pattern := range snapshot.Globs {
    if strings.TrimSpace(pattern) == "" ||
      !isAbsoluteLocalLSPProjectInputPath(pattern, runtime.GOOS) {
      return LSPProjectInputSnapshot{}, fmt.Errorf(
        "glob %q is not an absolute local path",
        pattern,
      )
    }
    // Every other lane in this function resolves its declaration physically,
    // and a glob has to as well or its population is compared against events
    // that were. A pattern has no filesystem object of its own, so resolution
    // takes its longest existing prefix and rejoins the wildcards, which leaves
    // the pattern's shape untouched while its root gains one identity.
    normalized := filepath.ToSlash(realProjectInputPath(pattern))
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
    WatchDirectories:  append([]string(nil), snapshot.WatchDirectories...),
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
  relative, within := projectInputPathIdentityRelative(
    resolvedDirectory,
    candidate,
  )
  return within && !strings.Contains(relative, "/")
}

func projectInputGlobExemptsReloadEntry(
  snapshot LSPProjectInputSnapshot,
  directory string,
  candidate string,
) bool {
  resolvedDirectory := realProjectInputPath(directory)
  directoryKey := projectInputPathKey(resolvedDirectory)
  for _, pattern := range snapshot.Globs {
    globRoot, _ := projectInputGlobRelativePattern(pattern)
    resolvedGlobRoot := realProjectInputPath(globRoot)
    if projectInputPathKey(resolvedGlobRoot) == directoryKey {
      continue
    }
    if projectInputPathContains(resolvedDirectory, resolvedGlobRoot) &&
      projectInputPathContains(resolvedGlobRoot, candidate) {
      return true
    }
  }
  return false
}

func projectInputPathContains(
  directory string,
  candidate string,
) bool {
  _, within := projectInputPathIdentityRelative(directory, candidate)
  return within
}

func projectInputPathIdentityRelative(
  directory string,
  candidate string,
) (string, bool) {
  root := strings.TrimRight(projectInputPathKey(directory), "/")
  location := strings.TrimRight(projectInputPathKey(candidate), "/")
  if root == location {
    return "", true
  }
  prefix := root + "/"
  if !strings.HasPrefix(location, prefix) {
    return "", false
  }
  return strings.TrimPrefix(location, prefix), true
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
  topology := projectInputReloadDirectoryTopologyDigest(directory)
  digest := sha256.New()
  digest.Write([]byte("directory\x00"))
  digest.Write([]byte(projectInputPhysicalPathKey(directory)))
  digest.Write([]byte{0})
  digest.Write([]byte(topology))
  return fmt.Sprintf("%x", digest.Sum(nil))
}

func projectInputReloadDirectoryTopologyDigest(directory string) string {
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
    case projectInputEntryIsLink(
      filepath.Join(projectInputFilesystemPath(directory), entry.Name()),
      info.Mode(),
    ):
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
  link := projectInputEntryIsLink(native, info.Mode())
  if !link && !info.Mode().IsRegular() {
    other := sha256.Sum256([]byte("other\x00"))
    return fmt.Sprintf("%x", other[:])
  }
  prefix := ""
  if link {
    target, err := os.Readlink(native)
    if err != nil {
      target = "<unreadable>"
    }
    prefix = "symlink\x00" + target + "\x00"
  }
  digest := sha256.New()
  digest.Write([]byte(prefix))
  file, err := os.Open(native)
  if err == nil {
    defer file.Close()
    digest.Write([]byte("file\x00"))
    if _, readErr := io.Copy(digest, file); readErr == nil {
      return fmt.Sprintf("%x", digest.Sum(nil))
    }
  }
  // Read failure must discard partial bytes, retaining the same missing marker
  // as the launcher, with the raw link target still part of a link's identity.
  digest.Reset()
  digest.Write([]byte(prefix))
  digest.Write([]byte("missing\x00"))
  return fmt.Sprintf("%x", digest.Sum(nil))
}

// projectInputEntryIsLink reports whether the entry at location, of mode, is a
// link: a symbolic link, or on Windows a junction, which Go reports as
// irregular while the launcher's Node reads it as a symbolic link with the same
// target. The launcher fingerprints the initial inputs and the host checks
// them, so both have to read a junction alike, or every input that is or holds
// one looks changed from the start.
func projectInputEntryIsLink(location string, mode os.FileMode) bool {
  if mode&os.ModeSymlink != 0 {
    return true
  }
  if runtime.GOOS != "windows" || mode&os.ModeIrregular == 0 {
    return false
  }
  _, err := os.Readlink(location)
  return err == nil
}

func realProjectInputPath(location string) string {
  absolute, err := filepath.Abs(projectInputFilesystemPath(location))
  if err != nil {
    return filepath.Clean(filepath.FromSlash(location))
  }
  probe := absolute
  suffix := []string{}
  for {
    resolved, err := physicalProjectInputPath(probe)
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

func matchProjectInputGlob(
  pattern []string,
  candidate []string,
  candidateCaseSensitive []bool,
) bool {
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
      sensitive :=
        candidateIndex >= len(candidateCaseSensitive) ||
          candidateCaseSensitive[candidateIndex]
      matched = matchProjectInputGlobSegment(
        pattern[patternIndex],
        candidate[candidateIndex],
        sensitive,
      ) && visit(patternIndex+1, candidateIndex+1)
    }
    memo[key] = matched
    return matched
  }
  return visit(0, 0)
}

func matchProjectInputGlobSegment(
  pattern string,
  candidate string,
  caseSensitive bool,
) bool {
  if !caseSensitive {
    pattern = strings.ToLower(pattern)
    candidate = strings.ToLower(candidate)
  }
  expression := []rune(pattern)
  input := []rune(candidate)
  // Only the previous row and the current row's left cell are dependencies.
  // Reuse one row, retaining the overwritten diagonal for literals and '?'.
  matches := make([]bool, len(input)+1)
  matches[0] = true
  for _, char := range expression {
    diagonal := matches[0]
    matches[0] = char == '*' && matches[0]
    for inputIndex := range input {
      previous := matches[inputIndex+1]
      switch char {
      case '*':
        matches[inputIndex+1] = previous || matches[inputIndex]
      case '?':
        matches[inputIndex+1] = diagonal
      default:
        matches[inputIndex+1] = char == input[inputIndex] && diagonal
      }
      diagonal = previous
    }
  }
  return matches[len(input)]
}
