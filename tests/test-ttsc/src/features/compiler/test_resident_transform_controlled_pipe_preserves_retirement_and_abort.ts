import { test_residenttransformprocess_lifecycle } from "../../../../test-e2e/src/features/ttsc/api/test_residenttransformprocess_lifecycle";
import { test_residenttransformprocess_request_bounds } from "../../../../test-e2e/src/features/ttsc/api/test_residenttransformprocess_request_bounds";

/**
 * Connect the retained actual controlled-pipe meanings to the owning unit suite.
 *
 * The peer is a Node protocol program, not a Go compiler. The original bodies
 * already combine compatible requests and join every owned child; this entry
 * restores their selection without repeating installed/native host setup.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual ResidentTransformProcess bodies over real stdin/stdout pipes: FIFO, legal negatives, shape rejection, malformed wire plus valid tail, explicit disposal, host exit, delayed success, pre-write abort and in-flight/collateral retirement. Both bodies settle before aggregate failure.
 * @evidence contracts/testing.md#independent-expectations Authored peer frames, literal source names and exact errors define each outcome independently of private queue storage. The lifecycle malformed-plus-tail pair is written by the real child; the separate request-bound late-line injection remains only a direct reader-branch observation.
 * @evidence contracts/testing.md#distinguishing-cases Healthy reuse and caller-only pre-abort differ from terminal malformed/disposal/exit/in-flight abort. Slow actual replies must succeed: the production client has no request deadline, and this entry invents none.
 * @evidence contracts/testing.md#execution-ownership The existing test-ttsc index recursively selects this compiler feature. It calls two retained bodies, acquiring six actual controlled Node peer lifetimes, with joined child-close cleanup and no Go build, SDK install or native compiler. These are six subprocesses, not one execution or zero lifetime cost; the body is unexecuted.
 */
export async function test_resident_transform_controlled_pipe_preserves_retirement_and_abort(): Promise<void> {
  const results = await Promise.allSettled([
    test_residenttransformprocess_lifecycle(),
    test_residenttransformprocess_request_bounds(),
  ]);
  const failures = results.flatMap((result) => result.status === "rejected" ? [result.reason] : []);
  if (failures.length) throw new AggregateError(failures, "controlled resident pipe lifecycle and request ownership");
}
