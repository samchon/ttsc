package lspserver

import (
  "fmt"
  "os"
  "path/filepath"
  "runtime"
  "strings"
)

// NativePluginSelectionInputs is what a session's plugin selection was loaded
// from, as the launcher writes it into the plugin manifest: a change to any of
// it ends the session like a plugin's own reload input, so the editor starts
// one that loads the current plugins (samchon/ttsc#1507).
//
// Both kinds of input travel by directory, each directory with the names of
// the files in it and the digest each had (projectInputReloadFileDigest). A
// descriptor's inputs are mostly resolution candidates that do not exist, a
// thousand of them across a few dozen directories, and a plugin's Go sources
// can be thousands of files; the host resolves the identity of a directory
// once rather than of every file. A source directory's listing is an input as
// well, counted by the build's own rule, which the launcher hands over as data
// rather than the host keeping a copy of it.
type NativePluginSelectionInputs struct {
  // DescriptorFiles maps every directory holding a file the descriptors'
  // load read or probed to the name of each such file, with its digest. Only
  // those files count; the rest of the directory is not an input.
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

// pluginSelectionInputs is the selection inputs with each directory resolved
// to its identity once.
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
        if name == "" || strings.ContainsAny(name, `/\`) {
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

// has reports whether a file is recorded under the name a listing spells,
// folding case where the platform's filesystems conventionally do.
func (directory *pluginSelectionDirectory) has(name string) bool {
  if _, ok := directory.files[name]; ok {
    return true
  }
  if runtime.GOOS != "windows" && runtime.GOOS != "darwin" {
    return false
  }
  for candidate := range directory.files {
    if strings.EqualFold(candidate, name) {
      return true
    }
  }
  return false
}
