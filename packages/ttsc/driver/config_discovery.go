package driver

import (
  "os"
  "path/filepath"
)

// ConfigDiscovery is the result of one upward config-file search: what it
// found, and what it looked at on the way.
//
// @evidence contracts/common.md#principled-implementation Matches and rejected probes are distinct, so absence can supersede a selected config without pretending to be its contents.
// @evidence contracts/common.md#clear-and-simple-design One search result carries stopping directory, ordered matches and rejected candidates; ambiguity policy stays with the plugin caller.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Candidate state is observed, not reconstructed from a plugin name or known project layout.
// @evidence contracts/common.md#meaningful-documentation Native member paragraphs explain ordering, ambiguity and negative observations under documentation-skill guidance.
// @evidence contracts/portability.md#os-neutral-implementation Paths retain native spellings; the result does not infer case policy or physical identity from the OS name.
type ConfigDiscovery struct {
  // Directory is the directory the search stopped in, empty when nothing
  // matched anywhere up to the filesystem root.
  Directory string

  // Matches are the config files present in Directory, in the caller's name
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
  // A rejected candidate is usually absent, but a directory carrying a config
  // file's name is rejected too, and the two are not the same observation: the
  // host-input contract records an existing directory by its directory-kind
  // digest and its physical path, so that replacing it with a file invalidates
  // the generation. Reporting one as absent instead makes every consumer's
  // check disagree with its own filesystem forever.
  Probed []ConfigCandidate
}

// ConfigCandidate is one path a config search rejected, and what it found
// there.
//
// @evidence contracts/common.md#principled-implementation A path and observed directory discriminator distinguish an absent candidate from a directory occupying its name.
// @evidence contracts/common.md#clear-and-simple-design The value records only the discovery facts consumed by rejected-input reporting.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Directory state is supplied by a filesystem observation, not a filename heuristic.
// @evidence contracts/common.md#meaningful-documentation Native member comments describe the directory flag and absolute path following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Native paths and directory status remain separate; no separator or case capability is encoded as an OS guess.
type ConfigCandidate struct {
  // Directory reports that the path exists and is a directory.
  Directory bool

  // Path is the candidate's absolute location.
  Path string
}

// DiscoverConfigFile walks upward from base looking for any of names in each
// directory, stopping at the first directory that contains at least one.
//
// The walk is the one every first-party utility plugin runs for its
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
// Each candidate is reported in the state it was found in, because the
// host-input contract distinguishes them. An absent path takes the paired nil
// hash and nil realpath, which records the absence as observed state rather
// than as an unknown and is what lets a persistent adapter keep its narrow
// reuse instead of declining it. A directory takes the directory-kind digest
// and its own physical path, the same shape the compiler's own resolution
// probes record, so that replacing it with a real config file invalidates the
// generation. Reporting a directory as absent instead leaves every consumer
// comparing nil against a digest its filesystem keeps producing, and the
// generation is refused on every delivery for the rest of its life.
//
// Takes the two reporters rather than a PluginContext so a plugin that already
// threads them through its config loader can call it there, which is where the
// discovery result lives.
//
// @evidence contracts/common.md#principled-implementation Missing candidates report nil observations; directories report the kind digest and a resolved physical target only when available.
// @evidence contracts/common.md#clear-and-simple-design Two callbacks receive the search's already observed states without requiring a whole plugin context.
// @evidence contracts/common.md#prohibited-implementation-shortcuts An unresolved directory target is omitted rather than falsely reported as observed missing.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain nil-versus-unknown state, invalidation and callback ownership under documentation-skill guidance.
// @evidence contracts/portability.md#os-neutral-implementation filepath.Abs, EvalSymlinks and Clean obtain physical directory identity; failed native resolution leaves that observation unavailable.
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
        if physical, err := filepath.EvalSymlinks(resolved); err == nil {
          cleaned := filepath.Clean(physical)
          realpath = &cleaned
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
