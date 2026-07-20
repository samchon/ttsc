/**
 * Records a real walkthrough of the published website.
 *
 * This one is a capture, not a drawing: Chromium loads ttsc.dev over the
 * network and the recording is whatever the site actually served. Nothing here
 * is composed, so a stale page or a broken link shows up in the clip instead of
 * being papered over — which is the point of capturing rather than
 * illustrating.
 *
 * Run `node site.mjs [origin]`.
 *
 * Playwright records WebM, so the result is transcoded to H.264 for the same
 * reason the rule clips are: GitHub accepts MP4 and MOV attachments.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FFMPEG = path.join(HERE, "ffmpeg.exe");
const OUT = path.join(HERE, "..", "clips");
const RAW = path.join(HERE, "..", ".site-raw");
const ORIGIN = process.argv[2] ?? "https://ttsc.dev";
const SIZE = { height: 900, width: 1600 };

/** The tour. Each stop is a page worth seeing and how far to read down it. */
const STOPS = [
  { hold: 1800, path: "/", scroll: 2400 },
  { hold: 1600, path: "/docs/lint", scroll: 1800 },
  { hold: 1600, path: "/docs/lint/editor", scroll: 2200 },
  { hold: 2000, path: "/docs/lint/rules", scroll: 2600 },
];

fs.rmSync(RAW, { force: true, recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  recordVideo: { dir: RAW, size: SIZE },
  viewport: SIZE,
});
const page = await context.newPage();
let video;
const skipped = [];
try {
  video = page.video();
  for (const stop of STOPS) {
    const response = await page.goto(ORIGIN + stop.path, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    // A stop the site does not serve yet is skipped and reported, never faked.
    // Pages land with the pull request that documents them, so a tour recorded
    // before that merge is legitimately shorter — but silence about it would
    // read as full coverage.
    if (!response || !response.ok()) {
      skipped.push(`${stop.path} answered ${response?.status() ?? "nothing"}`);
      continue;
    }
    await page.waitForTimeout(stop.hold);
    await smoothScroll(page, stop.scroll);
    await page.waitForTimeout(900);
  }
} finally {
  await context.close();
  await browser.close();
}
if (skipped.length === STOPS.length) {
  throw new Error(`every stop failed: ${skipped.join("; ")}`);
}

const source = await video.path();
const target = path.join(OUT, "site-tour.mp4");
await transcode(source, target);
fs.rmSync(RAW, { force: true, recursive: true });
process.stdout.write(`${fs.statSync(target).size} ${target}\n`);
for (const gap of skipped) process.stdout.write(`skipped ${gap}\n`);

/** Scroll the way a reader does, so the recording is legible at every frame. */
async function smoothScroll(page, distance) {
  await page.evaluate(
    (total) =>
      new Promise((resolve) => {
        const step = 14;
        let moved = 0;
        const timer = setInterval(() => {
          window.scrollBy(0, step);
          moved += step;
          if (
            moved >= total ||
            window.scrollY + window.innerHeight >= document.body.scrollHeight
          ) {
            clearInterval(timer);
            resolve();
          }
        }, 16);
      }),
    distance,
  );
}

function transcode(source, target) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(
      FFMPEG,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        source,
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "22",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        target,
      ],
      { stdio: ["ignore", "inherit", "inherit"] },
    );
    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)),
    );
  });
}
