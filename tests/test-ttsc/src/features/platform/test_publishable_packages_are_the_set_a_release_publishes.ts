import { createRequire } from "node:module";

import { assert, fs, path, workspaceRoot } from "../../internal/toolchain";

const { isPlatformPackage, listPublishablePackages } = createRequire(
  import.meta.url,
)(path.join(workspaceRoot, "scripts", "publishable-packages.cjs")) as {
  isPlatformPackage(manifest: Record<string, unknown>): boolean;
  listPublishablePackages(root: string): {
    entry: string;
    error?: Error;
    manifest?: Record<string, unknown>;
  }[];
};

/**
 * Verifies the release's package set is read from the manifests, so a new
 * public or platform package joins the preflight and the tarball rehearsal
 * without a list naming it.
 *
 * The full tarball rehearsal packed a hand-written package list and platform
 * directories matching a fixed OS/architecture pattern, while `pnpm -r publish`
 * publishes every manifest not marked private. A new public package, or a
 * platform package for a new platform, could be published without ever being
 * packed by the rehearsal (samchon/ttsc#1518). Both now read one rule.
 *
 * 1. Lay out a workspace with a public package, a private one, a platform
 *    package for a platform no earlier pattern named, a directory without a
 *    manifest, and a malformed manifest.
 * 2. List the publishable packages.
 * 3. Assert the public and platform packages are listed, the private one and the
 *    manifest-less directory are not, and the malformed one is reported.
 */
export const test_publishable_packages_are_the_set_a_release_publishes = () => {
  const root = fs.mkdtempSync(path.join(process.cwd(), ".tmp-publishable-"));
  try {
    const write = (entry: string, manifest: unknown): void => {
      fs.mkdirSync(path.join(root, "packages", entry), { recursive: true });
      fs.writeFileSync(
        path.join(root, "packages", entry, "package.json"),
        typeof manifest === "string" ? manifest : JSON.stringify(manifest),
      );
    };
    write("fresh", { name: "@ttsc/fresh", version: "1.0.0" });
    write("internal", { name: "@ttsc/internal", private: true });
    write("ttsc-freebsd-riscv64", {
      cpu: ["riscv64"],
      name: "@ttsc/freebsd-riscv64",
      os: ["freebsd"],
      version: "1.0.0",
    });
    write("broken", "{ not json");
    fs.mkdirSync(path.join(root, "packages", "notes"));

    const listed = listPublishablePackages(root);
    assert.deepEqual(
      listed.map(({ entry, error }) => `${entry}${error ? ":invalid" : ""}`),
      ["broken:invalid", "fresh", "ttsc-freebsd-riscv64"],
    );
    const platform = listed.find(
      ({ entry }) => entry === "ttsc-freebsd-riscv64",
    )!;
    assert.equal(isPlatformPackage(platform.manifest!), true);
    const fresh = listed.find(({ entry }) => entry === "fresh")!;
    assert.equal(isPlatformPackage(fresh.manifest!), false);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
};
