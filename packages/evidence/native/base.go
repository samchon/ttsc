package evidence

import (
  "os"
  "path"
  "path/filepath"
  "sort"
  "strings"
)

// populationBase is the directory one rooted artifact population resolves
// against.
//
// Every population had exactly one base before `root` existed — the ttsc
// project root — and that is still the default. Declaring a root moves three
// things together, and keeping them together is what makes the escape coherent:
// the globs resolve against it, a unit's target is spelled relative to it, and a
// diagnostic names the file through it. A requirements set shared by two
// packages therefore answers to the *same* citation text in both, which is the
// only reason a second project can adopt a document set the first already cites.
//
// The alternative — project-relative targets that ascend with `../` — was
// rejected because it re-couples the citation to the citing project's position
// in the tree, so the same document owns a different address in every package
// that reads it. This mirrors what a `package` TypeScript reference already
// does: moving the base moves the address space with it (`graph.go`,
// `materializePackageGlobReference`).
type populationBase struct {
  // Absolute is the canonical directory, and the identity two populations are
  // judged the same base by.
  Absolute string
  // Declared is the author's own spelling of this base, empty for the default
  // base.
  //
  // It is kept beside the derived Display because the two answer different
  // questions. Display is where a reader opens a file; Declared is what they
  // search their `lint.config.ts` for. The two coincide for a relative root and
  // diverge for an absolute one, where the derived spelling ascends out of the
  // project and appears nowhere in the file the diagnostic is asking them to
  // edit.
  //
  // It arrives already normalized and is stored untouched. `normalizeRootPath`
  // owns that step, refusing the two forms a root may not take and reducing the
  // rest to one slash-separated spelling before a project identity exists to
  // resolve against — so a second normalization here would be a branch no
  // configuration can reach.
  Declared string
  // Display is what a diagnostic names: project-relative, ascending with `..`
  // when the base sits above the project, and absolute only when no relative
  // spelling exists. Empty for the default base, whose files are already named
  // by their project-relative path.
  Display string
  // Default marks the base a population takes when it declares no root. Its
  // addresses stay plain project-relative paths, which is what leaves every
  // existing citation, unit identity, and diagnostic byte-identical.
  Default bool
}

// artifactAddress is the three spellings one loaded file answers to.
//
// They are carried together because each is load-bearing and none can be
// derived from another once a base is in play. Relative is the citation's
// target, Display is what a reader has to open, and Key separates two
// populations that reached the same file through different roots — where the
// file is one thing and its target is two.
type artifactAddress struct {
  Base     populationBase
  Relative string
  Display  string
  Key      string
}

func (base populationBase) addressOf(relative string) artifactAddress {
  return artifactAddress{
    Base:     base,
    Relative: relative,
    Display:  base.display(relative),
    Key:      base.address(relative),
  }
}

// display spells a base-relative path the way a reader must open it.
func (base populationBase) display(relative string) string {
  if base.Display == "" {
    return relative
  }
  return base.Display + "/" + relative
}

// address composes the key one artifact is filed under.
//
// The base is part of the key because one physical file may belong to two
// populations with different roots, and its target — its path relative to its
// own base — differs between them. Keying on the file alone would let the second
// population overwrite the first with addresses the first cannot resolve, and
// nothing about that failure looks like a failure: the citations simply stop
// resolving in one of the two claims.
//
// The default base returns the bare relative path, so every unit identity, every
// inventory key, and the whole TypeScript path space are exactly what they were
// before roots existed.
func (base populationBase) address(relative string) string {
  if base.Default {
    return relative
  }
  return base.Absolute + "\x00" + relative
}

// relativeOf inverts address, recovering the base-relative path an inventory key
// was composed from and reporting false when that key belongs to another base.
//
// Composition and inversion live together on purpose. The key's shape is what
// separates two populations that reached one file through different roots, and
// a matcher that re-derived it would be free to drift from the loader that
// wrote it — silently, since a drifted key matches nothing and reads exactly
// like a glob that selects nothing.
func (base populationBase) relativeOf(address string) (string, bool) {
  if base.Default {
    if strings.Contains(address, "\x00") {
      return "", false
    }
    return address, true
  }
  return strings.CutPrefix(address, base.Absolute+"\x00")
}

// resolveProjectPath turns a path a diagnostic names back into a location on
// disk.
//
// An absolute display path is used as it stands. Joining it to the project root
// would produce a path under the project that does not exist, and the failure
// would arrive as a missing file rather than as the configuration error it is.
func resolveProjectPath(root string, relative string) string {
  local := filepath.FromSlash(relative)
  if filepath.IsAbs(local) {
    return filepath.Clean(local)
  }
  return filepath.Join(root, local)
}

// resolvePopulationBase anchors a declared root against the ttsc project root.
//
// A declared root that resolves back onto the project root is the default base
// rather than a second one spelled differently, so `root: "."` and an omitted
// root produce one population instead of two that address the same files
// differently. That collapse is also why only a non-default base carries a
// declared spelling: the base every un-rooted population shares names no
// configuration property, and giving it one would be a second identity for the
// one thing this branch exists to keep single.
func resolvePopulationBase(root string, declared string) populationBase {
  if declared == "" {
    return populationBase{Absolute: root, Default: true}
  }
  absolute := filepath.FromSlash(declared)
  if !declaredRootIsAbsolute(declared) {
    absolute = filepath.Join(root, absolute)
  }
  absolute = filepath.Clean(absolute)
  if absolute == root {
    return populationBase{Absolute: root, Default: true}
  }
  return populationBase{
    Absolute: absolute,
    Declared: declared,
    Display:  projectRelativeDisplay(root, absolute),
  }
}

// declaredRootIsAbsolute reports whether a declared root names its own location
// rather than one below the ttsc project root.
//
// One predicate answers this for the resolution and for every message that
// describes it, so the two cannot disagree. A sentence telling an author that
// their root resolves against the project root, printed over a path the
// resolution never joined to anything, is the false clause this diagnostic
// exists to remove — and it would return the moment a message re-derived the
// question with a test of its own.
//
// Windows answers it the way `filepath.Join` does: a rooted path carrying no
// volume, such as `/srv/contracts`, is relative there and is joined to the
// project, so a message reading this predicate keeps telling the truth on that
// platform while one reading the spelling would not.
func declaredRootIsAbsolute(declared string) bool {
  return filepath.IsAbs(filepath.FromSlash(declared))
}

// projectRelativeDisplay spells a directory the way the project sees it.
//
// A relative spelling is preferred even when it ascends, because every other
// path this rule prints is project-relative and a reader compares them against
// each other. An absolute path appears only when no relative one exists — a
// different Windows volume — where the alternative would be no spelling at all.
func projectRelativeDisplay(root string, absolute string) string {
  relative, err := filepath.Rel(root, absolute)
  if err != nil {
    return filepath.ToSlash(absolute)
  }
  slashed := filepath.ToSlash(relative)
  if slashed == "." {
    return ""
  }
  return slashed
}

// resolveGraphBases anchors every configured population against the project
// root, once, before anything is loaded.
//
// Decoding cannot do this: the decoder runs from options alone and has no
// project identity, which is also what lets `ProjectInputs` declare a rooted
// population's topology without touching the filesystem.
func resolveGraphBases(root string, config *graphConfig) {
  for claimIndex := range config.Claims {
    claim := &config.Claims[claimIndex]
    claim.Base = resolvePopulationBase(root, claim.Root)
    for referenceIndex := range claim.References {
      reference := &claim.References[referenceIndex]
      reference.Base = resolvePopulationBase(root, reference.Root)
    }
  }
}

// configuredBases lists the distinct directories one artifact kind is loaded
// from, in a stable order.
//
// Order is fixed rather than incidental because a loader walks these in
// sequence and its diagnostics are reported in the order they were produced. A
// map iteration here would make an unreadable root's message move between runs.
//
// Two populations that reach one directory through different spellings are one
// base, and the surviving spelling is the first one in configuration order,
// because that is the order this loop admits them in and the `seen` map only
// answers membership. That decides only the loader-level root messages, which
// belong to the directory rather than to either declaration. Every per-
// population diagnostic reads that population's own base and therefore keeps
// naming the spelling its own author wrote.
func configuredBases(config graphConfig, kind artifactKind) []populationBase {
  bases := []populationBase{}
  seen := map[string]bool{}
  add := func(base populationBase) {
    if seen[base.Absolute] {
      return
    }
    seen[base.Absolute] = true
    bases = append(bases, base)
  }
  for _, claim := range config.Claims {
    if claim.Type == kind {
      add(claim.Base)
    }
    for _, reference := range claim.References {
      if reference.Type == kind {
        add(reference.Base)
      }
    }
  }
  sort.Slice(bases, func(left int, right int) bool {
    return bases[left].Absolute < bases[right].Absolute
  })
  return bases
}

// populationRootLabel names the configuration property a reader has to edit,
// spelled the way they wrote it.
//
// This is the one place a declared spelling is preferred over the derived one,
// and the split is between two questions rather than two formats. A message
// naming a *location* spells it the way the reader opens it, which is what
// `display` does and why every file this rule prints stays project-relative. A
// message naming a *configuration property* spells it the way the configuration
// does, because the author's first move is to search `lint.config.ts` for it —
// and the derived spelling of an absolute root is an ascending path that file
// does not contain.
//
// The absolute fallback belongs to the default base alone, which is the only
// base with no declared spelling, and the project root is then the only thing
// left to name.
func populationRootLabel(base populationBase) string {
  if base.Declared == "" {
    return filepath.ToSlash(base.Absolute)
  }
  return base.Declared
}

// missingBaseDirectoryProblem reports a declared root that is not an existing
// directory.
//
// The test is a stat, and three states fail it: nothing at the path, an
// unreachable parent, and a path a non-directory occupies. The first two are one
// message because the repair is one act — create the directory — while the third
// is told apart, because "add that directory" cannot be followed while something
// else stands where it would go, and an author who tries reads the same sentence
// again.
//
// The Markdown and Prisma messages may still lead with "could not read", because
// the walk each of those callers is about to run is the read the root exists to
// serve, and it is skipped only because the root is not there. The predicate's
// own name may not, because the third caller reads nothing and asks the same
// question.
//
// The default base is excluded because `Check` already validated the project
// root, and its diagnostic names the ttsc project identity as the repair rather
// than a configuration property that does not exist there.
//
// Both spellings appear, and only while they differ. The declared one is the
// property the author has to edit, and the resolved one is where that property
// actually landed — which is the whole question the moment a root ascends out of
// the project. An absolute declared root landed on itself, so restating it would
// name the same path twice and offer the second as an explanation of the first.
//
// The clause about resolution goes with it, for the stronger reason that it is
// false there. `resolvePopulationBase` joins the project root into a relative
// declared root and into nothing else, so "it resolves against the ttsc project
// root" describes an act that did not happen whenever the root was absolute.
// `declaredRootIsAbsolute` is what both the resolution and this sentence read,
// so the sentence cannot outlive the act it reports.
//
// TypeScript is told apart in the verb and in the repair clause. Its root
// re-bases addressing over sources the Program already holds and never scans a
// directory, so a message about reading one would name an access this artifact
// kind never attempts.
//
// The verb also has to stay clear of the path sense beside it. "Resolves to"
// and "resolves against" are both composition, and a lead clause saying the
// root could not be resolved would make one sentence carry that sense and its
// opposite, in the one diagnostic whose whole job is to stop a misreading.
//
// Keep the two facts of the repair clause apart. The root spelling resolves
// against the project root; the sources re-base onto the root. Merging them
// into "re-bases Program sources against the ttsc project root" states the
// reverse of what the property does, and reads as though declaring it changed
// nothing — which is the one conclusion an author must not draw here.
//
// Every repair clause takes two steps, and that part is not about TypeScript at
// all. This stat is satisfied by an empty directory, so creating one silences
// the diagnostic and leaves the population exactly as empty — and for a claim
// that is worse than the diagnostic was, because an empty healthy claim
// deactivates without a word. Both branches therefore ask for what the
// directory must hold, and the split is disk against Program rather than one
// noun against another: the walkers want the sources on disk, and TypeScript
// wants them in the Program.
func missingBaseDirectoryProblem(base populationBase, kind artifactKind) string {
  if base.Default {
    return ""
  }
  info, err := os.Stat(base.Absolute)
  if err == nil && info.IsDir() {
    return ""
  }
  message := "Evidence graph could not read the " + string(kind) + " root '" +
    populationRootLabel(base) + "'"
  if kind == artifactTypeScript {
    message = "Evidence graph found no directory at the " + string(kind) + " root '" +
      populationRootLabel(base) + "'"
  }
  if !declaredRootIsAbsolute(base.Declared) {
    message += ", which resolves to '" + filepath.ToSlash(base.Absolute) + "'"
  }
  occupied := err == nil
  if occupied {
    message += ", because that path is not a directory"
  }
  message += ". Correct the 'root' property, or "
  switch {
  case kind == artifactTypeScript && occupied:
    message += "replace that path with a directory and make its sources part of the tsconfig Program"
  case kind == artifactTypeScript:
    message += "add that directory and make its sources part of the tsconfig Program"
  case occupied:
    message += "replace that path with a directory and the " + string(kind) + " sources it should hold"
  default:
    message += "create that directory and the " + string(kind) + " sources it should hold"
  }
  message += "; "
  if !declaredRootIsAbsolute(base.Declared) {
    message += "it resolves against the ttsc project root, and "
  }
  if kind == artifactTypeScript {
    return message + "a " + string(kind) +
      " root re-bases Program sources onto itself rather than scanning the filesystem."
  }
  return message + "an empty directory leaves the population just as empty."
}

// normalizeRootPath validates a declared root without resolving it.
//
// Two forms stay refused, and both for the reason the `files` grammar refuses
// them. A glob is not a directory, so accepting one would leave the base itself
// depending on what the filesystem happens to contain. A Windows drive-relative
// path such as `C:docs` is not absolute by the path API yet resolves against
// whatever directory that drive is currently on, so it names a different
// location on two machines while looking superficially safe — the rationale
// `glob_honors_public_path_contract_test.go` records for the same rejection in
// `files`.
//
// `..` is accepted here, and that is the whole point of the property. It is
// unambiguous and portable once resolved against a known root, and the root is
// the one place where declaring it is visible in the configuration rather than
// buried in a pattern.
func normalizeRootPath(value string) (string, string) {
  if value == "" {
    return "", "the root must not be empty."
  }
  if strings.TrimSpace(value) != value {
    return "", "the root must not have leading or trailing whitespace."
  }
  normalized := strings.ReplaceAll(value, "\\", "/")
  if strings.ContainsAny(normalized, "*?") {
    return "", "'" + value + "' is a glob; a root names one directory, and the patterns that select files inside it belong in 'files'."
  }
  if hasWindowsDrivePrefix(normalized) && !strings.HasPrefix(normalized[2:], "/") {
    return "", "'" + value + "' is drive-relative, so it resolves against whatever directory that drive currently sits on rather than against a stable base. Write the full path."
  }
  // A UNC share is cleaned by hand because `path.Clean` collapses its leading
  // `//` into one slash, which turns `//server/share` into an absolute path on
  // the local volume — a different location that still looks like the one that
  // was written.
  if strings.HasPrefix(normalized, "//") {
    normalized = "//" + strings.TrimPrefix(path.Clean(normalized), "/")
  } else {
    normalized = path.Clean(normalized)
  }
  if normalized == "." {
    return "", ""
  }
  // `path.Clean` reads a drive prefix as an ordinary segment and strips the
  // separator behind it, so `C:/` becomes `C:` — which the Windows path API
  // then calls relative and resolves against the project. The separator is
  // restored rather than the clean skipped, because a drive root is the one
  // directory whose separator is part of its identity.
  if len(normalized) == 2 && hasWindowsDrivePrefix(normalized) {
    return normalized + "/", ""
  }
  return normalized, ""
}
