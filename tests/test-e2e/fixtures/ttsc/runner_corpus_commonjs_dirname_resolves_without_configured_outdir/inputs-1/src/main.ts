
      const fs = require("node:fs");
      console.log(fs.readFileSync(__dirname + "/../template/data.txt", "utf8"));
      console.log(__dirname);
    