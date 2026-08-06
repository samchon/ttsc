import process from "node:process";

import { renderEvidenceBenchmarkDashboard } from "../EvidenceBenchmarkDashboard";
import { EvidenceBenchmarkLayout } from "../EvidenceBenchmarkLayout";

// The dashboard always renders the latest launched run of each cell and has no
// way to be pointed at anything else. `audit-suspensions` and `report` do take
// `--run-id`, and the three commands are documented together, so the natural
// mistake is to append a run ID to all three. Accepting the flag and ignoring it
// publishes the live cohort under a historical label, which is exactly the kind
// of unproven claim the campaign record must not carry — so an argument this
// command cannot honor is refused rather than dropped.
const unexpected: string[] = process.argv.slice(2);
if (unexpected.length !== 0) {
  process.stderr.write(
    `The dashboard takes no arguments and always renders the latest launched run of each cell; received ${unexpected.join(" ")}. Use \`audit-suspensions\` and \`report\` with \`--run-id\` to work on an explicit historical cohort.\n`,
  );
  process.exit(1);
}

const repository: string = EvidenceBenchmarkLayout.repositoryRoot;
process.stdout.write(renderEvidenceBenchmarkDashboard(repository));
