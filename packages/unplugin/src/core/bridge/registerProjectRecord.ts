import type { TtscProjectRegistration } from "../transform/watch/TtscProjectRegistration";
import type { HostWatchBridge } from "./HostWatchBridge";

/**
 * Hand one delivery's project record to a build host, and its inputs to the
 * session's bridge when the host is watching.
 *
 * This is the whole of what a build host learns from a delivery: the record
 * goes through the host's own file channel, the same one that watches the
 * module itself, and the host's watcher or persistent-cache snapshot then hears
 * the record move the way it hears any file. A watching session's bridge
 * observes the generation's inputs and moves the record when one changes
 * (`openHostWatchBridge`); a one-shot build has no bridge, and its next start
 * proves the record against the disk (`refreshProjectRecordFiles`).
 *
 * Its place in the adapter's invalidation model, and the units beside it, are
 * mapped in the maintainer page
 * `website/src/content/docs/development/reference/unplugin-invalidation.mdx`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Watching sessions register generation inputs with the bridge before handing
 *   the same record path to the host's dependency channel; one-shot hosts need
 *   only that persisted dependency for their next-start proof.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One operation coordinates the two ownership boundaries without embedding
 *   filesystem validation or bundler-specific watcher behavior.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Supported addWatchFile and adapter-owned observation replace direct compiler
 *   input registration into host channels that cannot represent those inputs.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs identify delivery/bridge roles and the maintainer map;
 *   spaced property comments and tag separation follow documentation guidance.
 */
export function registerProjectRecord(props: {
  /** The host's own file channel. */
  addWatchFile: (file: string) => void;

  /** The session's bridge, present only while the host is watching. */
  bridge?: { instance: HostWatchBridge; startedAt: number };

  /** What the delivery handed over (`TtscTransformHooks.project`). */
  registration: TtscProjectRegistration;
}): void {
  const { failed, inputs, record } = props.registration;
  props.bridge?.instance.register(
    record,
    inputs(),
    failed,
    props.bridge.startedAt,
  );
  props.addWatchFile(record);
}
