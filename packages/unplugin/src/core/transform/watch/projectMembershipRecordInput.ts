import { membershipDigestFile } from "../../bridge/membershipDigestFile";
import { membershipRecordDigest } from "../../bridge/membershipRecordDigest";
import { writeMembershipDigestFile } from "../../bridge/writeMembershipDigestFile";
import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import type { TtscTransformHooks } from "./TtscTransformHooks";
import type { TtscWatchInput } from "./TtscWatchInput";

/**
 * The membership record file as a watch input of every module of a generation,
 * brought up to date with the generation's walk first (samchon/ttsc#1468).
 *
 * The membership input itself (`projectMembershipInput`) reaches only a bridge,
 * which observes it live; this file reaches the host's own file channel, and
 * with it the host's persistent cache. Handed at every delivery, it is written
 * only when the generation's digest differs from what the file holds, so a host
 * comparing the file's state sees it move exactly when the membership did. A
 * failed generation without a walk leaves the file as it is and still registers
 * it, so the host records the dependency either way.
 *
 * @returns The input, or `undefined` for a host that takes no membership or
 *   names no tool directory.
 */
export function projectMembershipRecordInput(
  hooks: TtscTransformHooks | undefined,
  cached: TtscCachedProjectTransform,
): TtscWatchInput | undefined {
  if (hooks?.membership !== true || hooks.toolDirectory === undefined) {
    return undefined;
  }
  const file = membershipDigestFile(hooks.toolDirectory, cached.tsconfig);
  if (cached.projectDirectories !== undefined) {
    try {
      writeMembershipDigestFile(file, {
        digest: membershipRecordDigest(
          cached.membershipPolicy,
          cached.projectDirectories,
        ),
        policy: cached.membershipPolicy,
        root: cached.projectRoot,
        tsconfig: cached.tsconfig,
      });
    } catch {
      // A record that cannot be written registers nothing persistent; the
      // host's next start then re-runs the module, which is the safe side.
      return undefined;
    }
  }
  return { file };
}
