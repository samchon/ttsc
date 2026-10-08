import assert from "node:assert/strict";
import path from "node:path";

import { createProjectInputPathIdentityContext } from "../../../../../packages/ttsc/src/internal/pathIdentity/createProjectInputPathIdentityContext";
import { parseWindowsDirectoryCaseSensitivity } from "../../../../../packages/ttsc/src/internal/parseWindowsDirectoryCaseSensitivity";
import { planCompilerDirectoryWatchEvent } from "../../../../../packages/ttsc/src/launcher/internal/watch/planCompilerDirectoryWatchEvent";

/**
 * Verifies fsutil status framing excludes directory names in every locale.
 *
 * Node receives fsutil's console-code-page bytes without a portable decoder.
 * English responses use the native message's final status field. Opaque
 * localized responses instead require the disabled volume-root baseline;
 * English words inside their path cannot supply missing status evidence.
 *
 * 1. Contrast both statuses across ordinary, status-word and mixed-case paths.
 * 2. Reject unframed English words and incomplete or unavailable evidence.
 * 3. Route case aliases through the shared identity context and watch planner.
 * 4. Collect every matrix failure before returning.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual parser with raw response buffers and checks sensitive, insensitive and unknown results. Its parsed decisions then feed the supported identity-operation seam and actual directory-event planner, distinguishing incorrect path-word authority from valid missing-suffix and candidate routing.
 * @evidence contracts/testing.md#independent-expectations English messages use the installed fsutil en-US resource's `Case sensitive attribute on directory %1 is enabled/disabled.` framing; literal status fields determine expected booleans. Independently authored opaque suffixes use the successful-query and disabled-volume-root premises. Expected identity equality and candidate arrays follow false-only folding and conservative unknown routing, not parser outputs.
 * @evidence contracts/testing.md#distinguishing-cases Both English states and both opaque localized states cross ordinary, enabled, disabled, mixed-case and combined-word paths. Localized queries without a baseline remain unknown; missing root markers, empty suffixes, short evidence, unframed words, truncated English and unrelated messages remain unknown. Sensitive and unknown stored keys stay distinct, only insensitive missing suffixes converge, unknown aliases remain candidates, and existing physical aliases converge independently of case authority.
 * @evidence contracts/testing.md#execution-ownership The named source unit executes parser, identity and event-planning operations with in-memory bytes and supported virtual filesystem operations on every host. It launches no fsutil, compiler or watcher and makes no actual native case-capability or watch-delivery claim; the separate Windows native unit owns read-only capability observations.
 */
export const test_windows_directory_case_sensitivity_parser_is_locale_independent =
  (): void => {
    assert.equal(
      parseWindowsDirectoryCaseSensitivity(
        Buffer.from(
          "Case sensitive attribute on directory C:\\ordinary is disabled.\r\n",
        ),
        undefined,
        "C:\\",
      ),
      false,
    );
    assert.equal(
      parseWindowsDirectoryCaseSensitivity(
        Buffer.from(
          "Case sensitive attribute on directory C:\\ordinary is enabled.\r\n",
        ),
        undefined,
        "C:\\",
      ),
      true,
    );

    const prefix = Buffer.from([0x81, 0x40, 0x82, 0x41]);
    const disabledSuffix = Buffer.from([0x90, 0x40, 0x91, 0x41, 0x0d, 0x0a]);
    const enabledSuffix = Buffer.from([0x92, 0x40, 0x93, 0x41, 0x0d, 0x0a]);
    const volume = Buffer.concat([prefix, Buffer.from("C:\\"), disabledSuffix]);
    assert.equal(
      parseWindowsDirectoryCaseSensitivity(
        Buffer.concat([
          prefix,
          Buffer.from("C:\\workspace\\ordinary"),
          disabledSuffix,
        ]),
        volume,
        "C:\\",
      ),
      false,
    );
    assert.equal(
      parseWindowsDirectoryCaseSensitivity(
        Buffer.concat([
          prefix,
          Buffer.from("C:\\workspace\\sensitive"),
          enabledSuffix,
        ]),
        volume,
        "C:\\",
      ),
      true,
    );

    assert.equal(
      parseWindowsDirectoryCaseSensitivity(
        Buffer.from([0x81]),
        Buffer.from("no volume marker"),
        "C:\\",
      ),
      undefined,
    );
    assert.equal(
      parseWindowsDirectoryCaseSensitivity(
        Buffer.from([0x81]),
        Buffer.from("C:\\"),
        "C:\\",
      ),
      undefined,
    );
    assert.equal(
      parseWindowsDirectoryCaseSensitivity(Buffer.from([0x81]), volume, "C:\\"),
      undefined,
    );

    const failures: Error[] = [];
    const cases: {
      name: string;
      output: Buffer;
      baseline?: Buffer;
      expected: boolean | undefined;
    }[] = [];
    for (const name of [
      "ordinary",
      "enabled",
      "disabled",
      "EnAbLeD",
      "DiSaBlEd",
      "enabled disabled",
      "ordinary is enabled",
    ]) {
      for (const sensitive of [false, true]) {
        const status = sensitive ? "enabled" : "disabled";
        const directory = `C:\\workspace\\${name}`;
        cases.push({
          name: `English ${status}: ${name}`,
          output: Buffer.from(
            `Case sensitive attribute on directory ${directory} is ${status}.\r\n`,
          ),
          expected: sensitive,
        });
        const localized = Buffer.concat([
          prefix,
          Buffer.from(directory),
          sensitive ? enabledSuffix : disabledSuffix,
        ]);
        cases.push({
          name: `localized ${status}: ${name}`,
          output: localized,
          baseline: volume,
          expected: sensitive,
        });
        cases.push({
          name: `localized without baseline ${status}: ${name}`,
          output: localized,
          expected: undefined,
        });
      }
    }
    for (const output of [
      "enabled",
      "disabled",
      "C:\\workspace\\enabled",
      "Case sensitive attribute on directory C:\\enabled is unavailable.\r\n",
      "Case sensitive attribute on directory C:\\enabled is disabled",
      "unrelated message: disabled\r\n",
      "Case sensitive attribute on directory C:\\disabled\r\n is enabled.\r\n",
    ]) {
      cases.push({
        name: output,
        output: Buffer.from(output),
        expected: undefined,
      });
    }
    cases.push(
      {
        name: "English volume root",
        output: Buffer.from(
          "Case sensitive attribute on directory C:\\ is disabled.\r\n",
        ),
        expected: false,
      },
      {
        name: "English LF and mixed status case",
        output: Buffer.from(
          "Case sensitive attribute on directory C:\\disabled is EnAbLeD.\n",
        ),
        expected: true,
      },
      {
        name: "English without trailing newline",
        output: Buffer.from(
          "Case sensitive attribute on directory C:\\enabled is disabled.",
        ),
        expected: false,
      },
    );
    for (const scenario of cases) {
      try {
        assert.equal(
          parseWindowsDirectoryCaseSensitivity(
            scenario.output,
            scenario.baseline,
            "C:\\",
          ),
          scenario.expected,
        );
      } catch (cause) {
        failures.push(new Error(scenario.name, { cause }));
      }
    }

    for (const authority of [false, true, undefined]) {
      try {
        const directory = "C:\\enabled";
        const source = path.win32.join(directory, "Future.ts");
        const alias = path.win32.join(directory, "future.ts");
        const physical = path.win32.join(directory, "Target.ts");
        const linked = path.win32.join(directory, "Link.ts");
        const output =
          authority === undefined
            ? Buffer.from("unavailable enabled")
            : Buffer.from(
                `Case sensitive attribute on directory ${directory} is ${authority ? "enabled" : "disabled"}.\r\n`,
              );
        const identities = createProjectInputPathIdentityContext({
          platform: "win32",
          caseSensitive: () =>
            parseWindowsDirectoryCaseSensitivity(output, undefined, "C:\\"),
          realpath: (location) => {
            if (location === "C:\\" || location === directory) return location;
            if (location === physical || location === linked) return physical;
            throw Object.assign(new Error("missing"), { code: "ENOENT" });
          },
        });
        const plan = planCompilerDirectoryWatchEvent({
          changed: alias,
          event: "change",
          exists: (location) => location === source,
          identities,
          location: directory,
          platform: "win32",
          trackedFiles: new Map([[identities.lexicalKey(source), source]]),
        });
        assert.equal(
          identities.resolve(source).key === identities.resolve(alias).key,
          authority === false,
        );
        assert.equal(
          identities.resolve(physical).key,
          identities.resolve(linked).key,
        );
        assert.equal(
          identities.lexicalKey(source) === identities.lexicalKey(alias),
          authority === false,
        );
        assert.equal(identities.lexicalMatches(source, alias), authority !== true);
        assert.deepEqual(plan, {
          changes: authority === true ? [] : [source],
          rearm: [],
          refresh: authority === true,
        });
      } catch (cause) {
        failures.push(
          new Error(
            `shared identity and candidate authority ${String(authority)}`,
            { cause },
          ),
        );
      }
    }
    if (failures.length !== 0)
      throw new AggregateError(failures, "Windows status framing and routing");
  };
