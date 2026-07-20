/**
 * Deterministic clip renderer.
 *
 * Chromium draws the scene, this script seeks it one frame at a time, and
 * ffmpeg encodes the frame sequence. Seeking rather than recording wall-clock
 * playback is what makes a re-render reproducible: no dropped frame, no timing
 * jitter, no dependence on how busy the machine was.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

import { scene } from "./scene.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FFMPEG = path.join(HERE, "ffmpeg.exe");
const FPS = 30;
const SECONDS = 6;
const SIZE = 1080;
/**
 * One clip is a serial chain of 180 screenshot round trips, so the throughput
 * that matters is how many clips are in flight, not how fast one is. Each
 * worker owns a page and an encoder; the cap leaves the machine responsive.
 */
const WORKERS = Math.max(1, Math.min(4, Math.floor(os.cpus().length / 3)));

export async function render(specs, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const queue = [...specs];
  const written = [];
  try {
    await Promise.all(
      Array.from({ length: Math.min(WORKERS, queue.length) }, async () => {
        while (queue.length > 0) {
          const spec = queue.shift();
          // A fresh page per clip, deliberately. setContent replaces the
          // document inside the existing JavaScript realm, so a second scene's
          // `const CODE` throws as a redeclaration and the page keeps drawing
          // the previous clip's code under the new clip's popup.
          const page = await browser.newPage({
            viewport: { width: SIZE, height: SIZE },
          });
          try {
            const target = path.join(outDir, `${spec.slug}.mp4`);
            await page.setContent(scene(spec), { waitUntil: "load" });
            await encode(page, target);
            written.push({ bytes: fs.statSync(target).size, slug: spec.slug });
            process.stdout.write(`rendered ${spec.slug}\n`);
          } finally {
            await page.close();
          }
        }
      }),
    );
  } finally {
    await browser.close();
  }
  return written.sort((left, right) => left.slug.localeCompare(right.slug));
}

async function encode(page, target) {
  const ffmpeg = spawn(
    FFMPEG,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "image2pipe",
      "-framerate",
      String(FPS),
      "-i",
      "-",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      target,
    ],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const done = new Promise((resolve, reject) => {
    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)),
    );
  });

  for (let frame = 0; frame < FPS * SECONDS; frame++) {
    await page.evaluate((at) => window.seek(at), frame / FPS);
    const png = await page.screenshot({ type: "png" });
    if (!ffmpeg.stdin.write(png)) {
      await new Promise((resolve) => ffmpeg.stdin.once("drain", resolve));
    }
  }
  ffmpeg.stdin.end();
  await done;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { specs } = await import("./build.mjs");
  const all = specs();
  const only = process.argv.slice(2);
  const chosen = only.length
    ? all.filter((spec) => only.includes(spec.slug))
    : all;
  const written = await render(chosen, path.join(HERE, "..", "clips"));
  const bytes = written.reduce((sum, item) => sum + item.bytes, 0);
  process.stdout.write(
    `${written.length} clips, ${(bytes / 1048576).toFixed(1)} MiB\n`,
  );
}
