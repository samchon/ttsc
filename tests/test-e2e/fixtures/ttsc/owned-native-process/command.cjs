const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");

const [mode, root, ...args] = process.argv.slice(2);
if (mode === "echo") {
  const input = [];
  process.stdin.on("data", (chunk) => input.push(chunk));
  process.stdin.on("end", () => {
    process.stdout.write(
      JSON.stringify({
        args,
        cwd: process.cwd(),
        value: process.env.TTSC_OWNED_VALUE,
        input: Buffer.concat(input).toString("hex"),
      }),
    );
    process.stderr.write("authored diagnostic");
    process.exitCode = 23;
  });
} else if (mode === "tree") {
  fs.writeFileSync(path.join(root, "parent.pid"), String(process.pid));
  spawn(process.execPath, [__filename, "grandchild", root], { stdio: "ignore" });
  setInterval(() => {}, 1000);
} else if (mode === "grandchild") {
  const lateAt = Date.now() + 500;
  fs.writeFileSync(
    path.join(root, "grandchild.pending"),
    JSON.stringify({ pid: process.pid, lateAt }),
  );
  fs.renameSync(
    path.join(root, "grandchild.pending"),
    path.join(root, "grandchild.json"),
  );
  setTimeout(
    () => fs.writeFileSync(path.join(root, "late-marker"), "late"),
    500,
  );
  setInterval(() => {}, 1000);
} else if (mode === "overflow") {
  fs.writeFileSync(path.join(root, "overflow.pid"), String(process.pid));
  process.stdout.write(Buffer.alloc(4096, 65));
  setInterval(() => {}, 1000);
} else if (mode === "marker") {
  fs.writeFileSync(path.join(root, "admitted-marker"), "admitted");
} else if (mode === "rpc-unknown" || mode === "rpc-cancel") {
  if (process.env.TTSC_OWNED_RPC_BINARY)
    process.env.TTSC_BINARY = process.env.TTSC_OWNED_RPC_BINARY;
  const { CapabilityPluginResolver } = require(args[0]);
  const owner = new CapabilityPluginResolver();
  const request = { capability: "graph", cwd: root, tsconfig: "tsconfig.json" };
  const controller = new AbortController();
  const reason = new Error("authored arbitrary RPC cancellation");
  let operation;
  (async () => {
    if (mode === "rpc-unknown") {
      const results = await Promise.allSettled([
        owner.resolve(request),
        owner.resolve(request),
      ]);
      assert.equal(results[0].status, "rejected");
      assert.ok(results[0].reason instanceof AggregateError);
      assert.ok(
        results[0].reason.errors.some(
          (error) =>
            error instanceof Error &&
            /did not certify retirement/.test(error.message),
        ),
      );
      assert.equal(results[1].status, "rejected");
      assert.match(results[1].reason.message, /closed/);
      await assert.rejects(owner.close(), (error) => {
        assert.ok(error instanceof AggregateError);
        assert.equal(error.errors.length, 1);
        const failure = error.errors[0];
        assert.match(
          failure.message,
          /native retirement is unknown; retained protocol /,
        );
        assert.match(failure.cause.message, /did not publish a completion receipt/);
        const directory = failure.message.split("retained protocol ")[1];
        assert.ok(path.isAbsolute(directory));
        assert.ok(fs.statSync(directory).isDirectory());
        const admissions = fs
          .readFileSync(process.env.TTSC_OWNED_HELPER_ADMISSIONS, "utf8")
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));
        assert.equal(admissions.length, 1);
        assert.equal(path.dirname(admissions[0].resultFile), directory);
        assert.ok(Number.isSafeInteger(admissions[0].pid));
        assert.ok(admissions[0].pid > 0);
        assert.throws(() => process.kill(admissions[0].pid, 0), { code: "ESRCH" });
        process.stderr.write(
          "Retained RPC native protocol input: " + directory + "\n",
        );
        return true;
      });
      process.stdout.write("queued unknown retirement rejected\n");
    } else {
      operation = owner.resolve(request, { signal: controller.signal });
      void operation.catch(() => {});
      const until = Date.now() + 5000;
      while (!fs.existsSync(process.env.TTSC_OWNED_PROBE_PID)) {
        assert.ok(Date.now() < until, "actual runtime probe readiness deadline");
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      const pid = Number(fs.readFileSync(process.env.TTSC_OWNED_PROBE_PID, "utf8"));
      assert.ok(Number.isSafeInteger(pid) && pid > 0);
      controller.abort(reason);
      await assert.rejects(operation, (error) => error === reason);
      await owner.close();
      assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
      process.stdout.write("actual RPC runtime probe cancelled and joined\n");
    }
  })().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  }).finally(async () => {
    controller.abort(reason);
    if (operation) await operation.catch(() => {});
    await owner.close().catch((error) => {
      if (mode !== "rpc-unknown") {
        console.error(error);
        process.exitCode = 1;
      }
    });
  });
} else if (require.main === module) {
  throw new Error("Unknown authored command mode: " + mode);
}
