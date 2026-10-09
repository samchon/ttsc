package sourceprocess

import (
  "errors"
  "os/exec"
  "strings"
  "syscall"
  "testing"
  "time"
)

// TestCompleteGroupPreservesOriginalWaitAndRequiresIndependentAbsence verifies
// original wait authority, signal ordering and independent absence policy.
//
// A refused signal or observation cannot certify absence. The native Darwin
// protocol cases own real kernel behavior; these direct policy cases force
// otherwise unsafe permission, reuse and failure combinations without starting
// a process or replacing any global syscall.
//
//  1. Supply independent operation outcomes for absence, transient uncertainty,
//     persistent uncertainty, live groups and query/reaping failures.
//  2. Require the literal final-signal/wait order, original group selectors,
//     no destructive post-wait signal and the unchanged virtual-time budget.
//  3. Preserve original wait errors separately and every failed cleanup phase's
//     error identity; only observed ESRCH permits successful retirement.
//
// @evidence contracts/testing.md#behavioral-verification Calls actual completeGroup with local operation capabilities, asserting returned wait and retirement errors, native-cause identity, phase text, selectors, signal order and exact virtual elapsed time.
// @evidence contracts/testing.md#independent-expectations Literal absence/failure outcomes follow the requirement that only ESRCH proves group absence and that original child identity reserves the final destructive signal. Five seconds and ten-millisecond intervals are the existing cleanup contract, not calculated from policy outputs.
// @evidence contracts/testing.md#distinguishing-cases Immediate absence contrasts with transient EPERM and presence, persistent permission refusal, live or reused groups, unexpected query errors, reaping errors and combined signal/retirement failures. Successful versus failed original waits and nonzero ExitError remain independent of group absence. Actual cancellation, normal/nonzero/descendant and EOF connections remain in native protocol and installed runtime populations.
// @evidence contracts/testing.md#execution-ownership One discoverable Go case invokes portable policy in the same process with owned operations and a virtual clock; it builds no native artifact, starts no product process and patches no foreign/global method.
func TestCompleteGroupPreservesOriginalWaitAndRequiresIndependentAbsence(t *testing.T) {
  signalFailure := errors.New("authored final signal refusal")
  queryFailure := errors.New("authored observation failure")
  reapFailure := errors.New("authored reaping failure")
  waitFailure := errors.New("authored original wait failure")
  nonzero := &exec.ExitError{}
  cases := []struct {
    name    string
    final   error
    wait    error
    queries []error
    reap    error
    elapsed time.Duration
    causes  []error
    phase   string
  }{
    {name: "ordinary absence", queries: []error{syscall.ESRCH}},
    {name: "zombie signal refusal then independent absence", final: syscall.EPERM, queries: []error{syscall.ESRCH}},
    {name: "signal already absent still requires observation", final: syscall.ESRCH, queries: []error{syscall.ESRCH}},
    {name: "post-wait permission uncertainty then absence", queries: []error{syscall.EPERM, syscall.ESRCH}, elapsed: 10 * time.Millisecond},
    {name: "presence and permission uncertainty then absence", queries: []error{nil, syscall.EPERM, syscall.ESRCH}, elapsed: 20 * time.Millisecond},
    {name: "persistent permission refusal", queries: []error{syscall.EPERM}, elapsed: 5 * time.Second, causes: []error{syscall.EPERM}, phase: "post-wait group 73 absence remains unproved"},
    {name: "live group exhausts budget", queries: []error{nil}, elapsed: 5 * time.Second, phase: "post-wait group 73 still exists"},
    {name: "reused numeric group never re-signaled", final: syscall.ESRCH, queries: []error{nil}, elapsed: 5 * time.Second, causes: []error{syscall.ESRCH}, phase: "post-wait group 73 still exists"},
    {name: "unexpected query failure", queries: []error{queryFailure}, causes: []error{queryFailure}, phase: "post-wait group observation"},
    {name: "reaping failure", reap: reapFailure, causes: []error{reapFailure}, phase: "post-wait group reaping"},
    {name: "signal and query causes survive", final: signalFailure, queries: []error{queryFailure}, causes: []error{signalFailure, queryFailure}, phase: "post-wait group observation"},
    {name: "signal and reaping causes survive", final: signalFailure, reap: reapFailure, causes: []error{signalFailure, reapFailure}, phase: "post-wait group reaping"},
    {name: "partial permission refusal cannot certify descendants", final: signalFailure, queries: []error{syscall.EPERM}, elapsed: 5 * time.Second, causes: []error{signalFailure, syscall.EPERM}, phase: "post-wait group 73 absence remains unproved"},
    {name: "unavailable original wait remains independent", wait: waitFailure, queries: []error{syscall.ESRCH}},
    {name: "nonzero original outcome remains independent", wait: nonzero, queries: []error{syscall.ESRCH}},
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      clock := time.Unix(0, 0)
      initial := clock
      var order []string
      waited := false
      query := 0
      destructive := 0
      waitErr, retirementErr := completeGroup(73, groupOperations{
        signal: func(group int, signal syscall.Signal) error {
          if group != -73 {
            t.Errorf("signal selector = %d, want -73", group)
          }
          if signal == syscall.SIGKILL {
            destructive++
            if waited {
              t.Error("destructive signal followed original wait")
            }
            order = append(order, "final-signal")
            return test.final
          }
          if signal != 0 || !waited {
            t.Error("group observation did not follow original wait with signal zero")
          }
          order = append(order, "observe")
          index := query
          query++
          if index >= len(test.queries) {
            index = len(test.queries) - 1
          }
          if index < 0 {
            t.Fatal("unexpected observation after failed reaping")
          }
          return test.queries[index]
        },
        wait: func() error { waited = true; order = append(order, "original-wait"); return test.wait },
        reap: func(group int) error {
          if group != 73 || !waited {
            t.Error("reaping lost original group or preceded wait")
          }
          order = append(order, "reap")
          return test.reap
        },
        now: func() time.Time { return clock },
        sleep: func(duration time.Duration) {
          if duration != 10*time.Millisecond {
            t.Errorf("sleep = %v, want 10ms", duration)
          }
          clock = clock.Add(duration)
          if clock.Sub(initial) > 5*time.Second {
            t.Fatal("retirement extended its observation budget")
          }
        },
      })
      if waitErr != test.wait {
        t.Errorf("original wait error changed: got %v, want %v", waitErr, test.wait)
      }
      if destructive != 1 || len(order) < 3 || order[0] != "final-signal" || order[1] != "original-wait" || order[2] != "reap" {
        t.Errorf("invalid retirement order: %v", order)
      }
      if elapsed := clock.Sub(initial); elapsed != test.elapsed {
        t.Errorf("elapsed = %v, want %v", elapsed, test.elapsed)
      }
      if test.phase == "" {
        if retirementErr != nil {
          t.Errorf("independent absence rejected: %v", retirementErr)
        }
      } else {
        if retirementErr == nil || !strings.Contains(retirementErr.Error(), test.phase) {
          t.Errorf("missing retirement failure phase %q: %v", test.phase, retirementErr)
        }
        for _, cause := range test.causes {
          if !errors.Is(retirementErr, cause) {
            t.Errorf("original cleanup cause lost: %v in %v", cause, retirementErr)
          }
        }
        if test.final != nil && !strings.Contains(retirementErr.Error(), "pre-wait final group signal") {
          t.Error("final signal failure phase lost")
        }
      }
    })
  }
}
