// Process-observer is an independent test fixture. It never starts or stops a
// target: the test enrolls a live lifetime before permitting its retirement.
package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"regexp"
	"time"
	"unicode/utf8"
)

// main owns only protocol descriptors and enrolled kernel references. Parent
// tests join this process as well as requiring its explicit closed receipt.
func main() {
	flags := flag.NewFlagSet("process-observer", flag.ContinueOnError)
	nonce := flags.String("session-nonce", "", "test session UUID")
	if err := flags.Parse(os.Args[1:]); err != nil || flags.NArg() != 0 || !uuid.MatchString(*nonce) {
		fmt.Fprintln(os.Stderr, "a session UUID is required")
		os.Exit(2)
	}
	if err := serve(os.Stdin, os.Stdout, *nonce, acquireReference); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

// identity supplements the retained kernel authority. Creation is the exact
// Windows FILETIME decimal value; other backends do not invent a timestamp.
type identity struct {
	Platform string `json:"platform"`
	Kernel   string `json:"kernel"`
	Creation string `json:"creation,omitempty"`
}

// reference retains one original lifetime until close. Poll never resolves its
// PID again. A consumed exit event stays retired for subsequent polls.
type reference interface {
	identity() identity
	poll(milliseconds int) (bool, error)
	close() error
}

type request struct {
	Version      int    `json:"version"`
	SessionNonce string `json:"sessionNonce"`
	ID           string `json:"id"`
	Op           string `json:"op"`
	PID          *int   `json:"pid,omitempty"`
	TargetID     string `json:"targetId,omitempty"`
	TimeoutMS    *int   `json:"timeoutMs,omitempty"`
}

type frame struct {
	data []byte
	err  error
}

type waitResult struct {
	retired bool
	err     error
}

type activeWait struct {
	request request
	cancel  context.CancelFunc
	result  <-chan waitResult
}

var uuid = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

// serve serializes enrollment and releases references only after an active
// poll has joined. The reader remains available during a positive wait so EOF
// and close can cancel that wait. Frames and the input queue have finite bounds;
// references/request IDs grow with this finite test session and die on close.
// Protocol errors remain errors, including lookup/permission/close failures.
func serve(in io.ReadCloser, out io.Writer, nonce string, acquire func(int) (reference, error)) (result error) {
	refs := make(map[string]reference)
	seen := make(map[string]bool)
	encoder := json.NewEncoder(out)
	emit := func(event, id string, values map[string]any) error {
		if values == nil {
			values = make(map[string]any)
		}
		values["version"], values["sessionNonce"], values["event"] = 1, nonce, event
		if id != "" {
			values["id"] = id
		}
		return encoder.Encode(values)
	}
	failure := func(req request, code string, err error) error {
		return errors.Join(err, emit("error", req.ID, map[string]any{"operation": req.Op, "code": code, "message": err.Error()}))
	}
	var pending *activeWait
	defer func() {
		if pending != nil {
			pending.cancel()
			<-pending.result
		}
		for _, ref := range refs {
			result = errors.Join(result, ref.close())
		}
		result = errors.Join(result, in.Close())
	}()
	if err := emit("ready", "", nil); err != nil {
		return err
	}
	frames := make(chan frame, 1)
	finished := make(chan struct{})
	defer close(finished)
	go readFrames(in, frames, finished)
	for {
		var completed <-chan waitResult
		if pending != nil {
			completed = pending.result
		}
		select {
		case done := <-completed:
			req := pending.request
			pending.cancel()
			pending = nil
			if done.err != nil {
				return failure(req, "EWAIT", done.err)
			}
			if err := emit("waited", req.ID, map[string]any{"targetId": req.TargetID, "retired": done.retired}); err != nil {
				return err
			}
		case incoming := <-frames:
			if incoming.err != nil {
				if errors.Is(incoming.err, io.EOF) {
					return nil
				}
				return failure(request{}, "EFRAME", incoming.err)
			}
			req, err := decodeRequest(incoming.data, nonce)
			if err != nil {
				return failure(req, "EPROTOCOL", err)
			}
			if seen[req.ID] {
				return failure(req, "EDUPLICATE", errors.New("request ID already used"))
			}
			seen[req.ID] = true
			if pending != nil && req.Op != "close" {
				return failure(req, "EBUSY", errors.New("another original wait is pending"))
			}
			switch req.Op {
			case "acquire":
				ref, err := acquire(*req.PID)
				if err != nil {
					return failure(req, "EACQUIRE", err)
				}
				refs[req.ID] = ref
				if err := emit("acquired", req.ID, map[string]any{"targetId": req.ID, "pid": *req.PID, "identity": ref.identity()}); err != nil {
					return err
				}
			case "wait":
				ref := refs[req.TargetID]
				if ref == nil {
					return failure(req, "ETARGET", errors.New("target was not enrolled in this session"))
				}
				ctx, cancel := context.WithCancel(context.Background())
				channel := make(chan waitResult, 1)
				pending = &activeWait{request: req, cancel: cancel, result: channel}
				go func() {
					retired, err := waitOriginal(ctx, ref, *req.TimeoutMS)
					channel <- waitResult{retired: retired, err: err}
				}()
			case "close":
				if pending != nil {
					pending.cancel()
					<-pending.result
					if err := emit("error", pending.request.ID, map[string]any{"operation": "wait", "code": "ECANCELLED", "message": "observer closed during wait"}); err != nil {
						pending = nil
						return err
					}
					pending = nil
				}
				var release error
				for id, ref := range refs {
					release = errors.Join(release, ref.close())
					delete(refs, id)
				}
				if release != nil {
					return failure(req, "ERELEASE", release)
				}
				return emit("closed", req.ID, nil)
			}
		}
	}
}

// readFrames requires complete newline-delimited UTF-8 JSON and never allocates
// an unbounded input token. Cancellation also unblocks a queued reader send.
func readFrames(in io.Reader, frames chan<- frame, finished <-chan struct{}) {
	scanner := bufio.NewScanner(in)
	scanner.Split(func(data []byte, atEOF bool) (int, []byte, error) {
		if index := bytes.IndexByte(data, '\n'); index >= 0 {
			return index + 1, data[:index+1], nil
		}
		if atEOF && len(data) != 0 {
			return 0, nil, errors.New("truncated JSONL frame")
		}
		return 0, nil, nil
	})
	for scanner.Scan() {
		select {
		case frames <- frame{data: bytes.Clone(scanner.Bytes())}:
		case <-finished:
			return
		}
	}
	err := scanner.Err()
	if err == nil {
		err = io.EOF
	}
	select {
	case frames <- frame{err: err}:
	case <-finished:
	}
}

func decodeRequest(data []byte, nonce string) (req request, err error) {
	if !utf8.Valid(data) {
		return req, errors.New("frame is not UTF-8")
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err = decoder.Decode(&req); err != nil {
		return req, err
	}
	var extra any
	if err = decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		return req, errors.New("multiple JSON values in one frame")
	}
	if req.Version != 1 || req.SessionNonce != nonce || !uuid.MatchString(req.ID) {
		return req, errors.New("invalid version, session nonce or request UUID")
	}
	switch req.Op {
	case "acquire":
		if req.PID == nil || *req.PID <= 0 || *req.PID > 2147483647 || req.TargetID != "" || req.TimeoutMS != nil {
			return req, errors.New("acquire requires only a positive native PID")
		}
	case "wait":
		if !uuid.MatchString(req.TargetID) || req.PID != nil || req.TimeoutMS == nil || *req.TimeoutMS < 0 || *req.TimeoutMS > 5000 {
			return req, errors.New("wait requires an enrolled UUID and timeoutMs in [0,5000]")
		}
	case "close":
		if req.PID != nil || req.TargetID != "" || req.TimeoutMS != nil {
			return req, errors.New("close accepts no target or timeout")
		}
	default:
		return req, errors.New("unknown operation")
	}
	return req, nil
}

// waitOriginal's zero timeout is exactly one original-object poll. Positive
// waits use bounded native slices so EOF/close joins before releasing a handle;
// elapsed timeout returns false, while an API error remains unknown.
func waitOriginal(ctx context.Context, ref reference, milliseconds int) (bool, error) {
	deadline := time.Now().Add(time.Duration(milliseconds) * time.Millisecond)
	for {
		if err := ctx.Err(); err != nil {
			return false, err
		}
		interval := 0
		if milliseconds != 0 {
			remaining := time.Until(deadline)
			if remaining <= 0 {
				return false, nil
			}
			interval = min(20, int((remaining+time.Millisecond-1)/time.Millisecond))
		}
		retired, err := ref.poll(interval)
		if retired || err != nil || milliseconds == 0 {
			return retired, err
		}
	}
}

// requireLive rejects an already retired enrollment instead of interpreting a
// failed/missing enrollment as proof. The caller releases the failed reference.
func requireLive(ref reference) (reference, error) {
	retired, err := ref.poll(0)
	if err == nil && retired {
		err = errors.New("target already retired before enrollment")
	}
	if err != nil {
		return nil, errors.Join(err, ref.close())
	}
	return ref, nil
}
