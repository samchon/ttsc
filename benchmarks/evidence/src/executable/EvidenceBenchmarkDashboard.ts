import { renderEvidenceBenchmarkDashboard } from "../EvidenceBenchmarkDashboard";
import { EvidenceBenchmarkLayout } from "../EvidenceBenchmarkLayout";

// The dashboard always renders the latest launched run of each cell and has no
// way to be pointed at anything else. `audit-suspensions` and `report` do take
// `--run-id`, and the three commands are documented together, so the natural
// mistake is to append a run ID to all three. Accepting the flag and ignoring
// it publishes the live cohort under a historical label, into the pull-request
// body that is the campaign's live record. An argument this command cannot
// honor is therefore refused rather than dropped.
const args: string[] = process.argv.slice(2);
if (args.length !== 0)
  throw new Error(
    `Unexpected benchmark dashboard argument: ${args[0]}. This command always renders the latest launched run of each cell; \`audit-suspensions\` and \`report\` take \`--run-id\` for an explicit historical cohort.`,
  );

const repository: string = EvidenceBenchmarkLayout.repositoryRoot;
process.stdout.write(renderEvidenceBenchmarkDashboard(repository));
