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
 * use compatible byte framing. The Windows parity test in
 * `internal/lspserver` checks one existing directory and one missing descendant;
 * it does not establish agreement for every native entry or failure state.
 *
 * @evidence contracts/common.md#principled-implementation Domain-framed content, link and topology records encode the same selection distinctions as the Go validator; physical directory identity is distinct from leaf-link identity and ordinary child content.
 * @evidence contracts/common.md#clear-and-simple-design JavaScript capture and validation share these digest helpers; the Go peer independently implements the startup framing and must remain compatible.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unavailable reads and non-file entries use declared protocol markers; a missing marker can also represent a read failure and is not proof of absence. Native readers remain supported APIs without foreign replacement.
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
   * @evidence contracts/common.md#principled-implementation The frame combines the available directory identity and sorted immediate name/kind/link-target observations; ordinary child content is excluded. These sequential native reads are not an atomic topology snapshot.
   * @evidence contracts/common.md#clear-and-simple-design Physical identity and immediate topology have separate private readers and combine at one documented protocol boundary.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Any failed directory listing uses the missing topology marker, without certifying absence or distinguishing permission failure; unreadable link targets have a separate marker and supported filesystem APIs remain unchanged.
   * @evidence contracts/common.md#meaningful-documentation The native paragraph states exactly which entry facts count and excludes child contents, with separated tags following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Windows uses native resolved spelling; POSIX passes raw physical bytes through topology enumeration, preserving backslashes and non-UTF-8 names rather than converting them into protocol separators.
   * @evidence contracts/performance.md#efficient-algorithms Native identity setup includes path probes, ancestor spelling work and a possible Windows capability query. For E immediate entries, sorting makes O(E log E) byte comparisons whose cost depends on compared name/target lengths; record buffers, sorting references and concatenated framing coexist, with hashing proportional to framed bytes. Child trees are not recursively scanned.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each reading is a freshness observation; sharing prior topology would need an independent change witness which this digest boundary does not own.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Supported synchronous APIs own their native handles; this helper retains no cross-call state or running task. Its identity context and entry/framing buffers live through the call without an independent byte ceiling.
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
   * Digest of the available observations of one entry. A symlink frame combines
   * its raw target and reached content; failed target/content reads use markers.
   * Regular files hash their bytes, while classification or regular-file read
   * failure hashes the stable `missing` marker. Other entry kinds hash as
   * `other`. The reads are sequential and do not pin the entry against change.
   *
   * @evidence contracts/common.md#principled-implementation File, symlink and other frames distinguish available entry observations; a symlink includes the observed target and reached bytes. Unavailable observations collapse into markers, so unchanged digests do not prove native state was unchanged.
   * @evidence contracts/common.md#clear-and-simple-design One lstat-driven dispatch owns entry-kind framing and keeps dangling or unreadable symlink content distinct from a missing link itself.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Fixed markers encode the native wire contract's unavailable states; the function reads actual entries rather than replacing content with expected diagnostics or test values.
   * @evidence contracts/common.md#meaningful-documentation Native prose documents each entry kind and the two symlink inputs, with tags separated according to the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Native lstat, readlink and readFile preserve host link semantics; Buffer target reads retain POSIX raw bytes while Windows supplies the native target representation consumed by the Go peer.
   * @evidence contracts/performance.md#efficient-algorithms One native classification and at most one target/content read produce the digest. Native path work, hashing and copied framing scale with path, target and reached content bytes; whole-file buffers and concatenated frames coexist without a separate input byte ceiling. No unrelated files are enumerated.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This produces a current observation, not a cached selection; a prior digest cannot be reused without separately proving the file and link remained unchanged.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Supported synchronous APIs own their handles; this helper retains only local content/framing buffers during the call and returns digest text. It owns no cross-call history, persistent handle or running task.
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
   * Best-effort resolved spelling of an entry's parent joined with its own
   * basename, preserving the leaf link rather than resolving its target.
   * Failed parent probes retain unresolved suffixes; if every probe fails,
   * the normalized lexical spelling is returned. This does not pin identity.
   *
   * @evidence contracts/common.md#principled-implementation Resolving available parent ancestors and reattaching the basename preserves the leaf coordinate used by exact reload-file fingerprints. Failed resolution falls back to lexical spelling rather than certifying a physical identity.
   * @evidence contracts/common.md#clear-and-simple-design Parent canonicalization stays with one private resolver; this public adapter expresses the leaf-preserving operation in one native join.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts All failed realpath probes are treated as unresolved, including failures other than absence. Suffixes remain beneath a resolved ancestor, or the normalized original path is returned when no ancestor resolves.
   * @evidence contracts/common.md#meaningful-documentation The native paragraph explains why the leaf differs from its ancestors, and separated tags follow the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Shared native spelling normalization handles extended Windows paths while native dirname/basename/join preserve POSIX names; no unconditional case folding is used.
   * @evidence contracts/performance.md#efficient-algorithms The ancestor walk makes one native realpath probe per visited parent until success or root. Repeated dirname/basename/path normalization and the final join depend on path text lengths; retained suffix strings and joined spelling are local, with no directory traversal.
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
