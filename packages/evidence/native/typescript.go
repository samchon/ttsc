package evidence

import (
	"path/filepath"
	"sort"
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"
)

func loadTypeScriptInventories(
	root string,
	sources []*shimast.SourceFile,
	config graphConfig,
) map[string]*artifactInventory {
	inventories := map[string]*artifactInventory{}
	extendTypeScriptInventories(root, sources, config, inventories)
	return inventories
}

// extendTypeScriptInventories adds only populations the caller has not already
// scanned.
//
// Graph activation first needs each TypeScript claim's own population, before
// it is allowed to inspect that claim's references. Once active claims are
// known, this second pass adds their reference bases without rescanning the
// claim bases already materialized.
func extendTypeScriptInventories(
	root string,
	sources []*shimast.SourceFile,
	config graphConfig,
	inventories map[string]*artifactInventory,
) {
	bases := configuredBases(config, artifactTypeScript)
	for _, file := range sources {
		if file == nil || !isTypeScriptPath(file.FileName()) {
			continue
		}
		for _, base := range bases {
			relative, ok := relativeProjectPath(base.Absolute, file.FileName())
			if !ok || !isTypeScriptPath(relative) {
				continue
			}
			address := base.addressOf(relative)
			if inventories[address.Key] != nil {
				continue
			}
			inventories[address.Key] = typeScriptInventories.scan(address, file)
		}
	}
}

// isTypeScriptPath is asked once per source file per configured base on every
// rebuild, so it compares the suffix in place rather than lowercasing the whole
// path into a fresh string to answer four fixed questions.
func isTypeScriptPath(path string) bool {
	for _, suffix := range []string{".ts", ".tsx", ".mts", ".cts"} {
		if len(path) >= len(suffix) &&
			strings.EqualFold(path[len(path)-len(suffix):], suffix) {
			return true
		}
	}
	return false
}

func relativeProjectPath(root string, absolute string) (string, bool) {
	if root == "" || absolute == "" {
		return "", false
	}
	// A source file usually sits below the base that is asking, spelled the same
	// way. Answering that from the two strings keeps the general path machinery
	// off a loop that runs once per file per base on every rebuild.
	if inside, ok := containedProjectPath(root, absolute); ok {
		return inside, true
	}
	relative, err := filepath.Rel(root, absolute)
	if err != nil {
		return "", false
	}
	relative = strings.ReplaceAll(relative, "\\", "/")
	if relative == ".." || strings.HasPrefix(relative, "../") {
		return "", false
	}
	return strings.TrimPrefix(relative, "./"), true
}

// containedProjectPath answers the ordinary case of one path sitting below
// another: same spelling, one separator between them, and nothing left to
// normalize. It declines anything else so the general form still decides.
//
// The prefix comparison is exact rather than case-insensitive, because the
// general form is `filepath.Rel`, which is lexical and case-sensitive on every
// platform. Folding case here would admit a differently-cased sibling that the
// path this shortcut stands in for rejects.
func containedProjectPath(root string, absolute string) (string, bool) {
	if len(absolute) <= len(root)+1 ||
		absolute[:len(root)] != root {
		return "", false
	}
	if separator := absolute[len(root)]; separator != '/' && separator != '\\' {
		return "", false
	}
	relative := absolute[len(root)+1:]
	if strings.ContainsRune(relative, '\\') {
		return "", false
	}
	for segment := range strings.SplitSeq(relative, "/") {
		if segment == "" || segment == "." || segment == ".." {
			return "", false
		}
	}
	return relative, true
}

func scanTypeScriptInventory(
	path string,
	file *shimast.SourceFile,
) *artifactInventory {
	return scanTypeScriptInventoryAt(artifactAddress{
		Base:     populationBase{Default: true},
		Relative: path,
		Display:  path,
		Key:      path,
	}, file)
}

func scanTypeScriptInventoryAt(
	address artifactAddress,
	file *shimast.SourceFile,
) *artifactInventory {
	inventory := &artifactInventory{
		Address:   address.Key,
		Path:      address.Display,
		Type:      artifactTypeScript,
		Imports:   collectImportBindings(file),
		Exports:   collectModuleExports(file),
		UnitNodes: map[string][]*shimast.Node{},
	}
	supportedHosts := map[*shimast.Node]symbolSet{}
	unitsByID := map[string]*evidenceUnit{}
	collectTypeScriptStatements(
		file,
		file.Statements,
		nil,
		"",
		inventory,
		supportedHosts,
		unitsByID,
		file.IsDeclarationFile,
		false,
		false,
		"",
	)
	withdrawHiddenHosts(inventory, supportedHosts)
	collectTypeScriptDeclarations(
		file,
		address.Key,
		address.Display,
		inventory,
		supportedHosts,
	)
	// Policy evaluation needs semantic host IDs, not the AST node associations
	// used to derive them. Declarations now retain those IDs directly, so release
	// the transient index before this inventory enters the immutable graph.
	inventory.UnitNodes = nil
	sort.Slice(inventory.Units, func(left int, right int) bool {
		if inventory.Units[left].Target != inventory.Units[right].Target {
			return inventory.Units[left].Target < inventory.Units[right].Target
		}
		return inventory.Units[left].Line < inventory.Units[right].Line
	})
	return inventory
}

// withdrawHiddenHosts takes every declaration of a withdrawn identity out of
// the host set, once materialization has decided which identities are withdrawn.
//
// Withdrawal is a property of the **identity**, while `supportedHosts` is filled
// in one node at a time by whichever collector walked that container. Those two
// facts disagree whenever an identity spans more than one declaration and the
// author tagged only one of them, which is every overload run and every merged
// interface: the unit came out marked, and the untagged sibling stayed a host,
// so a declaration the author had taken out of the API went on discharging
// coverage and acting as an exclusion carrier. Measured on both shapes; both
// were silent, because the unit really was marked.
//
// Reconciling here rather than in each collector is what turns a list of
// witnesses into one rule. A per-container withdrawal index closes the container
// it indexes and nothing else, and there is one such container per declaration
// form. This runs once, over the identities the whole file produced, so it
// reaches a form nobody has written yet — but only as far as that form's
// unit-to-node association goes, which is the condition below and the one place
// this is not yet a closed class.
//
// A position is given up only when **every** identity that reaches it is
// withdrawn. One node can host several: `export var price: number, live:
// number` is two property identities sharing the statement TypeScript attaches
// their block to, and withdrawing one of them must not take the other's only
// host position with it. Judging per node alone did exactly that, and refused a
// citation on a public declaration nobody had tagged. The exemplar is `var`
// rather than `const` because a partial withdrawal needs a second declaration
// of one identity, which for `const` is `TS2451`.
//
// What this cannot reach is a host node no unit records, so a form that
// registers a position owes that position to its unit. The variable declarator
// was the one that did not, and a withdrawn variable identity kept it until
// `collectTypeScriptVariables` began recording it. `documentedHosts` filters on
// the same association and was measured to answer identically either way, since
// it takes the first of a unit's *host* nodes and a declarator is a host only
// when its statement is one for the same symbol; the invariant is what was
// broken there rather than an observable answer.
//
// A second fault travelled
// with that one and has its own cause, which is why they are stated apart: a
// withdrawal tag read from a container is not the tag of the declarations
// inside it, so an inner declarator owes its own read, and recording the node
// would have left that exactly where it was.
//
// `documentedHosts` needs no equivalent: it skips a withdrawn unit before it
// ever consults the host set.
func withdrawHiddenHosts(
	inventory *artifactInventory,
	supportedHosts map[*shimast.Node]symbolSet,
) {
	type hostPosition struct {
		node   *shimast.Node
		symbol string
	}
	live := map[hostPosition]bool{}
	withdrawn := map[hostPosition]bool{}
	for _, unit := range inventory.Units {
		for _, node := range inventory.UnitNodes[unit.ID] {
			position := hostPosition{node: node, symbol: unit.Symbol}
			if unit.Hidden == "" {
				live[position] = true
				continue
			}
			withdrawn[position] = true
		}
	}
	for position := range withdrawn {
		if live[position] {
			continue
		}
		hosts := supportedHosts[position.node]
		if hosts == nil {
			continue
		}
		delete(hosts, position.symbol)
		if len(hosts) == 0 {
			delete(supportedHosts, position.node)
		}
	}
}

// collectTypeScriptStatements materializes the public units one statement list
// declares.
//
// hidden carries the documentation tag by which an enclosing declaration
// withdrew itself from the public surface. It is inherited rather than
// recomputed, which is what makes `@internal` on a namespace reach every member
// beneath it without each member repeating the tag.
func collectTypeScriptStatements(
	file *shimast.SourceFile,
	statements *shimast.NodeList,
	prefix []string,
	parentID string,
	inventory *artifactInventory,
	supportedHosts map[*shimast.Node]symbolSet,
	unitsByID map[string]*evidenceUnit,
	ambientContext bool,
	implicitlyExported bool,
	typeOnlyProjection bool,
	hidden string,
) {
	if statements == nil {
		return
	}
	exports := collectLocalExportNames(statements)
	hiddenNames := collectHiddenDeclarationNames(file, statements)
	// Built on the first namespace this list holds rather than up front, so a
	// file declaring none pays nothing.
	var functionNames map[string]bool
	// The same, for the class an interface in this list may merge with.
	var classNames map[string]bool
	for _, statement := range statements.Nodes {
		if statement == nil {
			continue
		}
		switch statement.Kind {
		case shimast.KindInterfaceDeclaration:
			name := declarationName(statement.Name())
			if name == "" {
				continue
			}
			targets := publicTypeScriptExports(
				statement,
				name,
				exports,
				true,
				implicitlyExported,
			)
			if len(targets) == 0 {
				continue
			}
			memberHidden := hidingTagFor(hidden, hiddenNames, name)
			if memberHidden == "" {
				addTypeScriptHost(supportedHosts, statement, "type")
			}
			// An interface merged with a class declares that class's instance
			// members, so they take the instance address the class body form takes.
			// Addressing them from the bare name instead published `Sale.charge` for
			// a member reached as `Sale.prototype.charge`: a path no consumer can
			// walk, a second unit for a method the class already declared, and an
			// obligation that stayed owed however the real member was cited.
			//
			// The merge also brings the type-only rule with it. The members of an
			// interface no class merges with are type-space and project through a
			// type-only alias, a namespace or function partner included, but a
			// class-merged one's are reached through the class value that alias does
			// not expose, which is the address the class branch is already
			// suppressed for. Publishing them here would breach that guard at
			// exactly the address it exists to keep empty. What `target.TypeOnly`
			// reaches, and what it does not, is stated once on the class branch this
			// guard mirrors.
			if classNames == nil {
				classNames = collectClassDeclarationNames(statements)
			}
			mergedWithClass := classNames[name]
			for _, target := range targets {
				identity := qualifyTypeScriptName(prefix, target.Public)
				unit := addTypeScriptUnit(
					inventory,
					unitsByID,
					statement,
					"type",
					identity,
					parentID,
					memberHidden,
				)
				memberOwner := identity
				if mergedWithClass {
					if typeOnlyProjection || target.TypeOnly {
						continue
					}
					memberOwner = qualifyTypeScriptName(identity, "prototype")
				}
				collectPropertyMembers(
					file,
					statement.AsInterfaceDeclaration().Members,
					memberOwner,
					unit.ID,
					inventory,
					supportedHosts,
					unitsByID,
					memberHidden,
					// Only the class merge makes these value-space. An interface's own
					// members are type-space and a type-only export publishes them.
					mergedWithClass,
				)
			}
		case shimast.KindTypeAliasDeclaration:
			name := declarationName(statement.Name())
			if name == "" {
				continue
			}
			targets := publicTypeScriptNames(
				statement,
				name,
				exports,
				true,
				implicitlyExported,
			)
			if len(targets) == 0 {
				continue
			}
			memberHidden := hidingTagFor(hidden, hiddenNames, name)
			if memberHidden == "" {
				addTypeScriptHost(supportedHosts, statement, "type")
			}
			alias := statement.AsTypeAliasDeclaration()
			for _, name := range targets {
				identity := qualifyTypeScriptName(prefix, name)
				unit := addTypeScriptUnit(
					inventory,
					unitsByID,
					statement,
					"type",
					identity,
					parentID,
					memberHidden,
				)
				if alias.Type != nil && alias.Type.Kind == shimast.KindTypeLiteral {
					collectPropertyMembers(
						file,
						alias.Type.AsTypeLiteralNode().Members,
						identity,
						unit.ID,
						inventory,
						supportedHosts,
						unitsByID,
						memberHidden,
						false,
					)
				}
			}
		case shimast.KindFunctionDeclaration:
			if typeOnlyProjection {
				continue
			}
			name := declarationName(statement.Name())
			if name == "" {
				continue
			}
			targets := publicTypeScriptNames(
				statement,
				name,
				exports,
				false,
				implicitlyExported,
			)
			if len(targets) == 0 {
				continue
			}
			memberHidden := hidingTagFor(hidden, hiddenNames, name)
			if memberHidden == "" {
				addTypeScriptHost(supportedHosts, statement, "function")
			}
			for _, name := range targets {
				addTypeScriptUnit(
					inventory,
					unitsByID,
					statement,
					"function",
					qualifyTypeScriptName(prefix, name),
					parentID,
					memberHidden,
				).markSpace(true)
			}
		case shimast.KindVariableStatement:
			if typeOnlyProjection {
				continue
			}
			memberHidden := typeScriptHidingTag(file, statement, hidden)
			for symbol := range collectTypeScriptVariables(
				file,
				statement,
				prefix,
				parentID,
				exports,
				inventory,
				supportedHosts,
				unitsByID,
				implicitlyExported,
				memberHidden,
			) {
				if memberHidden != "" {
					continue
				}
				// TypeScript attaches the leading JSDoc of
				// a variable declaration to the statement wrapper.
				addTypeScriptHost(supportedHosts, statement, symbol)
			}
		case shimast.KindClassDeclaration:
			name := declarationName(statement.Name())
			if name == "" {
				continue
			}
			// A class name is type-space, so a type-only alias exposes it exactly
			// as it exposes an interface. What the alias withholds is the members:
			// `C.prototype.field` and `C.staticField` are paths through the class
			// *value*, and a type-only alias exposes no value to walk them from.
			//
			// This guard answers an export written in this file, where the
			// declaration kind is in hand: `target.TypeOnly` sees `export type { C }`
			// and `export { type C }` alike, and `typeOnlyProjection` sees a
			// type-only alias of an enclosing namespace. A re-export naming another
			// module has no such context and is answered at traversal time instead,
			// from `evidenceUnit.ValueSpace`, which is why these members are marked
			// there. The interface branch mirrors this guard for a class-merged
			// interface and points here for the reason.
			targets := publicTypeScriptExports(
				statement,
				name,
				exports,
				true,
				implicitlyExported,
			)
			if len(targets) == 0 {
				continue
			}
			memberHidden := hidingTagFor(hidden, hiddenNames, name)
			if memberHidden == "" {
				addTypeScriptHost(supportedHosts, statement, "type")
			}
			for _, target := range targets {
				identity := qualifyTypeScriptName(prefix, target.Public)
				unit := addTypeScriptUnit(
					inventory,
					unitsByID,
					statement,
					"type",
					identity,
					parentID,
					memberHidden,
				)
				if typeOnlyProjection || target.TypeOnly {
					continue
				}
				collectClassMembers(
					file,
					statement,
					identity,
					unit.ID,
					inventory,
					supportedHosts,
					unitsByID,
					memberHidden,
				)
			}
		case shimast.KindModuleDeclaration:
			name := declarationName(statement.Name())
			targets := publicTypeScriptExports(
				statement,
				name,
				exports,
				true,
				implicitlyExported,
			)
			if len(targets) == 0 {
				continue
			}
			memberHidden := hidingTagFor(hidden, hiddenNames, name)
			if memberHidden == "" {
				addTypeScriptHost(supportedHosts, statement, "type")
			}
			// A namespace merged with a same-named function is that function's
			// static side, not an independent container. `get.path` is a
			// property of the `get` function value and `get.Output` is the type
			// its own signature spells; neither is authored contract, so the
			// merged namespace contributes its identity and nothing beneath it.
			// Selecting those members is also what promoted the namespace to an
			// addressable aggregate scope, where it collided with the function
			// unit of the same name and left the accessor with no spelling that
			// resolves.
			if functionNames == nil {
				functionNames = collectFunctionDeclarationNames(statements)
			}
			staticSide := functionNames[name]
			for _, target := range targets {
				identity := qualifyTypeScriptName(prefix, target.Public)
				unit := addTypeScriptUnit(
					inventory,
					unitsByID,
					statement,
					"type",
					identity,
					parentID,
					memberHidden,
				)
				if !staticSide {
					collectTypeScriptModule(
						file,
						statement,
						identity,
						unit.ID,
						inventory,
						supportedHosts,
						unitsByID,
						ambientContext,
						typeOnlyProjection || target.TypeOnly,
						memberHidden,
					)
				}
			}
		}
	}
}

// collectFunctionDeclarationNames indexes the local names a statement list
// declares as functions, which is what a namespace in the same list merges with.
//
// A namespace merges only with a function, a class, or an enum in the same
// scope; a `const` or `let` of the same name is `TS2451`, measured against the
// pinned compiler. Only the function partner makes the namespace a static side
// that materializes nothing. A class partner keeps its namespace, because a
// companion namespace beside a class is authored contract — `namespace Sale`
// holding `Sale.IProps` beside `class Sale` — rather than the generated
// accessor machinery `get.path` and `get.Output` are. The collector has no enum
// case, so an enum partner reaches nothing either way.
//
// The name alone decides, without consulting export modifiers, because
// TypeScript refuses a merged declaration whose halves disagree on export
// (`TS2395`, measured). The whole list is indexed rather than only the
// statements already collected, because merging does not depend on which
// declaration is written first.
func collectFunctionDeclarationNames(
	statements *shimast.NodeList,
) map[string]bool {
	names := map[string]bool{}
	if statements == nil {
		return names
	}
	for _, statement := range statements.Nodes {
		if statement == nil ||
			statement.Kind != shimast.KindFunctionDeclaration {
			continue
		}
		if name := declarationName(statement.Name()); name != "" {
			names[name] = true
		}
	}
	return names
}

// collectClassDeclarationNames indexes the local names a statement list
// declares as classes, which is what an interface in the same list merges with.
//
// The merge is what decides a member's address rather than its kind. An
// interface merged with a class describes that class's instance side, so
// `interface Sale { charge(): void }` beside `class Sale` declares the same
// member the class body would and takes the same `Sale.prototype.charge`
// address. A namespace is the other partner and adds statics instead, which is
// why only the interface case moves.
//
// The whole list is indexed rather than only the statements already collected,
// because merging does not depend on which declaration is written first, and
// export modifiers are not consulted for the reason
// `collectFunctionDeclarationNames` gives: TypeScript refuses a merge whose
// halves disagree on export.
func collectClassDeclarationNames(
	statements *shimast.NodeList,
) map[string]bool {
	names := map[string]bool{}
	if statements == nil {
		return names
	}
	for _, statement := range statements.Nodes {
		if statement == nil ||
			statement.Kind != shimast.KindClassDeclaration {
			continue
		}
		if name := declarationName(statement.Name()); name != "" {
			names[name] = true
		}
	}
	return names
}

// collectTypeScriptVariables materializes a variable statement's exported
// declarators.
//
// A variable is a function only when a `const` is initialized with a function
// value, and that is the inverse of the member rule in memberSymbol:
// here the annotation decides nothing, because a variable's declared type
// describes a value that already exists rather than stating a contract. The
// three conditions below are each load-bearing and each measured separately, at
// module and at namespace scope: a binding pattern's initializer belongs to the
// pattern rather than to any leaf, `let` and `var` are excluded whatever they
// hold, and the initializer is read syntactically because these rules run with
// no type checker.
// A declarator is both a host position and a unit node, and it has to be both.
// It was only the first: `supportedHosts` held it while no unit recorded it, so
// nothing that walks from a unit to its declarations could see it. Two answers
// were wrong and both were silent. `withdrawHiddenHosts` could not take the
// position away from a withdrawn identity, so a declaration the author had
// removed from the API went on discharging coverage and carrying exclusions.
// And a citation written on it resolved to no semantic host, so
// `singleEvidencePerSymbol` counted the statement's identities as citing zero
// units while the same run reported the obligation satisfied.
//
// A third consumer reads the same association and was measured to answer
// identically either way. `hostNodesOf` keeps a unit's host nodes and takes the
// first, and a declarator is a host only when its statement is one for the same
// symbol, so `evidence/documented` always had the wrapper to look at. The
// invariant was broken there rather than the answer, which is reason enough:
// the next declaration form to register a position will not be so lucky.
//
// Its own withdrawal tag is read here for a separate fault rather than the same
// one: the statement wrapper's tag was taken for every declarator it holds, so
// `@internal` written on an inner declarator withdrew nothing. Recording the
// node closes the first two and leaves this one standing, which is why #1126
// states them apart.
func collectTypeScriptVariables(
	file *shimast.SourceFile,
	statement *shimast.Node,
	prefix []string,
	parentID string,
	exports map[string][]exportedName,
	inventory *artifactInventory,
	supportedHosts map[*shimast.Node]symbolSet,
	unitsByID map[string]*evidenceUnit,
	implicitlyExported bool,
	hidden string,
) symbolSet {
	variable := statement.AsVariableStatement()
	if variable.DeclarationList == nil {
		return nil
	}
	list := variable.DeclarationList.AsVariableDeclarationList()
	if list.Declarations == nil {
		return nil
	}
	found := symbolSet{}
	for _, declaration := range list.Declarations.Nodes {
		if declaration == nil {
			continue
		}
		value := declaration.AsVariableDeclaration()
		symbol := "property"
		if !shimast.IsBindingPattern(declaration.Name()) &&
			shimast.IsConst(declaration) &&
			isFunctionValue(value.Initializer) {
			symbol = "function"
		}
		declaratorHidden := typeScriptHidingTag(file, declaration, hidden)
		for _, binding := range bindingIdentifierNodes(declaration.Name()) {
			name := declarationName(binding)
			targets := publicTypeScriptNames(
				statement,
				name,
				exports,
				false,
				implicitlyExported,
			)
			if len(targets) == 0 {
				continue
			}
			if declaratorHidden == "" {
				addTypeScriptHost(supportedHosts, declaration, symbol)
			}
			for _, name := range targets {
				unit := addTypeScriptUnit(
					inventory,
					unitsByID,
					binding,
					symbol,
					qualifyTypeScriptName(prefix, name),
					parentID,
					declaratorHidden,
				)
				// The binding names the unit, but TypeScript attaches a
				// variable's leading JSDoc to the statement wrapper, so that
				// is where a citation for this unit actually lives. The
				// declarator is recorded too, because it is a host position and
				// every consumer that walks a unit's nodes has to reach it.
				unit.markSpace(true)
				inventory.recordUnitNode(unit.ID, statement)
				inventory.recordUnitNode(unit.ID, declaration)
			}
			found[symbol] = true
		}
	}
	return found
}

// collectClassMembers materializes the public contract a class declares.
//
// A method is a function unit and a field is a property unit, which is the
// mapping a reader already assumes: the class is the subject, its methods are
// what the subject does, and its fields are the measured facts it carries.
// `memberSymbol` owns the one exception, where a field written as a
// callable joins the methods, and "written as" is literal: see
// `isDirectFunctionType`.
// Every member hangs below the class unit, so a citation on the class
// acknowledges the members it selected.
//
// A constructor is not a unit of its own, now that the class is: construction
// is how the subject comes to be, and the subject already carries that
// obligation. It is still read, because the fields it declares through the
// parameter-property shorthand are the class's fields; `collectParameterProperties`
// takes those.
//
// Two shapes stay out entirely. An accessor, including an auto-accessor, is a
// get/set pair rather than a member variable, which is the exclusion the
// published contract has always stated. A member with no citable name — a
// private identifier, an index signature, a computed name, a static block — has
// no target an author could write.
func collectClassMembers(
	file *shimast.SourceFile,
	statement *shimast.Node,
	classIdentity []string,
	classID string,
	inventory *artifactInventory,
	supportedHosts map[*shimast.Node]symbolSet,
	unitsByID map[string]*evidenceUnit,
	hidden string,
) {
	class := statement.AsClassDeclaration()
	if class.Members == nil {
		return
	}
	// A member's own tag is read from the node in hand, and that is enough for
	// the unit: `addTypeScriptUnit` keeps the first tag any declaration of an
	// identity carries, so an overload run tagged on one half comes out marked
	// whichever half is written first. The host set is reconciled against those
	// identities afterwards by `withdrawHiddenHosts`, which is what stops the
	// untagged half of a withdrawn member from staying a claim host.
	//
	// The constructor is resolved separately and up front, because it is the one
	// container here that declares units without being one: its tag has to reach
	// the parameter properties rather than a member of its own, and no unit of
	// its own will carry it there.
	constructorHidden := ""
	constructorResolved := false
	for _, member := range class.Members.Nodes {
		if member == nil {
			continue
		}
		// A constructor is judged before the public check, because its own
		// visibility is not its parameter properties'. A `private constructor`
		// closes construction from outside; `public readonly price` on one of its
		// parameters is still an instance field every holder of the object reads.
		if member.Kind == shimast.KindConstructor {
			// Resolved once per class rather than per declaration, so an overload
			// run does not rescan the member list for every signature it holds.
			if !constructorResolved {
				constructorHidden = constructorHidingTag(file, class.Members, hidden)
				constructorResolved = true
			}
			collectParameterProperties(
				file,
				member,
				classIdentity,
				classID,
				inventory,
				supportedHosts,
				unitsByID,
				constructorHidden,
			)
			continue
		}
		if !isPublicClassMember(member) {
			continue
		}
		symbol := ""
		switch member.Kind {
		case shimast.KindMethodDeclaration:
			symbol = "function"
		case shimast.KindPropertyDeclaration:
			if member.ModifierFlags()&shimast.ModifierFlagsAccessor != 0 {
				continue
			}
			property := member.AsPropertyDeclaration()
			symbol = memberSymbol(property.Initializer, property.Type)
		default:
			continue
		}
		addClassMemberUnit(
			member,
			declarationName(member.Name()),
			symbol,
			shimast.GetCombinedModifierFlags(member)&shimast.ModifierFlagsStatic != 0,
			classIdentity,
			classID,
			inventory,
			supportedHosts,
			unitsByID,
			typeScriptHidingTag(file, member, hidden),
		)
	}
}

// collectParameterProperties materializes the fields a constructor declares
// through the parameter-property shorthand.
//
// `constructor(public readonly price: number)` declares the same public
// instance field as `readonly price: number` written in the class body, and
// TypeScript attaches a leading documentation block to the parameter, so it is
// a real position a citation can live in. Reading only `class.Members` would
// leave the shorthand invisible while the body form was selected, which is one
// defect wearing two syntaxes.
//
// Every parameter property is an instance field. A constructor cannot be
// static, and TypeScript refuses a parameter property on an overload
// signature, so the implementation constructor is the only one that reaches
// here with any.
//
// The tag `hidden` carries is the constructor's, already resolved across every
// declaration of it by `constructorHidingTag`. The constructor is the only
// container in this collector that declares units without being one, so
// forwarding the class's tag alone would leave `@internal` on a constructor
// inert while the same tag on a class or on the field itself withdraws.
func collectParameterProperties(
	file *shimast.SourceFile,
	constructor *shimast.Node,
	classIdentity []string,
	classID string,
	inventory *artifactInventory,
	supportedHosts map[*shimast.Node]symbolSet,
	unitsByID map[string]*evidenceUnit,
	hidden string,
) {
	if constructor.ParameterList() == nil {
		return
	}
	for _, parameter := range constructor.Parameters() {
		if parameter == nil || !isParameterProperty(parameter) {
			continue
		}
		if !isPublicClassMember(parameter) {
			continue
		}
		value := parameter.AsParameterDeclaration()
		addClassMemberUnit(
			parameter,
			declarationName(parameter.Name()),
			memberSymbol(value.Initializer, value.Type),
			false,
			classIdentity,
			classID,
			inventory,
			supportedHosts,
			unitsByID,
			// A parameter property is declared exactly once, so its own tag is the
			// only one below the constructor's and no identity index is needed.
			typeScriptHidingTag(file, parameter, hidden),
		)
	}
}

// constructorHidingTag resolves the withdrawal tag of a class's constructor
// across every declaration of it.
//
// An overload run is one constructor written several times, and the tag may sit
// on any of them: a signature is where a reader looks for the documentation,
// while only the implementation declares parameter properties. Reading the tag
// per node would make the withdrawal depend on which half the author documented,
// which is the source-order accident every other merged declaration in this
// collector already refuses.
func constructorHidingTag(
	file *shimast.SourceFile,
	members *shimast.NodeList,
	inherited string,
) string {
	if inherited != "" {
		return inherited
	}
	if file == nil || members == nil {
		return ""
	}
	for _, member := range members.Nodes {
		if member == nil || member.Kind != shimast.KindConstructor {
			continue
		}
		if tag := typeScriptHidingTag(file, member, ""); tag != "" {
			return tag
		}
	}
	return ""
}

// isParameterProperty reports whether a constructor parameter also declares a
// field, which is exactly what a property modifier says.
//
// The mask is TypeScript's own and holds five: the three accessibility
// modifiers, `readonly`, and `override`. Naming the familiar four is what a
// summary reaches for, and it is short by `override`, whose own meaning is
// about the base class rather than about the field, so it does not read as a
// field declaration at all. On a class extending one that declares `rate`,
// `constructor(override rate: number)` compiles, emits the assignment, and
// declares a public instance field. Take the mask rather than restating it;
// upstream's own comment beside the constant enumerates four.
func isParameterProperty(parameter *shimast.Node) bool {
	return shimast.GetCombinedModifierFlags(parameter)&
		shimast.ModifierFlagsParameterPropertyModifier != 0
}

// memberSymbol classifies one member variable by how it is written.
//
// Not by what it resolves to: an arrow or function initializer, or a type
// annotation spelled as a function type, makes a member a callable, and one
// annotated with an alias of that type does not. `isDirectFunctionType` says
// why.
//
// Spelled once because the answer may not depend on which syntax declared the
// member. A field in a class body, the same field written as a constructor
// parameter property, and the same member spelled on an interface or an
// object-shaped type alias are one contract in four spellings, and letting any
// of them classify separately is the syntax dependence this collector exists to
// remove. An interface once answered `property` to `charge: () => void` while a
// class answered `function`, so a `symbol: "function"` claim over a file of
// interfaces selected nothing, deactivated, and passed with no coverage.
func memberSymbol(initializer *shimast.Node, declared *shimast.Node) string {
	if isFunctionValue(initializer) || isDirectFunctionType(declared) {
		return "function"
	}
	return "property"
}

// addClassMemberUnit registers one public class member under the address that
// reaches it from the class.
//
// An instance member is addressed through `prototype` and a static member
// directly, because those are the two paths a consumer can actually write. The
// class unit is the parent, so the member is a structural descendant of the
// subject that declares it rather than a sibling of the class's neighbours.
// `memberHidden` is this declaration's own withdrawal tag, inherited from its
// class. A sibling declaration of the same identity may carry one this node does
// not; `addTypeScriptUnit` folds that into the unit, and `withdrawHiddenHosts`
// then takes this node out of the host set.
func addClassMemberUnit(
	node *shimast.Node,
	name string,
	symbol string,
	static bool,
	classIdentity []string,
	classID string,
	inventory *artifactInventory,
	supportedHosts map[*shimast.Node]symbolSet,
	unitsByID map[string]*evidenceUnit,
	memberHidden string,
) {
	if name == "" {
		return
	}
	identity := qualifyTypeScriptName(classIdentity, "prototype", name)
	if static {
		identity = qualifyTypeScriptName(classIdentity, name)
	}
	addTypeScriptUnit(
		inventory,
		unitsByID,
		node,
		symbol,
		identity,
		classID,
		memberHidden,
	).markSpace(true)
	if memberHidden == "" {
		addTypeScriptHost(supportedHosts, node, symbol)
	}
}

func isPublicClassMember(node *shimast.Node) bool {
	flags := shimast.GetCombinedModifierFlags(node)
	return flags&shimast.ModifierFlagsPrivate == 0 &&
		flags&shimast.ModifierFlagsProtected == 0
}

func isFunctionValue(node *shimast.Node) bool {
	for node != nil {
		switch node.Kind {
		case shimast.KindArrowFunction, shimast.KindFunctionExpression:
			return true
		case shimast.KindParenthesizedExpression,
			shimast.KindAsExpression,
			shimast.KindSatisfiesExpression,
			shimast.KindNonNullExpression,
			shimast.KindTypeAssertionExpression:
			node = node.Expression()
		default:
			return false
		}
	}
	return false
}

// isDirectFunctionType reports whether a type annotation is written as a
// function type, rather than whether it resolves to one.
//
// Syntactic on purpose, and this is the sentence every summary of the class
// field rule gets wrong. `evidence/graph` declares `NeedsTypeChecker() false`,
// so nothing here can follow `type Handler = () => void` to its target: a field
// annotated `Handler` is a property, while the same field annotated
// `() => void` is a function. Parentheses are unwrapped because they change
// nothing a reader means; a constructor type, a union with a callable in it,
// and an alias are all left alone because resolving them is the checker's job.
//
// Anyone restating this as "a field that holds a function" has restated
// something else. Twice now, on shipped surfaces.
func isDirectFunctionType(node *shimast.Node) bool {
	for node != nil && node.Kind == shimast.KindParenthesizedType {
		parenthesized := node.AsParenthesizedTypeNode()
		if parenthesized == nil {
			return false
		}
		node = parenthesized.Type
	}
	return node != nil && node.Kind == shimast.KindFunctionType
}

func collectTypeScriptModule(
	file *shimast.SourceFile,
	node *shimast.Node,
	qualified []string,
	parentID string,
	inventory *artifactInventory,
	supportedHosts map[*shimast.Node]symbolSet,
	unitsByID map[string]*evidenceUnit,
	ambientContext bool,
	typeOnlyProjection bool,
	hidden string,
) {
	if node == nil || node.Kind != shimast.KindModuleDeclaration {
		return
	}
	module := node.AsModuleDeclaration()
	if module.Body == nil {
		return
	}
	switch module.Body.Kind {
	case shimast.KindModuleBlock:
		moduleAmbient := ambientContext ||
			shimast.GetCombinedModifierFlags(node)&shimast.ModifierFlagsAmbient != 0
		collectTypeScriptStatements(
			file,
			module.Body.AsModuleBlock().Statements,
			qualified,
			parentID,
			inventory,
			supportedHosts,
			unitsByID,
			moduleAmbient,
			moduleAmbient,
			typeOnlyProjection,
			hidden,
		)
	case shimast.KindModuleDeclaration:
		// `export namespace Outer.Inner {}` is represented as nested module
		// declarations; the inner declaration inherits the outer export.
		name := declarationName(module.Body.Name())
		if name != "" {
			identity := qualifyTypeScriptName(qualified, name)
			innerHidden := typeScriptHidingTag(file, module.Body, hidden)
			// No citation reaches this position today. TypeScript attaches a leading
			// block to the outer declaration of a dotted namespace, so the tag on
			// `export namespace Outer.Inner {}` resolves through the outer host and
			// the inner one is written and never read. It is registered anyway,
			// because the host set is derived from the unit set and a position a unit
			// records must be in it; the day a form does attach a block here, the
			// guard is the thing that was already right.
			if innerHidden == "" {
				addTypeScriptHost(supportedHosts, module.Body, "type")
			}
			unit := addTypeScriptUnit(
				inventory,
				unitsByID,
				module.Body,
				"type",
				identity,
				parentID,
				innerHidden,
			)
			collectTypeScriptModule(
				file,
				module.Body,
				identity,
				unit.ID,
				inventory,
				supportedHosts,
				unitsByID,
				ambientContext ||
					shimast.GetCombinedModifierFlags(node)&shimast.ModifierFlagsAmbient != 0,
				typeOnlyProjection,
				innerHidden,
			)
		}
	}
}

// collectPropertyMembers materializes the members an interface or an
// object-shaped type alias declares.
//
// This is the other half of the four-spelling rule `collectClassMembers` owns,
// and the two must stay in step: a member signature is a function unit and a
// data member is a property unit, decided by `memberSymbol` from the annotation
// as spelled. The classification is single-sourced there, while the member-kind
// switch is written twice, once per container, so a kind added to one and not
// the other is the drift this pair is most exposed to.
//
// The allowlist and the name check are the exclusion, and both gates matter. A
// get or set signature is an accessor, which is a get/set pair rather than a
// member variable and stays out on every container. A call signature, a
// construct signature, and an index signature have no citable name, so an
// author could not write a target for one. A computed name passes the switch
// and is refused after it, for the same reason.
//
// That leaves a consequence worth stating rather than discovering: a
// call-signature-only `interface Handler { (input: string): void }` contributes
// no *member* unit, so a claim narrowed to `symbol: "function"` or `"property"`
// over a file of them selects no host and deactivates silently. The interface
// itself is still a `type` unit, so the default selector keeps such a claim
// active; the qualifier is the whole statement here, not a detail of it.
func collectPropertyMembers(
	file *shimast.SourceFile,
	members *shimast.NodeList,
	owner []string,
	parentID string,
	inventory *artifactInventory,
	supportedHosts map[*shimast.Node]symbolSet,
	unitsByID map[string]*evidenceUnit,
	hidden string,
	valueSpace bool,
) {
	if members == nil {
		return
	}
	for _, member := range members.Nodes {
		if member == nil {
			continue
		}
		symbol := ""
		switch member.Kind {
		case shimast.KindPropertySignature:
			symbol = memberSymbol(nil, member.AsPropertySignatureDeclaration().Type)
		case shimast.KindMethodSignature:
			symbol = "function"
		default:
			continue
		}
		name := declarationName(member.Name())
		if name == "" {
			continue
		}
		identity := qualifyTypeScriptName(owner, name)
		memberHidden := typeScriptHidingTag(file, member, hidden)
		addTypeScriptUnit(
			inventory,
			unitsByID,
			member,
			symbol,
			identity,
			parentID,
			memberHidden,
		).markSpace(valueSpace)
		if memberHidden == "" {
			addTypeScriptHost(supportedHosts, member, symbol)
		}
	}
}

// collectHiddenDeclarationNames indexes the local names a statement list
// withdraws from the public surface, by the tag that withdrew each.
//
// The index is over names rather than over nodes because declaration merging
// makes one name several declarations. `interface I` beside `namespace I` is
// one public identity and one unit, so a tag on either half withdraws the
// identity — and which half carries it is a matter of where the author wrote
// the comment. Reading only the node in hand would leave the identity
// withdrawn while its members stayed selected, depending on source order.
func collectHiddenDeclarationNames(
	file *shimast.SourceFile,
	statements *shimast.NodeList,
) map[string]string {
	if file == nil || statements == nil {
		return nil
	}
	var names map[string]string
	for _, statement := range statements.Nodes {
		if statement == nil {
			continue
		}
		name := declarationName(statement.Name())
		if name == "" {
			continue
		}
		tag := typeScriptHidingTag(file, statement, "")
		if tag == "" {
			continue
		}
		if names == nil {
			names = map[string]string{}
		}
		if names[name] == "" {
			names[name] = tag
		}
	}
	return names
}

// hidingTagFor answers for one local name, preferring an inherited tag.
func hidingTagFor(
	inherited string,
	names map[string]string,
	local string,
) string {
	if inherited != "" {
		return inherited
	}
	return names[local]
}

// typeScriptHidingTag reports the documentation tag that withdraws a
// declaration from the public surface, inheriting an enclosing one.
//
// An inherited tag wins outright and the node's own blocks are not consulted:
// once an ancestor is out of the surface, nothing beneath it can opt back in,
// and the cause an author has to be told about is the outermost tag.
func typeScriptHidingTag(
	file *shimast.SourceFile,
	node *shimast.Node,
	inherited string,
) string {
	if inherited != "" {
		return inherited
	}
	if file == nil || node == nil {
		return ""
	}
	content := file.Text()
	for _, doc := range node.JSDoc(file) {
		if doc == nil ||
			doc.Pos() < 0 ||
			doc.End() > len(content) ||
			doc.Pos() >= doc.End() {
			continue
		}
		if tag := commentHidingTag(content[doc.Pos():doc.End()]); tag != "" {
			return tag
		}
	}
	return ""
}

func addTypeScriptUnit(
	inventory *artifactInventory,
	unitsByID map[string]*evidenceUnit,
	node *shimast.Node,
	symbol string,
	identity []string,
	parentID string,
	hidden string,
) *evidenceUnit {
	target := strings.Join(identity, ".")
	address := inventory.Address
	if address == "" {
		address = inventory.Path
	}
	id := "typescript:" + address + ":" + symbol + ":" + encodeTypeScriptIdentity(identity)
	// Recorded before the dedupe below, so a merged identity keeps every
	// declaration that spells it. `interface I` beside `namespace I` is one
	// unit and two nodes, and a rule asking where that unit's JSDoc may live
	// has to see both.
	inventory.recordUnitNode(id, node)
	if unit := unitsByID[id]; unit != nil {
		// A merged identity is one unit, so one declaration marking itself
		// internal marks the identity. Both halves of `interface I` beside
		// `namespace I` name the same public thing, and honoring only the tagged
		// half would leave the identity half in and half out of the surface.
		if hidden != "" && unit.Hidden == "" {
			unit.Hidden = hidden
		}
		return unit
	}
	unit := &evidenceUnit{
		ID:       id,
		ParentID: parentID,
		Target:   target,
		Identity: append([]string{}, identity...),
		Type:     artifactTypeScript,
		Symbol:   symbol,
		Path:     inventory.Path,
		Line:     lineAtNode(inventory.Path, node),
		Readable: "TypeScript " + symbol + " '" + target + "'",
		Hidden:   hidden,
	}
	unitsByID[id] = unit
	inventory.Units = append(inventory.Units, unit)
	return unit
}

func addTypeScriptHost(
	hosts map[*shimast.Node]symbolSet,
	node *shimast.Node,
	symbol string,
) {
	if node == nil {
		return
	}
	if hosts[node] == nil {
		hosts[node] = symbolSet{}
	}
	hosts[node][symbol] = true
}

// lineAtNode stores a byte offset until declarations are scanned against the
// complete source text. A position inside the name is on the declaration
// itself, while both the parent and name full starts may include leading trivia.
func lineAtNode(_ string, node *shimast.Node) int {
	if node == nil {
		return 0
	}
	if name := node.Name(); name != nil && name.End() > 0 {
		return name.End() - 1
	}
	return node.Pos()
}

func collectTypeScriptDeclarations(
	file *shimast.SourceFile,
	address string,
	location string,
	inventory *artifactInventory,
	supportedHosts map[*shimast.Node]symbolSet,
) {
	type docHost struct {
		node            *shimast.Node
		hosts           symbolSet
		hostIDs         map[string]bool
		semanticHostIDs map[string]bool
	}
	semanticHostsByNode := map[*shimast.Node]map[string]bool{}
	for unitID, nodes := range inventory.UnitNodes {
		for _, node := range nodes {
			if node == nil {
				continue
			}
			if semanticHostsByNode[node] == nil {
				semanticHostsByNode[node] = map[string]bool{}
			}
			semanticHostsByNode[node][unitID] = true
		}
	}
	docs := map[string]docHost{}
	walkTypeScriptNode(file.AsNode(), func(node *shimast.Node) {
		for _, doc := range node.JSDoc(file) {
			if doc == nil {
				continue
			}
			key := decimal(doc.Pos()) + ":" + decimal(doc.End())
			candidate := docHost{
				node:            doc,
				hosts:           supportedHosts[node],
				semanticHostIDs: semanticHostsByNode[node],
			}
			if len(candidate.hosts) != 0 {
				candidate.hostIDs = map[string]bool{
					address + ":" + decimal(node.Pos()) + ":" + decimal(node.End()): true,
				}
			}
			current, exists := docs[key]
			if !exists {
				docs[key] = candidate
				continue
			}
			for symbol := range candidate.hosts {
				if current.hosts == nil {
					current.hosts = symbolSet{}
				}
				current.hosts[symbol] = true
			}
			for hostID := range candidate.hostIDs {
				if current.hostIDs == nil {
					current.hostIDs = map[string]bool{}
				}
				current.hostIDs[hostID] = true
			}
			for semanticHostID := range candidate.semanticHostIDs {
				if current.semanticHostIDs == nil {
					current.semanticHostIDs = map[string]bool{}
				}
				current.semanticHostIDs[semanticHostID] = true
			}
			docs[key] = current
		}
	})
	keys := make([]string, 0, len(docs))
	for key := range docs {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(left int, right int) bool {
		leftNode := docs[keys[left]].node
		rightNode := docs[keys[right]].node
		if leftNode.Pos() != rightNode.Pos() {
			return leftNode.Pos() < rightNode.Pos()
		}
		return leftNode.End() < rightNode.End()
	})
	content := file.Text()
	sequence := 0
	for _, key := range keys {
		entry := docs[key]
		if entry.node.Pos() < 0 || entry.node.End() > len(content) || entry.node.Pos() >= entry.node.End() {
			continue
		}
		baseLine := lineAt(content, entry.node.Pos())
		hostIDs := make([]string, 0, len(entry.hostIDs))
		for hostID := range entry.hostIDs {
			hostIDs = append(hostIDs, hostID)
		}
		sort.Strings(hostIDs)
		hostID := strings.Join(hostIDs, "|")
		semanticHostIDs := make([]string, 0, len(entry.semanticHostIDs))
		for semanticHostID := range entry.semanticHostIDs {
			semanticHostIDs = append(semanticHostIDs, semanticHostID)
		}
		sort.Strings(semanticHostIDs)
		for _, parsed := range parseDeclarations(content[entry.node.Pos():entry.node.End()]) {
			sequence++
			inventory.Declarations = append(inventory.Declarations, &evidenceDeclaration{
				ID:               "typescript:" + address + ":" + decimal(baseLine+parsed.LineOffset) + ":" + decimal(sequence),
				HostID:           hostID,
				SemanticHostIDs:  semanticHostIDs,
				Type:             artifactTypeScript,
				Tag:              parsed.Tag,
				Target:           parsed.Target,
				Reason:           parsed.Reason,
				Hosts:            entry.hosts,
				ExclusionCarrier: len(entry.hosts) != 0,
				Path:             location,
				Line:             baseLine + parsed.LineOffset,
				Sequence:         sequence,
			})
		}
		// Reviews are read from the same block by a separate pass into a separate
		// slice. Sharing the declaration loop would put a review one field away
		// from every acknowledgement map in evaluation.
		for _, review := range parseReviews(content[entry.node.Pos():entry.node.End()]) {
			inventory.Reviews = append(inventory.Reviews, &evidenceReview{
				HostID:          hostID,
				SemanticHostIDs: semanticHostIDs,
				Reviews:         review.Reviews,
				Type:            artifactTypeScript,
				Target:          review.Target,
				Fingerprint:     review.Fingerprint,
				Description:     review.Description,
				Path:            location,
				Line:            baseLine + review.LineOffset,
			})
		}
	}
	for _, unit := range inventory.Units {
		// TypeScript AST positions are byte offsets; translate them only after
		// the complete source text is available.
		unit.Line = lineAt(content, unit.Line)
		// The digest is deferred to the same pass for the same reason: the nodes
		// are recorded while walking, and their text needs the source file that
		// only the caller holds.
		unit.Digest = typeScriptUnitDigest(file, inventory.UnitNodes[unit.ID])
	}
}

func walkTypeScriptNode(node *shimast.Node, visit func(*shimast.Node)) {
	if node == nil {
		return
	}
	visit(node)
	node.ForEachChild(func(child *shimast.Node) bool {
		walkTypeScriptNode(child, visit)
		return false
	})
}

type exportedName struct {
	Public   string
	TypeOnly bool
}

func collectLocalExportNames(
	statements *shimast.NodeList,
) map[string][]exportedName {
	exports := map[string][]exportedName{}
	if statements == nil {
		return exports
	}
	for _, statement := range statements.Nodes {
		if statement == nil || statement.Kind != shimast.KindExportDeclaration {
			continue
		}
		declaration := statement.AsExportDeclaration()
		if declaration == nil ||
			declaration.ModuleSpecifier != nil ||
			declaration.ExportClause == nil ||
			declaration.ExportClause.Kind != shimast.KindNamedExports {
			continue
		}
		named := declaration.ExportClause.AsNamedExports()
		if named == nil || named.Elements == nil {
			continue
		}
		for _, element := range named.Elements.Nodes {
			if element == nil || element.Kind != shimast.KindExportSpecifier {
				continue
			}
			specifier := element.AsExportSpecifier()
			if specifier == nil {
				continue
			}
			localNode := specifier.PropertyName
			if localNode == nil {
				localNode = specifier.Name()
			}
			local := declarationName(localNode)
			public := declarationName(specifier.Name())
			if local == "" || public == "" || public == "default" {
				continue
			}
			exports[local] = append(exports[local], exportedName{
				Public:   public,
				TypeOnly: declaration.IsTypeOnly || specifier.IsTypeOnly,
			})
		}
	}
	return exports
}

func publicTypeScriptNames(
	node *shimast.Node,
	local string,
	exports map[string][]exportedName,
	allowTypeOnly bool,
	implicitlyExported bool,
) []string {
	projected := publicTypeScriptExports(
		node,
		local,
		exports,
		allowTypeOnly,
		implicitlyExported,
	)
	result := make([]string, 0, len(projected))
	for _, exported := range projected {
		result = append(result, exported.Public)
	}
	return result
}

func publicTypeScriptExports(
	node *shimast.Node,
	local string,
	exports map[string][]exportedName,
	allowTypeOnly bool,
	implicitlyExported bool,
) []exportedName {
	if local == "" {
		return nil
	}
	names := map[string]exportedName{}
	if implicitlyExported || isSyntacticallyExported(node) {
		names[local] = exportedName{Public: local}
	}
	for _, exported := range exports[local] {
		if exported.TypeOnly && !allowTypeOnly {
			continue
		}
		current, exists := names[exported.Public]
		if !exists || current.TypeOnly && !exported.TypeOnly {
			names[exported.Public] = exported
		}
	}
	result := make([]string, 0, len(names))
	for name := range names {
		result = append(result, name)
	}
	sort.Strings(result)
	projected := make([]exportedName, 0, len(result))
	for _, name := range result {
		projected = append(projected, names[name])
	}
	return projected
}

func isSyntacticallyExported(node *shimast.Node) bool {
	return node != nil && shimast.GetCombinedModifierFlags(node)&shimast.ModifierFlagsExport != 0
}

func declarationName(node *shimast.Node) string {
	if node == nil {
		return ""
	}
	switch node.Kind {
	case shimast.KindIdentifier,
		shimast.KindStringLiteral,
		shimast.KindNumericLiteral:
		name := node.Text()
		if containsWhitespace(name) {
			return ""
		}
		return name
	default:
		return ""
	}
}

func bindingIdentifierNodes(node *shimast.Node) []*shimast.Node {
	if node == nil {
		return nil
	}
	if declarationName(node) != "" {
		return []*shimast.Node{node}
	}
	if !shimast.IsBindingPattern(node) {
		return nil
	}
	pattern := node.AsBindingPattern()
	if pattern == nil || pattern.Elements == nil {
		return nil
	}
	nodes := []*shimast.Node{}
	for _, element := range pattern.Elements.Nodes {
		if element == nil || element.Kind != shimast.KindBindingElement {
			continue
		}
		nodes = append(nodes, bindingIdentifierNodes(element.Name())...)
	}
	return nodes
}

func qualifyTypeScriptName(prefix []string, names ...string) []string {
	qualified := make([]string, 0, len(prefix)+len(names))
	qualified = append(qualified, prefix...)
	qualified = append(qualified, names...)
	return qualified
}

func encodeTypeScriptIdentity(identity []string) string {
	var builder strings.Builder
	for _, segment := range identity {
		builder.WriteString(decimal(len(segment)))
		builder.WriteByte(':')
		builder.WriteString(segment)
		builder.WriteByte(';')
	}
	return builder.String()
}
