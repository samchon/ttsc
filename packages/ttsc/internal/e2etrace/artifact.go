package e2etrace

import (
  "crypto/sha256"
  "fmt"
  "io"
  "os"
  "path/filepath"
  "strings"
  "time"
)

// Artifact retains a bounded actual file observation on an existing command
// invocation. A producer calls it after its unchanged successful build and
// before exposing the path to consumers; a use can call it before its original
// Cmd method. Native handle/path sameness and metadata bound the captured bytes,
// not reproducible build output, a subsequently loaded image or descendants.
// Observation failure never replaces the original command result.
//
// @evidence contracts/common.md#principled-implementation Actual file bytes, native handle/path sameness and before/after size/mode/mtime bind the retained capture to this command invocation; independently prepared assets and later real process outcomes remain coordinator requirements.
// @evidence contracts/common.md#clear-and-simple-design One observation method records file identity and delegates bounded payload retention to the private writer without invoking a Cmd method.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No expected hash, fake process, image-loading certificate or alternate executable is supplied; IO, identity and budget failures remain integrity failures and original product outcomes are unchanged.
// @evidence contracts/common.md#meaningful-documentation Native prose states producer/use ordering, bounded capture and the distinction between observed file bytes and a loaded image.
// @evidence contracts/portability.md#os-neutral-implementation Native EvalSymlinks/Open/Stat/SameFile observe the selected file without classifying paths by OS name; real-path and metadata disagreement are failures, not permission to substitute another file.
// @evidence contracts/performance.md#efficient-algorithms Disabled observations perform no filesystem IO. Enabled capture reads at most64MiB+1, hashes and writes accepted bytes once, scans the label and performs native path/metadata observations; temporary byte-buffer allocation follows Go ReadAll growth rather than a strict allocation cap.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Each caller chooses an actual invocation boundary; another invocation's file observation does not establish this one's identity or continued validity.
// @evidence contracts/performance.md#bound-retention-and-release-resources The native read handle closes before emission; payload writing opens/closes one exclusive file, charged to the existing256MiB writer budget with reserved failure space. Captures over64MiB or changing identity fail integrity. Retained payloads transfer to the coordinator; this observer owns no child or selected executable lifetime.
func (observation *Command) Artifact(path, label string) {
  defer func() { _ = recover() }()
  if observation == nil || os.Getenv("TTSC_E2E_TRACE") == "" {
    return
  }
  writer.Lock()
  enabled := !writer.failed && writer.root != "" && os.Getenv("TTSC_E2E_TRACE") == writer.root
  writer.Unlock()
  if !enabled {
    return
  }
  data := map[string]any{"owner": observation.owner, "requestedPath": path}
  defer func() {
    writeEvent("native-artifact", observation.invocation, os.Getpid(), observation.cmd.Args, observation.cmd.Dir, data)
  }()
  fail := func(err error) {
    data["outcome"] = "IO-failed"
    data["error"] = err.Error()
    writeEvent("integrity-failure", observation.invocation, os.Getpid(), nil, "", map[string]any{
      "operation": "native-artifact", "requestedPath": path, "error": err.Error(),
    })
  }
  if !filepath.IsAbs(path) {
    fail(fmt.Errorf("absolute artifact path required"))
    return
  }
  realPath, err := filepath.EvalSymlinks(path)
  if err != nil {
    fail(err)
    return
  }
  data["realPath"] = realPath
  file, err := os.Open(path)
  if err != nil {
    fail(err)
    return
  }
  closed := false
  defer func() {
    if !closed {
      _ = file.Close()
    }
  }()
  before, err := file.Stat()
  if err != nil || !before.Mode().IsRegular() || before.Size() > 64<<20 {
    closeErr := file.Close()
    closed = true
    fail(fmt.Errorf("artifact pre-read stat=%v close=%v; regular file within64MiB required", err, closeErr))
    return
  }
  body, readErr := io.ReadAll(io.LimitReader(file, (64<<20)+1))
  after, afterErr := file.Stat()
  pathAfter, pathErr := os.Stat(path)
  realAfter, realErr := filepath.EvalSymlinks(path)
  closeErr := file.Close()
  closed = true
  data["identityBefore"] = artifactIdentity(before)
  if readErr != nil || afterErr != nil || pathErr != nil || realErr != nil || closeErr != nil {
    fail(fmt.Errorf("read=%v handleStat=%v pathStat=%v realPath=%v close=%v", readErr, afterErr, pathErr, realErr, closeErr))
    return
  }
  data["identityAfter"] = artifactIdentity(after)
  data["realPathAfter"] = realAfter
  data["sameHandleIdentity"] = os.SameFile(before, after)
  data["samePathIdentity"] = os.SameFile(after, pathAfter)
  unchanged := before.Size() == after.Size() && before.Mode() == after.Mode() && before.ModTime().Equal(after.ModTime()) &&
    after.Size() == pathAfter.Size() && after.Mode() == pathAfter.Mode() && after.ModTime().Equal(pathAfter.ModTime())
  data["metadataUnchanged"] = unchanged
  data["observedBytes"] = len(body)
  if len(body) > 64<<20 || int64(len(body)) != before.Size() || !unchanged ||
    !os.SameFile(before, after) || !os.SameFile(after, pathAfter) || realPath != realAfter {
    fail(fmt.Errorf("artifact exceeds capture limit or changed identity/metadata/bytes during observation"))
    return
  }
  raw, err := writeArtifactPayload(observation.invocation, label, body)
  if err != nil {
    fail(err)
    return
  }
  data["sha256"] = fmt.Sprintf("%x", sha256.Sum256(body))
  data["raw"] = raw
  data["outcome"] = "complete"
}

// artifactIdentity names the observed metadata; native identity is checked by
// SameFile separately, not inferred from equal text fields or inode spelling.
func artifactIdentity(info os.FileInfo) map[string]any {
  return map[string]any{"size": info.Size(), "mode": info.Mode().String(), "modified": info.ModTime().UTC().Format(time.RFC3339Nano)}
}

// writeArtifactPayload owns an exclusive writer/ordinal-labelled file. The
// caller supplies actual bounded bytes; failures leave incomplete evidence.
func writeArtifactPayload(invocation, label string, body []byte) (map[string]any, error) {
  for _, character := range label {
    if !(character >= 'a' && character <= 'z' || character >= '0' && character <= '9' || character == '-') {
      return nil, fmt.Errorf("invalid artifact payload label")
    }
  }
  if label == "" || len(body) > 64<<20 {
    return nil, fmt.Errorf("invalid artifact payload label or size")
  }
  writer.Lock()
  defer writer.Unlock()
  if writer.failed || writer.root == "" || os.Getenv("TTSC_E2E_TRACE") != writer.root ||
    writer.bytes+int64(len(body)) > writerBudget-failureReserve {
    return nil, fmt.Errorf("artifact writer unavailable or over budget")
  }
  filename := fmt.Sprintf("%d-%s-%s-%s.bin", os.Getpid(), writer.instance, invocation[strings.LastIndexByte(invocation, '-')+1:], label)
  file, err := os.OpenFile(filepath.Join(writer.root, filename), os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
  if err != nil {
    return nil, err
  }
  written, writeErr := file.Write(body)
  closeErr := file.Close()
  writer.bytes += int64(written)
  if writeErr != nil || closeErr != nil || written != len(body) {
    return nil, fmt.Errorf("artifact write=%v close=%v bytes=%d/%d", writeErr, closeErr, written, len(body))
  }
  return map[string]any{"path": filename, "bytes": written}, nil
}
