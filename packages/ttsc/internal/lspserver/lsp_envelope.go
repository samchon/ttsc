package lspserver

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
)

// ErrInvalidJSONRPC is returned by ParseEnvelope when the body has a
// `jsonrpc` field present and not equal to "2.0". A missing field is
// tolerated to stay compatible with editors that omit it.
var ErrInvalidJSONRPC = errors.New("lsp: jsonrpc field must be \"2.0\"")

// Envelope is the minimal JSON-RPC view ttscserver needs to dispatch
// messages without re-serializing them. id is decoded as json.RawMessage
// because LSP allows both numbers and strings and we must round-trip
// whichever shape the editor used in correlating responses.
type Envelope struct {
	JSONRPC string          `json:"jsonrpc,omitempty"`
	ID      json.RawMessage `json:"id,omitempty"`
	Method  string          `json:"method,omitempty"`
	Params  json.RawMessage `json:"params,omitempty"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   json.RawMessage `json:"error,omitempty"`
}

// ParseEnvelope decodes the JSON-RPC envelope without consuming the
// inner params/result/error payloads. Unknown fields are ignored, which
// matches the LSP base protocol's forward-compatibility expectation. A
// non-empty `jsonrpc` value other than "2.0" is rejected.
func ParseEnvelope(body []byte) (Envelope, error) {
	var env Envelope
	if err := json.Unmarshal(body, &env); err != nil {
		return Envelope{}, fmt.Errorf("lsp: envelope decode: %w", err)
	}
	if env.JSONRPC != "" && env.JSONRPC != "2.0" {
		return Envelope{}, fmt.Errorf("%w (got %q)", ErrInvalidJSONRPC, env.JSONRPC)
	}
	return env, nil
}

// IsRequest reports whether the envelope represents a request expecting
// a response (id present, method present).
func (e Envelope) IsRequest() bool {
	return len(e.ID) > 0 && e.Method != ""
}

// IsNotification reports whether the envelope is a one-way notification.
func (e Envelope) IsNotification() bool {
	return len(e.ID) == 0 && e.Method != ""
}

// IsResponse reports whether the envelope is a response (id present,
// method absent — either result or error will be set).
func (e Envelope) IsResponse() bool {
	return len(e.ID) > 0 && e.Method == ""
}

// IsErrorResponse reports whether a response envelope carries an error
// object. JSON-RPC §5.1 forbids `result` and `error` both being present
// on the same response, so the proxy uses this to skip merging plugin
// contributions into upstream failures.
func (e Envelope) IsErrorResponse() bool {
	return e.IsResponse() && len(e.Error) > 0 && !bytes.Equal(bytes.TrimSpace(e.Error), []byte("null"))
}

// IDKey returns a stable string key for matching request and response
// envelopes. LSP allows integer or string ids, and peers sometimes
// disagree on the numeric encoding — `1` vs `1.0` is semantically the
// same id. The key normalizes both forms so the proxy correlates them.
// Strings remain quoted so a numeric id `42` never collides with a
// string id `"42"`. Ids whose JSON value is not a number or string
// (LSP forbids these as request ids) produce the empty key, which
// callers treat as "no entry".
func (e Envelope) IDKey() string {
	return idKeyFromRaw(e.ID)
}

// IDKeyFromRaw exposes the shared id-key normalizer to the public driver
// compatibility layer without exporting the helper from that package.
func IDKeyFromRaw(raw json.RawMessage) string {
	return idKeyFromRaw(raw)
}

// idKeyFromRaw normalizes a raw id payload the same way IDKey does so
// every call site keyed on json.RawMessage produces a consistent key.
// Without this shared helper, $/cancelRequest handling and pending
// request bookkeeping would disagree on numeric form and the proxy
// would fail to correlate them.
//
// Numbers are decoded via json.Decoder.UseNumber() so the full int64
// range round-trips exactly: decoding into `any` would produce float64
// and any id past 2^53 would silently collide with its neighbor. LSP
// places no upper bound on numeric ids, so the helper preserves the
// high-bit fidelity peers may rely on. Strings are quoted so the proxy
// never confuses a numeric id `42` with a string id `"42"`. Anything
// the type switch below does not recognize as a JSON-RPC id shape
// (boolean, null, array, object — none of which LSP allows for ids)
// falls through to the empty key, which callers treat as "no entry".
func idKeyFromRaw(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	var decoded any
	if err := dec.Decode(&decoded); err != nil {
		return ""
	}
	switch v := decoded.(type) {
	case json.Number:
		lit := v.String()
		if !strings.ContainsAny(lit, ".eE") {
			// Integer-shaped literal. Use int64 when it fits so leading
			// zeros and minus signs canonicalize, but preserve the literal
			// for past-int64 ids — Float64 normalization would silently
			// round 9999999999999999998 and 9999999999999999999 to the
			// same key.
			if n, err := v.Int64(); err == nil {
				return strconv.FormatInt(n, 10)
			}
			return lit
		}
		// Float-shaped literal (`1.0`, `1.5`, `1e2`). Collapse to integer
		// form only when the value is exactly representable as int64;
		// 2^53 bounds the safe range because float64 loses unit precision
		// past that magnitude.
		if f, err := v.Float64(); err == nil {
			const maxSafeFloat = float64(int64(1) << 53)
			if f >= -maxSafeFloat && f <= maxSafeFloat && f == float64(int64(f)) {
				return strconv.FormatInt(int64(f), 10)
			}
		}
		return lit
	case string:
		return strconv.Quote(v)
	}
	return ""
}
