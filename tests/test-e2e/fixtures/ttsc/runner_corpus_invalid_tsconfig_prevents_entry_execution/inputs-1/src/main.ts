
      declare const process: { env: { TTSX_MARKER?: string } };
      declare function require(name: string): {
        writeFileSync(file: string, text: string): void;
      };

      const fs = require("node:fs");
      const marker = process.env.TTSX_MARKER;
      if (!marker) throw new Error("missing marker path");
      fs.writeFileSync(marker, "executed");
      console.log("invalid-config-should-not-run");
    