import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { type ProjectInputPathIdentityContext } from "../../../internal/pathIdentity/ProjectInputPathIdentityContext";
import { createProjectInputPathIdentityContext } from "../../../internal/pathIdentity/createProjectInputPathIdentityContext";
import { resolveProjectInputPath } from "../../../internal/pathIdentity/resolveProjectInputPath";
import type { ITtscProjectInputSnapshot } from "../../../structures/internal/ITtscProjectInputSnapshot";

/**
 * Content fingerprints of the files and directories whose change forces the
 * language server to reselect plugins.
 *
 * `ttscserver` resolves its plugin selection before the Go LSP host starts and
 * hands both the selection and these fingerprints to the host, which recomputes
 * them to notice a change that landed in between. The two sides must therefore
 * hash identically, byte for byte and on every platform; the Windows parity
 * test in `internal/lspserver` pins that.
 */
export namespace LSPProjectInputDigest {
/** A project-input snapshot plus the fingerprints taken when it was read. */
export type InitialLSPProjectInputSnapshot = ITtscProjectInputSnapshot & {
  /** Topology digest of each reload directory, keyed by its declared path. */
  reloadDirectoryDigests: Readonly<Record<string, string>>;
  /** Content digest of each reload file, keyed by its declared path. */
  reloadFileDigests: Readonly<Record<string, string>>;
};

/**
 * Digest of a directory's immediate topology: each child's name, kind, and
 * link target, resolved through the directory's physical identity. Content of
 * the children is not part of it.
 */
export function lspProjectInputReloadDirectoryDigest(location: string): string {
  const identities = createProjectInputPathIdentityContext();
  const identity = lspProjectInputPhysicalPathIdentity(location, identities);
  return createHash("sha256")
    .update(
      Buffer.concat([
        Buffer.from("directory\0"),
        identity,
        Buffer.from([0]),
        Buffer.from(
          lspProjectInputDirectoryTopologyDigest(
            process.platform === "win32"
              ? identities.resolve(location).path
              : identity,
          ),
        ),
      ]),
    )
    .digest("hex");
}

function lspProjectInputPhysicalPathIdentity(
  location: string,
  identities: ProjectInputPathIdentityContext,
): Buffer {
  if (process.platform === "win32") {
    return Buffer.from(
      identities.resolve(location).path.replaceAll("\\", "/"),
      "utf8",
    );
  }
  let existing = path.resolve(location);
  const missing: Buffer[] = [];
  while (true) {
    try {
      const realpath = fs.realpathSync.native ?? fs.realpathSync;
      let physical = realpath(Buffer.from(existing), {
        encoding: "buffer",
      });
      for (const segment of missing) {
        physical = Buffer.concat([
          physical,
          physical.at(-1) === 0x2f ? Buffer.alloc(0) : Buffer.from("/"),
          segment,
        ]);
      }
      return physical;
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code !== "ENOENT" &&
        error.code !== "ENOTDIR"
      ) {
        throw error;
      }
      const parent = path.dirname(existing);
      if (parent === existing) return Buffer.from(existing);
      missing.unshift(Buffer.from(path.basename(existing)));
      existing = parent;
    }
  }
}

function lspProjectInputDirectoryTopologyDigest(
  location: string | Buffer,
): string {
  const entries: Buffer[] = [];
  try {
    if (process.platform === "win32") {
      const directory =
        typeof location === "string" ? location : location.toString("utf8");
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        let target = Buffer.alloc(0);
        if (entry.isSymbolicLink()) {
          try {
            target = Buffer.from(
              fs.readlinkSync(path.join(directory, entry.name)),
              "utf8",
            );
          } catch {
            target = Buffer.from("<unreadable>");
          }
        }
        entries.push(
          lspProjectInputDirectoryRecord(
            Buffer.from(entry.name),
            entry,
            target,
          ),
        );
      }
    } else {
      for (const entry of fs.readdirSync(location, {
        encoding: "buffer",
        withFileTypes: true,
      })) {
        let target = Buffer.alloc(0);
        if (entry.isSymbolicLink()) {
          try {
            target = fs.readlinkSync(
              Buffer.concat([
                Buffer.isBuffer(location) ? location : Buffer.from(location),
                Buffer.from(path.sep),
                entry.name,
              ]),
              { encoding: "buffer" },
            );
          } catch {
            target = Buffer.from("<unreadable>");
          }
        }
        entries.push(lspProjectInputDirectoryRecord(entry.name, entry, target));
      }
    }
  } catch {
    return createHash("sha256").update("missing\0").digest("hex");
  }
  entries.sort(Buffer.compare);
  const serialized = Buffer.concat(
    entries.flatMap((entry, index) =>
      index === 0 ? [entry] : [Buffer.from([0]), entry],
    ),
  );
  return createHash("sha256").update(serialized).digest("hex");
}

function lspProjectInputDirectoryRecord(
  name: Buffer,
  entry: {
    isDirectory(): boolean;
    isFile(): boolean;
    isSymbolicLink(): boolean;
  },
  target: Buffer,
): Buffer {
  const kind = entry.isDirectory()
    ? "directory"
    : entry.isFile()
      ? "file"
      : entry.isSymbolicLink()
        ? "symlink"
        : "other";
  return Buffer.concat([name, Buffer.from("\0" + kind + "\0"), target]);
}

/**
 * Digest of one file as the host will see it. A symlink hashes both its link
 * target and the bytes it currently reaches, so retargeting the link and
 * editing its target are both changes; a regular file hashes its bytes; a
 * missing path hashes a stable `missing` marker, so creating it later is a
 * change; anything else hashes as `other`.
 */
export function lspProjectInputFileDigest(location: string): string {
  try {
    const info = fs.lstatSync(location);
    if (info.isSymbolicLink()) {
      let target = Buffer.from("<unreadable>");
      try {
        target = fs.readlinkSync(Buffer.from(location), {
          encoding: "buffer",
        });
      } catch {
        // Preserve the same explicit unreadable state as the Go validator.
      }
      let content = Buffer.from("missing\0");
      try {
        content = Buffer.concat([
          Buffer.from("file\0"),
          fs.readFileSync(location),
        ]);
      } catch {
        // A dangling or unreadable target remains part of the symlink state.
      }
      return createHash("sha256")
        .update(
          Buffer.concat([
            Buffer.from("symlink\0"),
            target,
            Buffer.from([0]),
            content,
          ]),
        )
        .digest("hex");
    }
    if (info.isFile()) {
      return createHash("sha256")
        .update(
          Buffer.concat([Buffer.from("file\0"), fs.readFileSync(location)]),
        )
        .digest("hex");
    }
    return createHash("sha256").update("other\0").digest("hex");
  } catch {
    return createHash("sha256").update("missing\0").digest("hex");
  }
}

/**
 * Physical path of a location whose leaf may not exist yet.
 *
 * Both ends go through the shared spelling rule rather than `path.resolve`
 * alone. Windows hands back extended-length paths from a native realpath, and a
 * record written as `\?\C:\project` never matches a lookup for `C:\project`
 * even though one file is meant — the split identity every other consumer on
 * this branch was taught to avoid.
 */
function realLSPProjectInputPath(location: string): string {
  const absolute = resolveProjectInputPath(location);
  let probe = absolute;
  const suffix: string[] = [];
  for (;;) {
    try {
      let resolved = resolveProjectInputPath(fs.realpathSync.native(probe));
      for (let index = suffix.length - 1; index >= 0; index--) {
        resolved = path.join(resolved, suffix[index]!);
      }
      return path.normalize(resolved);
    } catch {
      const parent = path.dirname(probe);
      if (parent === probe) return path.normalize(absolute);
      suffix.push(path.basename(probe));
      probe = parent;
    }
  }
}

/**
 * The physical spelling of an entry's parent directory joined with the entry's
 * own name, so a symlinked file keeps its link identity while an aliased
 * directory above it is resolved.
 */
export function realLSPProjectInputEntryPath(location: string): string {
  const absolute = resolveProjectInputPath(location);
  return path.join(
    realLSPProjectInputPath(path.dirname(absolute)),
    path.basename(absolute),
  );
}
}
