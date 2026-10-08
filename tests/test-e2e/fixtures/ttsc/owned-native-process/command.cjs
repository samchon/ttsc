const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
const lifetime = require("./lifetime.cjs");

const [mode, root, ...args] = process.argv.slice(2);
if (process.env.TTSC_LIFETIME_ROLE && mode !== "grandchild")
  lifetime.enrolled(process.env.TTSC_LIFETIME_ROLE);
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
  const { serializeCompilerError } = require(
    path.join(path.dirname(args[0]), "internal/serializeCompilerError.js"),
  );
  const failures = [];
  const reportFailure = (error) => {
    failures.push(error);
    lifetime.reportFailure(
      process.env.TTSC_LIFETIME_ROLE,
      failures.length === 1 ? error : new AggregateError(
        [...failures],
        "Actor execution and closure failures",
        { cause: failures[0] },
      ),
      serializeCompilerError,
    );
  };
  const owner = new CapabilityPluginResolver();
  const request = { capability: "graph", cwd: root, tsconfig: "tsconfig.json" };
  const controller = new AbortController();
  const reason = new Error("authored arbitrary RPC cancellation");
  let operation;
  let acceptedUnknownClose;
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
      const admissions = fs
        .readFileSync(process.env.TTSC_OWNED_HELPER_ADMISSIONS, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      assert.equal(admissions.length, 1);
      assert.ok(Number.isSafeInteger(admissions[0].pid));
      assert.ok(admissions[0].pid > 0);
      const resultFile = admissions[0].resultFile;
      assert.ok(path.isAbsolute(resultFile));
      const directory = path.dirname(resultFile);
      const requireUnknown = (failure) => {
        assert.ok(failure instanceof Error);
        assert.equal(failure.message, "ttsc: native retirement is unknown; retained protocol " + directory);
        assert.ok(failure.cause instanceof Error);
        assert.match(failure.cause.message, /did not publish a completion receipt/);
        assert.ok(failure.cause.cause instanceof Error);
        assert.equal(failure.cause.cause.code, "ENOENT");
        assert.equal(failure.cause.cause.path, resultFile);
      };
      await assert.rejects(owner.close(), (error) => {
        assert.ok(error instanceof AggregateError);
        assert.equal(error.errors.length, 2);
        requireUnknown(error.errors[0]);
        const background = error.errors[1];
        assert.ok(background instanceof AggregateError);
        assert.equal(background.message, "ttsc: resolver background cleanup failed");
        assert.equal(background.errors.length, 1);
        const relay = background.errors[0];
        assert.ok(relay instanceof Error);
        assert.equal(relay.message, "ttsc: native relay did not certify retirement");
        requireUnknown(relay.cause);
        assert.ok(fs.statSync(directory).isDirectory());
        process.stderr.write(
          "Retained RPC native protocol input: " + directory + "\n",
        );
        acceptedUnknownClose = error;
        return true;
      });
      const admission = JSON.parse(fs.readFileSync(process.env.TTSC_OWNED_HELPER_ADMISSIONS, "utf8").trim());
      const target = lifetime.awaitAck("rpc-helper", "acquired", admission.pid);
      lifetime.requireRetired("rpc-helper", target);
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
      const target = lifetime.awaitAck("rpc-probe", "acquired", pid);
      controller.abort(reason);
      await assert.rejects(operation, (error) => error === reason);
      await owner.close();
      const joinObserved = { joinObservedAt: Date.now(), joinObservedNs: process.hrtime.bigint().toString() };
      lifetime.requireRetired("rpc-probe", target, joinObserved);
      process.stdout.write("actual RPC runtime probe cancelled and joined\n");
    }
  })().catch((error) => {
    reportFailure(error);
    process.exitCode = 1;
  }).finally(async () => {
    controller.abort(reason);
    if (operation) await operation.catch(() => {});
    await owner.close().catch((error) => {
      if (error !== acceptedUnknownClose) {
        reportFailure(error);
        process.exitCode = 1;
      }
    });
  });
} else if (require.main === module) {
  throw new Error("Unknown authored command mode: " + mode);
}
