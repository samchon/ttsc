// Package packageartifacts validates published Go cache actions before they enter a local base.
package packageartifacts

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/url"
	"strings"
)

const MaxManifestBytes = 16 << 20

const MaxPackBytes = 512 << 20

const MaxPackDecodedBytes = 4 << 30

// Manifest is a candidate catalog. Only Go's full ActionID decides a cache hit.
// Its exact serialized bytes must match a digest carried by the trusted release package.
//
// @evidence contracts/common.md#principled-implementation Release provenance, Go selection, transport packs and complete action associations are kept together so admission cannot use an unauthenticated partial catalog.
// @evidence contracts/common.md#clear-and-simple-design One versioned value is decoded and validated before any pack or action is exposed.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The graph digest diagnoses a build; it never substitutes for Go's action key or a release-pinned digest.
// @evidence contracts/common.md#meaningful-documentation The comment identifies candidate-only selection and the external trust prerequisite.
//
// @evidenceExclude contracts/portability.md#os-neutral-implementation This JSON value has no native path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms The type chooses no algorithm; parsing and traversal belong to ParseTrustedManifest.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The value owns no retained computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The value owns no external resource.
type Manifest struct {
	Schema       int      `json:"schema"`
	Release      string   `json:"release"`
	SourceCommit string   `json:"sourceCommit"`
	Tuple        Tuple    `json:"tuple"`
	GraphSHA256  string   `json:"graphSHA256"`
	Packs        []Pack   `json:"packs"`
	Actions      []Action `json:"actions"`
}

// Tuple selects candidate packs, while Go validates actual package actions.
// Initial publisher coverage is limited to an observed effective CGO_ENABLED=0.
//
// @evidence contracts/common.md#principled-implementation The recorded Go tool, target, features and build policy choose a possible pack without claiming that equal tuple fields imply equal ActionIDs.
// @evidence contracts/common.md#clear-and-simple-design Selection fields form one value and leave actual cache matching to Go.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The CGO field records the observed setting and cannot be rewritten to manufacture coverage.
// @evidence contracts/common.md#meaningful-documentation The comment states the tuple's limited authority and initial native eligibility.
//
// @evidenceExclude contracts/portability.md#os-neutral-implementation These are Go-reported target strings, not native filesystem paths or process calls.
// @evidenceExclude contracts/performance.md#efficient-algorithms The type chooses no algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The type retains no result across requests.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The type owns no handle or task.
type Tuple struct {
	GoVersion     string            `json:"goVersion"`
	GoToolSHA256  string            `json:"goToolSHA256"`
	GOOS          string            `json:"goos"`
	GOARCH        string            `json:"goarch"`
	Architecture  map[string]string `json:"architecture"`
	CGOEnabled    string            `json:"cgoEnabled"`
	GoExperiment  string            `json:"goExperiment"`
	BuildFlags    []string          `json:"buildFlags"`
	BuildTags     []string          `json:"buildTags"`
	ToolIDsSHA256 string            `json:"toolIDsSHA256"`
}

// Pack describes one immutable compressed transport object and its decoded limit.
//
// @evidence contracts/common.md#principled-implementation A transport digest and compressed/decoded counts are separate so admission can bound both transfer and extracted bodies.
// @evidence contracts/common.md#clear-and-simple-design One pack record carries the bytes and count limits needed by its reader.
// @evidence contracts/common.md#prohibited-implementation-shortcuts A pack hash from the pack itself is not producer authority; the enclosing Manifest requires a separately trusted digest.
// @evidence contracts/common.md#meaningful-documentation The comment names the immutable object and decoded limit; fields carry their JSON units in names.
//
// @evidenceExclude contracts/portability.md#os-neutral-implementation The name is a transport identifier, not an interpreted native path.
// @evidenceExclude contracts/performance.md#efficient-algorithms The record chooses no computation strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The record retains no cross-request computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The record owns no downloaded bytes or handle.
type Pack struct {
	Name         string `json:"name"`
	URL          string `json:"url"`
	SHA256       string `json:"sha256"`
	Length       int64  `json:"length"`
	DecodedBytes int64  `json:"decodedBytes"`
	FileCount    int    `json:"fileCount"`
}

// Action associates a complete Go cache key with the exact body Go produced.
// Evidence is diagnostic; no package path, graph digest or displayed build ID replaces ActionID.
//
// @evidence contracts/common.md#principled-implementation The full Go action and output identities own lookup; package/module/source/command/dependency fields explain a captured association without changing it.
// @evidence contracts/common.md#clear-and-simple-design Archive and opaque bodies share one association because both use the same Go cache protocol.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The package annotation never synthesizes a key, and an opaque record cannot be silently interpreted as an archive.
// @evidence contracts/common.md#meaningful-documentation The comment distinguishes cache authority from diagnostic evidence.
//
// @evidenceExclude contracts/portability.md#os-neutral-implementation Paths are Go package/module identifiers and full digests, not native filesystem paths.
// @evidenceExclude contracts/performance.md#efficient-algorithms The record selects no algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The record retains no computation across calls.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The record owns no body or handle.
type Action struct {
	ActionID          string   `json:"actionID"`
	OutputID          string   `json:"outputID"`
	BodySHA256        string   `json:"bodySHA256"`
	BodyLength        int64    `json:"bodyLength"`
	Pack              string   `json:"pack"`
	Kind              string   `json:"kind"`
	PackagePath       string   `json:"packagePath"`
	ModulePath        string   `json:"modulePath"`
	ModuleVersion     string   `json:"moduleVersion"`
	ModuleRole        string   `json:"moduleRole"`
	SelectedSourceSHA string   `json:"selectedSourceSHA256"`
	CommandSHA256     string   `json:"commandSHA256"`
	DirectInputs      []string `json:"directInputs"`
}

// ParseTrustedManifest checks the raw release-pinned digest before decoding any mapping.
// The caller must obtain expectedSHA256 from authenticated release metadata, never from raw.
//
// @evidence contracts/common.md#principled-implementation SHA-256 of exact bounded bytes is compared with an external trusted digest before strict schema and full 32-byte action/output validation; Go alone computes the keys.
// @evidence contracts/common.md#clear-and-simple-design One decoder owns producer authentication, schema and association checks before returning a usable manifest.
// @evidence contracts/common.md#prohibited-implementation-shortcuts A digest supplied by the same untrusted manifest is never accepted as authority; duplicate conflicting actions fail rather than choosing a convenient output.
// @evidence contracts/common.md#meaningful-documentation The comment states the trust source and that the raw bytes, not a reserialized form, are authenticated.
//
// @evidenceExclude contracts/portability.md#os-neutral-implementation This byte decoder does no native path or process operation.
// @evidence contracts/performance.md#efficient-algorithms It hashes at most 16 MiB of input once, then decodes and traverses at most 64 packs and 100000 actions; maps give expected constant-time identity lookup with memory proportional to those populations.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Release bytes are checked for each call; this function retains no result or in-flight work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only bounded call-local bytes and maps are retained; the caller owns raw input and returned manifest lifetime.
func ParseTrustedManifest(raw []byte, expectedSHA256 string) (Manifest, error) {
	var manifest Manifest
	if len(raw) == 0 || len(raw) > MaxManifestBytes {
		return manifest, fmt.Errorf("artifact manifest length %d is outside (0,%d]", len(raw), MaxManifestBytes)
	}
	if !validSHA256(expectedSHA256) {
		return manifest, errors.New("artifact manifest has no valid trusted digest")
	}
	digest := sha256.Sum256(raw)
	if hex.EncodeToString(digest[:]) != expectedSHA256 {
		return manifest, errors.New("artifact manifest differs from trusted release digest")
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&manifest); err != nil {
		return Manifest{}, fmt.Errorf("decode artifact manifest: %w", err)
	}
	var trailing any
	if err := decoder.Decode(&trailing); err != io.EOF {
		return Manifest{}, errors.New("artifact manifest contains trailing data")
	}
	if err := manifest.validate(); err != nil {
		return Manifest{}, err
	}
	return manifest, nil
}

func (manifest Manifest) validate() error {
	if manifest.Schema != 1 {
		return fmt.Errorf("unsupported artifact manifest schema %d", manifest.Schema)
	}
	if manifest.Release == "" || !validCommit(manifest.SourceCommit) || !validSHA256(manifest.GraphSHA256) {
		return errors.New("artifact manifest has incomplete release provenance")
	}
	tuple := manifest.Tuple
	if tuple.GoVersion == "" || tuple.GOOS == "" || tuple.GOARCH == "" || tuple.CGOEnabled != "0" || !validSHA256(tuple.GoToolSHA256) || !validSHA256(tuple.ToolIDsSHA256) || len(tuple.BuildFlags) == 0 {
		return errors.New("artifact manifest has an unsupported or incomplete Go tuple")
	}
	if len(manifest.Packs) == 0 || len(manifest.Packs) > 64 || len(manifest.Actions) == 0 || len(manifest.Actions) > 100000 {
		return errors.New("artifact manifest exceeds pack or action count policy")
	}
	packs := make(map[string]Pack, len(manifest.Packs))
	for _, pack := range manifest.Packs {
		if !validName(pack.Name) || !validPackURL(pack.URL) || !validSHA256(pack.SHA256) || pack.Length <= 0 || pack.Length > MaxPackBytes || pack.DecodedBytes < 0 || pack.DecodedBytes > MaxPackDecodedBytes || pack.FileCount <= 0 {
			return fmt.Errorf("invalid artifact pack %q", pack.Name)
		}
		if _, exists := packs[pack.Name]; exists {
			return fmt.Errorf("duplicate artifact pack %q", pack.Name)
		}
		packs[pack.Name] = pack
	}
	actions := make(map[string]Action, len(manifest.Actions))
	outputs := make(map[string]int64, len(manifest.Actions))
	outputPacks := make(map[string]string, len(manifest.Actions))
	packOutputs := make(map[string]map[string]int64, len(manifest.Packs))
	for _, action := range manifest.Actions {
		if !validSHA256(action.ActionID) || !validSHA256(action.OutputID) || action.BodySHA256 != action.OutputID || action.BodyLength < 0 {
			return fmt.Errorf("invalid full action/output identity %q", action.ActionID)
		}
		if action.BodyLength == 0 && action.OutputID != emptyBodySHA256 {
			return fmt.Errorf("invalid empty body identity for action %s", action.ActionID)
		}
		if action.Kind != "archive" && action.Kind != "opaque" {
			return fmt.Errorf("unsupported cache body kind %q", action.Kind)
		}
		if action.Kind == "archive" && (action.PackagePath == "" || action.ModuleRole == "" || !validSHA256(action.SelectedSourceSHA) || !validSHA256(action.CommandSHA256)) {
			return fmt.Errorf("incomplete package evidence for action %s", action.ActionID)
		}
		if _, exists := packs[action.Pack]; !exists {
			return fmt.Errorf("action %s names unknown pack %q", action.ActionID, action.Pack)
		}
		if previous, exists := actions[action.ActionID]; exists {
			if previous.OutputID != action.OutputID || previous.BodyLength != action.BodyLength {
				return fmt.Errorf("conflicting publisher mapping for action %s", action.ActionID)
			}
			return fmt.Errorf("duplicate publisher action %s", action.ActionID)
		}
		if length, exists := outputs[action.OutputID]; exists && length != action.BodyLength {
			return fmt.Errorf("conflicting body length for output %s", action.OutputID)
		}
		if owner, exists := outputPacks[action.OutputID]; exists && owner != action.Pack {
			return fmt.Errorf("output %s is duplicated across packs", action.OutputID)
		}
		for _, input := range action.DirectInputs {
			if !validSHA256(input) {
				return fmt.Errorf("action %s has a malformed direct input", action.ActionID)
			}
		}
		actions[action.ActionID] = action
		outputs[action.OutputID] = action.BodyLength
		outputPacks[action.OutputID] = action.Pack
		if packOutputs[action.Pack] == nil {
			packOutputs[action.Pack] = make(map[string]int64)
		}
		packOutputs[action.Pack][action.OutputID] = action.BodyLength
	}
	for _, pack := range manifest.Packs {
		var total int64
		for _, length := range packOutputs[pack.Name] {
			if length > pack.DecodedBytes-total {
				return fmt.Errorf("pack %q exceeds its decoded byte count", pack.Name)
			}
			total += length
		}
		if len(packOutputs[pack.Name]) != pack.FileCount || total != pack.DecodedBytes {
			return fmt.Errorf("pack %q has inconsistent decoded counts", pack.Name)
		}
	}
	return nil
}

const emptyBodySHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

func validSHA256(value string) bool {
	if len(value) != 64 {
		return false
	}
	for _, char := range value {
		if !strings.ContainsRune("0123456789abcdef", char) {
			return false
		}
	}
	return true
}

func validCommit(value string) bool {
	if len(value) != 40 && len(value) != 64 {
		return false
	}
	for _, char := range value {
		if !strings.ContainsRune("0123456789abcdef", char) {
			return false
		}
	}
	return true
}

func validName(value string) bool {
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

func validPackURL(value string) bool {
	parsed, err := url.Parse(value)
	if err != nil || parsed.User != nil || parsed.Host == "" || parsed.Fragment != "" {
		return false
	}
	if parsed.Scheme == "https" {
		return true
	}
	return parsed.Scheme == "http" && net.ParseIP(parsed.Hostname()) != nil && net.ParseIP(parsed.Hostname()).IsLoopback()
}
