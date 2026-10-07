package driver

import (
  "os"
  "path/filepath"

  "github.com/microsoft/typescript-go/shim/vfs/osvfs"
)

// ConfigDiscovery is the result of one upward config-file search: what it
// found, and what it looked at on the way.
//
// @evidence contracts/common.md#principled-implementation Matches and rejected probes are distinct; rejected path and directory classifications identify candidates to validate later without claiming their contents or independently verified absence.
// @evidence contracts/common.md#clear-and-simple-design One search result carries stopping directory, ordered matches and rejected candidates; ambiguity policy stays with the plugin caller.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Candidate state is observed, not reconstructed from a plugin name or known project layout.
// @evidence contracts/common.md#meaningful-documentation Native member paragraphs explain ordering, ambiguity and negative observations under documentation-skill guidance.
// @evidence contracts/portability.md#os-neutral-implementation Paths retain native spellings; the result does not infer case policy or physical identity from the OS name.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
type ConfigDiscovery struct {
  // Directory is the directory the search stopped in, empty when nothing
  // matched anywhere up to the filesystem root.
  Directory string

  // Matches are the non-directory candidates statted successfully in Directory, in the caller's name
  // order. More than one is the ambiguity each plugin reports in its own
  // words; none means the search reached the root.
  Matches []string

  // Probed are the candidates the search examined and rejected, in every
  // directory it visited up to and including Directory.
  //
  // These are the paths that can supersede the result: a file created at any
  // of them either wins the search outright, because it sits nearer the entry
  // than the match, or makes the matching directory ambiguous. A persistent
  // consumer that never hears about them keeps serving output built from a
  // config a cold run would no longer choose, which is why a plugin reports
  // them as host inputs rather than dropping them.
  //
  // Rejected candidates include successfully observed directories and all stat
  // failures, whose individual reasons are not retained here. Reporting uses a
  // directory-kind digest for the former and a physical path only when later
  // resolution succeeds; the latter use the protocol's observed-missing class.
  // A consumer owns later validation and can reject reuse when these reported
  // states conflict with what its own filesystem observes.
  Probed []ConfigCandidate
}

// ConfigCandidate is one path a config search rejected and its directory
// classification. Stat failures and other non-matches share the false class;
// the value carries no error reason or independently verified absence receipt.
//
// @evidence contracts/common.md#principled-implementation A path and directory discriminator distinguish a successfully observed directory from the search's other rejected candidates; false does not certify physical absence.
// @evidence contracts/common.md#clear-and-simple-design The value records only the discovery facts consumed by rejected-input reporting.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Directory state is supplied by a filesystem observation, not a filename heuristic.
// @evidence contracts/common.md#meaningful-documentation Native member comments describe the directory flag and absolute path following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Native paths and directory status remain separate; no separator or case capability is encoded as an OS guess.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
type ConfigCandidate struct {
  // Directory reports that the path exists and is a directory.
  Directory bool

  // Path is the candidate spelling, absolute when discovery's caller supplies
  // the documented absolute base and config filename inputs.
  Path string
}

// DiscoverConfigFile walks upward from base looking for any of names in each
// directory, stopping at the first directory that contains at least one.
//
// Banner and strip use this shared walk for their
// `<plugin>.config.*` file. It is shared here so the set of superseding
// candidates is derived by the same rule everywhere, since that set is the part
// a consumer needs and the part each plugin was most likely to leave out.
// Pass an absolute base so returned candidates have the host's absolute form.
//
// @evidence contracts/common.md#principled-implementation Every supplied name is statted before stopping at the nearest matching ancestor, preserving ambiguity and superseding negative candidates.
// @evidence contracts/common.md#clear-and-simple-design One upward walk owns discovery while callers decide how multiple matches become plugin diagnostics.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Names are caller policy; the search has no repository-specific branch or fabricated missing-file result.
// @evidence contracts/common.md#meaningful-documentation Native prose states search stopping, shared observation ownership and the absolute-base precondition under documentation-skill guidance.
// @evidence contracts/portability.md#os-neutral-implementation filepath.Join and Dir handle native ancestry and root termination; os.Stat obtains actual directory state without an OS case guess.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Native stat owns its temporary resources; the function keeps no handles or historical search state. Candidate slices and path strings are transferred to the caller, whose lifetime is not controlled here.
// @evidence contracts/performance.md#efficient-algorithms Each visited directory probes every supplied name before deciding whether to stop: O(depth x names) native stat calls plus candidate-path construction and retained rejected-path bytes. This preserves same-directory ambiguity and nearer rejected candidates without enumerating directory contents.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation owns no cross-search cache or coordinator; it returns observed candidate states, while callers own later validation and any repeated native observations.
func DiscoverConfigFile(base string, names []string) ConfigDiscovery {
  out := ConfigDiscovery{}
  directory := base
  for {
    matches := make([]string, 0, 1)
    probed := make([]ConfigCandidate, 0, len(names))
    for _, name := range names {
      candidate := filepath.Join(directory, name)
      stat, err := os.Stat(candidate)
      switch {
      case err == nil && !stat.IsDir():
        matches = append(matches, candidate)
      case err == nil:
        probed = append(probed, ConfigCandidate{Directory: true, Path: candidate})
      default:
        // Any stat failure (absent, permission-denied, not-a-directory
        // ancestor) is reported as absent: the compiler's own filesystem
        // exposes existence as a boolean, so its observer records the same
        // state for the same path and the two proofs agree.
        probed = append(probed, ConfigCandidate{Path: candidate})
      }
    }
    out.Probed = append(out.Probed, probed...)
    if len(matches) != 0 {
      out.Directory = directory
      out.Matches = matches
      return out
    }
    parent := filepath.Dir(directory)
    if parent == directory {
      return out
    }
    directory = parent
  }
}

// ReportRejectedConfigCandidates declares every candidate a config search
// rejected, so a consumer invalidates when one of them becomes the answer.
//
// A candidate not classified as a directory reports nil hash and nil realpath
// as the protocol's observed-missing state. Discovery also uses this class for
// stat failures; reporting does not independently verify physical absence.
// A directory reports the directory-kind digest and a physical path only when
// Abs and EvalSymlinks succeed. Failure to resolve that path leaves its realpath
// report unavailable. Later consumers own validation against their filesystem;
// a conflicting directory-versus-missing observation prevents that reuse while
// the mismatch remains, rather than being treated as an unknown observation.
//
// Takes the two reporters rather than a PluginContext so a plugin that already
// threads them through its config loader can call it there, which is where the
// discovery result lives.
//
// @evidence contracts/common.md#principled-implementation Missing candidates report nil observations; directories report the kind digest and a resolved physical target only when available.
// @evidence contracts/common.md#clear-and-simple-design Two callbacks receive the search's already observed states without requiring a whole plugin context.
// @evidence contracts/common.md#prohibited-implementation-shortcuts An unresolved directory target is omitted rather than falsely reported as observed missing.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain nil-versus-unknown state, invalidation and callback ownership under documentation-skill guidance.
// @evidence contracts/portability.md#os-neutral-implementation The compiler's OS filesystem resolves native physical names, including Windows junctions and short names. Directory Stat identities bracket that resolution; missing, replaced or non-directory targets leave the realpath observation unavailable.
// @evidence contracts/performance.md#bound-retention-and-release-resources Digest and resolved-path pointers are passed to caller-owned reporters, which may copy or retain them. This function retains no historical state or native handle; native resolution owns its temporary resources and reporter-owned retained bytes have no bound enforced here.
// @evidence contracts/performance.md#efficient-algorithms One pass processes all candidates; directory candidates add native absolute-path and symlink-resolution work driven by path length and link components. Each supplied reporter is called at most once per applicable candidate, with its own processing and retention costs.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This function coordinates no repeated requests or cache; it transfers each applicable observation to the supplied reporters, whose validation and sharing policies remain separate.
func ReportRejectedConfigCandidates(candidates []ConfigCandidate, hashReporter, realpathReporter func(string, *string)) {
  for _, candidate := range candidates {
    var hash *string
    var realpath *string
    if candidate.Directory {
      digest := observedDirectoryDigest
      hash = &digest
      if resolved, err := filepath.Abs(candidate.Path); err == nil {
        // Abs and Clean preserve aliases (Windows 8.3 names, symlinks, and
        // junctions). The descriptor-side observer reports a physical path, so
        // publishing the lexical spelling here would make the two proofs
        // conflict and leave every persistent consumer unable to reuse.
        before, beforeErr := os.Stat(resolved)
        if beforeErr == nil && before.IsDir() {
          physical := osvfs.FS().Realpath(resolved)
          // Realpath returns its argument if the native resolver fails. An
          // unchanged spelling is proof only when no component is an alias or
          // unknown reparse entry; SameFile alone cannot prove its spelling.
          spellingKnown := true
          if physical == resolved {
            for component := resolved; ; component = filepath.Dir(component) {
              entry, err := os.Lstat(component)
              if err != nil || !entry.IsDir() || entry.Mode()&(os.ModeSymlink|os.ModeIrregular) != 0 {
                spellingKnown = false
                break
              }
              if filepath.Dir(component) == component {
                break
              }
            }
          }
          target, targetErr := os.Stat(physical)
          after, afterErr := os.Stat(resolved)
          if spellingKnown && filepath.IsAbs(physical) && targetErr == nil && afterErr == nil &&
            target.IsDir() && after.IsDir() && os.SameFile(before, target) && os.SameFile(before, after) {
            cleaned := filepath.Clean(physical)
            realpath = &cleaned
          }
        }
      }
    }
    if hashReporter != nil {
      hashReporter(candidate.Path, hash)
    }
    // A nil report is the explicit observed-missing state, not an unknown
    // proof. Only absent candidates may publish it; a directory whose physical
    // identity could not be resolved must leave the realpath observation out.
    if realpathReporter != nil && (!candidate.Directory || realpath != nil) {
      realpathReporter(candidate.Path, realpath)
    }
  }
}
