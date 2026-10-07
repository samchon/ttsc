package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

const testNonce = "12345678-1234-1234-1234-123456789abc"
const firstID = "aaaaaaaa-1234-1234-1234-123456789abc"
const secondID = "bbbbbbbb-1234-1234-1234-123456789abc"
const thirdID = "cccccccc-1234-1234-1234-123456789abc"

type authoredReference struct {
	released atomic.Int32
	polling  chan struct{}
	once     sync.Once
	closeErr error
}

func (ref *authoredReference) identity() identity {
	return identity{Platform: "authored", Kernel: "unit-reference"}
}

func (ref *authoredReference) poll(milliseconds int) (bool, error) {
	if ref.polling != nil {
		ref.once.Do(func() { close(ref.polling) })
	}
	time.Sleep(time.Duration(milliseconds) * time.Millisecond)
	return false, nil
}

func (ref *authoredReference) close() error {
	ref.released.Add(1)
	return ref.closeErr
}

func authoredRequest(id, operation string, values map[string]any) string {
	if values == nil {
		values = make(map[string]any)
	}
	values["version"], values["sessionNonce"], values["id"], values["op"] = 1, testNonce, id, operation
	data, _ := json.Marshal(values)
	return string(data) + "\n"
}

// TestProtocolRejectsUnknownLifetimeAuthority Verifies that protocol errors and
// release failures never become a successful original-lifetime observation.
//
// This fixture's own factory supplies explicit permission/backend failures; it
// does not claim to reproduce actual OS permission denial or numeric PID reuse.
// 1. Exercise malformed/session/identity/request/target/timeout boundaries.
// 2. Preserve lookup and release failures while releasing acquired references.
// 3. Cancel a pending original wait on explicit close and EOF, then release it.
//
// @evidence contracts/testing.md#behavioral-verification Runs the actual decoder/session protocol and cancellation implementation with fixture-owned references; asserts no failed response reports retired true and every acquired reference is released once.
// @evidence contracts/testing.md#independent-expectations Authored UUIDs and request fields prescribe allowed sessions/targets. Explicit factory and close errors prescribe failure independently of the dispatcher.
// @evidence contracts/testing.md#distinguishing-cases Invalid version/nonce/IDs/PIDs, duplicate enrollment, unknown target/backend, permission error, malformed/truncated UTF-8 frames, timeout bounds, close failure, EOF and pending close remain distinct from a successful closed session.
// @evidence contracts/testing.md#execution-ownership Executes the test-only protocol directly in this Go test process; the separate native primitive case owns real OS references and SDK consumers stay in E2E.
func TestProtocolRejectsUnknownLifetimeAuthority(t *testing.T) {
	acquire := authoredRequest(firstID, "acquire", map[string]any{"pid": 1})
	closing := authoredRequest(secondID, "close", nil)
	cases := map[string]string{
		"version":           strings.Replace(acquire, `"version":1`, `"version":2`, 1),
		"nonce":             strings.Replace(acquire, testNonce, secondID, 1),
		"id":                strings.Replace(acquire, firstID, "invalid", 1),
		"PID":               authoredRequest(firstID, "acquire", map[string]any{"pid": -1}),
		"duplicate":         acquire + acquire,
		"unknown target":    authoredRequest(firstID, "wait", map[string]any{"targetId": secondID, "timeoutMs": 0}),
		"foreign target":    acquire + authoredRequest(secondID, "wait", map[string]any{"targetId": thirdID, "timeoutMs": 0}),
		"timeout":           authoredRequest(firstID, "wait", map[string]any{"targetId": secondID, "timeoutMs": 5001}),
		"negative timeout":  authoredRequest(firstID, "wait", map[string]any{"targetId": secondID, "timeoutMs": -1}),
		"operation":         authoredRequest(firstID, "kill", nil),
		"target on acquire": authoredRequest(firstID, "acquire", map[string]any{"pid": 1, "targetId": secondID}),
		"close target":      authoredRequest(firstID, "close", map[string]any{"pid": 1}),
		"unknown field":     strings.Replace(acquire, `"pid":1`, `"pid":1,"backend":"fake"`, 1),
		"malformed":         "{\n",
		"truncated":         strings.TrimSuffix(acquire, "\n"),
		"invalid UTF8":      "{\"id\":\"\xff\"}\n",
		"multiple JSON":     "{} {}\n",
		"oversized":         strings.Repeat("x", 65537) + "\n",
	}
	for name, input := range cases {
		t.Run(name, func(t *testing.T) {
			ref := &authoredReference{}
			acquired := 0
			var output bytes.Buffer
			err := serve(io.NopCloser(strings.NewReader(input)), &output, testNonce, func(int) (reference, error) {
				acquired++
				return ref, nil
			})
			if err == nil || strings.Contains(output.String(), `"retired":true`) || strings.Contains(output.String(), `"event":"closed"`) {
				t.Fatalf("invalid authority accepted: %v %s", err, output.String())
			}
			if int(ref.released.Load()) != acquired {
				t.Fatalf("reference release %d acquire %d", ref.released.Load(), acquired)
			}
		})
	}
	for _, cause := range []error{errors.New("permission denied"), errors.New("unsupported backend")} {
		var output bytes.Buffer
		err := serve(io.NopCloser(strings.NewReader(acquire)), &output, testNonce, func(int) (reference, error) { return nil, cause })
		if !errors.Is(err, cause) || !strings.Contains(output.String(), `"code":"EACQUIRE"`) {
			t.Fatalf("lookup error lost: %v %s", err, output.String())
		}
	}
	for _, failClose := range []bool{false, true} {
		ref := &authoredReference{}
		if failClose {
			ref.closeErr = errors.New("authored release failure")
		}
		var output bytes.Buffer
		acquisitions := 0
		late := authoredRequest(thirdID, "acquire", map[string]any{"pid": 2})
		err := serve(io.NopCloser(strings.NewReader(acquire+closing+late)), &output, testNonce, func(int) (reference, error) {
			acquisitions++
			return ref, nil
		})
		if (err != nil) != failClose || ref.released.Load() != 1 || strings.Contains(output.String(), `"event":"closed"`) == failClose {
			t.Fatalf("close boundary: %v %s", err, output.String())
		}
		if acquisitions != 1 {
			t.Fatal("close allowed late enrollment")
		}
	}
	for _, eof := range []bool{false, true} {
		input, writer := io.Pipe()
		ref := &authoredReference{polling: make(chan struct{})}
		output := &protocolOutput{events: make(chan map[string]any, 16)}
		done := make(chan error, 1)
		go func() { done <- serve(input, output, testNonce, func(int) (reference, error) { return ref, nil }) }()
		<-output.events // ready
		_, _ = io.WriteString(writer, acquire)
		<-output.events // acquired
		_, _ = io.WriteString(writer, authoredRequest(secondID, "wait", map[string]any{"targetId": firstID, "timeoutMs": 5000}))
		<-ref.polling
		if eof {
			_ = writer.Close()
		} else {
			_, _ = io.WriteString(writer, authoredRequest(thirdID, "close", nil))
		}
		select {
		case err := <-done:
			if err != nil || ref.released.Load() != 1 {
				t.Fatalf("pending close: %v release=%d", err, ref.released.Load())
			}
		case <-time.After(time.Second):
			t.Fatal("close did not cancel and join original wait")
		}
		_ = writer.Close()
	}
	ref := &authoredReference{}
	retired, err := waitOriginal(context.Background(), ref, 1)
	if err != nil || retired {
		t.Fatalf("elapsed wait manufactured retirement: %v %v", retired, err)
	}
}

type protocolOutput struct {
	events chan map[string]any
}

func (output *protocolOutput) Write(data []byte) (int, error) {
	var value map[string]any
	if err := json.Unmarshal(data, &value); err != nil {
		return 0, err
	}
	output.events <- value
	return len(data), nil
}
