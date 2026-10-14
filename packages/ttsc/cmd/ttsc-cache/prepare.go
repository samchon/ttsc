package main

import (
  "archive/zip"
  "context"
  "crypto/sha256"
  "encoding/hex"
  "errors"
  "fmt"
  "io"
  "net"
  "net/http"
  "net/url"
  "os"
  "path/filepath"
  "strings"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/internal/packageartifacts"
)

type preparationReceipt struct {
  SelectedPacks   []string           `json:"selectedPacks"`
  DownloadedPacks int                `json:"downloadedPacks"`
  Requests        int                `json:"requests"`
  CompressedBytes int64              `json:"compressedBytes"`
  DecodedBytes    int64              `json:"decodedBytes"`
  Storage         artifactAccounting `json:"storage"`
  DownloadMillis  int64              `json:"downloadMillis"`
  ExtractMillis   int64              `json:"extractMillis"`
  AdmissionMillis int64              `json:"admissionMillis"`
  TotalMillis     int64              `json:"totalMillis"`
}

const maxSelectedCompressedBytes int64 = 512 << 20

const maxSelectedDecodedBytes int64 = 4 << 30

const maxRetainedBaseBytes int64 = 8 << 30

const maxRetainedStagingBytes int64 = 5 << 30

func preparePacks(ctx context.Context, store *artifactStore, manifest packageartifacts.Manifest, names []string) (preparationReceipt, error) {
  started := time.Now()
  var receipt preparationReceipt
  if len(names) == 0 || len(names) > 8 {
    return receipt, errors.New("select between one and eight artifact packs")
  }
  packs := make(map[string]packageartifacts.Pack, len(manifest.Packs))
  for _, pack := range manifest.Packs {
    packs[pack.Name] = pack
  }
  seen := make(map[string]bool, len(names))
  selected := make([]packageartifacts.Pack, 0, len(names))
  var compressed, decoded int64
  for _, name := range names {
    pack, exists := packs[name]
    if !exists || seen[name] {
      return receipt, fmt.Errorf("unknown or repeated artifact pack %q", name)
    }
    seen[name] = true
    receipt.SelectedPacks = append(receipt.SelectedPacks, name)
    if pack.Length > maxSelectedCompressedBytes-compressed || pack.DecodedBytes > maxSelectedDecodedBytes-decoded {
      return receipt, errors.New("selected artifact packs exceed transfer or decoded byte policy")
    }
    compressed += pack.Length
    decoded += pack.DecodedBytes
    selected = append(selected, pack)
  }
  for _, pack := range selected {
    if admittedPack(store, pack, manifest.Actions) {
      continue
    }
    accounting, err := accountArtifactStore(store)
    if err != nil {
      return receipt, fmt.Errorf("accounting for artifact admission: %w", err)
    }
    if accounting.BaseBytes > maxRetainedBaseBytes-pack.DecodedBytes || accounting.StagingBytes > maxRetainedStagingBytes-pack.DecodedBytes-pack.Length {
      return receipt, errors.New("artifact storage exceeds preparation byte policy")
    }
    downloaded, err := prepareSelectedPack(ctx, store, pack, manifest.Actions, &receipt)
    if err != nil {
      return receipt, err
    }
    if downloaded {
      receipt.DownloadedPacks++
    }
  }
  var err error
  receipt.Storage, err = accountArtifactStore(store)
  if err != nil {
    return receipt, fmt.Errorf("accounting for prepared artifacts: %w", err)
  }
  receipt.TotalMillis = time.Since(started).Milliseconds()
  return receipt, nil
}

func prepareSelectedPack(ctx context.Context, store *artifactStore, pack packageartifacts.Pack, actions []packageartifacts.Action, receipt *preparationReceipt) (bool, error) {
  lock := filepath.ToSlash(filepath.Join("base", "staging", pack.Name+"-"+pack.SHA256+".lock"))
  deadline := time.Now().Add(120 * time.Second)
  for {
    if err := ctx.Err(); err != nil {
      return false, err
    }
    file, err := store.root.OpenFile(lock, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
    if err == nil {
      defer store.root.Remove(lock)
      defer file.Close()
      if admittedPack(store, pack, actions) {
        return false, nil
      }
      if err := downloadAndAdmitPack(ctx, store, pack, actions, receipt); err != nil {
        return false, err
      }
      return true, nil
    }
    if !errors.Is(err, os.ErrExist) {
      return false, err
    }
    info, err := store.root.Lstat(lock)
    if err != nil && !errors.Is(err, os.ErrNotExist) {
      return false, err
    }
    if err == nil && !info.Mode().IsRegular() {
      return false, errors.New("artifact preparation lock is not an ordinary file")
    }
    if admittedPack(store, pack, actions) {
      return false, nil
    }
    if time.Now().After(deadline) {
      return false, fmt.Errorf("artifact preparation lock for %s did not settle", pack.Name)
    }
    select {
    case <-ctx.Done():
      return false, ctx.Err()
    case <-time.After(50 * time.Millisecond):
    }
  }
}

func admittedPack(store *artifactStore, pack packageartifacts.Pack, actions []packageartifacts.Action) bool {
  name := filepath.ToSlash(filepath.Join("base", "packs", pack.Name+"-"+pack.SHA256))
  info, err := store.root.Lstat(name)
  if err != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
    return false
  }
  receipt, err := store.root.ReadFile(filepath.ToSlash(filepath.Join(name, ".complete")))
  if err != nil || string(receipt) != pack.SHA256+"\n" {
    return false
  }
  seen := make(map[string]bool)
  for _, action := range actions {
    if action.Pack != pack.Name || seen[action.OutputID] {
      continue
    }
    seen[action.OutputID] = true
    body, err := store.root.Lstat(filepath.ToSlash(filepath.Join(name, "bodies", action.OutputID)))
    if err != nil || !body.Mode().IsRegular() || body.Size() != action.BodyLength {
      return false
    }
  }
  return len(seen) == pack.FileCount
}

func downloadAndAdmitPack(ctx context.Context, store *artifactStore, pack packageartifacts.Pack, actions []packageartifacts.Action, receipt *preparationReceipt) error {
  stage := filepath.ToSlash(filepath.Join("base", "staging", randomName()))
  if err := store.root.Mkdir(stage, 0700); err != nil {
    return err
  }
  defer store.root.RemoveAll(stage)
  if err := store.root.Mkdir(filepath.ToSlash(filepath.Join(stage, "bodies")), 0700); err != nil {
    return err
  }
  archive := filepath.ToSlash(filepath.Join(stage, "pack.zip"))
  started := time.Now()
  if err := downloadPack(ctx, store, pack, archive, receipt); err != nil {
    return err
  }
  receipt.DownloadMillis += time.Since(started).Milliseconds()
  started = time.Now()
  if err := extractPack(store, pack, archive, stage, actions, receipt); err != nil {
    return err
  }
  receipt.ExtractMillis += time.Since(started).Milliseconds()
  started = time.Now()
  if err := store.root.Remove(archive); err != nil {
    return err
  }
  marker := filepath.ToSlash(filepath.Join(stage, ".complete"))
  file, err := store.root.OpenFile(marker, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
  if err != nil {
    return err
  }
  _, writeErr := io.WriteString(file, pack.SHA256+"\n")
  syncErr := file.Sync()
  closeErr := file.Close()
  if writeErr != nil || syncErr != nil || closeErr != nil {
    return errors.Join(writeErr, syncErr, closeErr)
  }
  final := filepath.ToSlash(filepath.Join("base", "packs", pack.Name+"-"+pack.SHA256))
  if err := store.root.Rename(stage, final); err != nil {
    if admittedPack(store, pack, actions) {
      return nil
    }
    return fmt.Errorf("admitting artifact pack %s: %w", pack.Name, err)
  }
  receipt.AdmissionMillis += time.Since(started).Milliseconds()
  return nil
}

func downloadPack(ctx context.Context, store *artifactStore, pack packageartifacts.Pack, destination string, receipt *preparationReceipt) error {
  client := &http.Client{
    Timeout: 120 * time.Second,
    CheckRedirect: func(req *http.Request, via []*http.Request) error {
      if len(via) >= 5 || !safeRedirect(req.URL) {
        return errors.New("artifact redirect policy rejected destination")
      }
      receipt.Requests++
      return nil
    },
  }
  request, err := http.NewRequestWithContext(ctx, http.MethodGet, pack.URL, nil)
  if err != nil {
    return fmt.Errorf("invalid artifact pack URL for %s", pack.Name)
  }
  receipt.Requests++
  response, err := client.Do(request)
  if err != nil {
    return fmt.Errorf("artifact pack %s transfer failed (%T)", pack.Name, err)
  }
  defer response.Body.Close()
  if response.StatusCode != http.StatusOK {
    return fmt.Errorf("artifact pack %s returned HTTP %d", pack.Name, response.StatusCode)
  }
  if response.ContentLength > pack.Length {
    return fmt.Errorf("artifact pack %s exceeds compressed byte limit", pack.Name)
  }
  file, err := store.root.OpenFile(destination, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
  if err != nil {
    return err
  }
  hash := sha256.New()
  count, copyErr := io.Copy(io.MultiWriter(file, hash), io.LimitReader(response.Body, pack.Length+1))
  syncErr := file.Sync()
  closeErr := file.Close()
  if copyErr != nil || syncErr != nil || closeErr != nil {
    return errors.Join(copyErr, syncErr, closeErr)
  }
  receipt.CompressedBytes += count
  if count != pack.Length || hex.EncodeToString(hash.Sum(nil)) != pack.SHA256 {
    return fmt.Errorf("artifact pack %s has wrong compressed length or digest", pack.Name)
  }
  return nil
}

func extractPack(store *artifactStore, pack packageartifacts.Pack, archive, stage string, actions []packageartifacts.Action, receipt *preparationReceipt) error {
  file, err := store.root.Open(archive)
  if err != nil {
    return err
  }
  defer file.Close()
  info, err := file.Stat()
  if err != nil || !info.Mode().IsRegular() || info.Size() != pack.Length {
    return fmt.Errorf("artifact pack %s changed before extraction", pack.Name)
  }
  reader, err := zip.NewReader(file, info.Size())
  if err != nil {
    return fmt.Errorf("artifact pack %s is not a ZIP: %w", pack.Name, err)
  }
  expected := make(map[string]int64)
  for _, action := range actions {
    if action.Pack == pack.Name {
      expected[action.OutputID] = action.BodyLength
    }
  }
  if len(reader.File) != pack.FileCount || len(expected) != pack.FileCount {
    return fmt.Errorf("artifact pack %s has wrong file count", pack.Name)
  }
  var total int64
  seen := make(map[string]bool, len(expected))
  for _, entry := range reader.File {
    if !strings.HasPrefix(entry.Name, "bodies/") {
      return fmt.Errorf("artifact pack %s contains an unexpected path", pack.Name)
    }
    outputID := strings.TrimPrefix(entry.Name, "bodies/")
    length, exists := expected[outputID]
    if !exists || seen[outputID] || entry.UncompressedSize64 != uint64(length) || total > pack.DecodedBytes-length {
      return fmt.Errorf("artifact pack %s contains an unexpected body", pack.Name)
    }
    seen[outputID] = true
    compressed, err := entry.Open()
    if err != nil {
      return err
    }
    destination := filepath.ToSlash(filepath.Join(stage, "bodies", outputID))
    file, err := store.root.OpenFile(destination, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
    if err != nil {
      compressed.Close()
      return err
    }
    hash := sha256.New()
    count, copyErr := io.Copy(io.MultiWriter(file, hash), io.LimitReader(compressed, length+1))
    closeInputErr := compressed.Close()
    syncErr := file.Sync()
    closeOutputErr := file.Close()
    if copyErr != nil || closeInputErr != nil || syncErr != nil || closeOutputErr != nil {
      return errors.Join(copyErr, closeInputErr, syncErr, closeOutputErr)
    }
    if count != length || hex.EncodeToString(hash.Sum(nil)) != outputID {
      return fmt.Errorf("artifact pack %s contains a corrupt body", pack.Name)
    }
    total += count
  }
  if total != pack.DecodedBytes {
    return fmt.Errorf("artifact pack %s has wrong decoded byte count", pack.Name)
  }
  receipt.DecodedBytes += total
  return nil
}

func safeRedirect(target *url.URL) bool {
  if target.User != nil || target.Fragment != "" {
    return false
  }
  if target.Scheme == "https" {
    return true
  }
  address := net.ParseIP(target.Hostname())
  return target.Scheme == "http" && address != nil && address.IsLoopback()
}
