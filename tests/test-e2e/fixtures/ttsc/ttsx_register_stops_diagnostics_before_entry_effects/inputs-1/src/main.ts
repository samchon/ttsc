import fs from "node:fs";
const marker = process.env.TTSX_REGISTER_MARKER!;
const invalid: string = 123;
fs.writeFileSync(marker, invalid);
