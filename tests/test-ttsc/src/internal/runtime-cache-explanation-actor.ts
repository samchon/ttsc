import { RuntimeBuildExplanation } from "../../../../packages/ttsc/src/compiler/internal/build/RuntimeBuildExplanation";

// The source unit owns the pipe lifetime and literal result/diagnostic oracle.
process.once("message", () => {
  RuntimeBuildExplanation.report({ outcome: "reused", project: "source-한글" });
  setImmediate(() => {
    process.stdout.write("product-result\n");
    process.disconnect!();
  });
});
process.send!("ready");
