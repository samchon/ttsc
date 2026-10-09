import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Observes the staged backend graph without invoking a compiler or generator.
 *
 * @evidence contracts/common.md#principled-implementation Reads actual copied configurations, instruction steps, generated tags and diagnostic messages; empty claims and accessor populations fail rather than certifying no work.
 * @evidence contracts/common.md#clear-and-simple-design One namespace owns the test's portable observation policy; the boundary scene owns installation, generation, process status and final assertions.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Native output is observed without rewriting failures. Unlock removes only the selected disabled marker and its comments, and citation removal recognizes JSDoc tag lines rather than prose mentions.
 * @evidence contracts/common.md#meaningful-documentation Each operation identifies its input, selected result and refusal condition without claiming that an unexecuted boundary passes.
 * @evidence contracts/portability.md#os-neutral-implementation Native joins read regular authored files, while reported requirement addresses use POSIX separators. Directory links are not followed by these fixture observers; the real installed package traversal belongs to the contributor.
 * @evidence contracts/performance.md#efficient-algorithms Finite configuration and generated-source scans are linear in their input bytes; staged ordering compares positions in the short instruction population.
 * @evidence contracts/performance.md#reuse-equivalent-work The scene captures generated accessor and requirement populations once after generation. Mutated claim configuration is reread for each unlock rather than reusing stale line offsets.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Synchronous reads own no retained handles or child processes; returned observations live only with the finite scenario.
 */
export namespace BackendActivation {
  /** One named gate and the actual package script that owns its Program. */
  export interface Claim {
    /** Configured identity used by native diagnostic labels. */
    name: string;
    /** Native path to the copied lint configuration. */
    file: string;
    /** Package cwd that owns the selected compiler Program. */
    directory: string;
    /** Package script compiling that Program. */
    script: string;
    /** Whether at least one reference traverses an installed package. */
    throughPackage: boolean;
  }

  /** Claim-specific obligation parsed from the native diagnostic transport. */
  export interface Obligation {
    /** Named claim that owes this unit. */
    claim: string;
    /** Evidence unit address carried by the actual diagnostic. */
    target: string;
  }

  /**
   * Finds the current instruction's staged claims in their prescribed order. A
   * missing marker, owner, or instruction step refuses a vacuous walk.
   */
  export function claims(workspace: string, instruction: string): Claim[] {
    const steps = instruction
      .split("\n")
      .filter((line) => /delete `disabled` from/i.test(line));
    assert.ok(steps.length, "The backend instruction must prescribe an unlock");
    const result: Claim[] = [];
    const packages = path.join(workspace, "packages");
    for (const entry of fs.readdirSync(packages, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const directory = path.join(packages, entry.name);
      for (const [relative, script] of [
        ["lint.config.ts", "lint"],
        ["test/lint.config.ts", "build:test"],
      ] as const) {
        const file = path.join(directory, relative);
        if (!fs.existsSync(file)) continue;
        const source = fs.readFileSync(file, "utf8");
        const lines = source.split("\n");
        const starts = lines.flatMap((line, index) =>
          /^\s*name:\s*"([^"]+)",?\s*$/.test(line) ? [index] : [],
        );
        for (let i = 0; i < starts.length; i++) {
          const block = lines.slice(starts[i], starts[i + 1]).join("\n");
          const name = /^\s*name:\s*"([^"]+)"/m.exec(block)![1]!;
          if (!steps.some((step) => step.includes("`" + name + "`"))) continue;
          assert.equal(
            block
              .split("\n")
              .filter((line) => /^\s*disabled:\s*true,?\s*$/.test(line)).length,
            1,
            name + " must ship staged",
          );
          assert.ok(
            !result.some((claim) => claim.name === name),
            "Duplicate staged claim " + name,
          );
          result.push({
            name,
            file,
            directory,
            script,
            throughPackage: /^\s*package:\s*"/m.test(block),
          });
        }
      }
    }
    assert.ok(result.length, "The backend instruction must own a claim");
    assert.ok(
      result.some((claim) => claim.throughPackage),
      "The walk must reach an installed package",
    );
    const position = (claim: Claim): [number, number] => {
      const line = steps.findIndex((step) =>
        step.includes("`" + claim.name + "`"),
      );
      return [line, steps[line]!.indexOf("`" + claim.name + "`")];
    };
    return result.sort(
      (a, b) =>
        position(a)[0] - position(b)[0] || position(a)[1] - position(b)[1],
    );
  }

  /** Removes only the selected claim's disabled marker and adjacent comments. */
  export function unlock(claim: Claim): void {
    const lines = fs.readFileSync(claim.file, "utf8").split("\n");
    let current = "";
    for (let i = 0; i < lines.length; i++) {
      const named = /^\s*name:\s*"([^"]+)"/.exec(lines[i]!);
      if (named) current = named[1]!;
      if (
        current !== claim.name ||
        !/^\s*disabled:\s*true,?\s*$/.test(lines[i]!)
      )
        continue;
      let begin = i;
      while (begin > 0 && /^\s*\/\//.test(lines[begin - 1]!)) begin--;
      lines.splice(begin, i - begin + 1);
      fs.writeFileSync(claim.file, lines.join("\n"));
      return;
    }
    throw new Error("Missing activation marker for " + claim.name);
  }

  /** Parses named native obligations, refusing healthy but empty populations. */
  export function obligations(output: string, claim: string): Obligation[] {
    assert.ok(
      !output
        .split("\n")
        .some(
          (line) =>
            line.includes("matched no ") && line.includes("'" + claim + "'"),
        ),
      "Empty reference population for " + claim,
    );
    const result: Obligation[] = [];
    for (const match of output.matchAll(
      /Missing acknowledgement for '([^']+)'([^\r\n]*)/g,
    )) {
      const identity = / in Claim \d+ \('([^']+)'\) reference \d+ \(/.exec(
        match[2]!,
      );
      if (identity?.[1] === claim) result.push({ claim, target: match[1]! });
    }
    assert.ok(
      result.length,
      "Enabled unacknowledged claim must demand obligations: " +
        claim +
        "\n" +
        output,
    );
    return result;
  }

  /** Reads generator-published accessor addresses rather than inventing them. */
  export function accessors(directory: string): string[] {
    const result = new Set<string>();
    for (const file of files(directory, ".ts"))
      for (const match of fs
        .readFileSync(file, "utf8")
        .matchAll(/^\s*\*\s*@accessor\s+api\.(\S+)\s*$/gm))
        result.add(match[1]!);
    assert.ok(result.size, "The real SDK generator must publish accessors");
    return [...result].sort();
  }

  /** Finds delivered H2/H3 requirement documents outside fenced examples. */
  export function requirements(workspace: string): string[] {
    return files(path.join(workspace, "docs/analysis"), ".md")
      .filter((file) => {
        let fenced = false;
        for (const line of fs.readFileSync(file, "utf8").split("\n")) {
          if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
          else if (!fenced && /^(##|###)\s+\S/.test(line)) return true;
        }
        return false;
      })
      .map((file) => path.relative(workspace, file).split(path.sep).join("/"));
  }

  /** Removes shipped acknowledgments from the copied test hosts only. */
  export function stripCitations(directory: string): void {
    for (const file of files(directory, ".ts")) {
      const source = fs.readFileSync(file, "utf8");
      fs.writeFileSync(
        file,
        source
          .split("\n")
          .filter((line) => !/^\s*\*\s*@evidence(?:Exclude)?\s/.test(line))
          .join("\n"),
      );
    }
  }

  /** Enumerates regular authored inputs; directory links are not followed. */
  function files(directory: string, extension: string): string[] {
    return fs
      .readdirSync(directory, { withFileTypes: true })
      .flatMap((entry) => {
        const file = path.join(directory, entry.name);
        return entry.isDirectory()
          ? files(file, extension)
          : entry.isFile() && entry.name.endsWith(extension)
            ? [file]
            : [];
      });
  }
}
