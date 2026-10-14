package main

import (
  "archive/zip"
  "compress/flate"
  "crypto/sha256"
  "encoding/base64"
  "encoding/hex"
  "encoding/json"
  "errors"
  "fmt"
  "io"
  "os"
  "path/filepath"
  "sort"
  "strings"

  "github.com/samchon/ttsc/packages/ttsc/internal/packageartifacts"
)

type sealOptions struct {
  root, goBinary, actionGraph, packages, release, sourceCommit string
  packURLBase, packName, outputDir                             string
}

type graphAction struct {
  ID       int      `json:"ID"`
  Mode     string   `json:"Mode"`
  Package  string   `json:"Package"`
  Deps     []int    `json:"Deps"`
  ActionID string   `json:"ActionID"`
  Cmd      []string `json:"Cmd"`
}

type packageReceipt struct {
  ImportPath string
  Dir        string
  GoFiles    []string
  CgoFiles   []string
  SFiles     []string
  EmbedFiles []string
  Module     *struct {
    Path    string
    Version string
    Main    bool
    Replace *struct {
      Path    string
      Version string
    }
  }
}

// SealRecordedActions joins Go's displayed build actions to the full action and
// output IDs recorded by its cache client. Package receipts annotate those IDs;
// they never generate or replace a Go cache key. A release package must pin the
// printed manifest digest before a consumer may trust the result.
//
// @evidence contracts/common.md#principled-implementation Only full recorded actions with verified local bodies are sealed; a same-workspace Go action graph and package receipts add diagnostics, while the release pins the resulting manifest digest.
// @evidence contracts/common.md#clear-and-simple-design One publisher command reads bounded Go receipts, verifies body associations, writes one deterministic pack and authenticates its complete manifest before reporting the digest.
// @evidence contracts/common.md#prohibited-implementation-shortcuts A displayed action prefix is joined uniquely to a full recorded key; package names and source hashes cannot manufacture identities or resolve a conflict.
// @evidence contracts/common.md#meaningful-documentation The contract names the release trust step and separates diagnostic receipts from Go's authoritative keys.
// @evidence contracts/portability.md#os-neutral-implementation Go path and archive APIs process native publisher paths, while transport names use slash-separated ZIP entries independent of the publisher OS.
// @evidence contracts/performance.md#efficient-algorithms Each selected package body is streamed once into a level-one ZIP and hashed; action joins use maps rather than comparing every graph node with every recorded action.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Publisher sealing is an explicit one-shot release operation and does not memoize mutable source or tool observations.
// @evidence contracts/performance.md#bound-retention-and-release-resources Receipt/action files have byte caps, package source reads are streamed, body handles close after each entry, and failed staging files are removed; the finished pack remains with the publisher output owner.
func SealRecordedActions(opts sealOptions) error {
  if !filepath.IsAbs(opts.root) || !filepath.IsAbs(opts.outputDir) || !filepath.IsAbs(opts.actionGraph) || !filepath.IsAbs(opts.packages) || !validPackName(opts.packName) {
    return errors.New("publisher paths must be absolute and pack name must be safe")
  }
  tuple, err := readGoTuple(opts.goBinary)
  if err != nil {
    return err
  }
  graphRaw, err := readBoundedFile(opts.actionGraph, 16<<20)
  if err != nil {
    return err
  }
  var graph []graphAction
  if err := json.Unmarshal(graphRaw, &graph); err != nil {
    return fmt.Errorf("decode Go action graph: %w", err)
  }
  if len(graph) == 0 || len(graph) > 100000 {
    return errors.New("Go action graph exceeds publisher policy")
  }
  receipts, err := readPackageReceipts(opts.packages)
  if err != nil {
    return err
  }
  store, err := openArtifactStore(opts.root, nil)
  if err != nil {
    return err
  }
  defer store.close()
  recorded, err := readRecordedMappings(store)
  if err != nil {
    return err
  }
  byShort := make(map[string]string, len(recorded))
  for actionID := range recorded {
    bytes, _ := hex.DecodeString(actionID)
    short := base64.RawURLEncoding.EncodeToString(bytes[:15])
    if previous := byShort[short]; previous != "" && previous != actionID {
      return fmt.Errorf("ambiguous Go action prefix %s", short)
    }
    byShort[short] = actionID
  }
  selected := make(map[int]packageartifacts.Action)
  outputs := make(map[string]mapping)
  for _, node := range graph {
    if node.Mode != "build" || node.ActionID == "" {
      continue
    }
    fullID := byShort[node.ActionID]
    value, exists := recorded[fullID]
    if !exists || node.Package == "" {
      return fmt.Errorf("Go build action %s has no recorded full body", node.Package)
    }
    receipt, exists := receipts[node.Package]
    if !exists {
      return fmt.Errorf("Go build action %s has no package receipt", node.Package)
    }
    sourceHash, err := hashSelectedSources(receipt)
    if err != nil {
      return fmt.Errorf("package %s sources: %w", node.Package, err)
    }
    command, _ := json.Marshal(node.Cmd)
    commandHash := sha256.Sum256(command)
    role, modulePath, moduleVersion := receiptRole(receipt, tuple.GoVersion)
    selected[node.ID] = packageartifacts.Action{
      ActionID: fullID, OutputID: value.OutputID, BodySHA256: value.OutputID,
      BodyLength: value.Size, Pack: opts.packName, Kind: "archive",
      PackagePath: node.Package, ModulePath: modulePath, ModuleVersion: moduleVersion,
      ModuleRole: role, SelectedSourceSHA: sourceHash,
      CommandSHA256: hex.EncodeToString(commandHash[:]), DirectInputs: []string{},
    }
    if previous, exists := outputs[value.OutputID]; exists && previous.Size != value.Size {
      return errors.New("recorded output has conflicting lengths")
    }
    outputs[value.OutputID] = value
  }
  if len(selected) == 0 {
    return errors.New("no recorded package actions were selected")
  }
  manifest := packageartifacts.Manifest{
    Schema: 1, Release: opts.release, SourceCommit: opts.sourceCommit,
    Tuple: tuple, GraphSHA256: digestBytes(graphRaw), Actions: make([]packageartifacts.Action, 0, len(selected)),
  }
  for _, node := range graph {
    action, exists := selected[node.ID]
    if !exists {
      continue
    }
    for _, dependency := range node.Deps {
      if input, exists := selected[dependency]; exists {
        action.DirectInputs = append(action.DirectInputs, input.OutputID)
      }
    }
    sort.Strings(action.DirectInputs)
    manifest.Actions = append(manifest.Actions, action)
  }
  sort.Slice(manifest.Actions, func(i, j int) bool { return manifest.Actions[i].ActionID < manifest.Actions[j].ActionID })
  if err := os.MkdirAll(opts.outputDir, 0700); err != nil {
    return err
  }
  stage, err := os.CreateTemp(opts.outputDir, ".ttsc-pack-*.zip")
  if err != nil {
    return err
  }
  defer os.Remove(stage.Name())
  writer := zip.NewWriter(stage)
  writer.RegisterCompressor(zip.Deflate, func(destination io.Writer) (io.WriteCloser, error) {
    return flate.NewWriter(destination, flate.BestSpeed)
  })
  ids := make([]string, 0, len(outputs))
  for outputID := range outputs {
    ids = append(ids, outputID)
  }
  sort.Strings(ids)
  var decodedBytes int64
  for _, outputID := range ids {
    value := outputs[outputID]
    location := filepath.ToSlash(filepath.Join("overlay", "bodies", outputID))
    body, err := store.root.Open(location)
    if err != nil {
      writer.Close()
      stage.Close()
      return err
    }
    info, err := body.Stat()
    if err != nil || !info.Mode().IsRegular() || info.Size() != value.Size {
      body.Close()
      writer.Close()
      stage.Close()
      return fmt.Errorf("recorded body %s changed", outputID)
    }
    entry, err := writer.Create("bodies/" + outputID)
    if err != nil {
      body.Close()
      writer.Close()
      stage.Close()
      return err
    }
    hash := sha256.New()
    count, copyErr := io.CopyN(io.MultiWriter(entry, hash), body, value.Size)
    closeErr := body.Close()
    if copyErr != nil || closeErr != nil || count != value.Size || hex.EncodeToString(hash.Sum(nil)) != outputID {
      writer.Close()
      stage.Close()
      return fmt.Errorf("recorded body %s failed verification: %w", outputID, errors.Join(copyErr, closeErr))
    }
    decodedBytes += count
    if decodedBytes > packageartifacts.MaxPackDecodedBytes {
      writer.Close()
      stage.Close()
      return errors.New("pack exceeds decoded byte policy")
    }
  }
  if err := writer.Close(); err != nil {
    stage.Close()
    return err
  }
  if err := stage.Sync(); err != nil {
    stage.Close()
    return err
  }
  if err := stage.Close(); err != nil {
    return err
  }
  packRaw, err := hashFile(stage.Name(), packageartifacts.MaxPackBytes)
  if err != nil {
    return err
  }
  packFile := opts.packName + "-" + packRaw.digest + ".zip"
  manifest.Packs = []packageartifacts.Pack{{
    Name: opts.packName, URL: strings.TrimRight(opts.packURLBase, "/") + "/" + packFile,
    SHA256: packRaw.digest, Length: packRaw.length, DecodedBytes: decodedBytes, FileCount: len(ids),
  }}
  manifestRaw, err := json.MarshalIndent(manifest, "", "  ")
  if err != nil {
    return err
  }
  manifestRaw = append(manifestRaw, '\n')
  manifestDigest := digestBytes(manifestRaw)
  if _, err := packageartifacts.ParseTrustedManifest(manifestRaw, manifestDigest); err != nil {
    return fmt.Errorf("publisher manifest rejected: %w", err)
  }
  finalPack := filepath.Join(opts.outputDir, packFile)
  if err := os.Link(stage.Name(), finalPack); err != nil {
    if !errors.Is(err, os.ErrExist) {
      return err
    }
    existing, hashErr := hashFile(finalPack, packageartifacts.MaxPackBytes)
    if hashErr != nil || existing != packRaw {
      return errors.New("existing publisher pack differs from sealed bytes")
    }
  }
  manifestFile, err := os.OpenFile(filepath.Join(opts.outputDir, "manifest.json"), os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
  if err != nil {
    return err
  }
  _, writeErr := manifestFile.Write(manifestRaw)
  syncErr := manifestFile.Sync()
  closeErr := manifestFile.Close()
  if writeErr != nil || syncErr != nil || closeErr != nil {
    return errors.Join(writeErr, syncErr, closeErr)
  }
  return json.NewEncoder(os.Stdout).Encode(struct {
    ManifestSHA256  string `json:"manifestSHA256"`
    Pack            string `json:"pack"`
    Actions         int    `json:"actions"`
    DecodedBytes    int64  `json:"decodedBytes"`
    CompressedBytes int64  `json:"compressedBytes"`
  }{manifestDigest, packFile, len(manifest.Actions), decodedBytes, packRaw.length})
}

func readRecordedMappings(store *artifactStore) (map[string]mapping, error) {
  directory, err := store.root.Open("overlay/actions")
  if err != nil {
    return nil, err
  }
  defer directory.Close()
  entries, err := directory.ReadDir(-1)
  if err != nil {
    return nil, err
  }
  if len(entries) > 100000 {
    return nil, errors.New("too many publisher actions")
  }
  result := make(map[string]mapping, len(entries))
  for _, entry := range entries {
    if !validID(entry.Name()) || !entry.Type().IsRegular() {
      return nil, errors.New("publisher action index contains an unsafe entry")
    }
    index, err := store.root.Open(filepath.ToSlash(filepath.Join("overlay", "actions", entry.Name())))
    if err != nil {
      return nil, err
    }
    raw, readErr := io.ReadAll(io.LimitReader(index, 257))
    closeErr := index.Close()
    if readErr != nil || closeErr != nil || len(raw) > 256 {
      return nil, errors.New("publisher action index is unreadable or too large")
    }
    var value mapping
    if err := json.Unmarshal(raw, &value); err != nil || !validID(value.OutputID) || value.Size < 0 || value.Size > 512<<20 {
      return nil, errors.New("publisher action index is invalid")
    }
    result[entry.Name()] = value
  }
  return result, nil
}

func readPackageReceipts(filename string) (map[string]packageReceipt, error) {
  file, err := os.Open(filename)
  if err != nil {
    return nil, err
  }
  defer file.Close()
  info, err := file.Stat()
  if err != nil || !info.Mode().IsRegular() || info.Size() > 256<<20 {
    return nil, errors.New("package receipts exceed publisher policy")
  }
  decoder := json.NewDecoder(io.LimitReader(file, (256<<20)+1))
  result := make(map[string]packageReceipt)
  for {
    var receipt packageReceipt
    if err := decoder.Decode(&receipt); err == io.EOF {
      break
    } else if err != nil {
      return nil, fmt.Errorf("decode package receipt: %w", err)
    }
    if receipt.ImportPath == "" || receipt.Dir == "" {
      return nil, errors.New("incomplete package receipt")
    }
    if _, exists := result[receipt.ImportPath]; exists {
      return nil, errors.New("duplicate package receipt")
    }
    result[receipt.ImportPath] = receipt
    if len(result) > 100000 {
      return nil, errors.New("too many package receipts")
    }
  }
  return result, nil
}

func hashSelectedSources(receipt packageReceipt) (string, error) {
  names := append(append(append([]string{}, receipt.GoFiles...), receipt.CgoFiles...), receipt.SFiles...)
  names = append(names, receipt.EmbedFiles...)
  sort.Strings(names)
  hash := sha256.New()
  for _, name := range names {
    if filepath.IsAbs(name) || name == ".." || strings.HasPrefix(name, ".."+string(filepath.Separator)) {
      return "", errors.New("selected source escaped package directory")
    }
    file, err := os.Open(filepath.Join(receipt.Dir, name))
    if err != nil {
      return "", err
    }
    _, _ = fmt.Fprintf(hash, "%d:%s\n", len(name), filepath.ToSlash(name))
    count, copyErr := io.Copy(hash, io.LimitReader(file, (128<<20)+1))
    closeErr := file.Close()
    if copyErr != nil || closeErr != nil || count > 128<<20 {
      return "", errors.New("selected source is unreadable or too large")
    }
    _, _ = fmt.Fprintf(hash, "\n%d\n", count)
  }
  return hex.EncodeToString(hash.Sum(nil)), nil
}

func receiptRole(receipt packageReceipt, goVersion string) (string, string, string) {
  if receipt.Module == nil {
    return "standard", "std", goVersion
  }
  version := receipt.Module.Version
  if receipt.Module.Replace != nil {
    version = receipt.Module.Replace.Version
  }
  if receipt.Module.Main {
    return "main", receipt.Module.Path, version
  }
  return "dependency", receipt.Module.Path, version
}

func readBoundedFile(filename string, limit int64) ([]byte, error) {
  file, err := os.Open(filename)
  if err != nil {
    return nil, err
  }
  defer file.Close()
  info, err := file.Stat()
  if err != nil || !info.Mode().IsRegular() || info.Size() > limit {
    return nil, errors.New("publisher input exceeds byte policy")
  }
  return io.ReadAll(io.LimitReader(file, limit+1))
}

type fileDigest struct {
  digest string
  length int64
}

func hashFile(filename string, limit int64) (fileDigest, error) {
  file, err := os.Open(filename)
  if err != nil {
    return fileDigest{}, err
  }
  defer file.Close()
  hash := sha256.New()
  count, err := io.Copy(hash, io.LimitReader(file, limit+1))
  if err != nil || count > limit {
    return fileDigest{}, errors.New("publisher pack exceeds compressed byte policy")
  }
  return fileDigest{hex.EncodeToString(hash.Sum(nil)), count}, nil
}

func digestBytes(value []byte) string { sum := sha256.Sum256(value); return hex.EncodeToString(sum[:]) }

func validPackName(value string) bool {
  if value == "" || len(value) > 80 {
    return false
  }
  for _, char := range value {
    if !strings.ContainsRune("abcdefghijklmnopqrstuvwxyz0123456789-", char) {
      return false
    }
  }
  return true
}
