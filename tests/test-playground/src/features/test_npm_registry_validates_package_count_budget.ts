import assert from "node:assert/strict";

import { installPlaygroundDependencies } from "../../../../packages/playground/src/npm/installPlaygroundDependencies";
import type { IPlaygroundInstalledDependency } from "../../../../packages/playground/src/structures/IPlaygroundInstalledDependency";
import {
  createNpmFixtureTarball,
  installNpmFixture,
} from "../internal/npmFixture";

/**
 * Verifies package-count budgets reject invalid numbers before acquiring work.
 *
 * Non-finite counts previously disabled the comparison guarding every queue
 * entry. A valid cap counts mounted revalidation and optional omissions too,
 * while zero still permits an empty request and unused mounted state.
 *
 * 1. Reject malformed counts before input iteration, progress or transport.
 * 2. Distinguish an empty zero-budget call from a queued zero-budget request.
 * 3. Exercise exact and exceeded budgets with mounted and fresh packages.
 * 4. Preserve the default 48-name boundary and caller-owned mounted records.
 *
 * @evidence contracts/testing.md#behavioral-verification Direct installPlaygroundDependencies calls reject invalid counts before iterable/callback effects, preserve mounted inputs, accept zero only without queued names, and stop mounted-name processing at exact and default limits. Fixture installs prove fresh archives and optional omissions share that same count budget.
 * @evidence contracts/testing.md#independent-expectations A finite nonnegative count is the public safety contract; literal fetch/progress/iteration zero counts establish admission before effects. Authored one/two-name populations and the documented default 48 establish exact boundaries independently of the queue implementation.
 * @evidence contracts/testing.md#distinguishing-cases Negative, fractional, NaN, both infinities and an unsafe integer contrast with zero, one and two. Empty/ignored requests, unrequested mounted state, mounted reuse, fresh extraction, optional404 omission and default49-name overflow retain separate assertions.
 * @evidence contracts/testing.md#execution-ownership This unit entry calls authored installer source through the playground runner, with explicit transport callbacks and in-process tar fixtures. It installs no consumer and starts no native producer or external registry connection.
 */
export const test_npm_registry_validates_package_count_budget = async () => {
  const mounted: IPlaygroundInstalledDependency[] = [
    { name: "first", registryName: "first", version: "1.0.0", requests: [] },
    { name: "second", registryName: "second", version: "1.0.0", requests: [] },
  ];
  const original = structuredClone(mounted);
  for (const maxPackages of [
    -1,
    0.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    let iterations = 0;
    let progress = 0;
    let fetches = 0;
    const names = {
      *[Symbol.iterator]() {
        ++iterations;
        yield "first";
      },
    };
    await assert.rejects(
      installPlaygroundDependencies(names, {
        maxPackages,
        installedDependencies: mounted,
        onProgress: () => ++progress,
        fetch: async () => {
          ++fetches;
          throw new Error("invalid budgets must not fetch");
        },
      }),
      /maxPackages must be a non-negative safe integer/,
    );
    assert.equal(iterations, 0);
    assert.equal(progress, 0);
    assert.equal(fetches, 0);
    assert.deepEqual(mounted, original);
  }

  let fetches = 0;
  const fetch = async (url: string): Promise<Response> => {
    ++fetches;
    const name = decodeURIComponent(url.slice(url.lastIndexOf("/") + 1));
    return Response.json({
      name,
      versions: { "1.0.0": { name, version: "1.0.0" } },
    });
  };
  const empty = await installPlaygroundDependencies([], {
    maxPackages: 0,
    installedDependencies: mounted,
    fetch,
  });
  assert.deepEqual(empty.resolvedDependencies, original);
  assert.equal(fetches, 0);
  const ignored = await installPlaygroundDependencies(["first"], {
    maxPackages: 0,
    ignoredPackages: ["first"],
    fetch,
  });
  assert.deepEqual(ignored.packages, []);
  assert.equal(fetches, 0);
  await assert.rejects(
    installPlaygroundDependencies(["first"], { maxPackages: 0, fetch }),
    /stopped after 0 packages/,
  );
  assert.equal(fetches, 0);

  const exact = await installPlaygroundDependencies(["first", "first"], {
    maxPackages: 1,
    installedDependencies: mounted,
    fetch,
  });
  assert.deepEqual(exact.packages, []);
  assert.equal(fetches, 1, "duplicate names must share one validation");
  await assert.rejects(
    installPlaygroundDependencies(["first", "second"], {
      maxPackages: 1,
      installedDependencies: mounted,
      fetch,
    }),
    /stopped after 1 packages/,
  );
  assert.equal(fetches, 2, "overflow must not fetch the second name");
  const both = await installPlaygroundDependencies(["first", "second"], {
    maxPackages: 2,
    installedDependencies: mounted,
    fetch,
  });
  assert.equal(both.resolvedDependencies.length, 2);
  assert.equal(fetches, 4);
  assert.deepEqual(mounted, original);

  const tarball = createNpmFixtureTarball({
    name: "fixture",
    version: "1.0.0",
    optionalDependencies: { absent: "*" },
  });
  const fixtureFetch = async (url: string): Promise<Response> => {
    if (url === "https://registry.npmjs.org/fixture") {
      return Response.json({
        name: "fixture",
        versions: {
          "1.0.0": {
            name: "fixture",
            version: "1.0.0",
            dist: { tarball: "https://tar.invalid/fixture.tgz" },
          },
        },
      });
    }
    if (url === "https://tar.invalid/fixture.tgz") {
      return new Response(tarball);
    }
    return new Response(null, { status: 404 });
  };
  await assert.rejects(
    installPlaygroundDependencies(["fixture"], {
      maxPackages: 1,
      fetch: fixtureFetch,
    }),
    /stopped after 1 packages/,
  );
  const fresh = await installPlaygroundDependencies(["fixture"], {
    maxPackages: 2,
    fetch: fixtureFetch,
  });
  assert.deepEqual(
    fresh.packages.map(({ name }) => name),
    ["fixture"],
  );
  assert.equal(
    fresh.runtimeFiles["fixture/index.js"],
    "module.exports = true;\n",
  );
  const singleton = await installNpmFixture({
    tarball: createNpmFixtureTarball(),
    options: { maxPackages: 1 },
  });
  assert.equal(singleton.packages.length, 1);

  const names = Array.from({ length: 49 }, (_, index) => `mounted-${index}`);
  const many = names.map((name) => ({
    name,
    registryName: name,
    version: "1.0.0",
    requests: [],
  }));
  fetches = 0;
  await assert.rejects(
    installPlaygroundDependencies(names, { installedDependencies: many, fetch }),
    /stopped after 48 packages/,
  );
  assert.equal(fetches, 48);
};
