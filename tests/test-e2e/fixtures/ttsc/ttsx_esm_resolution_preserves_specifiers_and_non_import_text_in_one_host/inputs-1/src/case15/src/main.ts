import fs from "node:fs";
import { ROOT, sourceOnly, sourceUrl } from "./global";
console.log(JSON.stringify({ asset: fs.readFileSync(ROOT + "/template/data.txt", "utf8"), source: fs.readFileSync(sourceOnly, "utf8"), sourceUrl }));
