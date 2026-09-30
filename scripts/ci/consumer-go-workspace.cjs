const fs = require("node:fs");
const path = require("node:path");

const { writeGoWork } = require("../go-work.cjs");

/** Bind a consumer's Go tests to the driver and shims being reviewed. */
function writeConsumerGoWorkspace(location, consumers, producerRoot) {
  if (consumers.length === 0) throw new Error("expected consumer module paths");
  const driver = path.join(producerRoot, "packages", "ttsc");
  const modules = [driver];
  const visit = (directory) => {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    if (entries.some((entry) => entry.name === "go.mod")) modules.push(directory);
    for (const entry of entries)
      if (entry.isDirectory()) visit(path.join(directory, entry.name));
  };
  visit(path.join(driver, "shim"));
  const replacements = modules.map((directory) => {
    const declaration = /^module\s+(\S+)/m.exec(
      fs.readFileSync(path.join(directory, "go.mod"), "utf8"),
    );
    if (declaration === null) throw new Error(`missing module in ${directory}`);
    return `\t${declaration[1]} => ${JSON.stringify(directory)}`;
  });
  const use = consumers.map((directory) => {
    const absolute = path.resolve(directory);
    fs.readFileSync(path.join(absolute, "go.mod"), "utf8");
    return `\t${JSON.stringify(absolute)}`;
  });
  // A workspace main module cannot also have an unversioned replacement.
  // Consumer modules belong in use; candidate driver/shims belong in replace.
  writeGoWork(
    path.resolve(location),
    ["use (", ...use, ")", "replace (", ...replacements, ")", ""].join("\n"),
    process.env,
  );
}

if (require.main === module) {
  const [location, ...consumers] = process.argv.slice(2);
  if (!location) throw new Error("expected workspace result path");
  writeConsumerGoWorkspace(location, consumers, path.resolve(__dirname, "../.."));
}

module.exports = { writeConsumerGoWorkspace };
