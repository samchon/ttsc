const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const esbuild = require("esbuild");

const root = path.resolve(__dirname, "..");
const pkgPath = path.join(root, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

async function bundle() {
  await esbuild.build({
    entryPoints: [path.join(root, "src/extension.ts")],
    outfile: path.join(root, "lib/extension.js"),
    bundle: true,
    platform: "node",
    target: "node18",
    format: "cjs",
    external: ["vscode"],
    sourcemap: false,
    logLevel: "info",
  });
}

function packVsix() {
  const distDir = path.join(root, "dist");
  fs.mkdirSync(distDir, { recursive: true });
  const out = path.join(distDir, `ttsc-vscode-${pkg.version}.vsix`);
  const vsce = require.resolve("@vscode/vsce/vsce");
  removeLocalPackArtifacts();

  // vsce rejects scoped names (`@scope/name` produces "Invalid extension name").
  // Swap to an unscoped manifest just for the duration of `vsce package`, then
  // restore the npm-side manifest. Also drop `bin` (vsce would package its
  // shim into the .vsix) and other npm-only fields the marketplace ignores.
  const orig = fs.readFileSync(pkgPath, "utf8");
  const patched = {
    ...pkg,
    name: "ttsc",
  };
  delete patched.bin;
  delete patched.files;
  delete patched.publishConfig;
  fs.writeFileSync(pkgPath, JSON.stringify(patched, null, 2) + "\n");

  // vsce expects a LICENSE alongside package.json; pnpm auto-injects the
  // workspace LICENSE on `pnpm pack`, but vsce reads from disk directly.
  const licenseSrc = path.resolve(root, "../../LICENSE");
  const licenseDst = path.join(root, "LICENSE");
  let copiedLicense = false;
  if (fs.existsSync(licenseSrc) && !fs.existsSync(licenseDst)) {
    fs.copyFileSync(licenseSrc, licenseDst);
    copiedLicense = true;
  }

  let status;
  try {
    const r = cp.spawnSync(
      process.execPath,
      [vsce, "package", "--no-dependencies", "--no-yarn", "--out", out],
      { cwd: root, stdio: "inherit", windowsHide: true },
    );
    if (r.error) throw r.error;
    status = r.status ?? 1;
  } finally {
    fs.writeFileSync(pkgPath, orig);
    if (copiedLicense) fs.unlinkSync(licenseDst);
  }
  if (status !== 0) process.exit(status);
  console.log(
    `built ${path.relative(root, out)} (${(fs.statSync(out).size / 1024).toFixed(1)} KiB)`,
  );
}

function removeLocalPackArtifacts() {
  for (const name of fs.readdirSync(root)) {
    if (/^ttsc-vscode-.*\.tgz$/.test(name)) {
      fs.rmSync(path.join(root, name), { force: true });
    }
  }
}

(async () => {
  await bundle();
  packVsix();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
