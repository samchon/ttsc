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
