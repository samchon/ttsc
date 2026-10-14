package packageartifacts

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"
	"testing"
)

// TestParseTrustedManifest verifies release-pinned producer authority and the full-key schema.
//
// Verifies: only an authenticated, complete Go action association is admitted.
// 1. Decode a valid publisher record with archive and opaque bodies.
// 2. Change trust, schema, identities, mappings, provenance and pack bounds independently.
// 3. Require each invalid record to fail before it can become a cache hit.
//
// @evidence contracts/testing.md#behavioral-verification Calls the production decoder and asserts success or rejection of complete serialized publisher records, including an opaque zero-byte body.
// @evidence contracts/testing.md#independent-expectations The release digest is independently computed over serialized bytes; Go's protocol requires full 32-byte keys and SHA-256 output bodies, and schema one requires effective CGO_ENABLED=0.
// @evidence contracts/testing.md#distinguishing-cases Covers a valid record, a conflicting duplicate, truncated IDs, wrong producer digest, unknown required field/schema, unsupported CGO mode, unknown pack, invalid length and trailing JSON.
// @evidence contracts/testing.md#execution-ownership This is a Go unit test discovered by go test under internal/packageartifacts; no build, package installation or host process runs.
func TestParseTrustedManifest(t *testing.T) {
	const a = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	const b = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	const c = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
	valid := Manifest{
		Schema:       1,
		Release:      "0.32.1",
		SourceCommit: strings.Repeat("d", 40),
		Tuple: Tuple{
			GoVersion:     "go1.26.0",
			GoToolSHA256:  a,
			GOOS:          "windows",
			GOARCH:        "amd64",
			Architecture:  map[string]string{"GOAMD64": "v1"},
			CGOEnabled:    "0",
			BuildFlags:    []string{"-trimpath"},
			ToolIDsSHA256: b,
		},
		GraphSHA256: c,
		Packs: []Pack{{
			Name: "base-1", URL: "https://example.org/base-1.zip", SHA256: a, Length: 100, DecodedBytes: 4, FileCount: 2,
		}},
		Actions: []Action{
			{
				ActionID: a, OutputID: b, BodySHA256: b, BodyLength: 4,
				Pack: "base-1", Kind: "archive", PackagePath: "example.org/compiler/ast",
				ModulePath: "example.org/compiler", ModuleVersion: "v1.0.0",
				ModuleRole: "dependency", SelectedSourceSHA: c, CommandSHA256: a,
				DirectInputs: []string{c},
			},
			{
				ActionID: c, OutputID: emptyBodySHA256, BodySHA256: emptyBodySHA256, BodyLength: 0,
				Pack: "base-1", Kind: "opaque",
			},
		},
	}
	decode := func(value Manifest) error {
		t.Helper()
		raw, err := json.Marshal(value)
		if err != nil {
			t.Fatal(err)
		}
		digest := sha256.Sum256(raw)
		_, err = ParseTrustedManifest(raw, hex.EncodeToString(digest[:]))
		return err
	}
	if err := decode(valid); err != nil {
		t.Fatalf("valid publisher manifest rejected: %v", err)
	}
	mutations := map[string]func(*Manifest){
		"unknown schema":          func(m *Manifest) { m.Schema = 2 },
		"short action":            func(m *Manifest) { m.Actions[0].ActionID = a[:40] },
		"bad body association":    func(m *Manifest) { m.Actions[0].BodySHA256 = c },
		"unsupported cgo":         func(m *Manifest) { m.Tuple.CGOEnabled = "1" },
		"unknown pack":            func(m *Manifest) { m.Actions[0].Pack = "absent" },
		"negative length":         func(m *Manifest) { m.Actions[0].BodyLength = -1 },
		"missing source evidence": func(m *Manifest) { m.Actions[0].SelectedSourceSHA = "" },
		"wrong decoded count":     func(m *Manifest) { m.Packs[0].DecodedBytes++ },
		"untrusted pack URL":      func(m *Manifest) { m.Packs[0].URL = "http://example.org/base-1.zip" },
		"conflicting action": func(m *Manifest) {
			duplicate := m.Actions[0]
			duplicate.OutputID = c
			duplicate.BodySHA256 = c
			m.Actions = append(m.Actions, duplicate)
		},
		"duplicate output across packs": func(m *Manifest) {
			m.Packs = append(m.Packs, Pack{
				Name: "other", URL: "https://example.org/other.zip", SHA256: c,
				Length: 100, DecodedBytes: 4, FileCount: 1,
			})
			duplicate := m.Actions[0]
			duplicate.ActionID = strings.Repeat("d", 64)
			duplicate.Pack = "other"
			m.Actions = append(m.Actions, duplicate)
		},
	}
	for name, mutate := range mutations {
		t.Run(name, func(t *testing.T) {
			copy := valid
			copy.Packs = append([]Pack(nil), valid.Packs...)
			copy.Actions = append([]Action(nil), valid.Actions...)
			mutate(&copy)
			if err := decode(copy); err == nil {
				t.Fatal("invalid publisher manifest was accepted")
			}
		})
	}
	raw, err := json.Marshal(valid)
	if err != nil {
		t.Fatal(err)
	}
	for name, input := range map[string][]byte{
		"unknown field":  append(append([]byte(nil), raw[:len(raw)-1]...), []byte(`,"requiredLater":true}`)...),
		"trailing value": append(append([]byte(nil), raw...), []byte(` {}`)...),
	} {
		t.Run(name, func(t *testing.T) {
			digest := sha256.Sum256(input)
			if _, err := ParseTrustedManifest(input, hex.EncodeToString(digest[:])); err == nil {
				t.Fatal("invalid publisher JSON was accepted")
			}
		})
	}
	if _, err := ParseTrustedManifest(raw, a); err == nil {
		t.Fatal("untrusted producer association was accepted")
	}
}
