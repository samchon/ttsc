//go:build !windows

package sourceprocess

import (
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"syscall"
	"time"

	"golang.org/x/sys/unix"
)

// runCommand gives the command a separate process group before exec. Both
// cancellation and ordinary target exit retire any surviving group members.
// Exit observation leaves the direct child unreaped until group termination,
// so its process-group identity cannot be reused before the final signal.
// The direct child is then waited for; Linux also reaps adopted descendants, while
// other POSIX hosts leave orphan reaping to the operating system.
//
// @evidence contracts/common.md#principled-implementation Setpgid establishes the command boundary before target execution; group signals retire inherited descendants and wait plus native group absence qualify the completion record. Processes that deliberately leave the group are not contained by a POSIX group.
// @evidence contracts/common.md#clear-and-simple-design Command execution owns one wait result and one cancellation selection; the platform reaper and the bounded group finalizer isolate native differences.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Native process-group operations retire real work; unknown cleanup remains an error rather than a successful response or a longer command deadline.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes direct-child waiting, Linux adopted-child reaping and the operating system's orphan ownership elsewhere.
// @evidence contracts/portability.md#os-neutral-implementation A build constraint isolates POSIX group signalling and the Linux reaper from Windows Jobs. Arguments and environment entries remain native vectors without a shell.
// @evidence contracts/performance.md#efficient-algorithms One target is spawned and waited for; cleanup observes the owned group between fixed polling intervals, with adopted-child work proportional to exited descendants.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Effectful command executions cannot share their results merely because argv matches.
// @evidence contracts/performance.md#bound-retention-and-release-resources The call owns one target, wait goroutine and optional command timer. Normal completion and cancellation join the direct child and retire surviving group members. Native refusal or a group that does not disappear within the cleanup budget yields an explicit unproved-cleanup error.
func runCommand(req request, cancel <-chan struct{}, out, stderr io.Writer) (completed result) {
	if req.WindowsVerbatimArguments {
		return failure("EINVAL", "Windows verbatim arguments are unavailable on POSIX")
	}
	if err := prepareReaper(); err != nil { return failure("EPROCESS", err.Error()) }
	select {
	case <-cancel:
		value := failure("ECANCELED", "source command cancelled before launch")
		value.Cancelled = true
		value.Cleanup = cleanupProof{DirectChildJoined: true, BoundaryEmpty: true, OrphanReaping: orphanReaping()}
		return value
	default:
	}
	directory, err := os.MkdirTemp("", "ttsc-source-process-")
	if err != nil { return failure("EIO", err.Error()) }
	defer func() {
		if err := os.RemoveAll(directory); err != nil {
			completed.Error = &processError{Code: "EIO", Message: fmt.Sprintf("source process private-directory cleanup failed: %v", err)}
		}
	}()
	input, closeInput, err := openInput(req, directory)
	if err != nil { return failure("EINVAL", err.Error()) }
	defer func() {
		if err := closeInput(); err != nil {
			completed.Error = &processError{Code: "EIO", Message: fmt.Sprintf("source process input cleanup failed: %v", err)}
		}
	}()
	cmd := exec.Command(req.Command, req.Args...)
	if req.Argv0 != nil { cmd.Args[0] = *req.Argv0 }
	cmd.Dir, cmd.Env = req.Cwd, environment(req.Env)
	cmd.Stdin = input
	cmd.Stdout, cmd.Stderr = out, stderr
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	if err := cmd.Start(); err != nil {
		value := commandResult(cmd, err)
		value.Cleanup = cleanupProof{DirectChildJoined: true, BoundaryEmpty: true, OrphanReaping: orphanReaping()}
		return value
	}
	exited := observeExit(cmd.Process.Pid)
	var deadline <-chan time.Time
	if req.TimeoutMs > 0 {
		timer := time.NewTimer(time.Duration(req.TimeoutMs) * time.Millisecond)
		defer timer.Stop()
		deadline = timer.C
	}
	var observationErr error
	cancelled, timedOut := false, false
	observed := false
	select {
	case observationErr = <-exited:
		observed = true
	case <-cancel:
		cancelled = true
	case <-deadline:
		cancelled, timedOut = true, true
	}
	// The direct child has not been reaped, even if it already exited. Its PID
	// therefore still reserves this group identity during the final signal.
	terminationErr := syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
	if !observed { observationErr = <-exited }
	runErr := cmd.Wait()
	value := commandResult(cmd, runErr)
	value.Cancelled = cancelled
	value.Cleanup.OrphanReaping = orphanReaping()
	if terminationErr != nil && !errors.Is(terminationErr, syscall.ESRCH) {
		value.Error = &processError{Code: "EPROCESS", Message: terminationErr.Error()}
		return value
	}
	if err := retireGroup(cmd.Process.Pid); err != nil {
		value.Error = &processError{Code: "EPROCESS", Message: err.Error()}
		return value
	}
	value.Cleanup.BoundaryEmpty = true
	if observationErr != nil { value.Error = &processError{Code: "EPROCESS", Message: observationErr.Error()} }
	if timedOut { value.Error = &processError{Code: "ETIMEDOUT", Message: "source command exceeded its requested timeout"} }
	if cancelled && !timedOut { value.Error = &processError{Code: "ECANCELED", Message: "source command cancelled"} }
	return value
}

func retireGroup(group int) error {
	deadline := time.Now().Add(5 * time.Second)
	for {
		if err := reapGroup(group); err != nil { return err }
		err := syscall.Kill(-group, 0)
		if errors.Is(err, syscall.ESRCH) { return nil }
		if err != nil { return err }
		if !time.Now().Before(deadline) { return fmt.Errorf("source process group %d still exists after termination", group) }
		time.Sleep(10 * time.Millisecond)
	}
}

func commandSignal(state *os.ProcessState) *string {
	status, ok := state.Sys().(syscall.WaitStatus)
	if !ok || !status.Signaled() { return nil }
	name := unix.SignalName(unix.Signal(status.Signal()))
	return &name
}

func runInner(_ []string, _ io.Reader, _ io.Writer, stderr io.Writer) int {
	fmt.Fprintln(stderr, "ttsc: source-process inner command is Windows-only")
	return 2
}
