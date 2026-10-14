package main

import (
  "archive/zip"
  "compress/flate"
  "crypto/sha256"
  "encoding/hex"
  "encoding/json"
  "errors"
  "fmt"
  "io"
  "os"
  "path/filepath"
  "reflect"
  "sort"
  "strings"

  "github.com/samchon/ttsc/packages/ttsc/internal/packageartifacts"
)

type mergePlan struct {
  Schema int `json:"schema"`
  Inputs []struct {
    Name     string `json:"name"`
    Manifest string `json:"manifest"`
    SHA256   string `json:"sha256"`
  } `json:"inputs"`
  PackURLBase string `json:"packURLBase"`
  OutputDir   string `json:"outputDir"`
}

type mergeAction struct {
  action  packageartifacts.Action
  members uint8
}

type mergeBody struct {
  length  int64
  members uint8
  source  *zip.File
}

// MergeRecordedPacks makes a deduplicated package-action union from separately
// sealed, digest-pinned publisher builds. Equal ActionIDs must retain their
// complete mapping and package evidence; each OutputID is written to one membership
// pack. The final manifest digest still needs a trusted release metadata pin.
//
// @evidence contracts/common.md#principled-implementation Every input manifest and transport ZIP is verified against the operator's separate digest before equal Go actions are joined; conflicting mappings or package evidence fail, while path-dependent command diagnostics use a deterministic representative.
// @evidence contracts/common.md#clear-and-simple-design One release plan names the approved publisher builds, output directory and immutable URL base; action membership determines reusable common and composition-specific packs.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Go's full recorded ActionIDs and OutputIDs are copied, never recomputed from package names or an aggregate composition digest.
// @evidence contracts/common.md#meaningful-documentation The comment distinguishes a verified input union from the later release trust pin needed by consumers.
// @evidence contracts/portability.md#os-neutral-implementation Native absolute paths and standard ZIP APIs read publisher files; transport entry names and pack names are platform neutral.
// @evidence contracts/performance.md#efficient-algorithms Maps deduplicate actions and outputs once, and each selected body is streamed to exactly one sorted output ZIP without holding decoded archives in memory.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Release publication is a one-shot explicit operation; a changed plan or input is verified afresh.
// @evidence contracts/performance.md#bound-retention-and-release-resources The plan and manifest have byte/count caps, input archives close after merging, staging ZIPs are removed on failure and output packs retain only verified immutable bytes.
func MergeRecordedPacks(planPath string) error {
  if !filepath.IsAbs(planPath) {
    return errors.New("merge plan must be absolute")
  }
  raw, err := readBoundedFile(planPath, 64<<10)
  if err != nil {
    return err
  }
  var plan mergePlan
  decoder := json.NewDecoder(strings.NewReader(string(raw)))
  decoder.DisallowUnknownFields()
  if err := decoder.Decode(&plan); err != nil {
    return fmt.Errorf("decode release merge plan: %w", err)
  }
  var trailing any
  if err := decoder.Decode(&trailing); err != io.EOF {
    return errors.New("release merge plan has trailing data")
  }
  if plan.Schema != 1 || len(plan.Inputs) < 2 || len(plan.Inputs) > 8 || !filepath.IsAbs(plan.OutputDir) || plan.PackURLBase == "" {
    return errors.New("release merge plan has unsupported inputs or output")
  }
  var openFiles []*os.File
  defer func() {
    for _, file := range openFiles {
      file.Close()
    }
  }()
  seenNames := make(map[string]bool)
  actions := make(map[string]mergeAction)
  bodies := make(map[string]mergeBody)
  var first packageartifacts.Manifest
  var graphDigests []string
  for index, input := range plan.Inputs {
    if !validPackName(input.Name) || input.Name == "common" || seenNames[input.Name] || !filepath.IsAbs(input.Manifest) || !validID(input.SHA256) {
      return errors.New("release merge input has an unsafe name, path or digest")
    }
    seenNames[input.Name] = true
    manifestRaw, err := readBoundedFile(input.Manifest, packageartifacts.MaxManifestBytes)
    if err != nil {
      return err
    }
    manifest, err := packageartifacts.ParseTrustedManifest(manifestRaw, input.SHA256)
    if err != nil {
      return fmt.Errorf("merge input %s: %w", input.Name, err)
    }
    if index == 0 {
      first = manifest
    } else if manifest.Release != first.Release || manifest.SourceCommit != first.SourceCommit || !reflect.DeepEqual(manifest.Tuple, first.Tuple) {
      return fmt.Errorf("merge input %s belongs to another release or Go tuple", input.Name)
    }
    graphDigests = append(graphDigests, manifest.GraphSHA256)
    packBodies := make(map[string]map[string]int64)
    for _, action := range manifest.Actions {
      if packBodies[action.Pack] == nil {
        packBodies[action.Pack] = make(map[string]int64)
      }
      packBodies[action.Pack][action.OutputID] = action.BodyLength
    }
    packEntries := make(map[string]map[string]*zip.File)
    for _, pack := range manifest.Packs {
      filename := filepath.Join(filepath.Dir(input.Manifest), pack.Name+"-"+pack.SHA256+".zip")
      actual, err := hashFile(filename, packageartifacts.MaxPackBytes)
      if err != nil || actual.digest != pack.SHA256 || actual.length != pack.Length {
        return fmt.Errorf("merge input %s has a missing or corrupt pack %s", input.Name, pack.Name)
      }
      file, err := os.Open(filename)
      if err != nil {
        return err
      }
      openFiles = append(openFiles, file)
      reader, err := zip.NewReader(file, pack.Length)
      if err != nil || len(reader.File) != pack.FileCount {
        return fmt.Errorf("merge input %s has an invalid ZIP catalog", input.Name)
      }
      entries := make(map[string]*zip.File, len(reader.File))
      for _, entry := range reader.File {
        outputID := strings.TrimPrefix(entry.Name, "bodies/")
        length, exists := packBodies[pack.Name][outputID]
        if !strings.HasPrefix(entry.Name, "bodies/") || !exists || entries[outputID] != nil || entry.UncompressedSize64 != uint64(length) {
          return fmt.Errorf("merge input %s has an unexpected ZIP body", input.Name)
        }
        entries[outputID] = entry
      }
      packEntries[pack.Name] = entries
    }
    member := uint8(1 << index)
    for _, action := range manifest.Actions {
      sourcePack := action.Pack
      previous, exists := actions[action.ActionID]
      if exists {
        action.Pack = previous.action.Pack
        commandDigest := action.CommandSHA256
        action.CommandSHA256 = previous.action.CommandSHA256
        if !reflect.DeepEqual(previous.action, action) {
          return fmt.Errorf("conflicting publisher action %s", action.ActionID)
        }
        if commandDigest < previous.action.CommandSHA256 {
          previous.action.CommandSHA256 = commandDigest
        }
        previous.members |= member
        actions[action.ActionID] = previous
      } else {
        actions[action.ActionID] = mergeAction{action: action, members: member}
      }
      body := bodies[action.OutputID]
      if body.source != nil && body.length != action.BodyLength {
        return fmt.Errorf("conflicting publisher body %s", action.OutputID)
      }
      body.length = action.BodyLength
      body.members |= member
      if body.source == nil {
        body.source = packEntries[sourcePack][action.OutputID]
      }
      if body.source == nil {
        return fmt.Errorf("publisher body %s has no ZIP entry", action.OutputID)
      }
      bodies[action.OutputID] = body
    }
  }
  if len(actions) > 100000 || len(bodies) > 100000 {
    return errors.New("merged release exceeds action policy")
  }
  if err := os.MkdirAll(plan.OutputDir, 0700); err != nil {
    return err
  }
  groups := make(map[uint8][]string)
  for outputID, body := range bodies {
    groups[body.members] = append(groups[body.members], outputID)
  }
  if len(groups) > 64 {
    return errors.New("merged release exceeds pack policy")
  }
  manifest := packageartifacts.Manifest{
    Schema: 1, Release: first.Release, SourceCommit: first.SourceCommit, Tuple: first.Tuple,
    GraphSHA256: digestBytes([]byte(strings.Join(graphDigests, "\n"))),
  }
  groupNames := make(map[uint8]string)
  usedNames := make(map[string]bool)
  for members, ids := range groups {
    sort.Strings(ids)
    var names []string
    for index, input := range plan.Inputs {
      if members&(1<<index) != 0 {
        names = append(names, input.Name)
      }
    }
    name := "common"
    if len(names) == 1 {
      name = names[0]
    } else if len(names) != len(plan.Inputs) {
      name = "shared-" + digestBytes([]byte(strings.Join(names, ",")))[:16]
    }
    if usedNames[name] {
      return fmt.Errorf("merged pack name %s collides", name)
    }
    usedNames[name] = true
    groupNames[members] = name
    pack, err := writeMergedPack(plan.OutputDir, plan.PackURLBase, name, ids, bodies)
    if err != nil {
      return err
    }
    manifest.Packs = append(manifest.Packs, pack)
  }
  for _, value := range actions {
    action := value.action
    action.Pack = groupNames[bodies[action.OutputID].members]
    manifest.Actions = append(manifest.Actions, action)
  }
  sort.Slice(manifest.Packs, func(i, j int) bool { return manifest.Packs[i].Name < manifest.Packs[j].Name })
  sort.Slice(manifest.Actions, func(i, j int) bool { return manifest.Actions[i].ActionID < manifest.Actions[j].ActionID })
  manifestRaw, err := json.MarshalIndent(manifest, "", "  ")
  if err != nil {
    return err
  }
  manifestRaw = append(manifestRaw, '\n')
  digest := digestBytes(manifestRaw)
  if _, err := packageartifacts.ParseTrustedManifest(manifestRaw, digest); err != nil {
    return err
  }
  manifestFile, err := os.OpenFile(filepath.Join(plan.OutputDir, "manifest.json"), os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
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
    ManifestSHA256 string `json:"manifestSHA256"`
    Actions        int    `json:"actions"`
    Packs          int    `json:"packs"`
  }{digest, len(manifest.Actions), len(manifest.Packs)})
}

func writeMergedPack(directory, urlBase, name string, ids []string, bodies map[string]mergeBody) (packageartifacts.Pack, error) {
  var pack packageartifacts.Pack
  stage, err := os.CreateTemp(directory, ".ttsc-merge-*.zip")
  if err != nil {
    return pack, err
  }
  defer os.Remove(stage.Name())
  writer := zip.NewWriter(stage)
  writer.RegisterCompressor(zip.Deflate, func(destination io.Writer) (io.WriteCloser, error) {
    return flate.NewWriter(destination, flate.BestSpeed)
  })
  var decoded int64
  for _, outputID := range ids {
    body := bodies[outputID]
    if body.length > packageartifacts.MaxPackDecodedBytes-decoded {
      writer.Close()
      stage.Close()
      return pack, errors.New("merged pack exceeds decoded byte policy")
    }
    input, err := body.source.Open()
    if err != nil {
      writer.Close()
      stage.Close()
      return pack, err
    }
    entry, err := writer.Create("bodies/" + outputID)
    if err != nil {
      input.Close()
      writer.Close()
      stage.Close()
      return pack, err
    }
    hash := sha256.New()
    count, copyErr := io.Copy(io.MultiWriter(entry, hash), io.LimitReader(input, body.length+1))
    closeErr := input.Close()
    if copyErr != nil || closeErr != nil || count != body.length || hex.EncodeToString(hash.Sum(nil)) != outputID {
      writer.Close()
      stage.Close()
      return pack, fmt.Errorf("merged body %s failed verification: %w", outputID, errors.Join(copyErr, closeErr))
    }
    decoded += count
  }
  if err := writer.Close(); err != nil {
    stage.Close()
    return pack, err
  }
  if err := stage.Sync(); err != nil {
    stage.Close()
    return pack, err
  }
  if err := stage.Close(); err != nil {
    return pack, err
  }
  digest, err := hashFile(stage.Name(), packageartifacts.MaxPackBytes)
  if err != nil {
    return pack, err
  }
  filename := name + "-" + digest.digest + ".zip"
  final := filepath.Join(directory, filename)
  if err := os.Link(stage.Name(), final); err != nil {
    if !errors.Is(err, os.ErrExist) {
      return pack, err
    }
    previous, hashErr := hashFile(final, packageartifacts.MaxPackBytes)
    if hashErr != nil || previous != digest {
      return pack, errors.New("existing merged pack differs from verified bytes")
    }
  }
  return packageartifacts.Pack{
    Name: name, URL: strings.TrimRight(urlBase, "/") + "/" + filename,
    SHA256: digest.digest, Length: digest.length, DecodedBytes: decoded, FileCount: len(ids),
  }, nil
}
