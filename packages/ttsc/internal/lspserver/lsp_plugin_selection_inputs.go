package lspserver

import (
  "fmt"
  "os"
  "path/filepath"
  "runtime"
  "strings"
)

// NativePluginSelectionInputs carries the launcher-declared selection baseline
// in the plugin manifest. Host comparisons of reported changes can request a
// restart; the value itself neither observes changes nor authenticates capture.
//
// Both kinds of input travel by directory, each directory with the names of
// the files in it and the digest each had (projectInputReloadFileDigest). A
// descriptor can include missing resolution candidates, while source entries
// describe selected file populations. Normalization resolves directories per
// lane group rather than each filename; a directory occurring in both lanes
// can be queried again. A source directory's listing is an input as
// well, counted by the build's own rule, which the launcher hands over as data
// rather than the host keeping a copy of it.
//
// @evidence contracts/common.md#principled-implementation Directory-grouped filename/digest maps distinguish recorded descriptor candidates from source populations whose listing also affects selection.
// @evidence contracts/common.md#clear-and-simple-design Build-owned omission and pruning rules travel as data rather than duplicated host build policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Launcher-observed inputs and source rules supply the baseline instead of a fixed package-specific list. The wire shape does not prove producer completeness or capture freshness; host normalization and comparisons own its admission.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain directory grouping, missing candidates and listing ownership, with separated member prose under the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation The host validates absolute local directories and recorded file-entry names (rejecting separators, NUL and dot-parent entries), then attempts native directory identity with lexical/unknown-case fallback. Policy-name lists remain literal entry filters; protocol URLs are not used as native paths. Supplied hash syntax and sequential comparisons are not an atomic filesystem capture.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
type NativePluginSelectionInputs struct {
  // DescriptorFiles maps every directory holding a file the plugin load read
  // or probed to the name of each such file, with its digest: the project's
  // config chain, the manifests plugin discovery reads, the descriptors, and
  // what they resolved. Only those files count; the rest of the directory is
  // not an input.
  DescriptorFiles map[string]map[string]string `json:"descriptorFiles,omitempty"`

  // SourceFiles maps every plugin source directory to the name of every file
  // directly inside it that the build keys on, with its digest. A directory
  // with no such file is present with an empty map.
  SourceFiles map[string]map[string]string `json:"sourceFiles,omitempty"`

  // OmittedNames are the names of files the build never keys on.
  OmittedNames []string `json:"omittedNames,omitempty"`

  // OmittedSuffixes are the suffixes of files the build never keys on.
  OmittedSuffixes []string `json:"omittedSuffixes,omitempty"`

  // PrunedDirectoryNames are the names of directories the build passes over.
  PrunedDirectoryNames []string `json:"prunedDirectoryNames,omitempty"`
}

// pluginSelectionInputs groups accepted entries by attempted directory identity;
// repeated lane groups can perform native queries before sharing the record.
type pluginSelectionInputs struct {
  directories     map[string]*pluginSelectionDirectory
  omittedNames    []string
  omittedSuffixes []string
  prunedNames     []string
}

type pluginSelectionDirectory struct {
  path string

  // files are the recorded digests by name.
  files map[string]string

  // listing marks a plugin source directory, whose entries are an input by
  // the build's rule, beside the recorded files.
  listing bool
}

// newPluginSelectionInputs resolves inputs. A directory named by both kinds
// holds the files of both and is a source directory.
func newPluginSelectionInputs(
  inputs NativePluginSelectionInputs,
) (pluginSelectionInputs, error) {
  out := pluginSelectionInputs{
    directories:     map[string]*pluginSelectionDirectory{},
    omittedNames:    append([]string(nil), inputs.OmittedNames...),
    omittedSuffixes: append([]string(nil), inputs.OmittedSuffixes...),
    prunedNames:     append([]string(nil), inputs.PrunedDirectoryNames...),
  }
  add := func(lane map[string]map[string]string, listing bool) error {
    for directory, files := range lane {
      if strings.TrimSpace(directory) == "" ||
        !isAbsoluteLocalLSPProjectInputPath(directory, runtime.GOOS) {
        return fmt.Errorf(
          "plugin selection directory %q is not an absolute local path",
          directory,
        )
      }
      resolved := realProjectInputPath(directory)
      key := projectInputPathKey(resolved)
      entry := out.directories[key]
      if entry == nil {
        entry = &pluginSelectionDirectory{
          path:  resolved,
          files: map[string]string{},
        }
        out.directories[key] = entry
      }
      entry.listing = entry.listing || listing
      for name, digest := range files {
        if name == "" || name == "." || name == ".." || strings.ContainsAny(name, "/\\\x00") {
          return fmt.Errorf(
            "plugin selection file %q in %q is not a file name",
            name,
            directory,
          )
        }
        if !validProjectInputFingerprint(digest) {
          return fmt.Errorf(
            "plugin selection file %q in %q has an invalid fingerprint",
            name,
            directory,
          )
        }
        entry.files[name] = digest
      }
    }
    return nil
  }
  if err := add(inputs.DescriptorFiles, false); err != nil {
    return pluginSelectionInputs{}, err
  }
  if err := add(inputs.SourceFiles, true); err != nil {
    return pluginSelectionInputs{}, err
  }
  return out, nil
}

// watchDirectories are the directories whose entries an observer of the
// selection has to hear.
func (inputs pluginSelectionInputs) watchDirectories() []string {
  out := make([]string, 0, len(inputs.directories))
  for _, directory := range inputs.directories {
    out = append(out, directory.path)
  }
  return out
}

// current reports whether every directory still holds what the selection was
// loaded from.
func (inputs pluginSelectionInputs) current() bool {
  for _, directory := range inputs.directories {
    if !inputs.directoryCurrent(directory) {
      return false
    }
  }
  return true
}

// matchesChange reports whether a change to location changes the selection:
// whether a directory it can affect no longer holds what the selection was
// loaded from. A change affects the directory holding location, and every
// directory at or below location, which a client may report as one change
// when a tree appears or disappears at once.
func (inputs pluginSelectionInputs) matchesChange(location string) bool {
  if len(inputs.directories) == 0 {
    return false
  }
  native := projectInputFilesystemPath(location)
  changed := projectInputPathKey(realProjectInputPath(native))
  parent := projectInputPathKey(realProjectInputPath(filepath.Dir(native)))
  within := strings.TrimRight(changed, "/") + "/"
  for key, directory := range inputs.directories {
    if key != parent && key != changed && !strings.HasPrefix(key, within) {
      continue
    }
    if !inputs.directoryCurrent(directory) {
      return true
    }
  }
  return false
}

// directoryCurrent reports whether directory holds what the selection was
// loaded from: every recorded file with its digest, a missing one still
// missing, and for a source directory, by the build's rule, no other file the
// build keys on and no subdirectory the build would read that was not a
// source directory then.
func (inputs pluginSelectionInputs) directoryCurrent(
  directory *pluginSelectionDirectory,
) bool {
  for name, digest := range directory.files {
    if projectInputReloadFileDigest(filepath.Join(directory.path, name)) !=
      digest {
      return false
    }
  }
  if !directory.listing {
    return true
  }
  entries, err := os.ReadDir(directory.path)
  if err != nil {
    return false
  }
  for _, entry := range entries {
    name := entry.Name()
    link := projectInputEntryIsLink(
      filepath.Join(directory.path, name),
      entry.Type(),
    )
    // A directory, or a link standing where one would, that the build
    // passes over, as its own walk skips it.
    if (entry.IsDir() || link) && inputs.pruned(name) {
      continue
    }
    if entry.IsDir() {
      if !inputs.knownSource(filepath.Join(directory.path, name)) {
        return false
      }
      continue
    }
    if inputs.omitted(name) {
      continue
    }
    // Any other link is one the build refuses, which a new selection has to
    // report; any other irregular entry is none the build reads.
    if link {
      return false
    }
    if !entry.Type().IsRegular() {
      continue
    }
    if !directory.has(name) {
      return false
    }
  }
  return true
}

// knownSource reports whether location is one of the source directories.
func (inputs pluginSelectionInputs) knownSource(location string) bool {
  directory, ok := inputs.directories[projectInputPathKey(
    realProjectInputPath(location),
  )]
  return ok && directory.listing
}

func (inputs pluginSelectionInputs) omitted(name string) bool {
  for _, omitted := range inputs.omittedNames {
    if name == omitted {
      return true
    }
  }
  for _, suffix := range inputs.omittedSuffixes {
    if strings.HasSuffix(name, suffix) {
      return true
    }
  }
  return false
}

func (inputs pluginSelectionInputs) pruned(name string) bool {
  for _, pruned := range inputs.prunedNames {
    if name == pruned {
      return true
    }
  }
  return false
}

// has reports whether a file is recorded under the name a listing spells, by
// the case semantics of the directory itself (projectInputPathKey): a Windows
// directory opted into case sensitivity, or a case-sensitive macOS volume,
// holds Foo.go and foo.go as two files, and folding by platform alone would take
// a new foo.go for the recorded Foo.go.
func (directory *pluginSelectionDirectory) has(name string) bool {
  if _, ok := directory.files[name]; ok {
    return true
  }
  key := projectInputPathKey(filepath.Join(directory.path, name))
  for candidate := range directory.files {
    if projectInputPathKey(filepath.Join(directory.path, candidate)) == key {
      return true
    }
  }
  return false
}
