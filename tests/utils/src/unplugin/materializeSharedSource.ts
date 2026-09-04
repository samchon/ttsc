import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** Publish one generated fixture under an immutable content-addressed path. */
export function materializeSharedSource(
  parent: string,
  label: string,
  write: (directory: string) => void,
): string {
  if (!path.isAbsolute(parent)) {
    throw new Error(`Shared fixture parent must be absolute: ${parent}`);
  }
  if (!/^[a-z0-9-]+$/.test(label)) {
    throw new Error(`Invalid shared fixture label: ${label}`);
  }
  fs.mkdirSync(parent, { recursive: true });
  const staging = fs.mkdtempSync(path.join(parent, `.${label}-`));
  try {
    write(staging);
    const digest = directoryDigest(staging);
    const destination = path.join(parent, `${label}-${digest}`);
    try {
      fs.renameSync(staging, destination);
    } catch (error) {
      if (
        !fs.existsSync(destination) ||
        directoryDigest(destination) !== digest
      ) {
        throw error;
      }
      fs.rmSync(staging, { force: true, recursive: true });
    }
    return destination;
  } catch (error) {
    fs.rmSync(staging, { force: true, recursive: true });
    throw error;
  }
}

function directoryDigest(directory: string): string {
  const hash = crypto.createHash("sha256");
  const frame = (kind: string, value: string | Buffer): void => {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
    hash.update(kind);
    hash.update("\0");
    hash.update(String(bytes.byteLength));
    hash.update("\0");
    hash.update(bytes);
  };
  const visit = (current: string, relative: string): void => {
    for (const entry of fs
      .readdirSync(current, { withFileTypes: true })
      .sort((left, right) =>
        left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
      )) {
      const childRelative = path.posix.join(relative, entry.name);
      const child = path.join(current, entry.name);
      if (entry.isDirectory()) {
        frame("directory", childRelative);
        visit(child, childRelative);
      } else if (entry.isFile()) {
        frame("file", childRelative);
        frame("content", fs.readFileSync(child));
      } else {
        throw new Error(`Unsupported shared fixture entry: ${child}`);
      }
    }
  };
  visit(directory, "");
  return hash.digest("hex");
}
