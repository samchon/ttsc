package sourceprocess

import (
	"errors"
	"fmt"
	"syscall"
	"time"
)

// groupOperations supplies the original child's wait and the native group
// operations. The caller retains the unreaped child until signal returns;
// neither a numeric PID lookup nor this policy creates that authority.
//
// The POSIX caller supplies actual signal, wait and reaping capabilities and
// retains their resources; the local record allows an owned clock in policy
// tests without replacing global syscalls or granting authority from a PID.
type groupOperations struct {
	signal func(int, syscall.Signal) error
	wait func() error
	reap func(int) error
	now func() time.Time
	sleep func(time.Duration)
}

// completeGroup sends the final destructive signal while the original child
// still reserves its group identity, consumes that child's wait, then proves
// group absence independently. After wait it sends only signal zero: a reused
// numeric group can cause conservative failure, never destructive re-signaling.
//
// A signal refusal does not prove absence. EPERM from a post-wait observation
// remains unknown and is observed within the existing five-second budget;
// only ESRCH certifies absence. Persistent uncertainty, presence and other
// native failures preserve failure, including the final signal's cause.
//
// Original wait errors remain separate from retirement failures. Native wait,
// reaping and syscall costs can exceed the between-observation budget; it is
// not a deadline on original child joining. No earlier result is reused, and
// only local operation references and errors survive until return.
func completeGroup(group int, operations groupOperations) (waitErr, retirementErr error) {
	signalErr := operations.signal(-group, syscall.SIGKILL)
	waitErr = operations.wait()
	deadline := operations.now().Add(5 * time.Second)
	for {
		if err := operations.reap(group); err != nil {
			retirementErr = fmt.Errorf("post-wait group reaping: %w", err)
			break
		}
		err := operations.signal(-group, 0)
		if errors.Is(err, syscall.ESRCH) { return waitErr, nil }
		if err != nil && !errors.Is(err, syscall.EPERM) {
			retirementErr = fmt.Errorf("post-wait group observation: %w", err)
			break
		}
		if !operations.now().Before(deadline) {
			if err != nil {
				retirementErr = fmt.Errorf("post-wait group %d absence remains unproved after termination: %w", group, err)
			} else {
				retirementErr = fmt.Errorf("post-wait group %d still exists after termination", group)
			}
			break
		}
		operations.sleep(10 * time.Millisecond)
	}
	if signalErr != nil {
		retirementErr = errors.Join(fmt.Errorf("pre-wait final group signal: %w", signalErr), retirementErr)
	}
	return waitErr, retirementErr
}
