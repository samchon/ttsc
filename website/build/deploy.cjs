// Build then publish ./out to the gh-pages branch.
//
// Pre-req: run `pnpm build` first (or use the package.json deploy script
// which composes them).

const { execSync } = require("child_process");
const ghpages = require("gh-pages");
const path = require("path");

const root = path.resolve(__dirname, "..");

console.log("[deploy] building static export…");
execSync("pnpm build", { cwd: root, stdio: "inherit" });

console.log("[deploy] publishing ./out to gh-pages…");
ghpages.publish(
  path.join(root, "out"),
  {
    branch: "gh-pages",
    dotfiles: true,
    message: "Update ttsc website",
  },
  (err) => {
    if (err) {
      console.error("[deploy] FAILED:", err);
      process.exit(1);
    }
    console.log("[deploy] done.");
  },
);
