// Run the original scene in one owned native boundary. A failure sets status
// after its original finally path; the parent still joins the real boundary.
const { case_watch_topology_reports_deleted_config_and_recreation } = await import(process.argv[2]);
try {
  await case_watch_topology_reports_deleted_config_and_recreation(Number(process.argv[3]));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
