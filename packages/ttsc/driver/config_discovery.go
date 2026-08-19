package driver

import (
  "os"
  "path/filepath"
)

// ConfigDiscovery is the result of one upward config-file search: what it
// found, and what it looked at on the way.
type ConfigDiscovery struct {
  // Directory is the directory the search stopped in, empty when nothing
  // matched anywhere up to the filesystem root.
  Directory string
  // Matches are the config files present in Directory, in the caller's name
  // order. More than one is the ambiguity each plugin reports in its own
  // words; none means the search reached the root.
  Matches []string
  // Probed are the candidates the search examined and did not find, in every
  // directory it visited up to and including Directory.
  //
  // These are the paths that can supersede the result: a file created at any
  // of them either wins the search outright, because it sits nearer the entry
  // than the match, or makes the matching directory ambiguous. A persistent
  // consumer that never hears about them keeps serving output built from a
  // config a cold run would no longer choose, which is why a plugin reports
  // them as missing host inputs rather than dropping them.
  Probed []string
}

// DiscoverConfigFile walks upward from base looking for any of names in each
// directory, stopping at the first directory that contains at least one.
//
// The walk is the one every first-party utility plugin runs for its
// `<plugin>.config.*` file. It is shared here so the set of superseding
// candidates is derived by the same rule everywhere, since that set is the part
// a consumer needs and the part each plugin was most likely to leave out.
func DiscoverConfigFile(base string, names []string) ConfigDiscovery {
  out := ConfigDiscovery{}
  directory := base
  for {
    matches := make([]string, 0, 1)
    probed := make([]string, 0, len(names))
    for _, name := range names {
      candidate := filepath.Join(directory, name)
      if stat, err := os.Stat(candidate); err == nil && !stat.IsDir() {
        matches = append(matches, candidate)
        continue
      }
      probed = append(probed, candidate)
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

// ReportMissingConfigCandidates declares every candidate a config search
// rejected, so a consumer invalidates when one of them appears.
//
// A missing candidate is reported with the paired nil hash and nil realpath the
// host-input contract defines for a probe that found nothing: that records the
// absence as observed state rather than as an unknown, which is what lets a
// persistent adapter keep its narrow reuse instead of declining it. Reporting
// the path alone would do the opposite.
//
// Takes the two reporters rather than a PluginContext so a plugin that already
// threads them through its config loader can call it there, which is where the
// discovery result lives.
func ReportMissingConfigCandidates(candidates []string, hashReporter, realpathReporter func(string, *string)) {
  for _, candidate := range candidates {
    if hashReporter != nil {
      hashReporter(candidate, nil)
    }
    if realpathReporter != nil {
      realpathReporter(candidate, nil)
    }
  }
}
