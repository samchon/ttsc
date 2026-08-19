import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  createNativeSessionFixture,
  readRequests,
  readSpawnArguments,
} from "../internal/nativeSession";

/**
 * Verifies the resident client states its artifact answer on every request, and
 * states it as a withdrawal rather than as silence when it has none.
 *
 * The server distinguishes three things a client can say — nothing, none, or
 * this file — and only the client can produce them, so what it actually writes
 * is the half of that contract nothing else can check. The two failures are a
 * pointer apart on the wire and neither is visible from either side alone:
 * omitting the field when the project publishes none leaves a server holding a
 * startup set answering with artifacts the project no longer has, and stating a
 * path the server cannot read fails the request outright.
 *
 * The project here configures no plugin, which is the common case and the one
 * whose statement is easiest to get wrong: "I have none" and "I have no
 * opinion" look alike until a session has to withdraw something.
 *
 * 1. Drive a resident session against the fake native child twice.
 * 2. Read back what the child was spawned with and what it received.
 * 3. Require no `--artifacts` flag, and an explicit empty statement on both
 *    requests.
 */
export const test_ttscgraph_session_states_its_artifacts_on_every_request =
  async (): Promise<void> => {
    const fixture = createNativeSessionFixture({ mode: "respond" });
    fs.writeFileSync(
      path.join(fixture.root, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { strict: true } }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(fixture.root, "package.json"),
      JSON.stringify({ name: "native-session-fixture" }),
      "utf8",
    );

    try {
      await fixture.session.graph();
      await fixture.session.graph();
    } finally {
      fixture.session.close();
    }

    const spawned = readSpawnArguments(fixture.root);
    assert.equal(spawned.length, 1, "the session did not spawn exactly once");
    assert.equal(
      spawned[0]!.includes("--artifacts"),
      false,
      `a project publishing nothing was given an artifacts file: ${spawned[0]!.join(" ")}`,
    );

    const requests = readRequests(fixture.root);
    assert.equal(requests.length, 2, "the fake child did not see two requests");
    for (const [index, request] of requests.entries())
      assert.equal(
        request.artifacts,
        "",
        `request ${index + 1} said ${JSON.stringify(request.artifacts)} rather than stating it has none; a server holding a startup set would keep answering with it`,
      );
  };
