package lspserver

import (
  "encoding/base64"
  "fmt"
  "os"
  "runtime"
  "unicode/utf8"
)

// NativePluginWorkspaceFile carries one launcher-observed metadata baseline.
// The base64 path can name an undecodable POSIX entry or retain meaningful
// lexical parent components. An absent mode denotes an unavailable observation.
//
// @evidence contracts/common.md#principled-implementation The wire value supplies exact path bytes, the operation kind and its observed metadata.
// @evidence contracts/common.md#clear-and-simple-design A separate metadata lane avoids reading SDK contents through the descriptor digest protocol.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Native polling compares the supplied baseline and does not replace it with a fresh baseline.
// @evidence contracts/common.md#meaningful-documentation Identifies the native path encoding and missing marker.
// @evidence contracts/portability.md#os-neutral-implementation Linux, macOS and Windows compare native file identity and change time. Other hosts compare their available portable facts and retain the observed Go file identity.
// @evidenceExclude contracts/performance.md#efficient-algorithms The wire shape chooses no computation.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The wire shape stores one session baseline.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The session owns the transported entries.
type NativePluginWorkspaceFile struct {
  Path     string  `json:"path"`
  Kind     string  `json:"kind"`
  Mode     *uint32 `json:"mode,omitempty"`
  Modified string  `json:"modified,omitempty"`
  Size     string  `json:"size,omitempty"`
  Changed  string  `json:"changed,omitempty"`
  Device   string  `json:"device,omitempty"`
  Inode    string  `json:"inode,omitempty"`
  Owner    string  `json:"owner,omitempty"`
  Group    string  `json:"group,omitempty"`
  Physical string  `json:"physical,omitempty"`
  Target   string  `json:"target,omitempty"`
}

type pluginWorkspaceFile struct {
  NativePluginWorkspaceFile
  location string
  physical string
  target   string
  initial  os.FileInfo
}

// Decode the exact absolute pathname without cleaning its parent components.
func newPluginWorkspaceFile(wire NativePluginWorkspaceFile) (pluginWorkspaceFile, error) {
  native, err := base64.StdEncoding.Strict().DecodeString(wire.Path)
  location := string(native)
  if err != nil || base64.StdEncoding.EncodeToString(native) != wire.Path ||
    !isAbsoluteLocalLSPProjectInputPath(location, runtime.GOOS) ||
    (runtime.GOOS == "windows" && !utf8.Valid(native)) {
    return pluginWorkspaceFile{}, fmt.Errorf("invalid workspace selection path %q", wire.Path)
  }
  if wire.Kind != "stat" && wire.Kind != "directory" && wire.Kind != "link" {
    return pluginWorkspaceFile{}, fmt.Errorf("invalid workspace selection kind %q", wire.Kind)
  }
  target, err := base64.StdEncoding.Strict().DecodeString(wire.Target)
  if err != nil || base64.StdEncoding.EncodeToString(target) != wire.Target ||
    (wire.Mode != nil && wire.Kind == "link" && len(target) == 0) ||
    (wire.Kind != "link" && wire.Target != "") {
    return pluginWorkspaceFile{}, fmt.Errorf("invalid workspace selection link for %q", wire.Path)
  }
  physical, err := base64.StdEncoding.Strict().DecodeString(wire.Physical)
  if err != nil || base64.StdEncoding.EncodeToString(physical) != wire.Physical ||
    (wire.Physical != "" && (wire.Kind != "directory" || wire.Mode == nil ||
      !isAbsoluteLocalLSPProjectInputPath(string(physical), runtime.GOOS) ||
      (runtime.GOOS == "windows" && !utf8.Valid(physical)))) {
    return pluginWorkspaceFile{}, fmt.Errorf("invalid workspace selection physical path for %q", wire.Path)
  }
  out := pluginWorkspaceFile{NativePluginWorkspaceFile: wire, location: location, physical: string(physical), target: string(target)}
  out.initial = initialWorkspaceFileIdentity(out)
  return out, nil
}
