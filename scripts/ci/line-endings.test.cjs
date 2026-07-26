const assert = require("node:assert/strict");
const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..", "..");

function git(cwd, args, options = {}) {
  const result = cp.spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    ...options,
  });
  assert.equal(
    result.status,
    0,
    `git ${args.join(" ")} failed:\n${result.stderr ?? ""}`,
  );
  return result.stdout;
}

function assertCheckout(checkout, binary) {
  for (const file of ["sample.ts", "sample.md"])
    assert.equal(
      fs.readFileSync(path.join(checkout, file)).includes(Buffer.from("\r\n")),
      false,
      `${file} was checked out with CRLF despite the repository eol contract`,
    );
  assert.deepEqual(
    fs.readFileSync(path.join(checkout, "sample.bin")),
    binary,
    "text=auto rewrote a binary fixture",
  );
  assert.equal(
    git(checkout, ["status", "--short"]),
    "",
    "the line-ending policy dirtied a clean checkout",
  );
}

test("Prettier-owned files check out as LF under either autocrlf setting", () => {
  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-line-endings-"),
  );
  try {
    const origin = path.join(temporary, "origin");
    fs.mkdirSync(origin);
    git(origin, ["init", "--quiet"]);
    git(origin, ["config", "user.email", "ci@ttsc.dev"]);
    git(origin, ["config", "user.name", "ttsc CI"]);
    fs.copyFileSync(
      path.join(root, ".gitattributes"),
      path.join(origin, ".gitattributes"),
    );
    fs.writeFileSync(
      path.join(origin, "sample.ts"),
      "export const answer = 42;\n",
    );
    fs.writeFileSync(path.join(origin, "sample.md"), "# fixture\n");
    const binary = Buffer.from([0, 13, 10, 255, 10]);
    fs.writeFileSync(path.join(origin, "sample.bin"), binary);
    git(origin, ["add", "."]);
    git(origin, ["commit", "--quiet", "-m", "fixture"]);

    for (const autocrlf of ["true", "false"]) {
      const checkout = path.join(temporary, autocrlf);
      git(temporary, [
        "-c",
        `core.autocrlf=${autocrlf}`,
        "clone",
        "--quiet",
        "--no-local",
        origin,
        checkout,
      ]);
      assertCheckout(checkout, binary);
      assert.match(
        git(checkout, ["check-attr", "text", "eol", "--", "sample.ts"]),
        /text: auto[\s\S]*eol: lf/,
      );
    }
  } finally {
    fs.rmSync(temporary, { force: true, recursive: true });
  }
});
