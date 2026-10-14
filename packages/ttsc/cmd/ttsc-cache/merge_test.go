package main

import (
  "archive/zip"
  "bytes"
  "crypto/sha256"
  "encoding/hex"
  "encoding/json"
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/packageartifacts"
)

// TestMergeRecordedPacks checks that a release union retains complete action
// mappings while placing shared bytes in one pack and rejecting a conflict.
//
// Verifies: two authenticated publisher catalogs with one common action yield
// three packs and one common body, despite workspace-specific command hashes.
// A conflicting OutputID for the same ActionID stops the union.
// 1. Write two publisher manifests and packs with one shared action.
// 2. Merge twice and check pack membership, action mapping and identical output.
// 3. Change the shared action body and require the merge to reject the conflict.
//
// @evidence contracts/testing.md#behavioral-verification Calls the production merger on separately serialized manifests and ZIPs, then parses the produced catalog with its reported digest.
// @evidence contracts/testing.md#independent-expectations Literal body bytes define SHA-256 output identities independently of merge output; the expected three pack memberships follow from the input overlap.
// @evidence contracts/testing.md#distinguishing-cases A shared action with differing command diagnostics succeeds, whereas an equal ActionID with a different body fails.
// @evidence contracts/testing.md#execution-ownership All publisher inputs and merged output reside under t.TempDir and need no external server, installation, or sibling repository.
func TestMergeRecordedPacks(t *testing.T) {
  root := t.TempDir()
  hash := func(value []byte) string {
    sum := sha256.Sum256(value)
    return hex.EncodeToString(sum[:])
  }
  common := []byte("common archive")
  alpha := []byte("alpha archive")
  beta := []byte("beta archive")
  makeAction := func(key, body, command string) packageartifacts.Action {
    return packageartifacts.Action{
      ActionID: strings.Repeat(key, 64), OutputID: hash([]byte(body)),
      BodySHA256: hash([]byte(body)), BodyLength: int64(len(body)),
      Kind: "archive", PackagePath: "example.org/" + key,
      ModulePath: "example.org/fixture", ModuleRole: "main",
      SelectedSourceSHA: strings.Repeat("d", 64), CommandSHA256: strings.Repeat(command, 64),
      DirectInputs: []string{},
    }
  }
  writeInput := func(name string, sharedCommand string, own []byte, conflict bool) (string, string) {
    t.Helper()
    directory := filepath.Join(root, name)
    if err := os.Mkdir(directory, 0700); err != nil {
      t.Fatal(err)
    }
    shared := makeAction("a", string(common), sharedCommand)
    if conflict {
      shared = makeAction("a", "conflicting archive", sharedCommand)
    }
    uniqueKey := "b"
    if strings.HasPrefix(name, "beta") {
      uniqueKey = "c"
    }
    unique := makeAction(uniqueKey, string(own), "e")
    shared.Pack, unique.Pack = name, name
    var archive bytes.Buffer
    writer := zip.NewWriter(&archive)
    sharedBody := common
    if conflict {
      sharedBody = []byte("conflicting archive")
    }
    for _, body := range [][]byte{sharedBody, own} {
      entry, err := writer.Create("bodies/" + hash(body))
      if err != nil {
        t.Fatal(err)
      }
      if _, err := entry.Write(body); err != nil {
        t.Fatal(err)
      }
    }
    if err := writer.Close(); err != nil {
      t.Fatal(err)
    }
    packHash := hash(archive.Bytes())
    if err := os.WriteFile(filepath.Join(directory, name+"-"+packHash+".zip"), archive.Bytes(), 0600); err != nil {
      t.Fatal(err)
    }
    manifest := packageartifacts.Manifest{
      Schema: 1, Release: "1.0.0", SourceCommit: strings.Repeat("f", 40),
      GraphSHA256: strings.Repeat("0", 64),
      Tuple: packageartifacts.Tuple{
        GoVersion: "go1.26.0", GoToolSHA256: strings.Repeat("1", 64),
        GOOS: "windows", GOARCH: "amd64", CGOEnabled: "0",
        BuildFlags: []string{"-trimpath"}, ToolIDsSHA256: strings.Repeat("2", 64),
      },
      Packs: []packageartifacts.Pack{{
        Name: name, URL: "http://127.0.0.1:1/" + name, SHA256: packHash,
        Length: int64(archive.Len()), DecodedBytes: int64(len(sharedBody) + len(own)), FileCount: 2,
      }},
      Actions: []packageartifacts.Action{shared, unique},
    }
    raw, err := json.Marshal(manifest)
    if err != nil {
      t.Fatal(err)
    }
    path := filepath.Join(directory, "manifest.json")
    if err := os.WriteFile(path, raw, 0600); err != nil {
      t.Fatal(err)
    }
    return path, hash(raw)
  }
  firstPath, firstHash := writeInput("alpha", "3", alpha, false)
  secondPath, secondHash := writeInput("beta", "4", beta, false)
  writePlan := func(output, otherPath, otherHash string) string {
    t.Helper()
    plan := mergePlan{Schema: 1, PackURLBase: "http://127.0.0.1:1/release", OutputDir: filepath.Join(root, output)}
    plan.Inputs = make([]struct {
      Name     string `json:"name"`
      Manifest string `json:"manifest"`
      SHA256   string `json:"sha256"`
    }, 2)
    plan.Inputs[0].Name, plan.Inputs[0].Manifest, plan.Inputs[0].SHA256 = "alpha", firstPath, firstHash
    plan.Inputs[1].Name, plan.Inputs[1].Manifest, plan.Inputs[1].SHA256 = "beta", otherPath, otherHash
    raw, err := json.Marshal(plan)
    if err != nil {
      t.Fatal(err)
    }
    path := filepath.Join(root, output+"-plan.json")
    if err := os.WriteFile(path, raw, 0600); err != nil {
      t.Fatal(err)
    }
    return path
  }
  if err := MergeRecordedPacks(writePlan("merged", secondPath, secondHash)); err != nil {
    t.Fatal(err)
  }
  raw, err := os.ReadFile(filepath.Join(root, "merged", "manifest.json"))
  if err != nil {
    t.Fatal(err)
  }
  merged, err := packageartifacts.ParseTrustedManifest(raw, hash(raw))
  if err != nil || len(merged.Packs) != 3 || len(merged.Actions) != 3 {
    t.Fatalf("invalid union: packs=%d actions=%d err=%v", len(merged.Packs), len(merged.Actions), err)
  }
  if err := MergeRecordedPacks(writePlan("repeated", secondPath, secondHash)); err != nil {
    t.Fatal(err)
  }
  repeated, err := os.ReadFile(filepath.Join(root, "repeated", "manifest.json"))
  if err != nil || !bytes.Equal(raw, repeated) {
    t.Fatalf("equivalent release plans differed: %v", err)
  }
  for _, action := range merged.Actions {
    if action.ActionID == strings.Repeat("a", 64) && (action.Pack != "common" || action.CommandSHA256 != strings.Repeat("3", 64)) {
      t.Fatalf("common action lost deterministic evidence or membership: %+v", action)
    }
  }
  conflictPath, conflictHash := writeInput("beta-conflict", "4", beta, true)
  if err := MergeRecordedPacks(writePlan("rejected", conflictPath, conflictHash)); err == nil || !strings.Contains(err.Error(), "conflicting publisher action") {
    t.Fatalf("conflicting full action was accepted: %v", err)
  }
}
