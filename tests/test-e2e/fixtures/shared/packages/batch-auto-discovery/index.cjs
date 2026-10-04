const fs = require("node:fs");
const path = require("node:path");
module.exports = (context) => ({
  name: context.plugin.name,
  source: fs.realpathSync.native(path.resolve(context.dirname, "../../native-producer")),
});
