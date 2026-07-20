/**
 * Audits the rendered batch and records what was actually produced.
 *
 * Probing every file rather than trusting the renderer's own success is the
 * point: a clip can be written, be the right size, and still be a truncated
 * stream that no player will open. Dimensions, duration, byte count, and digest
 * together say the file is playable and say which render produced it.
 */
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { specs } from "./build.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FFPROBE = path.join(HERE, "ffprobe.exe");
const CLIPS = path.join(HERE, "..", "clips");
const OUTPUT = path.join(HERE, "..", "manifest.json");
const EXPECTED = { fps: 30, height: 1080, seconds: 6, width: 1080 };

const byName = new Map(specs().map((spec) => [spec.slug, spec]));
const entries = [];
const problems = [];

for (const file of fs
  .readdirSync(CLIPS)
  .filter((n) => n.endsWith(".mp4"))
  .sort()) {
  const slug = path.basename(file, ".mp4");
  const full = path.join(CLIPS, file);
  const probe = JSON.parse(
    await run([
      "-v",
      "error",
      "-show_entries",
      "stream=width,height,codec_name,nb_frames:format=duration",
      "-of",
      "json",
      full,
    ]),
  );
  const stream = probe.streams?.[0] ?? {};
  const bytes = fs.statSync(full).size;
  const spec = byName.get(slug);
  const entry = {
    bytes,
    codec: stream.codec_name,
    duration: Number(probe.format?.duration ?? 0),
    height: stream.height,
    rule: spec?.rule ?? null,
    sha256: crypto
      .createHash("sha256")
      .update(fs.readFileSync(full))
      .digest("hex"),
    shows: spec?.completion ? "completion" : "diagnostic",
    slug,
    source: spec?.messageSource ?? "capture",
    width: stream.width,
  };
  entries.push(entry);

  // A site capture is 16:9 and as long as the tour takes; only the rule clips
  // are held to the square format the batch renders.
  if (!spec) continue;
  if (entry.width !== EXPECTED.width || entry.height !== EXPECTED.height) {
    problems.push(`${slug}: ${entry.width}x${entry.height}`);
  }
  if (Math.abs(entry.duration - EXPECTED.seconds) > 0.2) {
    problems.push(`${slug}: ${entry.duration.toFixed(2)}s`);
  }
  if (entry.codec !== "h264") problems.push(`${slug}: codec ${entry.codec}`);
}

const missing = [...byName.keys()].filter(
  (slug) => !entries.some((entry) => entry.slug === slug),
);
for (const slug of missing) problems.push(`${slug}: not rendered`);

fs.writeFileSync(OUTPUT, JSON.stringify(entries, null, 2));
process.stdout.write(
  `${entries.length} files, ${(entries.reduce((sum, e) => sum + e.bytes, 0) / 1048576).toFixed(1)} MiB\n`,
);
for (const problem of problems) process.stdout.write(`PROBLEM ${problem}\n`);
process.stdout.write(
  problems.length === 0 ? "audit clean\n" : `${problems.length} problems\n`,
);

function run(args) {
  return new Promise((resolve, reject) => {
    const probe = spawn(FFPROBE, args, {
      stdio: ["ignore", "pipe", "inherit"],
    });
    let out = "";
    probe.stdout.on("data", (chunk) => (out += chunk));
    probe.on("error", reject);
    probe.on("close", (code) =>
      code === 0 ? resolve(out) : reject(new Error(`ffprobe exited ${code}`)),
    );
  });
}
