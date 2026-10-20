package main

import (
  "bufio"
  "bytes"
  "context"
  "encoding/base64"
  "encoding/hex"
  "encoding/json"
  "errors"
  "flag"
  "fmt"
  "io"
  "os"
  "path/filepath"
  "strings"

  "github.com/samchon/ttsc/packages/ttsc/internal/packageartifacts"
)

type request struct {
  ID       int64
  Command  string
  ActionID []byte
  OutputID []byte
  BodySize int64
}

type response struct {
  ID            int64
  Err           string   `json:",omitempty"`
  KnownCommands []string `json:",omitempty"`
  Miss          bool     `json:",omitempty"`
  OutputID      []byte   `json:",omitempty"`
  Size          int64    `json:",omitempty"`
  DiskPath      string   `json:",omitempty"`
}

func main() {
  if err := run(); err != nil {
    fmt.Fprintln(os.Stderr, "ttsc cache helper:", err)
    os.Exit(1)
  }
}

func run() error {
  rootPath := flag.String("root", "", "owned artifact cache root")
  manifestPath := flag.String("manifest", "", "authenticated publisher manifest")
  manifestDigest := flag.String("manifest-sha256", "", "trusted release metadata digest")
  prepare := flag.Bool("prepare", false, "download and verify selected packs before a Go build")
  packNames := flag.String("packs", "", "comma-separated selected pack names")
  tupleMode := flag.Bool("tuple", false, "report the effective stock-Go artifact tuple")
  goBinary := flag.String("go", "", "regular Go executable used by the source builder")
  seal := flag.Bool("seal", false, "seal recorded publisher actions into an immutable pack")
  merge := flag.Bool("merge", false, "merge independently sealed publisher packs")
  plan := flag.String("plan", "", "absolute JSON release merge plan")
  verify := flag.Bool("verify", false, "validate a trusted release manifest without using a cache")
  actionGraph := flag.String("actiongraph", "", "Go -debug-actiongraph JSON from the recording build")
  packageReceipts := flag.String("packages", "", "Go list -deps -json -compiled receipts from the same workspace")
  release := flag.String("release", "", "ttsc release version")
  sourceCommit := flag.String("source-commit", "", "full source commit")
  packURLBase := flag.String("pack-url-base", "", "immutable pack URL directory")
  packName := flag.String("pack-name", "", "safe transport pack name")
  outputDir := flag.String("out", "", "publisher output directory")
  receiptName := flag.String("receipt-name", "", "optional local per-build usage receipt ID")
  flag.Parse()
  if *merge {
    if *plan == "" || *rootPath != "" || *manifestPath != "" || *manifestDigest != "" || *prepare || *packNames != "" || *tupleMode || *goBinary != "" || *seal || *verify || *actionGraph != "" || *packageReceipts != "" || *release != "" || *sourceCommit != "" || *packURLBase != "" || *packName != "" || *outputDir != "" || *receiptName != "" {
      return errors.New("supply only -merge and -plan for release union")
    }
    return MergeRecordedPacks(*plan)
  }
  if *plan != "" {
    return errors.New("-plan requires -merge")
  }
  if *verify {
    if *manifestPath == "" || *manifestDigest == "" || *rootPath != "" || *prepare || *packNames != "" || *tupleMode || *goBinary != "" || *seal || *actionGraph != "" || *packageReceipts != "" || *release != "" || *sourceCommit != "" || *packURLBase != "" || *packName != "" || *outputDir != "" || *receiptName != "" {
      return errors.New("supply only -verify and trusted manifest arguments")
    }
    _, err := loadTrustedManifest(*manifestPath, *manifestDigest)
    return err
  }
  if *seal {
    if *rootPath == "" || *goBinary == "" || *actionGraph == "" || *packageReceipts == "" || *release == "" || *sourceCommit == "" || *packURLBase == "" || *packName == "" || *outputDir == "" || *manifestPath != "" || *manifestDigest != "" || *prepare || *tupleMode || *packNames != "" || *receiptName != "" {
      return errors.New("incomplete or conflicting publisher seal arguments")
    }
    return SealRecordedActions(sealOptions{root: *rootPath, goBinary: *goBinary, actionGraph: *actionGraph, packages: *packageReceipts, release: *release, sourceCommit: *sourceCommit, packURLBase: *packURLBase, packName: *packName, outputDir: *outputDir})
  }
  if *tupleMode {
    if *goBinary == "" || *rootPath != "" || *manifestPath != "" || *manifestDigest != "" || *prepare || *packNames != "" || *receiptName != "" {
      return errors.New("supply only -tuple and -go for tuple inspection")
    }
    value, err := readGoTuple(*goBinary)
    if err != nil {
      return err
    }
    return json.NewEncoder(os.Stdout).Encode(value)
  }
  if *rootPath == "" || (*manifestPath == "") != (*manifestDigest == "") || (*prepare && (*manifestPath == "" || *packNames == "")) || (!*prepare && *packNames != "") || (*prepare && *receiptName != "") || (*receiptName != "" && !validReceiptName(*receiptName)) {
    return errors.New("supply -root and either both publisher manifest arguments or neither")
  }
  var manifest *packageartifacts.Manifest
  if *manifestPath != "" {
    decoded, err := loadTrustedManifest(*manifestPath, *manifestDigest)
    if err != nil {
      return err
    }
    manifest = &decoded
  }
  store, err := openArtifactStore(*rootPath, manifest)
  if err != nil {
    return err
  }
  defer store.close()
  store.receiptName = *receiptName
  if *prepare {
    receipt, err := preparePacks(context.Background(), store, *manifest, strings.Split(*packNames, ","))
    if err != nil {
      return err
    }
    return json.NewEncoder(os.Stdout).Encode(receipt)
  }
  return serve(os.Stdin, os.Stdout, store)
}

func loadTrustedManifest(location, digest string) (packageartifacts.Manifest, error) {
  raw, err := readBoundedFile(location, packageartifacts.MaxManifestBytes)
  if err != nil {
    return packageartifacts.Manifest{}, err
  }
  return packageartifacts.ParseTrustedManifest(raw, digest)
}

func serve(source io.Reader, destination io.Writer, store *artifactStore) error {
  usage := usageReceipt{
    BaseActionIDs: []string{}, OverlayActionIDs: []string{},
    MissActionIDs: []string{}, PutActionIDs: []string{},
  }
  input := bufio.NewReaderSize(source, 64<<10)
  output := bufio.NewWriter(destination)
  if err := writeResponse(output, response{KnownCommands: []string{"get", "put", "close"}}); err != nil {
    return err
  }
  for {
    line, err := input.ReadSlice('\n')
    if err != nil {
      return fmt.Errorf("reading Go cache request: %w", err)
    }
    if len(bytes.TrimSpace(line)) == 0 {
      continue
    }
    decoder := json.NewDecoder(bytes.NewReader(line))
    decoder.DisallowUnknownFields()
    var current request
    if err := decoder.Decode(&current); err != nil {
      return fmt.Errorf("decoding Go cache request: %w", err)
    }
    answer := response{ID: current.ID}
    switch current.Command {
    case "get":
      usage.Gets++
      if len(current.ActionID) != 32 {
        answer.Err = "invalid full Go ActionID"
        break
      }
      actionID := hex.EncodeToString(current.ActionID)
      value, location, found, err := store.get(actionID)
      if err != nil {
        answer.Err = err.Error()
      } else if !found {
        answer.Miss = true
        usage.Misses++
        usage.record(&usage.MissActionIDs, actionID)
      } else {
        if strings.HasPrefix(location, filepath.Join(store.path, "base")+string(os.PathSeparator)) {
          usage.BaseHits++
          usage.record(&usage.BaseActionIDs, actionID)
        } else {
          usage.OverlayHits++
          usage.record(&usage.OverlayActionIDs, actionID)
        }
        answer.OutputID, _ = hex.DecodeString(value.OutputID)
        answer.Size = value.Size
        answer.DiskPath = location
      }
    case "put":
      if len(current.ActionID) != 32 || len(current.OutputID) != 32 || current.BodySize < 0 || current.BodySize > 512<<20 {
        return errors.New("invalid full Go cache put identity or body size")
      }
      // Go 1.26 and 1.27 write an extra newline after the encoded request.
      separator, err := input.ReadByte()
      if err != nil || separator != '\n' {
        return errors.New("missing Go cache request separator")
      }
      var body io.Reader = bytes.NewReader(nil)
      if current.BodySize > 0 {
        quote, err := input.ReadByte()
        if err != nil || quote != '"' {
          return errors.New("missing Go cache body framing")
        }
        encodedLength := ((current.BodySize + 2) / 3) * 4
        body = base64.NewDecoder(base64.StdEncoding, io.LimitReader(input, encodedLength))
      }
      location, putErr := store.put(hex.EncodeToString(current.ActionID), hex.EncodeToString(current.OutputID), current.BodySize, body)
      if current.BodySize > 0 {
        end, err := input.ReadByte()
        if err != nil || end != '"' {
          return errors.New("truncated Go cache body framing")
        }
        end, err = input.ReadByte()
        if err != nil || end != '\n' {
          return errors.New("invalid Go cache body terminator")
        }
      }
      if putErr != nil {
        answer.Err = putErr.Error()
      } else {
        answer.DiskPath = location
        usage.Puts++
        usage.PutBytes += current.BodySize
        usage.record(&usage.PutActionIDs, hex.EncodeToString(current.ActionID))
      }
    case "close":
      if store.receiptName != "" {
        if accounting, err := accountArtifactStore(store); err == nil {
          usage.Storage = &accounting
        } else {
          fmt.Fprintln(os.Stderr, "ttsc cache helper: storage accounting unavailable:", err)
        }
        if err := writeUsageReceipt(store, usage); err != nil {
          fmt.Fprintln(os.Stderr, "ttsc cache helper: usage receipt unavailable:", err)
        }
      }
      if err := writeResponse(output, answer); err != nil {
        return err
      }
      return nil
    default:
      answer.Err = "unsupported Go cache command"
    }
    if err := writeResponse(output, answer); err != nil {
      return err
    }
  }
}

func writeResponse(output *bufio.Writer, value response) error {
  if err := json.NewEncoder(output).Encode(value); err != nil {
    return err
  }
  return output.Flush()
}
