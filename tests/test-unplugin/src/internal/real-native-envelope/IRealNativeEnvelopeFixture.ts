/** A real native-host project whose linked plugin observes Program invocations. */
export interface IRealNativeEnvelopeFixture {
  /** Type-root directory whose child membership affects the whole Program. */
  automaticTypesDirectory: string;
  /** Selected declaration whose compiler proof must survive the JSON boundary. */
  declaration: string;
  /** Source kept outside the Program by an inherited templated outDir. */
  excludedSource: string;
  /** Existing package directory that the resolver probed only as a file. */
  fileCandidateDirectory: string;
  /** Missing source that supersedes the package's selected JavaScript entry. */
  missingCandidate: string;
  /** Sibling source modules delivered independently by a bundler. */
  modules: string[];
  /** Whether this fixture carries the full resolver-owner and suffix corpus. */
  resolutionCorpus: boolean;
  /** Real resolver candidates grouped by the path owner that produced them. */
  resolutionCandidateGroups: Record<string, string[]>;
  /** Project root containing the tsconfig, plugin descriptor, and packages. */
  root: string;
  /** Log outside the project, appended once from each linked ApplyProgram call. */
  runLog: string;
}
