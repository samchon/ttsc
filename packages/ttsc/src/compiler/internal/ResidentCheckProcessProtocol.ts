import type { ResidentCheckResult } from "./ResidentCheckResult";

/**
 * Messages between one resident client and its isolated process owner. Request identifiers pair concurrent callers; only the owner's terminal receipt establishes child-close authority. Errors use structured cloning.
 *
 * @evidence contracts/common.md#principled-implementation Discriminated messages separate request results from the actual-close verdict and strict shutdown status.
 * @evidence contracts/common.md#clear-and-simple-design One private protocol connects the client and its one process owner without exposing worker transport to consumers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Worker departure is absent from the successful join receipt; it cannot substitute for child close.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains correlation, ownership and error transport.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation These data types define no native boundary; the client and host own worker and child creation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms The namespace describes data rather than choosing an execution algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Messages describe independent operations without caching results.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Types retain no resources; the client and host own queued requests and worker lifetime.
 */
export namespace ResidentCheckProcessProtocol {
  /**
   * Parent commands preserve request order before the terminal retire command. Request lines were serialized by the caller before admission.
   *
   * @evidence contracts/common.md#principled-implementation A discriminant separates serialized request admission from terminal retirement; numeric identifiers correlate independent callers.
   * @evidence contracts/common.md#clear-and-simple-design Two command variants express the only supported parent operations without duplicating native shutdown state.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Commands carry actual caller data and retirement intent rather than fabricated native results.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains ordering and serialized-line admission.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation The data declaration performs no filesystem, path or process operation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms A command type selects no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A command type performs no reusable work.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The declaration owns no live queue, worker or native handle.
   */
  export type Command =
    | { kind: "request"; id: number; line: string }
    | { kind: "retire" };

  /**
   * Owner replies separate request outcomes from native lifetime authority. Absent joinError certifies actual child close; closeError independently preserves strict shutdown failure for a joined child.
   *
   * @evidence contracts/common.md#principled-implementation Terminal joining and strict status are independent outcomes, allowing replacement of a joined failed host while refusing unknown ownership.
   * @evidence contracts/common.md#clear-and-simple-design Request results use the request identifier, and one terminal receipt carries the host's two lifetime outcomes.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The successful receipt requires actual child close; worker disappearance is not represented as success.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains absent join failure and independent strict status.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation The data declaration performs no filesystem, path or process operation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms A reply type selects no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A reply type performs no reusable work.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The declaration owns no live reply queue, worker or native handle.
   */
  export type Reply =
    | { kind: "result"; id: number; result: ResidentCheckResult }
    | { kind: "error"; id: number; error: Error }
    | { kind: "terminal"; joinError?: Error; closeError?: Error };
}
