import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import util from "node:util";

import { SidecarEnvironment } from "../../../compiler/internal/sharedHost/SidecarEnvironment";
import { E2ETrace } from "../../../internal/E2ETrace";
import { OwnedSynchronousProcess } from "../../../internal/OwnedSynchronousProcess";
import { SourceNativeRetirement } from "../../../internal/SourceNativeRetirement";
import { SourceBuildCacheLayout } from "./SourceBuildCacheLayout";
import { spawnGoTool } from "./spawnGoTool";

/**
 * Select and prepare a local publisher package cache for an actual cold Go
 * build.
 *
 * The release package may pin an authenticated manifest digest. Explicit local
 * experiments may instead supply both a manifest path and its separately
 * trusted digest. Every candidate must match the selected stock-Go tuple, and
 * the Go client still decides hits from its complete ActionIDs. Preparation is
 * optional; a launched helper failure remains a terminal Go build failure.
 *
 * @evidence contracts/common.md#principled-implementation The selected release or explicit operator digest authenticates manifest bytes, a stock-Go tuple probe limits coverage to effective CGO=0, and Go's GOCACHEPROG retains final action authority.
 * @evidence contracts/common.md#clear-and-simple-design One cold-build selector owns opt-in, trust, tuple, preparation and program quoting, returning an environment copy only after complete admission.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An absent pack, user cache program, unsupported Go tuple or failed preparation selects ordinary Go before launch; an active helper error is never replayed as an apparent cache miss.
 * @evidence contracts/common.md#meaningful-documentation The comment distinguishes optional preparation from terminal active-helper failure and explains both trust sources.
 * @evidence contracts/portability.md#os-neutral-implementation Native path and platform package resolution choose the host helper; Go's quoted argument grammar is applied without shell expansion on Windows or POSIX.
 * @evidence contracts/performance.md#efficient-algorithms Only cold builds read at most 16 MiB of manifest bytes, hash the bounded value, probe the Go tool once, and request at most eight bounded packs; exact executable hits never call this selector.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Shared local pack admission is performed by the helper; this selector retains no memo that could outlive a changed effective environment.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The existing native task owns the bounded helper subprocess and guards its artifact root; the helper owns downloaded staging, while this call retains only bounded JSON and output buffers.
 */
export namespace SourcePackageArtifacts {
  /**
   * Record a cold build's real materialized Go package population for sealing.
   * The operator owns the explicit output root and the records retain local
   * paths until a release publisher consumes and removes them.
   *
   * @evidence contracts/common.md#principled-implementation Only an explicit absolute publisher root and an unused local cache program admit recording; Go list and the subsequent build inspect the same materialized workspace and effective environment.
   * @evidence contracts/common.md#clear-and-simple-design One record directory holds Go package receipts, the action graph and its private overlay, while ordinary builds receive null.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Go computes and records its own actions; this step never hashes package names into cache identities or replaces an existing caller program.
   * @evidence contracts/common.md#meaningful-documentation The comment names the explicit authority, sensitive local receipts and who cleans them after publication.
   * @evidence contracts/portability.md#os-neutral-implementation Native path construction and the shared Go command owner handle host quoting, working directories and native process completion.
   * @evidence contracts/performance.md#efficient-algorithms Only explicit publisher builds collect at most 256 MiB of Go package receipts before the actual build; ordinary and exact-executable paths do not run this mode.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Publisher output is exclusive for one cold attempt and cannot be reused as evidence for a different materialized workspace.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The native scope guards the record directory, a byte cap bounds the saved Go output, and the operator owns its eventual deletion after sealing.
   */
  export function record(opts: {
    cwd: string;
    entry: string;
    env: NodeJS.ProcessEnv;
    goBinary: string;
    key: string;
    pluginName: string;
    ttscVersion: string;
  }): {
    env: NodeJS.ProcessEnv;
    actionGraph: string;
    sealArgs: string[];
    helper: string;
    outputDir: string;
  } | null {
    const root = SidecarEnvironment.read(
      opts.env,
      "TTSC_PACKAGE_ARTIFACT_RECORD_DIR",
    );
    if (root === undefined) return null;
    if (!path.isAbsolute(root))
      throw new Error("ttsc: publisher record directory must be absolute");
    if (SidecarEnvironment.read(opts.env, "GOCACHEPROG"))
      throw new Error(
        "ttsc: publisher recording requires an unused GOCACHEPROG",
      );
    const helper = resolveHelper(opts.env);
    if (helper === null)
      throw new Error(
        "ttsc: publisher recording requires a prebuilt cache helper",
      );
    const sourceCommit = SidecarEnvironment.read(
      opts.env,
      "TTSC_PACKAGE_ARTIFACT_SOURCE_COMMIT",
    );
    const packURLBase = SidecarEnvironment.read(
      opts.env,
      "TTSC_PACKAGE_ARTIFACT_PACK_URL_BASE",
    );
    const packName = SidecarEnvironment.read(
      opts.env,
      "TTSC_PACKAGE_ARTIFACT_PACK_NAME",
    );
    if (
      !sourceCommit ||
      !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(sourceCommit) ||
      !packURLBase ||
      !packName ||
      !/^[a-z0-9-]{1,80}$/.test(packName)
    )
      throw new Error(
        "ttsc: publisher recording needs a source commit, pack URL base and safe pack name",
      );
    const identity = crypto
      .createHash("sha256")
      .update(`${opts.pluginName}\0${opts.key}`)
      .digest("hex");
    fs.mkdirSync(root, { recursive: true });
    const directory = path.join(root, identity);
    fs.mkdirSync(directory);
    SourceNativeRetirement.registerSharedRoot(directory);
    const packages = path.join(directory, "packages.json");
    const actionGraph = path.join(directory, "actiongraph.json");
    const listed = spawnGoTool(
      opts.goBinary,
      ["list", "-deps", "-json", opts.entry],
      {
        cwd: opts.cwd,
        encoding: "utf8",
        env: opts.env,
        windowsHide: true,
      },
    );
    OwnedSynchronousProcess.checkpoint();
    if (listed.error || listed.status !== 0)
      throw new Error(
        `ttsc: publisher package receipts failed: ${listed.stderr || listed.error}`,
      );
    if (Buffer.byteLength(listed.stdout, "utf8") > 256 << 20)
      throw new Error("ttsc: publisher package receipts exceed 256 MiB");
    fs.writeFileSync(packages, listed.stdout, { encoding: "utf8", flag: "wx" });
    const program = [helper, "-root", path.join(directory, "overlay")]
      .map(quoteGoArgument)
      .join(" ");
    process.stderr.write(
      `ttsc: recording Go package actions in ${directory}\n`,
    );
    const outputDir = path.join(directory, "sealed");
    return {
      env: { ...opts.env, GOCACHEPROG: program },
      actionGraph,
      helper,
      outputDir,
      sealArgs: [
        "-seal",
        "-root",
        path.join(directory, "overlay"),
        "-go",
        opts.goBinary,
        "-actiongraph",
        actionGraph,
        "-packages",
        packages,
        "-release",
        opts.ttscVersion,
        "-source-commit",
        sourceCommit,
        "-pack-url-base",
        packURLBase,
        "-pack-name",
        packName,
        "-out",
        outputDir,
      ],
    };
  }

  /**
   * Seal a successful publisher build before its materialized Go sources
   * retire. The explicit record owner keeps the resulting immutable pack and
   * digest.
   *
   * @evidence contracts/common.md#principled-implementation Sealing runs while the exact source workspace and Go receipts still exist, so source diagnostics come from the successful build rather than a reconstructed approximation.
   * @evidence contracts/common.md#clear-and-simple-design The recorded plan owns one helper invocation and one bounded release receipt.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Publisher failure is terminal for this explicit recording attempt; it cannot publish an unsealed executable while claiming artifact evidence.
   * @evidence contracts/common.md#meaningful-documentation The comment states the materialized-source lifetime requirement and output owner.
   * @evidence contracts/portability.md#os-neutral-implementation The prebuilt native helper receives separate arguments through the owned synchronous process seam.
   * @evidence contracts/performance.md#efficient-algorithms Sealing runs only after an explicitly recorded cold build and streams package bodies through the native helper.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work One successful build supplies one source/action population; its release receipt is not reused for another build.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The native task keeps source and record roots guarded until the helper exits; output retention transfers to the explicit publisher directory.
   */
  export function seal(recording: {
    helper: string;
    sealArgs: string[];
    env: NodeJS.ProcessEnv;
    outputDir: string;
  }): void {
    OwnedSynchronousProcess.checkpoint();
    const result = launch(recording.helper, recording.sealArgs, recording.env);
    OwnedSynchronousProcess.checkpoint();
    if (result.status !== 0)
      throw new Error(
        `ttsc: publisher package sealing failed: ${result.stderr}`,
      );
    let receipt: unknown;
    try {
      receipt = JSON.parse(result.stdout);
    } catch {
      throw new Error("ttsc: publisher sealing returned an invalid receipt");
    }
    if (
      receipt === null ||
      typeof receipt !== "object" ||
      !("manifestSHA256" in receipt) ||
      typeof receipt.manifestSHA256 !== "string" ||
      !/^[0-9a-f]{64}$/.test(receipt.manifestSHA256)
    )
      throw new Error(
        "ttsc: publisher sealing returned an invalid manifest digest",
      );
    process.stderr.write(
      `ttsc: sealed publisher package actions in ${recording.outputDir}; manifest SHA-256 ${receipt.manifestSHA256}\n`,
    );
  }

  /**
   * A cold source-build backend decision and its bounded transfer receipt.
   *
   * @evidence contracts/common.md#principled-implementation The environment is returned only after the selected helper has admitted its pack population; reason distinguishes ordinary fallback from local preparation.
   * @evidence contracts/common.md#clear-and-simple-design One value carries the invocation environment, decision and optional receipt without changing a cached binary's identity.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A receipt reports preparation, not Go package hits; actual ActionID matching remains with the Go client.
   * @evidence contracts/common.md#meaningful-documentation The comment separates transfer evidence from cache-hit claims.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Paths and environment names are interpreted by the selector, not this value.
   * @evidenceExclude contracts/performance.md#efficient-algorithms This shape chooses no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The value itself coordinates no reuse.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The selector and native owner retain resources; the value owns no handle.
   */
  export interface Selection {
    env: NodeJS.ProcessEnv;
    reason: string;
    artifactRoot?: string;
    usageReceiptPath?: string;
    receipt?: {
      selectedPacks: string[];
      downloadedPacks: number;
      requests: number;
      compressedBytes: number;
      decodedBytes: number;
      downloadMillis: number;
      extractMillis: number;
      admissionMillis: number;
      totalMillis: number;
      storage: {
        baseBytes: number;
        overlayBytes: number;
        stagingBytes: number;
        pinnedBytes: number;
        baseFiles: number;
        overlayFiles: number;
        stagingFiles: number;
      };
    };
  }

  /**
   * Return the prepared helper environment, or the unchanged environment and a
   * bounded reason when the optional backend cannot be selected.
   *
   * @evidence contracts/common.md#principled-implementation Explicit opt-in, caller cache authority, release digest, matching Go tuple and fully admitted packs precede a GOCACHEPROG assignment.
   * @evidence contracts/common.md#clear-and-simple-design Every refusal returns the same environment and one reason; successful preparation returns a copied environment and receipt.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A manifest supplied by an untrusted path cannot self-authenticate, and a failed preflight never starts Go under an unprepared helper.
   * @evidence contracts/common.md#meaningful-documentation The return contract identifies the ordinary path and the success path without implying package hits.
   * @evidence contracts/portability.md#os-neutral-implementation Node path resolution and environment-name identity work across platforms; Go's own quoted command arguments carry spaces without a shell.
   * @evidence contracts/performance.md#efficient-algorithms Only an opted-in cold build reads bounded manifest bytes and runs one tuple plus one preparation process; Go performs any later per-action lookup locally.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work No positive tuple or preparation result is memoized across source-build invocations.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The task's native retirement guard covers the shared artifact root before the helper runs; the child owner settles each synchronous process and the Go helper owns its staging cleanup.
   */
  export function prepare(opts: {
    artifactRoot: string;
    cwd: string;
    entry: string;
    env: NodeJS.ProcessEnv;
    goBinary: string;
    pluginName: string;
    quiet?: boolean;
    ttscVersion: string;
  }): Selection {
    const optedIn =
      SidecarEnvironment.read(opts.env, "TTSC_PACKAGE_ARTIFACTS") === "1";
    const ordinary = (reason: string): Selection => {
      E2ETrace.capabilityResolution("plugin-package-artifacts", {
        pluginName: opts.pluginName,
        reason,
        selected: false,
      });
      if (optedIn && !opts.quiet)
        process.stderr.write(
          `ttsc: package artifacts unavailable (${reason}); using ordinary Go cache.\n`,
        );
      return { env: opts.env, reason };
    };
    if (!optedIn) return ordinary("disabled");
    if (SidecarEnvironment.read(opts.env, "GOCACHEPROG"))
      return ordinary("caller-gocacheprog");
    const helper = resolveHelper(opts.env);
    if (helper === null) return ordinary("helper-unavailable");
    const release = resolveManifest(opts.env);
    if (release === null) return ordinary("manifest-unavailable");
    let raw: Buffer;
    try {
      const info = fs.statSync(release.path);
      if (!info.isFile() || info.size === 0 || info.size > 16 << 20)
        return ordinary("manifest-size");
      raw = fs.readFileSync(release.path);
      if (raw.length !== info.size) return ordinary("manifest-changed");
    } catch {
      return ordinary("manifest-unreadable");
    }
    if (
      crypto.createHash("sha256").update(raw).digest("hex") !== release.digest
    )
      return ordinary("manifest-untrusted");
    let manifest: {
      release?: unknown;
      tuple?: unknown;
      packs?: unknown;
      actions?: unknown;
    };
    try {
      manifest = JSON.parse(raw.toString("utf8"));
    } catch {
      return ordinary("manifest-invalid");
    }
    if (manifest === null || typeof manifest !== "object")
      return ordinary("manifest-invalid");
    if (manifest.release !== opts.ttscVersion || !Array.isArray(manifest.packs))
      return ordinary("release-mismatch");
    const names = manifest.packs.map((pack: unknown) =>
      pack !== null && typeof pack === "object" && "name" in pack
        ? (pack as { name: unknown }).name
        : undefined,
    );
    if (
      names.length === 0 ||
      names.length > 64 ||
      names.some(
        (name) => typeof name !== "string" || !/^[a-z0-9-]{1,80}$/.test(name),
      )
    )
      return ordinary("pack-selection-unsupported");
    const tuple = launch(helper, ["-tuple", "-go", opts.goBinary], opts.env);
    if (tuple.status !== 0) return ordinary("go-tuple-unsupported");
    let reported: unknown;
    try {
      reported = JSON.parse(tuple.stdout);
    } catch {
      return ordinary("go-tuple-invalid");
    }
    if (!util.isDeepStrictEqual(reported, manifest.tuple))
      return ordinary("go-tuple-mismatch");
    const goVersion =
      reported !== null &&
      typeof reported === "object" &&
      "goVersion" in reported
        ? (reported as { goVersion: unknown }).goVersion
        : undefined;
    if (typeof goVersion !== "string") return ordinary("go-tuple-invalid");
    const listed = launch(
      opts.goBinary,
      [
        "list",
        "-deps",
        "-f",
        "{{.ImportPath}}|{{if .Module}}{{.Module.Path}}|{{if .Module.Replace}}{{.Module.Replace.Version}}{{else}}{{.Module.Version}}{{end}}|{{.Module.Main}}{{else}}std||false{{end}}",
        opts.entry,
      ],
      opts.env,
      opts.cwd,
      4 << 20,
    );
    if (listed.status !== 0) return ordinary("package-graph-unavailable");
    const packages = new Set<string>();
    for (const line of listed.stdout.trimEnd().split(/\r?\n/)) {
      const fields = line.split("|");
      if (
        fields.length !== 4 ||
        !fields[0] ||
        !fields[1] ||
        (fields[3] !== "true" && fields[3] !== "false")
      )
        return ordinary("package-graph-invalid");
      const role =
        fields[1] === "std"
          ? "standard"
          : fields[3] === "true"
            ? "main"
            : "dependency";
      const version = role === "standard" ? goVersion : fields[2]!;
      packages.add([fields[0], fields[1], version, role].join("\0"));
    }
    if (!Array.isArray(manifest.actions)) return ordinary("manifest-invalid");
    const selected = new Set<string>();
    for (const action of manifest.actions) {
      if (
        action === null ||
        typeof action !== "object" ||
        !("pack" in action) ||
        !("packagePath" in action) ||
        !("modulePath" in action) ||
        !("moduleVersion" in action) ||
        !("moduleRole" in action)
      )
        return ordinary("manifest-invalid");
      const record = action as {
        pack: unknown;
        packagePath: unknown;
        modulePath: unknown;
        moduleVersion: unknown;
        moduleRole: unknown;
      };
      if (
        typeof record.pack !== "string" ||
        typeof record.packagePath !== "string" ||
        typeof record.modulePath !== "string" ||
        typeof record.moduleVersion !== "string" ||
        typeof record.moduleRole !== "string"
      )
        return ordinary("manifest-invalid");
      if (
        packages.has(
          [
            record.packagePath,
            record.modulePath,
            record.moduleVersion,
            record.moduleRole,
          ].join("\0"),
        )
      )
        selected.add(record.pack);
    }
    const matching: string[] = names.filter(
      (name): name is string => typeof name === "string" && selected.has(name),
    );
    if (matching.length === 0) return ordinary("no-matching-packs");
    if (matching.length > 8) return ordinary("pack-selection-unsupported");
    SourceNativeRetirement.registerSharedRoot(opts.artifactRoot);
    OwnedSynchronousProcess.checkpoint();
    const result = launch(
      helper,
      [
        "-root",
        opts.artifactRoot,
        "-manifest",
        release.path,
        "-manifest-sha256",
        release.digest,
        "-prepare",
        "-packs",
        matching.join(","),
      ],
      opts.env,
    );
    OwnedSynchronousProcess.checkpoint();
    if (result.status !== 0) return ordinary("preparation-failed");
    let receipt: Selection["receipt"];
    try {
      receipt = JSON.parse(result.stdout) as Selection["receipt"];
      const storage = receipt?.storage;
      if (
        receipt === undefined ||
        !Array.isArray(receipt.selectedPacks) ||
        receipt.selectedPacks.length !== matching.length ||
        receipt.selectedPacks.some((name, index) => name !== matching[index]) ||
        !Number.isSafeInteger(receipt.downloadedPacks) ||
        !Number.isSafeInteger(receipt.requests) ||
        !Number.isSafeInteger(receipt.compressedBytes) ||
        !Number.isSafeInteger(receipt.decodedBytes) ||
        [
          receipt.downloadMillis,
          receipt.extractMillis,
          receipt.admissionMillis,
          receipt.totalMillis,
        ].some((value) => !Number.isSafeInteger(value) || value < 0) ||
        storage === undefined ||
        storage === null ||
        typeof storage !== "object" ||
        [
          "baseBytes",
          "overlayBytes",
          "stagingBytes",
          "pinnedBytes",
          "baseFiles",
          "overlayFiles",
          "stagingFiles",
        ].some((key) => {
          const value = storage[key as keyof typeof storage];
          return !Number.isSafeInteger(value) || value < 0;
        })
      )
        return ordinary("preparation-receipt-invalid");
    } catch {
      return ordinary("preparation-receipt-invalid");
    }
    try {
      SourceBuildCacheLayout.replaceCacheMetadataFile(
        path.join(opts.artifactRoot, ".last-used"),
        `${Date.now()}\n`,
      );
    } catch {
      // Failed idle metadata cannot invalidate an admitted pack.
    }
    const receiptName = crypto.randomBytes(16).toString("hex");
    let program: string;
    try {
      program = [
        helper,
        "-root",
        opts.artifactRoot,
        "-manifest",
        release.path,
        "-manifest-sha256",
        release.digest,
        "-receipt-name",
        receiptName,
      ]
        .map(quoteGoArgument)
        .join(" ");
    } catch {
      return ordinary("helper-path-unquotable");
    }
    E2ETrace.capabilityResolution("plugin-package-artifacts", {
      pluginName: opts.pluginName,
      selected: true,
      selectedPacksJson: JSON.stringify(receipt.selectedPacks),
      downloadedPacks: receipt.downloadedPacks,
      requests: receipt.requests,
      compressedBytes: receipt.compressedBytes,
      decodedBytes: receipt.decodedBytes,
      downloadMillis: receipt.downloadMillis,
      extractMillis: receipt.extractMillis,
      admissionMillis: receipt.admissionMillis,
      totalMillis: receipt.totalMillis,
      baseBytes: receipt.storage.baseBytes,
      overlayBytes: receipt.storage.overlayBytes,
      stagingBytes: receipt.storage.stagingBytes,
      pinnedBytes: receipt.storage.pinnedBytes,
    });
    if (!opts.quiet)
      process.stderr.write(
        `ttsc: package artifacts prepared ${receipt.selectedPacks.length} pack(s), ` +
          `${receipt.downloadedPacks} downloaded, ${receipt.compressedBytes} compressed bytes.\n`,
      );
    return {
      env: { ...opts.env, GOCACHEPROG: program },
      reason: "selected",
      artifactRoot: opts.artifactRoot,
      usageReceiptPath: path.join(opts.artifactRoot, "receipts", receiptName),
      receipt,
    };
  }

  /**
   * Report the completed Go client's bounded local action counters. A missing
   * or malformed optional receipt never changes build success.
   *
   * @evidence contracts/common.md#principled-implementation The Go helper alone counts exact get outcomes and publishes its receipt after close; preparation counts are not substituted for package hits.
   * @evidence contracts/common.md#clear-and-simple-design A single post-build read emits bounded hit/miss diagnostics and removes the one-use receipt.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A missing receipt is reported as unavailable, not as zero misses or complete publisher coverage.
   * @evidence contracts/common.md#meaningful-documentation The comment separates optional observation failure from the completed build result.
   * @evidence contracts/portability.md#os-neutral-implementation Native path and file APIs read the helper's one-use receipt under its selected artifact root.
   * @evidence contracts/performance.md#efficient-algorithms A cold artifact-backed build reads at most one MiB of bounded action IDs once; exact executable hits never enter this path.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each helper process writes a distinct receipt and no prior counters authorize a new build.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Finally removes the owned single receipt after reading or refusal, while the helper and native scope own body pins.
   */
  export function reportUsage(
    selection: Selection,
    pluginName: string,
    quiet: boolean,
  ): void {
    if (selection.usageReceiptPath === undefined) return;
    const location = selection.usageReceiptPath;
    try {
      const info = fs.statSync(location);
      if (!info.isFile() || info.size > 1 << 20)
        throw new Error("invalid receipt size");
      const value: unknown = JSON.parse(fs.readFileSync(location, "utf8"));
      if (value === null || typeof value !== "object")
        throw new Error("invalid receipt value");
      const counts = value as Record<string, unknown>;
      for (const name of [
        "gets",
        "baseHits",
        "overlayHits",
        "misses",
        "puts",
        "putBytes",
      ])
        if (!Number.isSafeInteger(counts[name]) || (counts[name] as number) < 0)
          throw new Error("invalid receipt count");
      if (
        counts.gets !==
        (counts.baseHits as number) +
          (counts.overlayHits as number) +
          (counts.misses as number)
      )
        throw new Error("inconsistent receipt count");
      const actionFields = [
        "baseActionIDs",
        "overlayActionIDs",
        "missActionIDs",
        "putActionIDs",
      ] as const;
      for (const name of actionFields)
        if (
          !Array.isArray(counts[name]) ||
          (counts[name] as unknown[]).length > 4096 ||
          !(counts[name] as unknown[]).every(
            (id) => typeof id === "string" && /^[0-9a-f]{64}$/.test(id),
          )
        )
          throw new Error("invalid action IDs in receipt");
      if (
        typeof counts.truncated !== "boolean" ||
        actionFields.reduce(
          (total, name) => total + (counts[name] as unknown[]).length,
          0,
        ) > 4096
      )
        throw new Error("invalid receipt action limit");
      const storage = counts.storage;
      if (storage !== undefined && storage !== null) {
        if (typeof storage !== "object")
          throw new Error("invalid storage accounting");
        for (const name of [
          "baseBytes",
          "overlayBytes",
          "stagingBytes",
          "pinnedBytes",
          "baseFiles",
          "overlayFiles",
          "stagingFiles",
        ]) {
          const value = (storage as Record<string, unknown>)[name];
          if (!Number.isSafeInteger(value) || (value as number) < 0)
            throw new Error("invalid storage accounting");
        }
      }
      E2ETrace.capabilityResolution("plugin-package-artifact-usage", {
        pluginName,
        gets: counts.gets as number,
        baseHits: counts.baseHits as number,
        overlayHits: counts.overlayHits as number,
        misses: counts.misses as number,
        puts: counts.puts as number,
        putBytes: counts.putBytes as number,
        baseActionIDsJson: JSON.stringify(counts.baseActionIDs),
        missActionIDsJson: JSON.stringify(counts.missActionIDs),
        putActionIDsJson: JSON.stringify(counts.putActionIDs),
        truncated: counts.truncated,
        baseBytes:
          storage !== null && typeof storage === "object"
            ? (storage as Record<string, number>).baseBytes
            : undefined,
        overlayBytes:
          storage !== null && typeof storage === "object"
            ? (storage as Record<string, number>).overlayBytes
            : undefined,
        stagingBytes:
          storage !== null && typeof storage === "object"
            ? (storage as Record<string, number>).stagingBytes
            : undefined,
        pinnedBytes:
          storage !== null && typeof storage === "object"
            ? (storage as Record<string, number>).pinnedBytes
            : undefined,
      });
      if (!quiet)
        process.stderr.write(
          `ttsc: package artifacts: ${counts.baseHits} publisher hits, ` +
            `${counts.overlayHits} local hits, ${counts.misses} misses, ${counts.puts} puts.\n`,
        );
    } catch {
      if (!quiet)
        process.stderr.write(
          "ttsc: package artifact usage receipt unavailable.\n",
        );
    } finally {
      try {
        fs.rmSync(location, { force: true });
      } catch {}
    }
  }
}

function resolveHelper(env: NodeJS.ProcessEnv): string | null {
  const explicit = SidecarEnvironment.read(env, "TTSC_PACKAGE_ARTIFACT_HELPER");
  if (explicit !== undefined) {
    return path.isAbsolute(explicit) && ordinaryFile(explicit)
      ? explicit
      : null;
  }
  try {
    const location = require.resolve(
      `@ttsc/${process.platform}-${process.arch}/package.json`,
    );
    const candidate = path.join(
      path.dirname(location),
      "bin",
      process.platform === "win32" ? "ttsc-cache.exe" : "ttsc-cache",
    );
    return ordinaryFile(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function resolveManifest(
  env: NodeJS.ProcessEnv,
): { path: string; digest: string } | null {
  const explicit = SidecarEnvironment.read(
    env,
    "TTSC_PACKAGE_ARTIFACT_MANIFEST",
  );
  const expected = SidecarEnvironment.read(env, "TTSC_PACKAGE_ARTIFACT_SHA256");
  if (explicit !== undefined || expected !== undefined) {
    return explicit &&
      path.isAbsolute(explicit) &&
      expected &&
      /^[0-9a-f]{64}$/.test(expected)
      ? { path: explicit, digest: expected }
      : null;
  }
  try {
    const location = require.resolve(
      `@ttsc/${process.platform}-${process.arch}/package.json`,
    );
    const value: unknown = JSON.parse(fs.readFileSync(location, "utf8"));
    if (
      value === null ||
      typeof value !== "object" ||
      !("artifactManifestSHA256" in value)
    )
      return null;
    const digest = (value as { artifactManifestSHA256: unknown })
      .artifactManifestSHA256;
    return typeof digest === "string" && /^[0-9a-f]{64}$/.test(digest)
      ? {
          path: path.join(
            path.dirname(location),
            "bin",
            "artifacts",
            "manifest.json",
          ),
          digest,
        }
      : null;
  } catch {
    return null;
  }
}

function ordinaryFile(location: string): boolean {
  try {
    const info = fs.lstatSync(location);
    return info.isFile() && !info.isSymbolicLink();
  } catch {
    return false;
  }
}

function launch(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  cwd?: string,
  maxBuffer = 64 << 10,
): { status: number | null; stdout: string; stderr: string } {
  const options = {
    encoding: "utf8" as const,
    env,
    cwd,
    maxBuffer,
    windowsHide: true,
  };
  const result =
    OwnedSynchronousProcess.launch<string>(command, args, options) ??
    spawnSync(command, args, options);
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function quoteGoArgument(value: string): string {
  if (!/[\s'"]/.test(value)) return value;
  if (!value.includes("'")) return `'${value}'`;
  if (!value.includes('"')) return `"${value}"`;
  throw new Error("Go cache program argument contains both quote forms");
}
