package main

import (
  "archive/zip"
  "bytes"
  "context"
  "crypto/sha256"
  "encoding/hex"
  "errors"
  "net/http"
  "net/http/httptest"
  "os"
  "strings"
  "sync"
  "sync/atomic"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/internal/packageartifacts"
)

// TestPreparePacks verifies authenticated local admission from bounded bulk transport.
//
// Verifies: a complete pack is locally reusable, while transfer corruption, body corruption, traversal, count mismatch and cancellation leave no admitted base.
// 1. Serve a ZIP with one Go body from a loopback server and admit it.
// 2. Prepare the same pack again without a second request and get its full action locally.
// 3. Break transport or ZIP contents and require a miss after rejection.
//
// @evidence contracts/testing.md#behavioral-verification Uses the production HTTP, ZIP and rooted storage operations, asserting request counts, decoded bytes, a local get and absence of an admitted base after each failure.
// @evidence contracts/testing.md#independent-expectations SHA-256 of literal payload and ZIP bytes supplies body and transport expectations independently of preparation; a complete pack has one named body and no other entry.
// @evidence contracts/testing.md#distinguishing-cases Covers success, redirect request accounting, repeated and concurrent preparation, a cancelled waiter, corrupt transfer, corrupt decoded body, traversal, wrong file count, in-flight deadline and prior cancellation; helper lifetime and real remote transfer costs are separate boundaries.
// @evidence contracts/testing.md#execution-ownership This Go unit test uses an in-process loopback server and temporary owned store, without building a native helper or installing a consumer.
func TestPreparePacks(t *testing.T) {
  body := []byte("package archive bytes")
  bodyHash := sha256.Sum256(body)
  outputID := hex.EncodeToString(bodyHash[:])
  actionID := strings.Repeat("a", 64)
  makeZIP := func(name string, value []byte) []byte {
    var buffer bytes.Buffer
    writer := zip.NewWriter(&buffer)
    entry, err := writer.Create(name)
    if err != nil {
      t.Fatal(err)
    }
    if _, err := entry.Write(value); err != nil {
      t.Fatal(err)
    }
    if err := writer.Close(); err != nil {
      t.Fatal(err)
    }
    return buffer.Bytes()
  }
  goodZIP := makeZIP("bodies/"+outputID, body)
  for _, scenario := range []struct {
    name      string
    zip       []byte
    served    []byte
    valid     bool
    cancel    bool
    fileCount int
  }{
    {name: "complete", zip: goodZIP, served: goodZIP, valid: true},
    {name: "corrupt transfer", zip: goodZIP, served: append([]byte(nil), goodZIP[:len(goodZIP)-1]...)},
    {name: "corrupt body", zip: makeZIP("bodies/"+outputID, append([]byte("X"), body[1:]...))},
    {name: "traversal", zip: makeZIP("../outside", body)},
    {name: "wrong file count", zip: goodZIP, fileCount: 2},
    {name: "cancelled", zip: goodZIP, served: goodZIP, cancel: true},
  } {
    t.Run(scenario.name, func(t *testing.T) {
      served := scenario.served
      if served == nil {
        served = scenario.zip
      }
      requests := 0
      server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
        requests++
        _, _ = w.Write(served)
      }))
      defer server.Close()
      zipHash := sha256.Sum256(scenario.zip)
      fileCount := scenario.fileCount
      if fileCount == 0 {
        fileCount = 1
      }
      manifest := packageartifacts.Manifest{
        Packs: []packageartifacts.Pack{{
          Name: "base", URL: server.URL, SHA256: hex.EncodeToString(zipHash[:]),
          Length: int64(len(scenario.zip)), DecodedBytes: int64(len(body)), FileCount: fileCount,
        }},
        Actions: []packageartifacts.Action{{
          ActionID: actionID, OutputID: outputID, BodySHA256: outputID,
          BodyLength: int64(len(body)), Pack: "base", Kind: "archive",
        }},
      }
      store, err := openArtifactStore(t.TempDir(), &manifest)
      if err != nil {
        t.Fatal(err)
      }
      defer store.close()
      ctx := context.Background()
      if scenario.cancel {
        cancelled, cancel := context.WithCancel(ctx)
        cancel()
        ctx = cancelled
      }
      receipt, err := preparePacks(ctx, store, manifest, []string{"base"})
      if scenario.valid {
        if err != nil || receipt.Requests != 1 || receipt.DownloadedPacks != 1 || receipt.DecodedBytes != int64(len(body)) || receipt.Storage.BaseBytes < int64(len(body)) || receipt.Storage.StagingBytes != 0 {
          t.Fatalf("valid pack not prepared: %+v %v", receipt, err)
        }
        value, location, found, err := store.get(actionID)
        if err != nil || !found || value.OutputID != outputID {
          t.Fatalf("admitted action unavailable: %+v %q %v %v", value, location, found, err)
        }
        read, err := os.ReadFile(location)
        if err != nil || !bytes.Equal(read, body) {
          t.Fatalf("admitted bytes differ: %q %v", read, err)
        }
        second, err := preparePacks(ctx, store, manifest, []string{"base"})
        if err != nil || second.Requests != 0 || requests != 1 {
          t.Fatalf("repeat fetched a complete pack: %+v %v requests=%d", second, err, requests)
        }
      } else {
        if err == nil {
          t.Fatal("invalid pack was admitted")
        }
        _, _, found, getErr := store.get(actionID)
        if getErr != nil || found {
          t.Fatalf("failed pack became a hit: %v %v", found, getErr)
        }
        if scenario.name == "corrupt transfer" {
          final := "base/packs/base-" + manifest.Packs[0].SHA256
          if err := store.root.Mkdir(final, 0700); err != nil {
            t.Fatal(err)
          }
          _, _, found, getErr = store.get(actionID)
          if getErr != nil || found {
            t.Fatalf("incomplete final pack became a hit or error: %v %v", found, getErr)
          }
        }
      }
    })
  }
  t.Run("redirect requests are counted", func(t *testing.T) {
    var requests atomic.Int64
    target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
      requests.Add(1)
      _, _ = w.Write(goodZIP)
    }))
    defer target.Close()
    redirect := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
      requests.Add(1)
      http.Redirect(w, request, target.URL, http.StatusFound)
    }))
    defer redirect.Close()
    zipHash := sha256.Sum256(goodZIP)
    manifest := packageartifacts.Manifest{
      Packs: []packageartifacts.Pack{{
        Name: "base", URL: redirect.URL, SHA256: hex.EncodeToString(zipHash[:]),
        Length: int64(len(goodZIP)), DecodedBytes: int64(len(body)), FileCount: 1,
      }},
      Actions: []packageartifacts.Action{{
        ActionID: actionID, OutputID: outputID, BodySHA256: outputID,
        BodyLength: int64(len(body)), Pack: "base", Kind: "archive",
      }},
    }
    store, err := openArtifactStore(t.TempDir(), &manifest)
    if err != nil {
      t.Fatal(err)
    }
    defer store.close()
    receipt, err := preparePacks(context.Background(), store, manifest, []string{"base"})
    if err != nil || receipt.Requests != 2 || requests.Load() != 2 {
      t.Fatalf("redirect transfer request count differs: %+v %v requests=%d", receipt, err, requests.Load())
    }
  })
  t.Run("concurrent equivalent preparations", func(t *testing.T) {
    var requests atomic.Int64
    started := make(chan struct{})
    release := make(chan struct{})
    var once sync.Once
    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
      requests.Add(1)
      once.Do(func() { close(started) })
      <-release
      _, _ = w.Write(goodZIP)
    }))
    defer server.Close()
    zipHash := sha256.Sum256(goodZIP)
    manifest := packageartifacts.Manifest{
      Packs: []packageartifacts.Pack{{
        Name: "base", URL: server.URL, SHA256: hex.EncodeToString(zipHash[:]),
        Length: int64(len(goodZIP)), DecodedBytes: int64(len(body)), FileCount: 1,
      }},
      Actions: []packageartifacts.Action{{
        ActionID: actionID, OutputID: outputID, BodySHA256: outputID,
        BodyLength: int64(len(body)), Pack: "base", Kind: "archive",
      }},
    }
    root := t.TempDir()
    stores := make([]*artifactStore, 2)
    for index := range stores {
      var err error
      stores[index], err = openArtifactStore(root, &manifest)
      if err != nil {
        t.Fatal(err)
      }
      defer stores[index].close()
    }
    type result struct {
      receipt preparationReceipt
      err     error
    }
    results := make(chan result, 2)
    for _, store := range stores {
      go func(store *artifactStore) {
        ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
        defer cancel()
        receipt, err := preparePacks(ctx, store, manifest, []string{"base"})
        results <- result{receipt, err}
      }(store)
    }
    select {
    case <-started:
    case <-time.After(5 * time.Second):
      t.Fatal("first transfer did not start")
    }
    close(release)
    var downloads int
    for range stores {
      select {
      case outcome := <-results:
        if outcome.err != nil {
          t.Fatal(outcome.err)
        }
        downloads += outcome.receipt.DownloadedPacks
      case <-time.After(10 * time.Second):
        t.Fatal("concurrent preparation did not settle")
      }
    }
    if requests.Load() != 1 || downloads != 1 {
      t.Fatalf("equivalent preparations did not share one transfer: requests=%d downloads=%d", requests.Load(), downloads)
    }
  })
  t.Run("cancelled waiter preserves owner", func(t *testing.T) {
    var requests atomic.Int64
    started := make(chan struct{})
    release := make(chan struct{})
    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
      requests.Add(1)
      close(started)
      <-release
      _, _ = w.Write(goodZIP)
    }))
    defer server.Close()
    zipHash := sha256.Sum256(goodZIP)
    manifest := packageartifacts.Manifest{
      Packs: []packageartifacts.Pack{{
        Name: "base", URL: server.URL, SHA256: hex.EncodeToString(zipHash[:]),
        Length: int64(len(goodZIP)), DecodedBytes: int64(len(body)), FileCount: 1,
      }},
      Actions: []packageartifacts.Action{{
        ActionID: actionID, OutputID: outputID, BodySHA256: outputID,
        BodyLength: int64(len(body)), Pack: "base", Kind: "archive",
      }},
    }
    root := t.TempDir()
    owner, err := openArtifactStore(root, &manifest)
    if err != nil {
      t.Fatal(err)
    }
    defer owner.close()
    waiter, err := openArtifactStore(root, &manifest)
    if err != nil {
      t.Fatal(err)
    }
    defer waiter.close()
    settled := make(chan error, 1)
    go func() {
      _, err := preparePacks(context.Background(), owner, manifest, []string{"base"})
      settled <- err
    }()
    select {
    case <-started:
    case <-time.After(5 * time.Second):
      t.Fatal("preparation owner did not start")
    }
    ctx, cancel := context.WithCancel(context.Background())
    cancel()
    if _, err := preparePacks(ctx, waiter, manifest, []string{"base"}); !errors.Is(err, context.Canceled) {
      t.Fatalf("cancelled waiter did not leave independently: %v", err)
    }
    close(release)
    select {
    case err := <-settled:
      if err != nil || requests.Load() != 1 {
        t.Fatalf("owner failed after waiter left: %v requests=%d", err, requests.Load())
      }
    case <-time.After(10 * time.Second):
      t.Fatal("owner did not finish after waiter left")
    }
  })
  t.Run("transfer deadline", func(t *testing.T) {
    started := make(chan struct{})
    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
      w.WriteHeader(http.StatusOK)
      w.(http.Flusher).Flush()
      close(started)
      <-r.Context().Done()
    }))
    defer server.Close()
    zipHash := sha256.Sum256(goodZIP)
    manifest := packageartifacts.Manifest{
      Packs: []packageartifacts.Pack{{
        Name: "base", URL: server.URL, SHA256: hex.EncodeToString(zipHash[:]),
        Length: int64(len(goodZIP)), DecodedBytes: int64(len(body)), FileCount: 1,
      }},
      Actions: []packageartifacts.Action{{
        ActionID: actionID, OutputID: outputID, BodySHA256: outputID,
        BodyLength: int64(len(body)), Pack: "base", Kind: "archive",
      }},
    }
    store, err := openArtifactStore(t.TempDir(), &manifest)
    if err != nil {
      t.Fatal(err)
    }
    defer store.close()
    ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
    defer cancel()
    if _, err := preparePacks(ctx, store, manifest, []string{"base"}); err == nil {
      t.Fatal("timed-out transfer was accepted")
    }
    select {
    case <-started:
    default:
      t.Fatal("transfer deadline test did not reach the HTTP server")
    }
    if admittedPack(store, manifest.Packs[0], manifest.Actions) {
      t.Fatal("timed-out transfer admitted an incomplete pack")
    }
  })
  store, err := openArtifactStore(t.TempDir(), nil)
  if err != nil {
    t.Fatal(err)
  }
  defer store.close()
  oversized := packageartifacts.Manifest{Packs: []packageartifacts.Pack{
    {Name: "first", Length: 300 << 20, DecodedBytes: 2 << 30},
    {Name: "second", Length: 300 << 20, DecodedBytes: 2 << 30},
  }}
  receipt, err := preparePacks(context.Background(), store, oversized, []string{"first", "second"})
  if err == nil || receipt.Requests != 0 {
    t.Fatalf("oversized selection began transfer: %+v %v", receipt, err)
  }
}

// TestPrepareFailurePreservesBase verifies that a rejected newer pack does not
// remove an admitted older generation or turn its mapping into a partial hit.
//
// Verifies: a successful pack remains readable after a later corrupt transfer,
// offline endpoint, or disallowed redirect at the same artifact root.
//
// @evidence contracts/testing.md#behavioral-verification Reopens the same owned root with its earlier authenticated catalog after each failed real HTTP preparation and reads the original body.
// @evidence contracts/testing.md#independent-expectations Literal body SHA-256 and ZIP bytes define the first generation; a distinct transport digest defines the rejected generation.
// @evidence contracts/testing.md#distinguishing-cases Transfer corruption, an offline endpoint and a redirect outside the allowed loopback/HTTPS policy all leave the previous generation intact.
// @evidence contracts/testing.md#execution-ownership The test uses private temporary storage and local HTTP servers only; each server and store settles before the root is deleted.
func TestPrepareFailurePreservesBase(t *testing.T) {
  root := t.TempDir()
  item := []byte("admitted body")
  outputSum := sha256.Sum256(item)
  outputID := hex.EncodeToString(outputSum[:])
  var archive bytes.Buffer
  writer := zip.NewWriter(&archive)
  entry, err := writer.Create("bodies/" + outputID)
  if err != nil {
    t.Fatal(err)
  }
  if _, err := entry.Write(item); err != nil {
    t.Fatal(err)
  }
  if err := writer.Close(); err != nil {
    t.Fatal(err)
  }
  packSum := sha256.Sum256(archive.Bytes())
  packHash := hex.EncodeToString(packSum[:])
  actionID := strings.Repeat("a", 64)
  server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
    _, _ = w.Write(archive.Bytes())
  }))
  defer server.Close()
  old := packageartifacts.Manifest{
    Packs: []packageartifacts.Pack{{
      Name: "generation", URL: server.URL, SHA256: packHash,
      Length: int64(archive.Len()), DecodedBytes: int64(len(item)), FileCount: 1,
    }},
    Actions: []packageartifacts.Action{{
      ActionID: actionID, OutputID: outputID, BodySHA256: outputID,
      BodyLength: int64(len(item)), Pack: "generation", Kind: "archive",
    }},
  }
  initial, err := openArtifactStore(root, &old)
  if err != nil {
    t.Fatal(err)
  }
  if _, err := preparePacks(context.Background(), initial, old, []string{"generation"}); err != nil {
    t.Fatal(err)
  }
  if err := initial.close(); err != nil {
    t.Fatal(err)
  }
  redirect := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    http.Redirect(w, r, "http://example.com/disallowed", http.StatusFound)
  }))
  defer redirect.Close()
  offline := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
  offlineURL := offline.URL
  offline.Close()
  for name, endpoint := range map[string]string{
    "corrupt":  server.URL,
    "offline":  offlineURL,
    "redirect": redirect.URL,
  } {
    t.Run(name, func(t *testing.T) {
      bad := old
      bad.Packs = append([]packageartifacts.Pack(nil), old.Packs...)
      bad.Packs[0].SHA256 = strings.Repeat("b", 64)
      bad.Packs[0].URL = endpoint
      store, err := openArtifactStore(root, &bad)
      if err != nil {
        t.Fatal(err)
      }
      if _, err := preparePacks(context.Background(), store, bad, []string{"generation"}); err == nil {
        t.Fatal("rejected generation was admitted")
      }
      if err := store.close(); err != nil {
        t.Fatal(err)
      }
      previous, err := openArtifactStore(root, &old)
      if err != nil {
        t.Fatal(err)
      }
      defer previous.close()
      _, location, found, err := previous.get(actionID)
      if err != nil || !found {
        t.Fatalf("previous generation disappeared: %v %v", found, err)
      }
      read, err := os.ReadFile(location)
      if err != nil || !bytes.Equal(read, item) {
        t.Fatalf("previous body changed: %q %v", read, err)
      }
    })
  }
}
