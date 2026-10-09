package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"testing"
	"time"
)

const testNonce = "12345678-1234-1234-1234-123456789abc"
const firstID = "aaaaaaaa-1234-1234-1234-123456789abc"
const secondID = "bbbbbbbb-1234-1234-1234-123456789abc"
const thirdID = "cccccccc-1234-1234-1234-123456789abc"

type authoredReference struct {
	released   atomic.Int32
	polling    chan struct{}
	once       sync.Once
	closeErr   error
	pollResult func(int) (bool, error)
}

func (ref *authoredReference) identity() identity {
	return identity{Platform: "authored", Kernel: "unit-reference"}
}

func (ref *authoredReference) poll(milliseconds int) (bool, error) {
	if ref.polling != nil {
		ref.once.Do(func() { close(ref.polling) })
	}
	if ref.pollResult != nil {
		return ref.pollResult(milliseconds)
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
// 4. Retry interrupted observations without changing reference, deadline or
//    cancellation, while preserving completed live/retired and genuine errors.
//
// @evidence contracts/testing.md#behavioral-verification Runs the actual decoder/session protocol, wait and enrollment operations with fixture-owned references; interrupted polls preserve completed observations and request identity, no genuine failure reports retired true, and acquired references release once.
// @evidence contracts/testing.md#independent-expectations Authored UUIDs and request fields prescribe allowed sessions/targets. Explicit factory, polling and close errors prescribe failure independently of the dispatcher. Scripted EINTR is an incomplete observation; subsequent literal results, real cancellation and elapsed original budget decide the expected result, not an actual delivered OS signal.
// @evidence contracts/testing.md#distinguishing-cases Invalid protocol authority, genuine backend/release errors and close/EOF cancellation remain failures. Single/repeated/wrapped EINTR precede completed live/retired polls, cancelled zero/positive waits and original budget expiration; enrollment and waited response retain the same reference and target identity.
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
	for _, termination := range []struct{ eof, interrupted bool }{
		{false, false}, {true, false}, {false, true}, {true, true},
	} {
		input, writer := io.Pipe()
		ref := &authoredReference{polling: make(chan struct{})}
		if termination.interrupted {
			ref.pollResult = func(milliseconds int) (bool, error) {
				time.Sleep(time.Duration(milliseconds) * time.Millisecond)
				return false, syscall.EINTR
			}
		}
		output := &protocolOutput{events: make(chan map[string]any, 16)}
		done := make(chan error, 1)
		go func() { done <- serve(input, output, testNonce, func(int) (reference, error) { return ref, nil }) }()
		<-output.events // ready
		_, _ = io.WriteString(writer, acquire)
		<-output.events // acquired
		_, _ = io.WriteString(writer, authoredRequest(secondID, "wait", map[string]any{"targetId": firstID, "timeoutMs": 5000}))
		<-ref.polling
		if termination.eof {
			_ = writer.Close()
		} else {
			_, _ = io.WriteString(writer, authoredRequest(thirdID, "close", nil))
		}
		select {
		case err := <-done:
			if err != nil || ref.released.Load() != 1 {
				t.Fatalf("pending close: %v release=%d", err, ref.released.Load())
			}
		case <-t.Context().Done():
			t.Fatal("owning test cancelled before original wait joined")
		}
		_ = writer.Close()
	}
	ref := &authoredReference{}
	retired, err := waitOriginal(context.Background(), ref, 1)
	if err != nil || retired {
		t.Fatalf("elapsed wait manufactured retirement: %v %v", retired, err)
	}
	t.Run("interrupted original observations", func(t *testing.T) {
		backend := errors.New("authored backend failure")
		for name, steps := range map[string][]waitResult{
			"live":                {{err: syscall.EINTR}, {}},
			"incomplete retired":  {{retired: true, err: syscall.EINTR}, {}},
			"retired":             {{err: syscall.EINTR}, {err: fmt.Errorf("wrapped: %w", syscall.EINTR)}, {retired: true}},
			"backend":             {{err: backend}},
			"interrupted backend": {{err: syscall.EINTR}, {err: backend}},
		} {
			t.Run(name, func(t *testing.T) {
				for _, enrollment := range []bool{false, true} {
					calls := 0
					ref := &authoredReference{pollResult: func(milliseconds int) (bool, error) {
						if milliseconds != 0 || calls >= len(steps) {
							t.Fatalf("unexpected poll: timeout=%d call=%d", milliseconds, calls)
						}
						step := steps[calls]
						calls++
						return step.retired, step.err
					}}
					last := steps[len(steps)-1]
					if enrollment {
						selected, err := requireLive(ref)
						failed := last.retired || last.err != nil
						releases := int32(0)
						if failed {
							releases = 1
						}
						if (err != nil) != failed || (failed && selected != nil) || (!failed && selected != ref) || ref.released.Load() != releases {
							t.Fatalf("enrollment: selected=%v error=%v releases=%d", selected, err, ref.released.Load())
						}
						if last.err != nil && !errors.Is(err, last.err) {
							t.Fatalf("enrollment lost backend error: %v", err)
						}
						if !failed {
							_ = selected.close()
							if ref.released.Load() != 1 {
								t.Fatal("transferred reference did not release once")
							}
						}
					} else {
						retired, err := waitOriginal(context.Background(), ref, 0)
						if retired != last.retired || !errors.Is(err, last.err) || ref.released.Load() != 0 {
							t.Fatalf("wait result: retired=%v error=%v releases=%d", retired, err, ref.released.Load())
						}
					}
					if calls != len(steps) {
						t.Fatalf("polls=%d want=%d", calls, len(steps))
					}
				}
			})
		}
		for _, milliseconds := range []int{0, 20} {
			ctx, cancel := context.WithCancel(context.Background())
			calls := 0
			ref := &authoredReference{pollResult: func(int) (bool, error) {
				calls++
				cancel()
				return false, syscall.EINTR
			}}
			retired, err := waitOriginal(ctx, ref, milliseconds)
			if retired || !errors.Is(err, context.Canceled) || calls != 1 {
				t.Fatalf("interrupted cancellation: retired=%v error=%v calls=%d", retired, err, calls)
			}
		}
		calls := 0
		ref = &authoredReference{pollResult: func(int) (bool, error) {
			calls++
			if calls == 1 {
				time.Sleep(3 * time.Millisecond)
				return false, syscall.EINTR
			}
			return true, nil
		}}
		retired, err = waitOriginal(context.Background(), ref, 1)
		if retired || err != nil || calls != 1 {
			t.Fatalf("interruption reset original budget: retired=%v error=%v calls=%d", retired, err, calls)
		}
		calls = 0
		ref = &authoredReference{pollResult: func(milliseconds int) (bool, error) {
			if milliseconds <= 0 || milliseconds > 20 {
				t.Fatalf("positive wait lost its native slice: %d", milliseconds)
			}
			calls++
			if calls == 1 {
				return false, syscall.EINTR
			}
			return true, nil
		}}
		retired, err = waitOriginal(context.Background(), ref, 5000)
		if !retired || err != nil || calls != 2 {
			t.Fatalf("interrupted positive retirement: retired=%v error=%v calls=%d", retired, err, calls)
		}
		input, writer := io.Pipe()
		defer writer.Close()
		ref = &authoredReference{pollResult: func(int) (bool, error) {
			calls++
			if calls == 1 {
				return false, syscall.EINTR
			}
			return true, nil
		}}
		calls = 0
		output := &protocolOutput{events: make(chan map[string]any, 16)}
		done := make(chan error, 1)
		go func() { done <- serve(input, output, testNonce, func(int) (reference, error) { return ref, nil }) }()
		<-output.events // ready
		_, _ = io.WriteString(writer, acquire)
		<-output.events // acquired
		_, _ = io.WriteString(writer, authoredRequest(secondID, "wait", map[string]any{"targetId": firstID, "timeoutMs": 0}))
		frame := <-output.events
		if frame["event"] != "waited" {
			_ = writer.Close()
			err := <-done
			t.Fatalf("interruption became protocol failure: %v %v", err, frame)
		}
		_, _ = io.WriteString(writer, authoredRequest(thirdID, "close", nil))
		closed := <-output.events
		if err := <-done; err != nil || calls != 2 || ref.released.Load() != 1 ||
			frame["event"] != "waited" || frame["id"] != secondID || frame["targetId"] != firstID ||
			frame["sessionNonce"] != testNonce || frame["retired"] != true || closed["event"] != "closed" {
			t.Fatalf("interrupted protocol result: %v %v close=%v calls=%d releases=%d", err, frame, closed, calls, ref.released.Load())
		}
		_ = writer.Close()
	})
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
