import type { ClassDeclaration } from "../declarations/ClassDeclaration";
import type { EnumDeclaration } from "../declarations/EnumDeclaration";
import type { FunctionDeclaration } from "../declarations/FunctionDeclaration";
import type { ImportEqualsDeclaration } from "../declarations/ImportEqualsDeclaration";
import type { InterfaceDeclaration } from "../declarations/InterfaceDeclaration";
import type { ModuleDeclaration } from "../declarations/ModuleDeclaration";
import type { NamespaceExportDeclaration } from "../declarations/NamespaceExportDeclaration";
import type { TypeAliasDeclaration } from "../declarations/TypeAliasDeclaration";
import type { ExportAssignment } from "../imports/ExportAssignment";
import type { ExportDeclaration } from "../imports/ExportDeclaration";
import type { ImportDeclaration } from "../imports/ImportDeclaration";
import type { Block } from "./Block";
import type { BreakStatement } from "./BreakStatement";
import type { ContinueStatement } from "./ContinueStatement";
import type { DebuggerStatement } from "./DebuggerStatement";
import type { DoStatement } from "./DoStatement";
import type { EmptyStatement } from "./EmptyStatement";
import type { ExpressionStatement } from "./ExpressionStatement";
import type { ForInStatement } from "./ForInStatement";
import type { ForOfStatement } from "./ForOfStatement";
import type { ForStatement } from "./ForStatement";
import type { IfStatement } from "./IfStatement";
import type { LabeledStatement } from "./LabeledStatement";
import type { NotEmittedStatement } from "./NotEmittedStatement";
import type { ReturnStatement } from "./ReturnStatement";
import type { SwitchStatement } from "./SwitchStatement";
import type { ThrowStatement } from "./ThrowStatement";
import type { TryStatement } from "./TryStatement";
import type { VariableStatement } from "./VariableStatement";
import type { WhileStatement } from "./WhileStatement";
import type { WithStatement } from "./WithStatement";

/**
 * The supported statement forms, including explicit non-emitted placeholders.
 *
 * This union represents printable syntax data. It does not determine whether a
 * statement is legal at a particular program or control-flow position.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation The union admits supported control-flow, declaration, module and non-emitted statement forms; membership is distinct from contextual or semantic validity.
 * @evidence contracts/common.md#clear-and-simple-design One shared statement alias owns variants reused by bodies and source files; each concrete variant owns its fields.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Alternatives are syntax categories; non-emission is an explicit placeholder rather than an ad hoc fixture deletion.
 * @evidence contracts/common.md#meaningful-documentation JSDoc states placeholder support and contextual-validation limits in separate paragraphs following the documentation skill.
 */
export type Statement =
  | Block
  | BreakStatement
  | ClassDeclaration
  | ContinueStatement
  | DebuggerStatement
  | DoStatement
  | EmptyStatement
  | EnumDeclaration
  | ExportAssignment
  | ExportDeclaration
  | ExpressionStatement
  | ForInStatement
  | ForOfStatement
  | ForStatement
  | FunctionDeclaration
  | IfStatement
  | ImportDeclaration
  | ImportEqualsDeclaration
  | InterfaceDeclaration
  | LabeledStatement
  | ModuleDeclaration
  | NamespaceExportDeclaration
  | NotEmittedStatement
  | ReturnStatement
  | SwitchStatement
  | ThrowStatement
  | TryStatement
  | TypeAliasDeclaration
  | VariableStatement
  | WhileStatement
  | WithStatement;
