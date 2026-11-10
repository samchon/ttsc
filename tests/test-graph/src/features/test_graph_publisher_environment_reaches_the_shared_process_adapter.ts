import assert from "node:assert/strict";

import { TtscGraphLinePeer } from "../../../../packages/graph/src/model/TtscGraphLinePeer";
import { TtscGraphNativeArguments } from "../../../../packages/graph/src/model/TtscGraphNativeArguments";

/**
 * Verifies publisher permission reaches the shared process adapter's child.
 *
 * Pure environment construction cannot prove that the adapter passes its
 * captured value to Node's actual spawn boundary.
 *
 * 1. Derive enabled and disabled publisher environments from an inherited grant.
 * 2. Ask a real Node IO actor to report only the two compiler transport fields.
 * 3. Assert exact values and join normal EOF closure after each observation.
 *
 * @evidence contracts/testing.md#behavioral-verification Maintained environment capture and line transport spawn a real Node child whose stdout reports the actual inherited argv/cwd fields for both final permission assignments.
 * @evidence contracts/testing.md#independent-expectations Literal strict/permission arrays and an authored argument-base string prescribe the child values without computing an expected result through the product helper.
 * @evidence contracts/testing.md#distinguishing-cases Explicit true and false share an inherited true baseline; unrelated environment fields are unnecessary, and the captured cwd must survive both assignments.
 * @evidence contracts/testing.md#execution-ownership This source unit owns two serial Node IO actors through the actual process adapter, waits for each stdout observation, then joins EOF shutdown in finally. The actors test environment transport only and do not impersonate a compiler, lint publisher or installed consumer.
 */
export async function test_graph_publisher_environment_reaches_the_shared_process_adapter(): Promise<void> {
  for (const permission of [true, false]) {
    let receive!: (value: string[]) => void;
    let reject!: (error: unknown) => void;
    let observed = false;
    const answer = new Promise<string[]>((resolve, fail) => {
      receive = resolve;
      reject = fail;
    });
    const peer = TtscGraphLinePeer.open(
      process.execPath,
      [
        "-e",
        'process.stdin.on("data",()=>process.stdout.write(JSON.stringify([process.env.TTSC_TSGO_ARGS,process.env.TTSC_TSGO_ARGS_CWD])+"\\n"));',
      ],
      {
        line: (line) => {
          try {
            observed = true;
            receive(JSON.parse(line) as string[]);
          } catch (error) {
            reject(error);
          }
        },
        error: reject,
        exit: (code, signal) => {
          if (!observed)
            reject(
              new Error(
                `IO actor exited before observation: ${code}/${signal}`,
              ),
            );
        },
      },
      {
        stderr: "capture",
        env: TtscGraphNativeArguments.environment(permission, {
          SystemRoot: process.env.SystemRoot,
          TTSC_TSGO_ARGS: '["--strict","--runExternalCode","true"]',
          TTSC_TSGO_ARGS_CWD: "argument base",
        }),
      },
    );
    try {
      peer.write("capture\n", (error) => {
        if (error) reject(error);
      });
      const [raw, cwd] = await answer;
      assert.deepEqual(JSON.parse(raw!), [
        "--strict",
        "--runExternalCode",
        "true",
        "--runExternalCode",
        String(permission),
      ]);
      assert.equal(cwd, "argument base");
    } finally {
      await peer.close(true);
    }
  }
}
