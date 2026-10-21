package main

import (
  "errors"
  "fmt"
  "io"
  "io/fs"
  "os"
  "path/filepath"
)

type artifactAccounting struct {
  BaseBytes    int64 `json:"baseBytes"`
  OverlayBytes int64 `json:"overlayBytes"`
  StagingBytes int64 `json:"stagingBytes"`
  PinnedBytes  int64 `json:"pinnedBytes"`
  BaseFiles    int64 `json:"baseFiles"`
  OverlayFiles int64 `json:"overlayFiles"`
  StagingFiles int64 `json:"stagingFiles"`
}

// accountArtifactStore reads bounded rooted metadata for every retained cache
// population. The byte totals are logical file lengths, not free-space or
// physical allocated-byte claims; concurrent writers can change them later.
//
// A concurrent preparation of the same store removes its staging lock, and
// cleanup removes staged files, while this walks. An entry or directory that
// no longer exists when it is reached is therefore skipped as absent rather
// than failing the accounting; the depth, count, size and alias policies
// still apply to everything that does exist.
func accountArtifactStore(store *artifactStore) (artifactAccounting, error) {
  var result artifactAccounting
  var entries int
  var walk func(string, int, *int64, *int64) error
  walk = func(directory string, depth int, bytes, files *int64) error {
    if depth > 4 {
      return errors.New("artifact storage exceeds directory depth policy")
    }
    opened, err := store.root.Open(directory)
    if errors.Is(err, fs.ErrNotExist) {
      return nil
    }
    if err != nil {
      return err
    }
    defer opened.Close()
    for {
      batch, readErr := opened.ReadDir(256)
      if len(batch) != 0 && store.accountingListed != nil {
        store.accountingListed(directory)
      }
      for _, entry := range batch {
        entries++
        if entries > 100000 {
          return errors.New("artifact storage exceeds entry count policy")
        }
        child := filepath.ToSlash(filepath.Join(directory, entry.Name()))
        info, err := store.root.Lstat(child)
        if errors.Is(err, fs.ErrNotExist) {
          continue
        }
        if err != nil {
          return err
        }
        if info.IsDir() && info.Mode()&os.ModeSymlink == 0 {
          if err := walk(child, depth+1, bytes, files); err != nil {
            return err
          }
        } else if info.Mode().IsRegular() {
          if info.Size() < 0 || info.Size() > 1<<40 || *bytes > (1<<50)-info.Size() {
            return fmt.Errorf("artifact storage has an invalid file size: %s", child)
          }
          *bytes += info.Size()
          *files += 1
        } else {
          return fmt.Errorf("artifact storage contains an aliased or unknown entry: %s", child)
        }
      }
      if errors.Is(readErr, io.EOF) {
        return nil
      }
      if readErr != nil {
        return readErr
      }
    }
  }
  for _, part := range []struct {
    path  string
    bytes *int64
    files *int64
  }{
    {"base/packs", &result.BaseBytes, &result.BaseFiles},
    {"base/staging", &result.StagingBytes, &result.StagingFiles},
    {"overlay/bodies", &result.OverlayBytes, &result.OverlayFiles},
    {"overlay/actions", &result.OverlayBytes, &result.OverlayFiles},
    {"overlay/staging", &result.StagingBytes, &result.StagingFiles},
  } {
    if err := walk(part.path, 0, part.bytes, part.files); err != nil {
      return artifactAccounting{}, err
    }
  }
  for _, pinned := range store.pins {
    info, err := pinned.Stat()
    if err != nil || !info.Mode().IsRegular() || info.Size() < 0 || result.PinnedBytes > (1<<50)-info.Size() {
      return artifactAccounting{}, errors.New("artifact pinned body accounting failed")
    }
    result.PinnedBytes += info.Size()
  }
  return result, nil
}
