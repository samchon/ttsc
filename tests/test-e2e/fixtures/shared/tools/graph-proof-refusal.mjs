import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Exercise the existing public filesystem seam in the resident adapter caller.
// The real compiler reads unchanged package bytes; only its first subsequent
// external graph proof sees the adversarial bytes. node_modules is outside the
// project walk, so the retry would adopt a wrongly published first capture.
export async function observeGraphProofRefusal(root, input) {
  const api = await import(input.api);
  const declaration = fs.realpathSync.native(path.join(root, "node_modules/batch-record-dependency/index.d.ts"));
  const original = fs.readFileSync(declaration);
  const before = fs.existsSync(input.programRunLog) ? fs.statSync(input.programRunLog).size : 0;
  assert.equal(fs.existsSync(input.session), false, "this proof owns a fresh publication namespace");
  fs.mkdirSync(input.session, { recursive: true });
  let proven = false;
  const cache = api.createTtscTransformCache({
    readFile(location) {
      const contents = fs.readFileSync(location);
      if (!proven && fs.realpathSync.native(location) === declaration) {
        proven = true;
        return Buffer.concat([contents, Buffer.from("\n// first postcompile proof differs\n")]);
      }
      return contents;
    },
  });
  let failure, observation;
  try {
    api.shareTtscTransformCache(cache, input.session);
    api.beginTtscTransformBuild(cache);
    const entry = path.join(root, "src/bundle.ts");
    const result = await api.transformTtsc(entry, fs.readFileSync(entry, "utf8"),
      api.resolveOptions({ project: path.join(root, "tsconfig.json") }), undefined, cache);
    assert.equal(proven, true, "the outside-walk package declaration underwent graph proof");
    assert.match(result?.code ?? "", /Shared boundary corpus/, "the actual native banner output is served after retry");
    assert.match(result?.code ?? "", /authored-marker/, "the actual entry is served");
    const nativePrograms = fs.statSync(input.programRunLog).size - before;
    assert.equal(nativePrograms, 2, "rejected capture is not published back to its own retry");
    assert.deepEqual(fs.readFileSync(declaration), original, "the native input itself was never rewritten");
    observation = { proofRead: proven, nativePrograms, served: true };
  } catch (error) { failure = error; }
  try { api.resetTtscTransformCache(cache); }
  catch (error) {
    if (failure) throw new AggregateError([failure, error], "graph proof and cache withdrawal failed");
    throw error;
  }
  // Reset schedules generation disposal; it is not an awaited backend-close
  // receipt. The caller retains the resident's actual close responsibility.
  if (failure) throw failure;
  return observation;
}
