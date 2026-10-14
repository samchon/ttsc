package main

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/samchon/ttsc/packages/ttsc/internal/packageartifacts"
)

// TestPreparePacks verifies authenticated local admission from bounded bulk transport.
//
// Verifies: a complete pack is locally reusable, while transfer corruption, body corruption, traversal and cancellation leave no admitted base.
// 1. Serve a ZIP with one Go body from a loopback server and admit it.
// 2. Prepare the same pack again without a second request and get its full action locally.
// 3. Break transport or ZIP contents and require a miss after rejection.
//
// @evidence contracts/testing.md#behavioral-verification Uses the production HTTP, ZIP and rooted storage operations, asserting request counts, decoded bytes, a local get and absence of an admitted base after each failure.
// @evidence contracts/testing.md#independent-expectations SHA-256 of literal payload and ZIP bytes supplies body and transport expectations independently of preparation; a complete pack has one named body and no other entry.
// @evidence contracts/testing.md#distinguishing-cases Covers success, repeated preparation, corrupt transfer, corrupt decoded body, traversal and prior cancellation; helper lifetime and real remote transfer costs are separate boundaries.
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
		name   string
		zip    []byte
		served []byte
		valid  bool
		cancel bool
	}{
		{name: "complete", zip: goodZIP, served: goodZIP, valid: true},
		{name: "corrupt transfer", zip: goodZIP, served: append([]byte(nil), goodZIP[:len(goodZIP)-1]...)},
		{name: "corrupt body", zip: makeZIP("bodies/"+outputID, append([]byte("X"), body[1:]...))},
		{name: "traversal", zip: makeZIP("../outside", body)},
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
			manifest := packageartifacts.Manifest{
				Packs: []packageartifacts.Pack{{
					Name: "base", URL: server.URL, SHA256: hex.EncodeToString(zipHash[:]),
					Length: int64(len(scenario.zip)), DecodedBytes: int64(len(body)), FileCount: 1,
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
				if err != nil || receipt.Requests != 1 || receipt.DownloadedPacks != 1 || receipt.DecodedBytes != int64(len(body)) {
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
