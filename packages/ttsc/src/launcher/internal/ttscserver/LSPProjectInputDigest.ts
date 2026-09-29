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
 *
 * @evidence contracts/common.md#principled-implementation Domain-framed content, link and topology records encode the same selection distinctions as the Go validator; physical directory identity is distinct from leaf-link identity and ordinary child content.
 * @evidence contracts/common.md#clear-and-simple-design One namespace owns digest framing and physical spelling so capture and validation cannot maintain independent versions of the startup protocol.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing, unreadable and non-file states are explicit protocol records rather than fabricated bytes; native readers remain supported APIs without foreign replacement.
 * @evidence contracts/common.md#meaningful-documentation Namespace and helper comments explain cross-host framing, raw-byte preservation and leaf identity, with separated public tags and member paragraphs following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Windows native paths use the shared identity resolver; POSIX reads preserve raw path and link-target bytes, and neither branch infers filesystem case from an OS label.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms This namespace groups digest operations but chooses no computation itself; its functions acknowledge their own traversal and allocation costs.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The namespace retains no digest or validity state; each function supplies the current observation its caller needs.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The namespace owns no stored baseline, handle or running task; capture and session owners control returned observations.
 */
export namespace LSPProjectInputDigest {
  /**
   * A project-input snapshot plus the fingerprints taken when it was read.
   *
   * @evidence contracts/common.md#principled-implementation The intersection retains dependency declarations and attaches separate read-time file/content and directory/topology observations keyed by those declarations.
   * @evidence contracts/common.md#clear-and-simple-design Two readonly maps add baseline evidence without copying the base dependency schema or merging distinct reload semantics.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The representation stores actual captured digests rather than a precomputed compliance boolean that could conceal changed inputs.
   * @evidence contracts/common.md#meaningful-documentation Native type and member comments identify read-time provenance and topology versus content, using blank member lines and prose/tag separation following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Map keys preserve declared native spellings while the digest producer separately handles physical identity and link state across supported platforms.
   *
   * @evidenceExclude contracts/performance.md#efficient-algorithms This baseline type represents observations without choosing a traversal or hashing algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The representation does not coordinate equivalent requests; capture and validation functions own whether a selection remains reusable.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Session callers own the baseline lifetime; declaring its maps does not allocate or retain historical snapshots independently.
   */
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
   *
   * @evidence contracts/common.md#principled-implementation The framed digest combines physical directory identity with sorted immediate name/kind/link-target records, so topology and directory retargeting invalidate selection without treating ordinary child content as topology.
   * @evidence contracts/common.md#clear-and-simple-design Physical identity and immediate topology have separate private readers and combine at one documented protocol boundary.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The missing topology marker is shared protocol state, not an expected output; unreadable link targets remain explicit and no foreign filesystem function is replaced.
   * @evidence contracts/common.md#meaningful-documentation The native paragraph states exactly which entry facts count and excludes child contents, with separated tags following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Windows uses native resolved spelling; POSIX passes raw physical bytes through topology enumeration, preserving backslashes and non-UTF-8 names rather than converting them into protocol separators.
   * @evidence contracts/performance.md#efficient-algorithms For E immediate entries and B serialized bytes, sorting costs O(E log E) comparisons and framing/hashing O(B); traversal remains immediate and does not recursively scan child trees.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each reading is a freshness observation; sharing prior topology would need an independent change witness which this digest boundary does not own.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Native synchronous reads close their handles; identity context and entry buffers are local to one call with storage proportional to immediate topology.
   */
  export function lspProjectInputReloadDirectoryDigest(
    location: string,
  ): string {
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
        const physical = realpath(Buffer.from(existing), {
          encoding: "buffer",
        });
        const segments: Buffer[] = [physical];
        for (let index = missing.length - 1; index >= 0; index--) {
          if (index !== missing.length - 1 || physical.at(-1) !== 0x2f)
            segments.push(Buffer.from("/"));
          segments.push(missing[index]!);
        }
        return Buffer.concat(segments);
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
        missing.push(Buffer.from(path.basename(existing)));
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
        for (const entry of fs.readdirSync(directory, {
          withFileTypes: true,
        })) {
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
          entries.push(
            lspProjectInputDirectoryRecord(entry.name, entry, target),
          );
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
   *
   * @evidence contracts/common.md#principled-implementation Distinct file, symlink, missing and other frames preserve entry meaning; a symlink includes both its raw target and reached bytes so either retargeting or content drift changes the fingerprint.
   * @evidence contracts/common.md#clear-and-simple-design One lstat-driven dispatch owns entry-kind framing and keeps dangling or unreadable symlink content distinct from a missing link itself.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Fixed markers encode the native wire contract's unavailable states; the function reads actual entries rather than replacing content with expected diagnostics or test values.
   * @evidence contracts/common.md#meaningful-documentation Native prose documents each entry kind and the two symlink inputs, with tags separated according to the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Native lstat, readlink and readFile preserve host link semantics; Buffer target reads retain POSIX raw bytes while Windows supplies the native target representation consumed by the Go peer.
   * @evidence contracts/performance.md#efficient-algorithms One entry classification and at most one target/content read produce the digest; time and temporary bytes scale with the target string and reached file contents rather than unrelated files.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This produces a current observation, not a cached selection; a prior digest cannot be reused without separately proving the file and link remained unchanged.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Synchronous native calls retain no handle after return and content buffers are local; no historical file population accumulates.
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
   * alone. Windows hands back extended-length paths from a native realpath, and
   * a record written as `\?\C:\project` never matches a lookup for `C:\project`
   * even though one file is meant — the split identity every other consumer on
   * this branch was taught to avoid.
   */
  function realLSPProjectInputPath(location: string): string {
    const absolute = resolveProjectInputPath(location);
    let probe = absolute;
    const suffix: string[] = [];
    for (;;) {
      try {
        const resolved = resolveProjectInputPath(fs.realpathSync.native(probe));
        return path.join(resolved, ...suffix.reverse());
      } catch {
        const parent = path.dirname(probe);
        if (parent === probe) return path.normalize(absolute);
        suffix.push(path.basename(probe));
        probe = parent;
      }
    }
  }

  /**
   * The physical spelling of an entry's parent directory joined with the
   * entry's own name, so a symlinked file keeps its link identity while an
   * aliased directory above it is resolved.
   *
   * @evidence contracts/common.md#principled-implementation Resolving only the parent and reattaching the basename preserves the leaf link as an entry while removing ancestor aliases, which is the identity exact reload-file fingerprints require.
   * @evidence contracts/common.md#clear-and-simple-design Parent canonicalization stays with one private resolver; this public adapter expresses the leaf-preserving operation in one native join.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing suffixes are retained beneath a resolved ancestor rather than replaced with an unrelated existing path or an assumed target.
   * @evidence contracts/common.md#meaningful-documentation The native paragraph explains why the leaf differs from its ancestors, and separated tags follow the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Shared native spelling normalization handles extended Windows paths while native dirname/basename/join preserve POSIX names; no unconditional case folding is used.
   * @evidence contracts/performance.md#efficient-algorithms The ancestor walk makes at most one realpath probe per missing path component and rejoins retained components once, using space proportional to that suffix.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Ancestor aliases may retarget between captures, so this current resolver owns no reusable validity proof or persistent canonicalization cache.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only local path components are retained through the synchronous walk; no handle or cross-call path history survives.
   */
  export function realLSPProjectInputEntryPath(location: string): string {
    const absolute = resolveProjectInputPath(location);
    return path.join(
      realLSPProjectInputPath(path.dirname(absolute)),
      path.basename(absolute),
    );
  }
}
