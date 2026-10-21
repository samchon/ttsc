package main

import (
  "crypto/rand"
  "crypto/sha256"
  "encoding/hex"
  "encoding/json"
  "errors"
  "fmt"
  "io"
  "os"
  "path/filepath"
  "strings"

  "github.com/samchon/ttsc/packages/ttsc/internal/packageartifacts"
)

type mapping struct {
  OutputID string `json:"outputID"`
  Size     int64  `json:"size"`
}

type artifactStore struct {
  path        string
  root        *os.Root
  base        map[string]packageartifacts.Action
  packs       map[string]packageartifacts.Pack
  pins        []*os.File
  pinned      map[string]bool
  verified    map[string]bool
  receiptName string

  // accountingListed is told each directory batch accounting has listed,
  // before it stats the batch's entries. Nil outside tests, which use it to
  // remove an entry the way a concurrent preparation does.
  accountingListed func(directory string)
}

func openArtifactStore(directory string, manifest *packageartifacts.Manifest) (*artifactStore, error) {
  if err := os.MkdirAll(directory, 0700); err != nil {
    return nil, err
  }
  info, err := os.Lstat(directory)
  if err != nil {
    return nil, err
  }
  if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
    return nil, fmt.Errorf("artifact root is not an ordinary directory: %s", directory)
  }
  physical, err := filepath.EvalSymlinks(directory)
  if err != nil {
    return nil, err
  }
  root, err := os.OpenRoot(physical)
  if err != nil {
    return nil, err
  }
  store := &artifactStore{
    path: physical, root: root,
    base:     make(map[string]packageartifacts.Action),
    packs:    make(map[string]packageartifacts.Pack),
    pinned:   make(map[string]bool),
    verified: make(map[string]bool),
  }
  for _, name := range []string{"base", "base/packs", "base/staging", "overlay", "overlay/bodies", "overlay/actions", "overlay/staging", "receipts"} {
    if err := root.Mkdir(name, 0700); err != nil && !errors.Is(err, os.ErrExist) {
      root.Close()
      return nil, err
    }
    info, err := root.Lstat(name)
    if err != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
      root.Close()
      return nil, fmt.Errorf("artifact directory is aliased or unreadable: %s", name)
    }
  }
  if manifest != nil {
    for _, pack := range manifest.Packs {
      store.packs[pack.Name] = pack
    }
    for _, action := range manifest.Actions {
      store.base[action.ActionID] = action
    }
  }
  return store, nil
}

func (store *artifactStore) close() error {
  var first error
  for _, file := range store.pins {
    if err := file.Close(); err != nil && first == nil {
      first = err
    }
  }
  if err := store.root.Close(); err != nil && first == nil {
    first = err
  }
  return first
}

func (store *artifactStore) get(actionID string) (mapping, string, bool, error) {
  index := filepath.ToSlash(filepath.Join("overlay", "actions", actionID))
  indexFile, err := store.root.Open(index)
  if err == nil {
    raw, readErr := io.ReadAll(io.LimitReader(indexFile, 257))
    closeErr := indexFile.Close()
    if readErr != nil || closeErr != nil {
      return mapping{}, "", false, errors.Join(readErr, closeErr)
    }
    var value mapping
    if len(raw) > 256 || json.Unmarshal(raw, &value) != nil || !validID(value.OutputID) || value.Size < 0 {
      return mapping{}, "", false, fmt.Errorf("invalid overlay mapping for action %s", actionID)
    }
    location, err := store.pinBody("overlay", value)
    if errors.Is(err, os.ErrNotExist) {
      return mapping{}, "", false, nil
    }
    return value, location, err == nil, err
  }
  if !errors.Is(err, os.ErrNotExist) {
    return mapping{}, "", false, err
  }
  base, exists := store.base[actionID]
  if !exists {
    return mapping{}, "", false, nil
  }
  value := mapping{OutputID: base.OutputID, Size: base.BodyLength}
  pack := store.packs[base.Pack]
  owner := filepath.ToSlash(filepath.Join("base", "packs", pack.Name+"-"+pack.SHA256))
  info, err := store.root.Lstat(owner)
  if errors.Is(err, os.ErrNotExist) {
    return mapping{}, "", false, nil
  }
  if err != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
    return mapping{}, "", false, fmt.Errorf("invalid admitted pack %s", pack.Name)
  }
  marker, err := store.root.ReadFile(filepath.ToSlash(filepath.Join(owner, ".complete")))
  if errors.Is(err, os.ErrNotExist) {
    return mapping{}, "", false, nil
  }
  if err != nil || string(marker) != pack.SHA256+"\n" {
    return mapping{}, "", false, fmt.Errorf("invalid admission marker for pack %s", pack.Name)
  }
  location, err := store.pinBody(owner, value)
  if errors.Is(err, os.ErrNotExist) {
    return mapping{}, "", false, nil
  }
  return value, location, err == nil, err
}

func (store *artifactStore) put(actionID, outputID string, size int64, body io.Reader) (string, error) {
  if !validID(actionID) || !validID(outputID) || size < 0 || size > 512<<20 {
    return "", errors.New("invalid Go cache put identity or body size")
  }
  staging := filepath.ToSlash(filepath.Join("overlay", "staging", randomName()))
  file, err := store.root.OpenFile(staging, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
  if err != nil {
    return "", err
  }
  defer store.root.Remove(staging)
  hash := sha256.New()
  written, copyErr := io.CopyN(io.MultiWriter(file, hash), body, size)
  syncErr := file.Sync()
  closeErr := file.Close()
  if copyErr != nil || written != size {
    return "", fmt.Errorf("incomplete Go cache body: %w", copyErr)
  }
  if syncErr != nil {
    return "", syncErr
  }
  if closeErr != nil {
    return "", closeErr
  }
  if hex.EncodeToString(hash.Sum(nil)) != outputID {
    return "", errors.New("Go cache body differs from its OutputID")
  }
  destination := filepath.ToSlash(filepath.Join("overlay", "bodies", outputID))
  if err := store.root.Link(staging, destination); err != nil && !errors.Is(err, os.ErrExist) {
    return "", err
  }
  value := mapping{OutputID: outputID, Size: size}
  location, err := store.pinBody("overlay", value)
  if err != nil {
    return "", err
  }
  data, err := json.Marshal(value)
  if err != nil {
    return "", err
  }
  indexStage := filepath.ToSlash(filepath.Join("overlay", "staging", randomName()))
  indexFile, err := store.root.OpenFile(indexStage, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
  if err != nil {
    return "", err
  }
  defer store.root.Remove(indexStage)
  _, writeErr := indexFile.Write(data)
  syncErr = indexFile.Sync()
  closeErr = indexFile.Close()
  if writeErr != nil || syncErr != nil || closeErr != nil {
    return "", errors.Join(writeErr, syncErr, closeErr)
  }
  index := filepath.ToSlash(filepath.Join("overlay", "actions", actionID))
  if err := store.root.Rename(indexStage, index); err != nil {
    return "", err
  }
  return location, nil
}

func (store *artifactStore) pinBody(owner string, value mapping) (string, error) {
  relative := filepath.ToSlash(filepath.Join(owner, "bodies", value.OutputID))
  info, err := store.root.Lstat(relative)
  if err != nil {
    return "", err
  }
  if !info.Mode().IsRegular() || info.Size() != value.Size {
    return "", fmt.Errorf("invalid artifact body %s", relative)
  }
  file, err := store.root.Open(relative)
  if err != nil {
    return "", err
  }
  key := owner + "/" + value.OutputID
  if !store.verified[key] {
    hash := sha256.New()
    count, err := io.Copy(hash, file)
    if err != nil || count != value.Size || hex.EncodeToString(hash.Sum(nil)) != value.OutputID {
      file.Close()
      return "", fmt.Errorf("artifact body failed validation: %s", relative)
    }
    store.verified[key] = true
  }
  if store.pinned[key] {
    file.Close()
  } else {
    store.pins = append(store.pins, file)
    store.pinned[key] = true
  }
  return filepath.Join(store.path, filepath.FromSlash(relative)), nil
}

func validID(value string) bool {
  if len(value) != 64 {
    return false
  }
  _, err := hex.DecodeString(value)
  return err == nil && value == strings.ToLower(value)
}

func randomName() string {
  var value [16]byte
  if _, err := rand.Read(value[:]); err != nil {
    panic(err)
  }
  return hex.EncodeToString(value[:])
}
