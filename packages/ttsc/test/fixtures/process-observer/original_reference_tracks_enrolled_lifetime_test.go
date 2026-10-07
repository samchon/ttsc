package main

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"os/exec"
	"runtime"
	"testing"
)

// TestOriginalReferenceTracksEnrolledLifetime Verifies original kernel lifetime
// observations independently of a numeric PID's current occupant.
//
// Two authored children block on their own stdin. Closing only the first stdin
// ends that original child while the second remains live; this is not an actual
// OS PID-reuse experiment.
// 1. Enroll both live original objects and observe non-retirement.
// 2. Join one original child and observe sticky retirement, with the other live.
// 3. Reject dead enrollment and release both original references and children.
//
// @evidence contracts/testing.md#behavioral-verification Calls the actual platform acquire/poll/close primitives for two real authored children, including dead enrollment and closed-reference errors.
// @evidence contracts/testing.md#independent-expectations Child stdin closure and the original exec.Cmd.Wait independently establish which authored child ended; the other child keeps its stdin open.
// @evidence contracts/testing.md#distinguishing-cases Live versus exited original lifetimes, a separate live child, repeated exit observation, dead enrollment and closed references retain distinct outcomes. No actual numeric PID reuse is claimed.
// @evidence contracts/testing.md#execution-ownership One native Go test owns the platform primitives and two necessary authored child lifetimes; it neither invokes the SDK nor builds a compiler/plugin.
func TestOriginalReferenceTracksEnrolledLifetime(t *testing.T) {
	if os.Getenv("TTSC_OBSERVER_NATIVE_CHILD") == "1" {
		fmt.Println("READY")
		_, _ = io.Copy(io.Discard, os.Stdin)
		os.Exit(0)
	}
	type child struct {
		cmd   *exec.Cmd
		input io.WriteCloser
		ended bool
	}
	start := func() *child {
		executable, err := os.Executable()
		if err != nil {
			t.Fatal(err)
		}
		cmd := exec.Command(executable, "-test.run=^TestOriginalReferenceTracksEnrolledLifetime$")
		cmd.Env = append(os.Environ(), "TTSC_OBSERVER_NATIVE_CHILD=1")
		input, err := cmd.StdinPipe()
		if err != nil {
			t.Fatal(err)
		}
		output, err := cmd.StdoutPipe()
		if err != nil {
			t.Fatal(err)
		}
		if err := cmd.Start(); err != nil {
			t.Fatal(err)
		}
		owned := &child{cmd: cmd, input: input}
		t.Cleanup(func() {
			if !owned.ended {
				_ = owned.input.Close()
				if err := owned.cmd.Wait(); err != nil {
					t.Error(err)
				}
			}
		})
		line, err := bufio.NewReader(output).ReadString('\n')
		if err != nil || line != "READY\n" {
			t.Fatalf("child readiness: %q %v", line, err)
		}
		return owned
	}
	first, foreign := start(), start()
	original, err := acquireReference(first.cmd.Process.Pid)
	if err != nil {
		t.Fatal(err)
	}
	originalReleased := false
	t.Cleanup(func() {
		if !originalReleased {
			if err := original.close(); err != nil {
				t.Error(err)
			}
		}
	})
	other, err := acquireReference(foreign.cmd.Process.Pid)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := other.close(); err != nil {
			t.Error(err)
		}
	})
	assertPoll := func(ref reference, expected bool) {
		t.Helper()
		retired, err := ref.poll(0)
		if err != nil || retired != expected {
			t.Fatalf("original poll: retired=%v want=%v error=%v", retired, expected, err)
		}
	}
	assertPoll(original, false)
	assertPoll(other, false)
	if value := original.identity(); value.Kernel == "" || (runtime.GOOS == "windows" && value.Creation == "") {
		t.Fatalf("missing original identity: %+v", value)
	}
	if err := first.input.Close(); err != nil {
		t.Fatal(err)
	}
	if err := first.cmd.Wait(); err != nil {
		t.Fatal(err)
	}
	first.ended = true
	assertPoll(original, true)
	assertPoll(original, true)
	assertPoll(other, false)
	// Reuse the known original object: a new numeric lookup here could acquire
	// an unrelated replacement process, which this test must not misclassify.
	dead, err := requireLive(original)
	originalReleased = true
	if err == nil {
		_ = dead.close()
		t.Fatal("already exited lifetime was enrolled")
	}
	if _, err := original.poll(0); err == nil {
		t.Fatal("released original reference was accepted")
	}
}
