import type { TtscWatchInput } from "../transform/watch/TtscWatchInput";
import type { ViteDevServerLike } from "./ViteDevServerLike";

/**
 * Serve-time compiler dependencies never enter Vite's runtime import graph.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Attach, sequence capture, per-importer replacement and disposal express
 *   compiler-input ownership separately from Vite's executable import graph.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One lifecycle boundary hides observer implementation while preserving the
 *   importer identity and capture token the caller must supply.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The interface does not invent runtime imports to force compiler assets into
 *   Vite's watcher; reload policy remains with the attached server.
 * @evidence contracts/common.md#meaningful-documentation
 *   Spaced native member comments explain recovery inputs, sequence meaning
 *   and overlapping-restart ownership per documentation guidance.
 */
export interface ViteServeInputWatch {
  /**
   * Bind the dev server whose graphs are invalidated, and open the pinned
   * project-root scope.
   *
   * @evidence contracts/common.md#principled-implementation
   *   The supplied server defines the graph recipient and configured root for
   *   compiler observation; binding occurs before module registrations use it.
   * @evidence contracts/common.md#clear-and-simple-design
   *   One attach transition keeps server association and project scope together.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   Binding a structural host uses the adapter-owned observer, not patched Vite hooks.
   * @evidence contracts/common.md#meaningful-documentation
   *   Native prose states both effects, with a blank separator before tags
   *   and member spacing following documentation guidance.
   */
  attach(server: ViteDevServerLike): void;

  /**
   * The current change sequence, taken before a compile so registration can
   * tell what changed during it.
   *
   * @evidence contracts/common.md#principled-implementation
   *   A monotonic change-sequence token relates later registration to events
   *   since capture rather than accepting a stale delivery as an event response.
   * @evidence contracts/common.md#clear-and-simple-design
   *   One scalar token exposes the needed observation boundary without event internals.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   The token records real observer state, not a fabricated quiet-watcher verdict.
   * @evidence contracts/common.md#meaningful-documentation
   *   The method states when to take the token and why, following native paragraph
   *   and tag separation guidance.
   */
  begin(): number;

  /**
   * Close every scope, poller, and timer, and forget every entry; the attached
   * server is kept for an overlapping restart container.
   *
   * @evidence contracts/common.md#principled-implementation
   *   Promise completion represents observer teardown while server identity is
   *   retained for a replacement container's supported overlapping restart.
   * @evidence contracts/common.md#clear-and-simple-design
   *   One operation exposes release without requiring callers to enumerate handles.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   Server retention supports a real restart lifecycle rather than skipping teardown.
   * @evidence contracts/common.md#meaningful-documentation
   *   Native prose identifies released resources and retained association, with
   *   member/tag spacing following the documentation skill.
   */
  dispose(): Promise<void>;

  /**
   * Release every compiler input owned by one removed source module.
   *
   * @evidence contracts/common.md#principled-implementation
   *   Importer identity selects that owner's registrations while other importers
   *   can retain shared subscriptions to the same input.
   * @evidence contracts/common.md#clear-and-simple-design
   *   Removal stays expressed in source-module terms rather than watcher handles.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   The operation releases owned subscriptions without changing Vite internals.
   * @evidence contracts/common.md#meaningful-documentation
   *   Native prose states the ownership boundary and uses the documentation
   *   skill's blank tag/member separators.
   */
  forget(importer: string): void;

  /**
   * Replace one importer's compiler inputs with a delivery's, keeping a failed
   * delivery's previous spellings for recovery.
   *
   * @evidence contracts/common.md#principled-implementation
   *   Importer and input evidence define registration ownership; failed delivery
   *   retains recovery spellings and startedAt relates evidence to observer events.
   * @evidence contracts/common.md#clear-and-simple-design
   *   One replacement boundary groups a delivery's inputs and capture token.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   Retaining failed inputs supports retry after real changes, not a forced
   *   successful transform or a synthetic runtime dependency.
   * @evidence contracts/common.md#meaningful-documentation
   *   Native prose explains replacement/recovery and the neighboring token method
   *   supplies sequence meaning, with tag/member spacing per documentation guidance.
   */
  replace(
    importer: string,
    inputs: readonly TtscWatchInput[],
    failed?: boolean,
    startedAt?: number,
  ): void;
}
