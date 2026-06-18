import { createHeritageClause } from "./clauses/createHeritageClause";
import { createParameterDeclaration } from "./clauses/createParameterDeclaration";
import { createClassDeclaration } from "./declarations/createClassDeclaration";
import { createClassStaticBlockDeclaration } from "./declarations/createClassStaticBlockDeclaration";
import { createConstructorDeclaration } from "./declarations/createConstructorDeclaration";
import { createEnumDeclaration } from "./declarations/createEnumDeclaration";
import { createEnumMember } from "./declarations/createEnumMember";
import { createExternalModuleReference } from "./declarations/createExternalModuleReference";
import { createFunctionDeclaration } from "./declarations/createFunctionDeclaration";
import { createGetAccessorDeclaration } from "./declarations/createGetAccessorDeclaration";
import { createImportEqualsDeclaration } from "./declarations/createImportEqualsDeclaration";
import { createInterfaceDeclaration } from "./declarations/createInterfaceDeclaration";
import { createMethodDeclaration } from "./declarations/createMethodDeclaration";
import { createModuleBlock } from "./declarations/createModuleBlock";
import { createModuleDeclaration } from "./declarations/createModuleDeclaration";
import { createNamespaceExportDeclaration } from "./declarations/createNamespaceExportDeclaration";
import { createPropertyDeclaration } from "./declarations/createPropertyDeclaration";
import { createSemicolonClassElement } from "./declarations/createSemicolonClassElement";
import { createSetAccessorDeclaration } from "./declarations/createSetAccessorDeclaration";
import { createTypeAliasDeclaration } from "./declarations/createTypeAliasDeclaration";
import { createAdd } from "./expressions/createAdd";
import { createArrayBindingPattern } from "./expressions/createArrayBindingPattern";
import { createArrayLiteralExpression } from "./expressions/createArrayLiteralExpression";
import { createArrowFunction } from "./expressions/createArrowFunction";
import { createAsExpression } from "./expressions/createAsExpression";
import { createAssignment } from "./expressions/createAssignment";
import { createAwaitExpression } from "./expressions/createAwaitExpression";
import { createBinaryExpression } from "./expressions/createBinaryExpression";
import { createBindingElement } from "./expressions/createBindingElement";
import { createBitwiseAnd } from "./expressions/createBitwiseAnd";
import { createBitwiseNot } from "./expressions/createBitwiseNot";
import { createBitwiseOr } from "./expressions/createBitwiseOr";
import { createBitwiseXor } from "./expressions/createBitwiseXor";
import { createCallChain } from "./expressions/createCallChain";
import { createCallExpression } from "./expressions/createCallExpression";
import { createClassExpression } from "./expressions/createClassExpression";
import { createComma } from "./expressions/createComma";
import { createCommaListExpression } from "./expressions/createCommaListExpression";
import { createComputedPropertyName } from "./expressions/createComputedPropertyName";
import { createConditionalExpression } from "./expressions/createConditionalExpression";
import { createDeleteExpression } from "./expressions/createDeleteExpression";
import { createDivide } from "./expressions/createDivide";
import { createElementAccessChain } from "./expressions/createElementAccessChain";
import { createElementAccessExpression } from "./expressions/createElementAccessExpression";
import { createEquality } from "./expressions/createEquality";
import { createExponent } from "./expressions/createExponent";
import { createFunctionExpression } from "./expressions/createFunctionExpression";
import { createGreaterThan } from "./expressions/createGreaterThan";
import { createGreaterThanEquals } from "./expressions/createGreaterThanEquals";
import { createImmediatelyInvokedArrowFunction } from "./expressions/createImmediatelyInvokedArrowFunction";
import { createImmediatelyInvokedFunctionExpression } from "./expressions/createImmediatelyInvokedFunctionExpression";
import { createInequality } from "./expressions/createInequality";
import { createLeftShift } from "./expressions/createLeftShift";
import { createLessThan } from "./expressions/createLessThan";
import { createLessThanEquals } from "./expressions/createLessThanEquals";
import { createLogicalAnd } from "./expressions/createLogicalAnd";
import { createLogicalNot } from "./expressions/createLogicalNot";
import { createLogicalOr } from "./expressions/createLogicalOr";
import { createMetaProperty } from "./expressions/createMetaProperty";
import { createModulo } from "./expressions/createModulo";
import { createMultiply } from "./expressions/createMultiply";
import { createNewExpression } from "./expressions/createNewExpression";
import { createNonNullChain } from "./expressions/createNonNullChain";
import { createNonNullExpression } from "./expressions/createNonNullExpression";
import { createObjectBindingPattern } from "./expressions/createObjectBindingPattern";
import { createObjectLiteralExpression } from "./expressions/createObjectLiteralExpression";
import { createOmittedExpression } from "./expressions/createOmittedExpression";
import { createParenthesizedExpression } from "./expressions/createParenthesizedExpression";
import { createPostfixDecrement } from "./expressions/createPostfixDecrement";
import { createPostfixIncrement } from "./expressions/createPostfixIncrement";
import { createPostfixUnaryExpression } from "./expressions/createPostfixUnaryExpression";
import { createPrefixDecrement } from "./expressions/createPrefixDecrement";
import { createPrefixIncrement } from "./expressions/createPrefixIncrement";
import { createPrefixMinus } from "./expressions/createPrefixMinus";
import { createPrefixPlus } from "./expressions/createPrefixPlus";
import { createPrefixUnaryExpression } from "./expressions/createPrefixUnaryExpression";
import { createPropertyAccessChain } from "./expressions/createPropertyAccessChain";
import { createPropertyAccessExpression } from "./expressions/createPropertyAccessExpression";
import { createPropertyAssignment } from "./expressions/createPropertyAssignment";
import { createRegularExpressionLiteral } from "./expressions/createRegularExpressionLiteral";
import { createRightShift } from "./expressions/createRightShift";
import { createSatisfiesExpression } from "./expressions/createSatisfiesExpression";
import { createShorthandPropertyAssignment } from "./expressions/createShorthandPropertyAssignment";
import { createSpreadAssignment } from "./expressions/createSpreadAssignment";
import { createSpreadElement } from "./expressions/createSpreadElement";
import { createStrictEquality } from "./expressions/createStrictEquality";
import { createStrictInequality } from "./expressions/createStrictInequality";
import { createSubtract } from "./expressions/createSubtract";
import { createTaggedTemplateExpression } from "./expressions/createTaggedTemplateExpression";
import { createTemplateExpression } from "./expressions/createTemplateExpression";
import { createTemplateSpan } from "./expressions/createTemplateSpan";
import { createTypeAssertion } from "./expressions/createTypeAssertion";
import { createTypeOfExpression } from "./expressions/createTypeOfExpression";
import { createUnsignedRightShift } from "./expressions/createUnsignedRightShift";
import { createVoidExpression } from "./expressions/createVoidExpression";
import { createVoidZero } from "./expressions/createVoidZero";
import { createYieldExpression } from "./expressions/createYieldExpression";
import { createNodeArray } from "./file/createNodeArray";
import { createSourceFile } from "./file/createSourceFile";
import { updateSourceFile } from "./file/updateSourceFile";
import { createExportAssignment } from "./imports/createExportAssignment";
import { createExportDeclaration } from "./imports/createExportDeclaration";
import { createExportDefault } from "./imports/createExportDefault";
import { createExportSpecifier } from "./imports/createExportSpecifier";
import { createExternalModuleExport } from "./imports/createExternalModuleExport";
import { createImportClause } from "./imports/createImportClause";
import { createImportDeclaration } from "./imports/createImportDeclaration";
import { createImportSpecifier } from "./imports/createImportSpecifier";
import { createNamedExports } from "./imports/createNamedExports";
import { createNamedImports } from "./imports/createNamedImports";
import { createNamespaceExport } from "./imports/createNamespaceExport";
import { createNamespaceImport } from "./imports/createNamespaceImport";
import { createBigIntLiteral } from "./literals/createBigIntLiteral";
import { createNoSubstitutionTemplateLiteral } from "./literals/createNoSubstitutionTemplateLiteral";
import { createNumericLiteral } from "./literals/createNumericLiteral";
import { createStringLiteral } from "./literals/createStringLiteral";
import { createTemplateHead } from "./literals/createTemplateHead";
import { createTemplateMiddle } from "./literals/createTemplateMiddle";
import { createTemplateTail } from "./literals/createTemplateTail";
import { createDecorator } from "./names/createDecorator";
import { createFalse } from "./names/createFalse";
import { createIdentifier } from "./names/createIdentifier";
import { createModifier } from "./names/createModifier";
import { createNull } from "./names/createNull";
import { createPrivateIdentifier } from "./names/createPrivateIdentifier";
import { createQualifiedName } from "./names/createQualifiedName";
import { createSuper } from "./names/createSuper";
import { createThis } from "./names/createThis";
import { createToken } from "./names/createToken";
import { createTrue } from "./names/createTrue";
import { createBlock } from "./statements/createBlock";
import { createBreakStatement } from "./statements/createBreakStatement";
import { createCaseBlock } from "./statements/createCaseBlock";
import { createCaseClause } from "./statements/createCaseClause";
import { createCatchClause } from "./statements/createCatchClause";
import { createContinueStatement } from "./statements/createContinueStatement";
import { createDebuggerStatement } from "./statements/createDebuggerStatement";
import { createDefaultClause } from "./statements/createDefaultClause";
import { createDoStatement } from "./statements/createDoStatement";
import { createEmptyStatement } from "./statements/createEmptyStatement";
import { createExpressionStatement } from "./statements/createExpressionStatement";
import { createForInStatement } from "./statements/createForInStatement";
import { createForOfStatement } from "./statements/createForOfStatement";
import { createForStatement } from "./statements/createForStatement";
import { createIfStatement } from "./statements/createIfStatement";
import { createLabeledStatement } from "./statements/createLabeledStatement";
import { createReturnStatement } from "./statements/createReturnStatement";
import { createSwitchStatement } from "./statements/createSwitchStatement";
import { createThrowStatement } from "./statements/createThrowStatement";
import { createTryStatement } from "./statements/createTryStatement";
import { createVariableDeclaration } from "./statements/createVariableDeclaration";
import { createVariableDeclarationList } from "./statements/createVariableDeclarationList";
import { createVariableStatement } from "./statements/createVariableStatement";
import { createWhileStatement } from "./statements/createWhileStatement";
import { createWithStatement } from "./statements/createWithStatement";
import { createArrayTypeNode } from "./types/createArrayTypeNode";
import { createCallSignature } from "./types/createCallSignature";
import { createConditionalTypeNode } from "./types/createConditionalTypeNode";
import { createConstructSignature } from "./types/createConstructSignature";
import { createConstructorTypeNode } from "./types/createConstructorTypeNode";
import { createExpressionWithTypeArguments } from "./types/createExpressionWithTypeArguments";
import { createFunctionTypeNode } from "./types/createFunctionTypeNode";
import { createImportTypeNode } from "./types/createImportTypeNode";
import { createIndexSignature } from "./types/createIndexSignature";
import { createIndexedAccessTypeNode } from "./types/createIndexedAccessTypeNode";
import { createInferTypeNode } from "./types/createInferTypeNode";
import { createIntersectionTypeNode } from "./types/createIntersectionTypeNode";
import { createKeywordTypeNode } from "./types/createKeywordTypeNode";
import { createLiteralTypeNode } from "./types/createLiteralTypeNode";
import { createMappedTypeNode } from "./types/createMappedTypeNode";
import { createMethodSignature } from "./types/createMethodSignature";
import { createNamedTupleMember } from "./types/createNamedTupleMember";
import { createOptionalTypeNode } from "./types/createOptionalTypeNode";
import { createParenthesizedType } from "./types/createParenthesizedType";
import { createPropertySignature } from "./types/createPropertySignature";
import { createRestTypeNode } from "./types/createRestTypeNode";
import { createTemplateLiteralType } from "./types/createTemplateLiteralType";
import { createTemplateLiteralTypeSpan } from "./types/createTemplateLiteralTypeSpan";
import { createThisTypeNode } from "./types/createThisTypeNode";
import { createTupleTypeNode } from "./types/createTupleTypeNode";
import { createTypeLiteralNode } from "./types/createTypeLiteralNode";
import { createTypeOperatorNode } from "./types/createTypeOperatorNode";
import { createTypeParameterDeclaration } from "./types/createTypeParameterDeclaration";
import { createTypePredicateNode } from "./types/createTypePredicateNode";
import { createTypeQueryNode } from "./types/createTypeQueryNode";
import { createTypeReferenceNode } from "./types/createTypeReferenceNode";
import { createUnionTypeNode } from "./types/createUnionTypeNode";

/**
 * Hand-written, dependency-free re-implementation of the legacy TypeScript AST
 * node factory (`ts.factory`).
 *
 * Every `createXxx` method mirrors the legacy signature and returns a plain
 * outline node that {@link TsPrinter} renders to TypeScript source text. No
 * `typescript` module is imported — the logic is implemented directly.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export const factory = {
  createHeritageClause,
  createParameterDeclaration,
  createClassDeclaration,
  createClassStaticBlockDeclaration,
  createConstructorDeclaration,
  createEnumDeclaration,
  createEnumMember,
  createExternalModuleReference,
  createFunctionDeclaration,
  createGetAccessorDeclaration,
  createImportEqualsDeclaration,
  createInterfaceDeclaration,
  createMethodDeclaration,
  createModuleBlock,
  createModuleDeclaration,
  createNamespaceExportDeclaration,
  createPropertyDeclaration,
  createSemicolonClassElement,
  createSetAccessorDeclaration,
  createTypeAliasDeclaration,
  createAdd,
  createArrayBindingPattern,
  createArrayLiteralExpression,
  createArrowFunction,
  createAsExpression,
  createAssignment,
  createAwaitExpression,
  createBinaryExpression,
  createBindingElement,
  createBitwiseAnd,
  createBitwiseNot,
  createBitwiseOr,
  createBitwiseXor,
  createCallChain,
  createCallExpression,
  createClassExpression,
  createComma,
  createCommaListExpression,
  createComputedPropertyName,
  createConditionalExpression,
  createDeleteExpression,
  createDivide,
  createElementAccessChain,
  createElementAccessExpression,
  createEquality,
  createExponent,
  createFunctionExpression,
  createGreaterThan,
  createGreaterThanEquals,
  createImmediatelyInvokedArrowFunction,
  createImmediatelyInvokedFunctionExpression,
  createInequality,
  createLeftShift,
  createLessThan,
  createLessThanEquals,
  createLogicalAnd,
  createLogicalNot,
  createLogicalOr,
  createMetaProperty,
  createModulo,
  createMultiply,
  createNewExpression,
  createNonNullChain,
  createNonNullExpression,
  createObjectBindingPattern,
  createObjectLiteralExpression,
  createOmittedExpression,
  createParenthesizedExpression,
  createPostfixDecrement,
  createPostfixIncrement,
  createPostfixUnaryExpression,
  createPrefixDecrement,
  createPrefixIncrement,
  createPrefixMinus,
  createPrefixPlus,
  createPrefixUnaryExpression,
  createPropertyAccessChain,
  createPropertyAccessExpression,
  createPropertyAssignment,
  createRegularExpressionLiteral,
  createRightShift,
  createSatisfiesExpression,
  createShorthandPropertyAssignment,
  createSpreadAssignment,
  createSpreadElement,
  createStrictEquality,
  createStrictInequality,
  createSubtract,
  createTaggedTemplateExpression,
  createTemplateExpression,
  createTemplateSpan,
  createTypeAssertion,
  createTypeOfExpression,
  createUnsignedRightShift,
  createVoidExpression,
  createVoidZero,
  createYieldExpression,
  createNodeArray,
  createSourceFile,
  updateSourceFile,
  createExportAssignment,
  createExportDeclaration,
  createExportDefault,
  createExportSpecifier,
  createExternalModuleExport,
  createImportClause,
  createImportDeclaration,
  createImportSpecifier,
  createNamedExports,
  createNamedImports,
  createNamespaceExport,
  createNamespaceImport,
  createBigIntLiteral,
  createNoSubstitutionTemplateLiteral,
  createNumericLiteral,
  createStringLiteral,
  createTemplateHead,
  createTemplateMiddle,
  createTemplateTail,
  createDecorator,
  createFalse,
  createIdentifier,
  createModifier,
  createNull,
  createPrivateIdentifier,
  createQualifiedName,
  createSuper,
  createThis,
  createToken,
  createTrue,
  createBlock,
  createBreakStatement,
  createCaseBlock,
  createCaseClause,
  createCatchClause,
  createContinueStatement,
  createDebuggerStatement,
  createDefaultClause,
  createDoStatement,
  createEmptyStatement,
  createExpressionStatement,
  createForInStatement,
  createForOfStatement,
  createForStatement,
  createIfStatement,
  createLabeledStatement,
  createReturnStatement,
  createSwitchStatement,
  createThrowStatement,
  createTryStatement,
  createVariableDeclaration,
  createVariableDeclarationList,
  createVariableStatement,
  createWhileStatement,
  createWithStatement,
  createArrayTypeNode,
  createCallSignature,
  createConditionalTypeNode,
  createConstructorTypeNode,
  createConstructSignature,
  createExpressionWithTypeArguments,
  createFunctionTypeNode,
  createImportTypeNode,
  createIndexedAccessTypeNode,
  createIndexSignature,
  createInferTypeNode,
  createIntersectionTypeNode,
  createKeywordTypeNode,
  createLiteralTypeNode,
  createMappedTypeNode,
  createMethodSignature,
  createNamedTupleMember,
  createOptionalTypeNode,
  createParenthesizedType,
  createPropertySignature,
  createRestTypeNode,
  createTemplateLiteralType,
  createTemplateLiteralTypeSpan,
  createThisTypeNode,
  createTupleTypeNode,
  createTypeLiteralNode,
  createTypeOperatorNode,
  createTypeParameterDeclaration,
  createTypePredicateNode,
  createTypeQueryNode,
  createTypeReferenceNode,
  createUnionTypeNode,
};

/** Outline of the legacy `ts.NodeFactory`. */
export type NodeFactory = typeof factory;
