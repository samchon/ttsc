package evidence

import (
  "errors"
  "io/fs"
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
  // base. It sits beside the derived Display because a message that names a
  // configuration property and a message that names a location want different
  // spellings; `populationRootLabel` owns that split and the reasoning for it.
  //
  // It arrives already normalized and is stored untouched. `normalizeRootPath`
  // owns that step, refusing the two forms a root may not take and reducing the
  // rest to one slash-separated spelling before a project identity exists to
  // resolve against — so a second normalization here would be a branch no
  // configuration can reach.
  Declared string
  // Display is what a location names: project-relative, ascending with `..`
  // when the base sits above the project, and absolute only when no relative
  // spelling exists, which on Windows is another volume or a UNC share against a
  // drive-lettered project. Empty for the default base, whose files are already
  // named by their project-relative path.
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
//
// The separator is added only where one is missing. A base with no relative
// spelling, which on Windows is another volume or a UNC share against a
// drive-lettered project, carries its absolute path as its Display, and a drive
// root is the one directory whose own separator is part of it: joining `D:/` to
// a path without this would print `D://requirements`, in every file location as
// well as in the two walk messages.
func (base populationBase) display(relative string) string {
  if base.Display == "" {
    return relative
  }
  if strings.HasSuffix(base.Display, "/") {
    return base.Display + relative
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
// location this rule prints is project-relative and a reader compares them
// against each other. An absolute path appears only when no relative one exists
// — a different Windows volume, or a UNC share against a drive-letter project —
// where the alternative would be no spelling at all.
//
// The `root` property a diagnostic asks an author to correct is the one printed
// path this no longer decides. `populationRootLabel` spells that as the
// configuration does, because it is a different reader doing a different thing:
// editing a file rather than opening one.
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
// `display` does, and which is project-relative wherever a relative spelling
// exists. A
// message naming a *configuration property* spells it the way the configuration
// does, because the author's first move is to search `lint.config.ts` for it —
// and the derived spelling of an absolute root is an ascending path that file
// does not contain.
//
// The absolute fallback belongs to the default base alone, which is the only
// base with no declared spelling, and the project root is then the only thing
// left to name. Of the four callers, two reach it: `unlistableBaseProblem` and
// `unresolvedBaseProblem`, both of which a base with no declared root can arrive
// at. `describePopulation` returns on the default base before it names anything,
// and `describeBaseDirectoryProblem` is only ever entered through
// `baseDirectoryProblem`, which does the same. Neither of the two that reach it
// asks for an edit to a property that is not there, which is what makes the
// spelling usable where no property exists.
func populationRootLabel(base populationBase) string {
  if base.Declared == "" {
    return filepath.ToSlash(base.Absolute)
  }
  return base.Declared
}

// baseDirectoryProblem reports a declared root that is not a usable directory.
//
// The observation and the sentence are separate functions because the sentence
// branches on the artifact kind as well as on what the stat found, while the
// observation is one call, and because only the sentence can be put in front of
// a reader without a filesystem in the state it describes.
//
// The name says neither "missing" nor "read". Not missing, because the path may
// be occupied by a file or hidden behind a parent this process may not enter,
// and both of those are present. Not read, because the third of its three
// callers materializes from the Program and reads nothing while asking the same
// question the two walkers ask.
//
// The default base is excluded because `Check` already validated the project
// root, and its diagnostic names the ttsc project identity as the repair rather
// than a configuration property that does not exist there.
func baseDirectoryProblem(base populationBase, kind artifactKind) string {
  if base.Default {
    return ""
  }
  info, err := os.Stat(base.Absolute)
  if err == nil && info.IsDir() {
    return ""
  }
  // A link with no target is the one state where the two calls disagree about
  // whether anything is there: `Stat` follows it and reports the target as
  // absent, while `Lstat` finds the link itself. Told to create a directory over
  // one, the author gets `EEXIST` and reads the same sentence again, which is
  // the repair this predicate exists to avoid.
  //
  // Only an absent answer is asked the second question. A loop, a parent that
  // denies traversal, a name the filesystem refuses, and a path too long each
  // already say something the rule cannot improve on, and promoting one here
  // would trade the operating system's own sentence for an assertion that a
  // non-directory is in the way, which is the guess the third state exists to
  // refuse. The second call is made only on the absent path, so an ordinary
  // root still costs one stat.
  //
  // `fs.ErrNotExist` is the whole of that test, and Windows answers it for more
  // than an absent path: `ERROR_BAD_NETPATH` maps to it, so a UNC root whose
  // server is unreachable reads as missing and is told to create a directory it
  // cannot create. That is the second concession of the same shape as a path
  // whose parent is a file, and it is left for the same reason: separating it
  // means reading errno numbers per platform inside a file whose whole subject
  // is that a path means the same thing on both.
  occupied := err == nil
  if errors.Is(err, fs.ErrNotExist) {
    if _, linkErr := os.Lstat(base.Absolute); linkErr == nil {
      occupied = true
    }
  }
  return describeBaseDirectoryProblem(base, kind, occupied, err)
}

// describeBaseDirectoryProblem says what a declared root turned out to be, and
// what to do about it.
//
// Three states reach it, and each one owns a repair the other two cannot be
// given. `occupied` says something that is not a directory is at the path, and
// `cause` is the stat's error when it had one. They are not exclusive: a link
// with no target occupies the path and fails the stat at once, and it is
// `occupied` that decides the sentence, because what the author has to do is
// replace what is there. `cause` is read only where `occupied` is false, which
// is the one shape the caller never produces without an error.
//
// `occupied` means the repair has to name what is in the way: told to "add that
// directory" over a file, an author follows the instruction, watches it fail,
// and reads the same sentence again. An absent path is created. A stat that
// failed for any other reason is the state where the rule does not know which
// of those two it is looking at, and it must not guess, because "create that
// directory" over a directory an unreadable parent is hiding is the same
// unfollowable repair a second time.
//
// The third repair therefore names no cause of its own. A permission is only
// the likeliest reason a stat fails without saying the path is absent; a name
// the filesystem refuses to spell, a path too long, and a link loop arrive the
// same way, and "make that path reachable" would be a guess in each of them.
// The operating system already wrote the reason one clause earlier.
//
// `fs.ErrNotExist` is what separates the second from the third, and the split
// is not identical on both platforms. A path whose parent is a file answers
// `ENOTDIR` on POSIX and a not-found error on Windows, so POSIX reads the
// filesystem's own reason while Windows offers "create that directory" over a
// path `mkdir -p` cannot create. Both lead clauses are true; that one repair
// clause is not followable, and it is left because separating it needs a stat
// of every ancestor on a path this rule otherwise touches once. "Correct the
// 'root' property" is offered first in both, and it is the repair that works.
//
// The Markdown and Prisma messages may still lead with "could not read",
// because the walk each of those callers is about to run is the read the root
// exists to serve, and it is skipped only because the root is not there.
//
// Both spellings appear, and only while they differ. The declared one is the
// property the author has to edit, and the resolved one is where that property
// actually landed, which is the whole question the moment a root ascends out of
// the project. Restating a path the declaration already names would offer it as
// an explanation of itself, which is why the test is the difference and not
// whether the root was absolute: a UNC spelling on POSIX is absolute and still
// differs, because `filepath.Clean` collapses its leading slashes there while
// Windows keeps the volume.
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
// nothing, which is the one conclusion an author must not draw here.
//
// Every repair clause that ends in a directory takes two steps, and that part
// is not about TypeScript at all. This stat is satisfied by an empty directory,
// so creating one silences the diagnostic and leaves the population exactly as
// empty, and for a claim that is worse than the diagnostic was, because an
// empty healthy claim deactivates without a word. Those branches therefore ask
// for what the directory must hold, and the split is disk against Program
// rather than one noun against another: the walkers want the sources on disk,
// and TypeScript wants them in the Program.
func describeBaseDirectoryProblem(
  base populationBase,
  kind artifactKind,
  occupied bool,
  cause error,
) string {
  unexaminable := !occupied && !errors.Is(cause, fs.ErrNotExist)
  label := populationRootLabel(base)
  // Two questions, two tests, and they are not the same one. Restating the
  // resolved path tells a reader something only where it differs from the label,
  // which almost every absolute declared root fails and a UNC spelling on POSIX
  // passes, because `filepath.Clean` collapses its leading slashes while the
  // declaration keeps them. Whether the project root was composed into the
  // spelling at all is a different question, it is what gates the clause that
  // says so, and only `declaredRootIsAbsolute` answers it.
  restate := label != filepath.ToSlash(base.Absolute)
  resolved := !declaredRootIsAbsolute(base.Declared)
  if unexaminable {
    message := "Evidence graph could not examine the " + string(kind) + " root '" + label + "'"
    if restate {
      message += ", which resolves to '" + filepath.ToSlash(base.Absolute) + "'"
    }
    message += ": " + causeText(cause) + ". Correct the 'root' property, or clear the condition the filesystem reported"
    if resolved {
      message += "; it resolves against the ttsc project root"
    }
    if kind != artifactTypeScript {
      return message + "."
    }
    return message + ". A " + string(kind) +
      " root is checked by this stat alone: it re-bases Program sources onto itself rather than scanning the filesystem."
  }
  message := "Evidence graph could not read the " + string(kind) + " root '" + label + "'"
  if kind == artifactTypeScript {
    message = "Evidence graph found no directory at the " + string(kind) + " root '" + label + "'"
  }
  if restate {
    message += ", which resolves to '" + filepath.ToSlash(base.Absolute) + "'"
  }
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
  if resolved {
    message += "it resolves against the ttsc project root, and "
  }
  if kind == artifactTypeScript {
    return message + "a " + string(kind) +
      " root re-bases Program sources onto itself rather than scanning the filesystem."
  }
  return message + "an empty directory leaves the population just as empty."
}

// resolvedBaseDirectory is the directory a base's files sit in, and reports
// whether the links naming it end at one.
//
// A declared root may be a link, and `os.Stat` accepts one as a directory when
// the gate reads it, so a consumer that then compares paths against the base has
// to compare against what the link names. The filesystem never needs this: it
// opens a path through any link transparently. A comparison does, because the
// two sides are strings and only one of them was spelled by this rule.
//
// Every component is resolved, not only the leaf. A link on an ancestor is
// exactly what `os.Lstat` of the leaf cannot see, and it is the shape a package
// manager installs: the workspace dependency is the link and the root an author
// declares is a directory inside it. Resolving only the leaf left that silent,
// which is what #1269 recorded.
//
// The answer is verified rather than trusted, at every component and not only
// at the last. `resolveLinkedDirectory` gives up after a fixed number of hops
// and returns the link it stopped on, while the stat in `baseDirectoryProblem`
// follows further on Linux and on Windows, so a long enough chain passes the
// gate and leaves whoever trusted the resolver holding a link. Asking only the
// leaf would miss it on an ancestor for the same reason `os.Lstat` does:
// traversal through a link is transparent, so the remaining components still
// name a real directory and the last stat says so. Darwin and the BSDs stop at
// the same number of hops, so for a declared root the gate answers first and
// the refusal is unreachable there. The default base is not gated at all,
// because `baseDirectoryProblem` returns on it without stat'ing anything, so a
// walker reaches this refusal for the project root on every platform.
//
// A base that is not a link costs one `os.Lstat` per path component plus one
// for this answer, where resolving the leaf alone cost two. It is paid per call
// rather than per file, and the call count is the graph's own shape rather than
// this function's: claim-side populations are materialized before the whole
// configuration, so a base is asked once for each load it appears in. That is
// at most twice for a Markdown or Prisma claim base and once for its reference
// bases, and twice those numbers for TypeScript, whose gate asks beside the
// pass that builds its match table and whose governance pass builds one more
// from the configuration as declared. All of it stays off the loop this feeds,
// which is every source file of the project.
func resolvedBaseDirectory(base populationBase) (string, bool) {
  from, resolved := resolveLinkedPath(base.Absolute)
  if !resolved {
    return from, false
  }
  info, err := os.Lstat(from)
  return from, err == nil && info.IsDir()
}

// resolveLinkedPath resolves a link at any component of an absolute path.
//
// `filepath.EvalSymlinks` does this in one call and cannot be used, for the
// reason `resolveLinkedDirectory` exists at all: it returns a Windows junction
// unchanged, which is the link a package manager creates there. So the walk is
// by hand, and it asks the same resolver at every prefix.
//
// The volume is taken off first and never split. A Windows drive root and a UNC
// share are one component whose separator is part of them, and joining their
// pieces back would name a different location, which is the same hazard
// `normalizeRootPath` hand-cleans for a declared spelling. A base that is the
// share itself has nothing left to walk, and it returns unchanged rather than
// gaining the separator this walk starts from: a spelling that differs from
// the base by one character resolves to the same directory and compares as
// though it did not, so every consumer would pay the second spelling forever
// on a path with no link in it.
//
// A component whose chain outran the resolver ends the walk. Joining the rest
// onto it would produce a path the filesystem opens and every string
// comparison misses, which is #1269 exactly, one component further up than the
// case that opened it.
func resolveLinkedPath(absolute string) (string, bool) {
  volume := filepath.VolumeName(absolute)
  rest := absolute[len(volume):]
  current := volume + string(filepath.Separator)
  walked := false
  for _, segment := range strings.Split(filepath.ToSlash(rest), "/") {
    if segment == "" {
      continue
    }
    walked = true
    resolved, settled := resolveLinkedDirectory(filepath.Join(current, segment))
    if !settled {
      return filepath.FromSlash(resolved), false
    }
    current = resolved
  }
  if !walked {
    return filepath.Clean(absolute), true
  }
  return filepath.FromSlash(current), true
}

// unresolvedBaseProblem reports a base whose links this rule stops following
// before they reach a directory.
//
// The chain may be the root itself or any directory above it, so the sentence
// says the path passes through one rather than that it is one. Naming the
// component would be more precise and is deliberately not done: this message
// already carries the declared spelling and, where they differ, the path it
// resolves to, and a third path would cost more to read than the component
// buys — the repair is the same wherever on the path the chain sits.
//
// Every artifact kind gets this sentence, because the failure is the resolver's
// bound rather than anything a walk or a Program does, and the kind appears only
// as the noun. The verb stays clear of "resolve" for the reason
// `describeBaseDirectoryProblem` records: that word is composition everywhere
// else in these messages, and a lead clause borrowing it for failure would make
// one sentence carry both senses.
//
// The default base is named and repaired differently, because it declared no
// `root` and telling its author to correct that property sends them looking for
// a line their configuration does not contain. It is the ttsc project root, so
// it is named as one and the repair is the invocation.
func unresolvedBaseProblem(base populationBase, kind artifactKind) string {
  label := populationRootLabel(base)
  message := "Evidence graph found no directory at the end of the "
  if base.Default {
    message += "ttsc project root '" + label + "'"
  } else {
    message += string(kind) + " root '" + label + "'"
  }
  // The resolved path is restated only when it differs from the label, which is
  // the whole question: an absolute declared root and the default base both name
  // the path they landed on, while a UNC spelling on POSIX does not, because
  // `filepath.Clean` collapses its leading slashes and the two genuinely differ.
  // `describeBaseDirectoryProblem` makes the same test for the same reason.
  if resolved := filepath.ToSlash(base.Absolute); label != resolved {
    message += ", which resolves to '" + resolved + "'"
  }
  message += ". That path passes through a chain of links longer than this rule follows. "
  if base.Default {
    return message + "Run ttsc against the directory those links end at."
  }
  return message + "Correct the 'root' property to name the directory those links end at."
}

// causeText spells a reason for a sentence that owns its own terminator.
//
// Windows ends its messages with a period and POSIX does not, so a rule that
// appends one prints "denied.. Correct the" on the one platform and "denied.
// Correct the" on the other, over the same failure. The terminator belongs to
// the sentence this rule writes, and the reason belongs to whoever wrote it, so
// only the punctuation is taken.
//
// The reason may come from the filesystem, a subprocess, or this rule's own
// inner validation. Only the trim happens here; the sentence supplies its
// terminator, which is what lets a quoted glob error that writes none end with
// one instead of ending bare.
func causeText(cause error) string {
  return causeReason(cause.Error())
}

// causeReason is the same rule for a failure already reduced to text. A package
// entry read, a package walk, and a package source read take a string from the
// loader, and the Prisma and Swagger bridges hand back a parser's own sentence,
// so those five sites reach the rule this way rather than through an error.
func causeReason(text string) string {
  return strings.TrimSuffix(text, ".")
}

// unlistableBaseProblem reports a population whose own base could not be
// listed.
//
// This is a different finding from the entry-level one below, and the
// difference is the whole population. An entry the walk could not read costs
// the units in it; a base the walk could not list costs every unit there is,
// and reporting it through the per-entry line would name the base as though it
// were one file inside itself. Both walkers reach it through the error their
// callback returns for that one path, which is what ends the walk and brings
// the failure back here.
//
// The base is named by its configuration spelling rather than by a location,
// because that is the property an author edits, and because a base with no
// declared root has no other name than where it is.
//
// One cause reaches this: a listing the filesystem refused. A chain of links the
// resolver stops following used to arrive here as well and has its own sentence
// now, because that failure is the resolver's bound and this repair is about
// access.
func unlistableBaseProblem(
  base populationBase,
  sources string,
  cause error,
) string {
  return "Evidence graph could not walk " + sources + " root '" + populationRootLabel(base) +
    "': " + causeText(cause) + ". Make that root a directory this process can list, so its configured " +
    sources + " sources can be indexed."
}

// unreadableEntryProblem decides whether a walk failure inside a population
// belongs to it, and spells it if it does.
//
// The Markdown and Prisma walkers share it because they are otherwise one
// decision written twice, and its two halves fail differently. Reporting a path
// no configured glob reaches turns an unrelated permission on an unrelated
// directory into a build error; printing the path the walker was handed spells
// it the way the filesystem API does rather than the way the rest of the loader
// spells every path beside it.
//
// `reads` is the population's own membership question, which is the only part
// that differs by artifact kind. `from` is the directory the walk started at,
// which is the base unless the base is a link, and it is what a callback path
// is measured against; the spelling still comes from the base, so a reader sees
// the root they declared either way. The base itself never arrives here: it is
// not one entry among many, and each walker answers it before this is asked.
func unreadableEntryProblem(
  base populationBase,
  from string,
  sources string,
  current string,
  cause error,
  reads func(relative string) bool,
) (string, bool) {
  relative, ok := relativeProjectPath(from, current)
  if !ok || !reads(relative) {
    return "", false
  }
  return unreadableWalkEntryProblem(base, relative, sources, cause), true
}

// unreadableWalkEntryProblem names one path a population walk could not
// inspect.
//
// The path a `filepath.WalkDir` callback receives is the OS-native absolute
// one, and printing it as it arrives made this the only line in either walker
// spelled with backslashes on Windows, against globs, a root, and file
// locations that all pass through `filepath.ToSlash`. A reader compares them
// against each other, so the walker composes the base-relative path it already
// holds through the same `display` a loaded file's own message uses.
//
// The cause is passed through as the filesystem wrote it. It may embed an
// OS-native absolute path of its own, and rewriting a sentence this rule did
// not author is a different claim than spelling its own paths one way.
func unreadableWalkEntryProblem(
  base populationBase,
  relative string,
  sources string,
  cause error,
) string {
  return "Evidence graph could not inspect '" + base.display(relative) +
    "': " + causeText(cause) + ". Fix filesystem access so configured " + sources +
    " sources can be indexed."
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
