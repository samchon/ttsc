import fs from "node:fs";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../transform/filesystem/TtscTransformFilesystemOperations";
import { walkProjectInputs } from "../transform/project/walkProjectInputs";
import { MEMBERSHIP_DIGEST_DIRECTORY } from "./MEMBERSHIP_DIGEST_DIRECTORY";
import type { TtscMembershipDigestRecord } from "./TtscMembershipDigestRecord";
import { membershipRecordDigest } from "./membershipRecordDigest";
import { writeMembershipDigestFile } from "./writeMembershipDigestFile";

/**
 * Bring every membership record below a host's tool directory up to date with
 * the project on disk, before the host validates anything against its
 * persistent cache (samchon/ttsc#1468).
 *
 * A host restoring a module from its cache never runs the adapter for it, so
 * the adapter cannot learn at delivery that a root file appeared or vanished
 * while nothing ran. It learns here instead: each record names a tsconfig, its
 * root and the rule its walk applied, and the same walk over the same rule
 * gives the current digest. A record whose digest moved is rewritten, and the
 * host, which recorded the file as a dependency of every module of that
 * project, runs those modules again. A record whose tsconfig is gone records
 * that, which is a change too.
 *
 * The walk lists directories and never reads a file, so this costs the
 * project's directory count once per build start. A tool directory with no
 * records costs one failed listing.
 *
 * @param toolDirectory The host's tool directory (`hostToolDirectory`).
 */
export function refreshMembershipDigestFiles(
  toolDirectory: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): void {
  const directory = path.join(toolDirectory, MEMBERSHIP_DIGEST_DIRECTORY);
  let names: string[];
  try {
    names = fs.readdirSync(directory);
  } catch {
    return;
  }
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const file = path.join(directory, name);
    let record: TtscMembershipDigestRecord;
    try {
      record = JSON.parse(
        fs.readFileSync(file, "utf8"),
      ) as TtscMembershipDigestRecord;
    } catch {
      continue;
    }
    if (
      typeof record.tsconfig !== "string" ||
      typeof record.root !== "string" ||
      record.policy === undefined
    ) {
      continue;
    }
    const digest = fs.existsSync(record.tsconfig)
      ? membershipRecordDigest(
          record.policy,
          walkProjectInputs(record.root, filesystem, record.policy).directories,
        )
      : null;
    writeMembershipDigestFile(file, { ...record, digest });
  }
}
