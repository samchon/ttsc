import type { IPlaygroundDependencyProgress } from "./IPlaygroundDependencyProgress";
import type { IPlaygroundInstalledDependency } from "./IPlaygroundInstalledDependency";

/**
 * Options for {@link installPlaygroundDependencies}.
 *
 * @evidence contracts/common.md#principled-implementation Mounted exact identities, ignore policy, budgets and callbacks express distinct installation inputs; deprecated name-only state cannot establish version compatibility.
 * @evidence contracts/common.md#clear-and-simple-design One installation record groups transport, prior graph and progress controls without owning compiler mounting.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Fetch injection and explicit built-in exclusions are public policy; byte and package budgets apply to every package.
 * @evidence contracts/common.md#meaningful-documentation Member prose documents legacy limitations, byte units and streaming enforcement, with separate paragraphs and member spacing under the documentation skill.
 */
export interface IPlaygroundDependencyInstallOptions {
  /**
   * Defaults to `globalThis.fetch`; inject a transport for offline runs.
   */
  fetch?: PlaygroundFetch;

  /**
   * Exact package identities already mounted in this session.
   *
   * New edges are reconciled against their versions, registry targets, and
   * active requests before a tarball is reused.
   */
  installedDependencies?: Iterable<IPlaygroundInstalledDependency>;

  /**
   * Legacy name-only skip list.
   *
   * Prefer `installedDependencies`; names alone cannot validate later ranges.
   */
  installedPackages?: Iterable<string>;

  /** Package names to never install (preinstalled / built-in). */
  ignoredPackages?: Iterable<string>;

  /**
   * Maximum distinct package names completed in one install call (default: 48).
   *
   * Must be a nonnegative safe integer. Mounted packages revalidated and
   * optional packages omitted count toward the cap; unrequested mounted state
   * does not. Zero allows only calls with no queued packages. Invalid values
   * reject before input iteration, progress callbacks or network requests.
   */
  maxPackages?: number;

  /**
   * Maximum compressed bytes accepted for one npm tarball.
   *
   * Defaults to 16 MiB and is enforced while streaming, independent of the
   * response's `Content-Length`.
   */
  maxTarballBytes?: number;

  /**
   * Maximum expanded tar bytes accepted for one npm package.
   *
   * Defaults to 64 MiB and is enforced while gzip output is streamed.
   */
  maxUnpackedBytes?: number;

  /** Aborts the install when triggered. */
  signal?: AbortSignal;

  /**
   * Fires synchronously for phase transitions; callback failures reject the install.
   */
  onProgress?: PlaygroundDependencyProgressHandler;
}

/**
 * Fetch a playground package or source pack through the caller's transport.
 *
 * @evidence contracts/common.md#principled-implementation Standard RequestInit and Response preserve status, cancellation and streamed-body semantics used by the loaders.
 * @evidence contracts/common.md#clear-and-simple-design Transport stays distinct from registry resolution, archive processing and mounting.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Injection uses an explicit seam without replacing global fetch internals.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies the transport role; optional initialization matches fetch consumers.
 */
export type PlaygroundFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

/**
 * Receive synchronous installation progress; thrown errors reject installation.
 *
 * @evidence contracts/common.md#principled-implementation A typed event reports the actual install transition without inventing a success result.
 * @evidence contracts/common.md#clear-and-simple-design A single void notification keeps presentation state outside registry processing.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Observer failures are not converted into synthetic installation success.
 * @evidence contracts/common.md#meaningful-documentation Native prose states delivery timing and error propagation independently of acknowledgment tags.
 */
export type PlaygroundDependencyProgressHandler = (
  event: IPlaygroundDependencyProgress,
) => void;
