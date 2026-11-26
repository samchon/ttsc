package configloaderscratch

import (
  "os"
  "path/filepath"
  "strings"
)

// IdentityTempBase selects the existing identities directory in the current
// invocation's record store when Windows TEMP is on another drive or TEMP
// contains the config directory. The directory must be an ordinary direct child
// on the config's lexical drive when one exists, and it cannot contain the config
// directory. Scratch changes only the existing identities directory's entries, even when that
// directory is below the config directory. An empty result preserves the
// loader's existing placement.
//
// @evidence contracts/common.md#principled-implementation The selected record store already owns its identities child before plugin evaluation; resolved directory identities, child metadata, Windows lexical drive comparison, and ancestry checks ensure identities is not the config directory or its ancestor. Scratch changes only identities entries, not the config directory's direct entries or metadata.
// @evidence contracts/common.md#clear-and-simple-design This selector only chooses an optional base; each loader retains its own historical TEMP fallback and creation/cleanup lifetime.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The caller supplies its selected store root, and each path premise is checked on disk rather than inferred from a package or operating-system name.
// @evidence contracts/common.md#meaningful-documentation The comment states the store's ownership, required directory relationship, and empty-result meaning.
// @evidence contracts/portability.md#os-neutral-implementation IsAbs accepts POSIX absolute paths despite their empty VolumeName; EvalSymlinks and SameFile resolve POSIX links and case aliases. On Windows, VolumeName keeps TypeScript-Go drive spelling and opened directory handles resolve junctions. Unavailable directories fail closed; no URL form or process argument is used.
// @evidence contracts/performance.md#efficient-algorithms Windows uses at most four directory opens and constant path operations; POSIX compares directory identities along at most two bounded ancestor walks. Neither scans directory contents or source bytes.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The store and its links may change between config loads, so each call observes current metadata.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Metadata operations close within their calls; this selector retains no handle, directory, or task, while its caller owns temporary creation and removal.
func IdentityTempBase(location, systemTemp, recordRoot string) string {
  if recordRoot == "" || !filepath.IsAbs(recordRoot) {
    return ""
  }
  if !filepath.IsAbs(location) {
    return ""
  }
  volume := filepath.VolumeName(location)
  configDir := filepath.Dir(location)
  physicalConfigDir, err := canonicalDirectory(configDir)
  if err != nil {
    return ""
  }
  if strings.EqualFold(filepath.VolumeName(systemTemp), volume) {
    lexicalContains := false
    if volume != "" {
      lexicalContains, err = containsDirectory(systemTemp, configDir)
      if err != nil {
        return ""
      }
    }
    if !lexicalContains {
      physicalTemp, err := canonicalDirectory(systemTemp)
      if err != nil {
        return ""
      }
      physicalContains, err := containsDirectory(physicalTemp, physicalConfigDir)
      if err != nil || !physicalContains {
        return ""
      }
    }
  }
  physicalRoot, err := canonicalDirectory(recordRoot)
  if err != nil {
    return ""
  }
  identity := filepath.Join(recordRoot, "identities")
  entry, err := os.Lstat(identity)
  if err != nil || !entry.IsDir() || entry.Mode()&os.ModeSymlink != 0 {
    return ""
  }
  if _, err := os.Readlink(identity); err == nil {
    return ""
  }
  physicalIdentity, err := canonicalDirectory(identity)
  if err != nil || filepath.Dir(physicalIdentity) != physicalRoot ||
    !strings.EqualFold(filepath.VolumeName(physicalIdentity), volume) {
    return ""
  }
  if strings.EqualFold(filepath.VolumeName(physicalIdentity), filepath.VolumeName(physicalConfigDir)) {
    contained, err := containsDirectory(physicalIdentity, physicalConfigDir)
    if err != nil || contained {
      return ""
    }
  }
  return physicalIdentity
}

// SystemTempBase returns an existing same-volume temp directory outside the
// config directory and any enclosing worktree or pnpm workspace. An empty
// result leaves selection to the caller and authorizes no write.
//
// @evidence contracts/common.md#principled-implementation Resolved config and temporary directory identities are compared on the required compiler volume and against concrete ancestry markers before allocation.
// @evidence contracts/common.md#clear-and-simple-design The selector only checks a candidate; callers retain fallback order and own actual allocation and cleanup.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No directory is created to make an unavailable TEMP usable.
// @evidence contracts/common.md#meaningful-documentation The prose states the volume, protected project roots and empty result.
// @evidence contracts/portability.md#os-neutral-implementation Native canonicalDirectory and containsDirectory use real native aliases, while filepath supplies volume and parent semantics.
// @evidence contracts/performance.md#efficient-algorithms Two directory identity observations precede one ancestor walk and its marker probes.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Each request checks live filesystem topology.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The read-only selector retains no file, handle or state.
func SystemTempBase(location, systemTemp string) string {
  base := PrivateTempBase(location, systemTemp)
  if base == "" {
    return ""
  }
  absolute, err := filepath.Abs(location)
  if err != nil || !strings.EqualFold(filepath.VolumeName(base), filepath.VolumeName(absolute)) {
    return ""
  }
  return base
}

// PrivateTempBase checks an existing temporary directory for optional state
// that need not share the compiler's volume.
//
// @evidence contracts/common.md#principled-implementation The temporary directory and each protected directory resolve to native paths before containment is tested.
// @evidence contracts/common.md#clear-and-simple-design Scratch selection adds its compiler-volume restriction separately to the same read-only containment check.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Missing or unusable TEMP cannot be created by optional cache writers using this policy.
// @evidence contracts/common.md#meaningful-documentation The comment identifies the optional state and its volume independence.
// @evidence contracts/portability.md#os-neutral-implementation Native canonical paths support junction and symlink identities, and different Windows volumes cannot contain one another.
// @evidence contracts/performance.md#efficient-algorithms One candidate check and one existing ancestry walk visit no directory payload.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call observes current pathname ownership.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The read-only selector acquires no retained state.
func PrivateTempBase(location, systemTemp string) string {
  absolute, err := filepath.Abs(location)
  if err != nil || !filepath.IsAbs(systemTemp) {
    return ""
  }
  config, err := canonicalDirectory(filepath.Dir(absolute))
  if err != nil {
    return ""
  }
  base, err := canonicalDirectory(systemTemp)
  if err != nil {
    return ""
  }
  entry, err := os.Stat(base)
  if err != nil || !entry.IsDir() {
    return ""
  }
  if !strings.EqualFold(filepath.VolumeName(base), filepath.VolumeName(config)) {
    return base
  }
  for directory := config; ; directory = filepath.Dir(directory) {
    _, git := os.Lstat(filepath.Join(directory, ".git"))
    _, workspace := os.Lstat(filepath.Join(directory, "pnpm-workspace.yaml"))
    if directory == config || git == nil || workspace == nil {
      inside, err := containsDirectory(directory, base)
      if err != nil || inside {
        return ""
      }
    }
    if filepath.Dir(directory) == directory {
      return base
    }
  }
}

// CacheTempBase selects the physical node_modules cache on the config volume.
// Its destination is checked before allocation and aliases at .cache are
// refused. The caller owns the actual temporary child.
//
// @evidence contracts/common.md#principled-implementation The physical node_modules directory must have its own ignored installation name and the config volume before an ordinary cache child can be created.
// @evidence contracts/common.md#clear-and-simple-design Three config loaders share the path admission; their callers own nearest-installation discovery and scratch lifetime.
// @evidence contracts/common.md#prohibited-implementation-shortcuts A linked cache or absent installation yields no candidate, without falling back to a directory beside the config.
// @evidence contracts/common.md#meaningful-documentation The native comment identifies the selected root and child ownership.
// @evidence contracts/portability.md#os-neutral-implementation Native directory canonicalization observes NTFS junctions as well as POSIX aliases; filepath.VolumeName provides the compiler-volume constraint.
// @evidence contracts/performance.md#efficient-algorithms A bounded set of canonicalization, stat, link and mkdir calls checks one installation and its cache child without walking their payload.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Mutable path aliases are observed separately on each call.
// @evidence contracts/performance.md#bound-retention-and-release-resources The ordinary cache directory may remain, while actual scratch allocations belong to the caller.
func CacheTempBase(location, nodeModules string) string {
  if nodeModules == "" {
    return ""
  }
  modules, err := canonicalDirectory(nodeModules)
  if err != nil || filepath.Base(modules) != "node_modules" ||
    !strings.EqualFold(filepath.VolumeName(modules), filepath.VolumeName(location)) {
    return ""
  }
  cache := filepath.Join(modules, ".cache")
  if err := os.Mkdir(cache, 0o755); err != nil && !os.IsExist(err) {
    return ""
  }
  entry, err := os.Lstat(cache)
  if err != nil || !entry.IsDir() || entry.Mode()&os.ModeSymlink != 0 {
    return ""
  }
  physical, err := canonicalDirectory(cache)
  if err != nil || physical != cache {
    return ""
  }
  return physical
}
