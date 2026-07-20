/**
 * Builds one contact sheet from the last frame of every clip.
 *
 * Forty-two clips is too many to watch one at a time, and the failures that
 * matter here are all visible in a still: text that overflows its pane, a popup
 * that lands off the card, a snippet that shrank too far to read. One tiled
 * image makes a whole batch reviewable at a glance.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FFMPEG = path.join(HERE, "ffmpeg.exe");
const CLIPS = path.join(HERE, "..", "clips");
const FRAMES = path.join(HERE, "..", "frames", "sheet");
const AT = process.argv[2] ?? "5.5";

fs.rmSync(FRAMES, { force: true, recursive: true });
fs.mkdirSync(FRAMES, { recursive: true });

const clips = fs
  .readdirSync(CLIPS)
  .filter((name) => name.endsWith(".mp4"))
  .sort();

let index = 0;
for (const name of clips) {
  const target = path.join(FRAMES, `${String(index++).padStart(3, "0")}.png`);
  await run([
    "-y",
    "-ss",
    AT,
    "-i",
    path.join(CLIPS, name),
    "-frames:v",
    "1",
    "-vf",
    "scale=360:360",
    target,
  ]);
}

const columns = 6;
const sheet = path.join(HERE, "..", "frames", "sheet.png");
await run([
  "-y",
  "-i",
  path.join(FRAMES, "%03d.png"),
  "-filter_complex",
  `tile=${columns}x${Math.ceil(index / columns)}:margin=8:padding=8`,
  sheet,
]);
process.stdout.write(`${index} clips tiled into ${sheet}\n`);

function run(args) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(
      FFMPEG,
      ["-hide_banner", "-loglevel", "error", ...args],
      {
        stdio: ["ignore", "inherit", "inherit"],
      },
    );
    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)),
    );
  });
}
