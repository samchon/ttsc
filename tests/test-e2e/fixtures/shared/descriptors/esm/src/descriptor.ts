import fs from "node:fs";
import path from "node:path";

export default (context: {
  dirname: string;
  filename: string;
  plugin: { name: string; esmContextProbe: string };
}) => {
  fs.writeFileSync(context.plugin.esmContextProbe, JSON.stringify({
    filename: context.filename,
    dirname: context.dirname,
    ambientDirname: typeof __dirname,
    ambientFilename: typeof __filename,
  }));
  return {
    name: context.plugin.name,
    source: path.resolve(context.dirname, "../../..", "native-producer"),
    hostInputHashes: {},
  };
};
