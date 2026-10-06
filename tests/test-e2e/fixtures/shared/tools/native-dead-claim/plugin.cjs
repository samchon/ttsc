const path = require("node:path");
module.exports = (context) => ({ name: context.plugin.name, source: path.join(__dirname, "native-producer") });
