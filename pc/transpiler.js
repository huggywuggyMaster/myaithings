// transpiler.js

/**
 * 1. Lexer (Tokenizer): Converts raw input code into a stream of tokens.
 *    Each token represents a meaningful unit in the language (e.g., keyword, identifier, number).
 */
export const tokenize = (input) => { // Export tokenize for external use (highlighting)
    const tokens = [];
    let cursor = 0;

    // Changed 'RETURN' to 'return'
    const keywords = ['PRINT', '_cpp_', 'function', 'end', 'return']; // '_cpp_' is now a keyword for C++ injection
    const booleanLiterals = ['true', 'false']; // New: Boolean literal values
    // Added arithmetic operators
    const operators = ['=', '+', '-', '*', '/'];
    // Parentheses, comma, and colon are punctuation
    const punctuation = [';', '(', ')', ',', ':']; // Added ':'
    // New: Explicit types
    const types = ['int', 'float', 'string', 'bool'];

    while (cursor < input.length) {
        let char = input[cursor];

        // Handle single-line comments (//)
        if (char === '/' && input[cursor + 1] === '/') {
            let value = '';
            cursor += 2; // Skip '//'
            while (cursor < input.length && input[cursor] !== '\n' && input[cursor] !== '\r') {
                value += input[cursor];
                cursor++;
            }
            tokens.push({ type: 'COMMENT', value: '//' + value }); // Store full comment with //
            continue;
        }

        // Parse String Literals
        if (char === '"') {
            let value = '';
            cursor++; // Skip opening "
            while (cursor < input.length && input[cursor] !== '"') {
                // Handle escaped quotes \" and escaped backslashes \\ within string literals.
                // Other escapes like \n, \t are treated as literal \ and n, \ and t by the lexer,
                // which is acceptable for simple string literals in our language, and also for
                // _cpp_ strings as C++ string literals require those specific escapes.
                if (input[cursor] === '\\' && (input[cursor+1] === '"' || input[cursor+1] === '\\')) {
                    value += input[cursor]; // Add the backslash
                    cursor++; // Move past the backslash
                }
                value += input[cursor];
                cursor++;
            }
            if (input[cursor] === '"') { // Consume closing "
                cursor++;
                tokens.push({ type: 'STRING_LITERAL', value: `"${value}"` }); // Store with quotes for literal representation
            } else {
                // Unterminated string literal, treat as an error
                tokens.push({ type: 'ERROR', value: `"${value}` });
            }
            continue;
        }

        // Parse Whitespace (important to keep for highlighting layout)
        if (/\s/.test(char)) {
            let value = '';
            while (cursor < input.length && /\s/.test(input[cursor])) {
                value += input[cursor];
                cursor++;
            }
            tokens.push({ type: 'WHITESPACE', value });
            continue;
        }

        // Parse Keywords, Boolean Literals, Types and Identifiers (starts with letter or underscore, followed by letters, numbers, or underscores)
        if (/[a-zA-Z_]/.test(char)) {
            let value = '';
            while (cursor < input.length && /[a-zA-Z0-9_]/.test(input[cursor])) {
                value += input[cursor];
                cursor++;
            }
            if (keywords.includes(value)) {
                tokens.push({ type: 'KEYWORD', value });
            } else if (booleanLiterals.includes(value)) { // Check for boolean literals
                tokens.push({ type: 'BOOLEAN_LITERAL', value });
            } else if (types.includes(value)) { // Check for types
                tokens.push({ type: 'TYPE', value });
            }
            else {
                tokens.push({ type: 'IDENTIFIER', value });
            }
            continue;
        }

        // Parse Numbers (int and float)
        if (/[0-9]/.test(char)) {
            let value = '';
            let hasDecimal = false;
            while (cursor < input.length) {
                if (/[0-9]/.test(input[cursor])) {
                    value += input[cursor];
                } else if (input[cursor] === '.') {
                    if (hasDecimal) {
                        // Multiple decimal points, stop parsing number here and let next iteration handle the rest
                        break;
                    }
                    hasDecimal = true;
                    value += input[cursor];
                } else {
                    break; // End of number
                }
                cursor++;
            }
            tokens.push({ type: 'NUMBER', value: hasDecimal ? parseFloat(value) : parseInt(value, 10) });
            continue;
        }

        // Parse Operators
        if (operators.includes(char)) {
            tokens.push({ type: 'OPERATOR', value: char });
            cursor++;
            continue;
        }

        // Parse Punctuation
        if (punctuation.includes(char)) {
            tokens.push({ type: 'PUNCTUATION', value: char });
            cursor++;
            continue;
        }

        // If no match, it's an unexpected character.
        tokens.push({ type: 'ERROR', value: char });
        cursor++;
    }
    return tokens;
};

/**
 * 2. Parser: Converts the token stream into an Abstract Syntax Tree (AST).
 *    The AST is a tree representation of the program's structure.
 */
const parse = (tokens) => {
    const ast = {
        type: 'Program',
        body: [], // Statements in the main program body
        functions: [] // Function declarations
    };
    let cursor = 0;

    // Helper to get the token at current cursor, skipping ignorable tokens (whitespace, comments)
    const getNextMeaningfulToken = (startCursor = cursor) => {
        let tempCursor = startCursor;
        let token = tokens[tempCursor];
        while (token && (token.type === 'WHITESPACE' || token.type === 'COMMENT')) {
            tempCursor++;
            token = tokens[tempCursor];
        }
        return { token, newCursor: tempCursor };
    };

    // Helper to get the current meaningful token without advancing the main cursor
    const peek = () => getNextMeaningfulToken().token;

    // Helper to peek a token ahead by an offset (meaningful tokens only)
    const peekAhead = (offset) => {
        let tempCursor = cursor;
        let meaningfulCount = 0;
        while (tempCursor < tokens.length) {
            let result = getNextMeaningfulToken(tempCursor);
            if (!result.token) return undefined; // No more tokens
            if (meaningfulCount === offset) return result.token;
            tempCursor = result.newCursor + 1; // Move past the found token for the next iteration
            meaningfulCount++;
        }
        return undefined;
    };

    // Helper to consume (advance past) a token, checking its type and optionally value
    const consume = (expectedTypes, expectedValue) => {
        const { token, newCursor } = getNextMeaningfulToken();
        cursor = newCursor; // Update cursor to point to the current meaningful token

        if (!token) {
            throw new Error(`Unexpected end of input. Expected one of [${expectedTypes.join(', ')}]${expectedValue ? ` with value ${expectedValue}` : ''}.`);
        }
        if (!expectedTypes.includes(token.type)) {
            throw new Error(`Expected token type one of [${expectedTypes.join(', ')}], got '${token.type}' (value: '${token.value}')`);
        }
        if (expectedValue !== undefined && token.value !== expectedValue) {
            throw new Error(`Expected token value '${expectedValue}', got '${token.value}'`);
        }
        cursor++; // Advance cursor past this consumed token
        return token;
    };

    // Helper to consume an optional semicolon after a statement
    const consumeOptionalSemicolon = () => {
        const { token, newCursor } = getNextMeaningfulToken(cursor);
        if (token && token.type === 'PUNCTUATION' && token.value === ';') {
            cursor = newCursor + 1;
            return true;
        }
        return false;
    };

    // New: Parsing Expressions with Operator Precedence
    // Order of operations: Parentheses > *, / > +, -

    // Handles literals, identifiers, function calls, and parenthesized expressions
    const parseFactor = () => {
        const { token: exprStartToken, newCursor: tempCursor } = getNextMeaningfulToken(cursor);
        cursor = tempCursor; // Advance cursor to the start of the expression

        if (!exprStartToken) {
            throw new Error("Expected an expression, but found end of input.");
        }

        // Literals
        if (exprStartToken.type === 'NUMBER') {
            cursor++; // consume
            return { type: 'NumberLiteral', value: exprStartToken.value };
        }
        if (exprStartToken.type === 'STRING_LITERAL') {
            cursor++; // consume
            return { type: 'StringLiteral', value: exprStartToken.value.slice(1, -1) };
        }
        if (exprStartToken.type === 'BOOLEAN_LITERAL') {
            cursor++; // consume
            return { type: 'BooleanLiteral', value: exprStartToken.value === 'true' };
        }

        // Parenthesized expression
        if (exprStartToken.type === 'PUNCTUATION' && exprStartToken.value === '(') {
            consume(['PUNCTUATION'], '(');
            const expr = parseExpression(); // Recursively parse the inner expression
            consume(['PUNCTUATION'], ')');
            return expr;
        }

        // Identifier or Function Call
        if (exprStartToken.type === 'IDENTIFIER') {
            const identifierToken = consume(['IDENTIFIER']); // Consume the identifier
            const nextToken = peek(); // Look ahead for '(' to distinguish identifier from function call
            if (nextToken && nextToken.type === 'PUNCTUATION' && nextToken.value === '(') {
                // It's a function call
                // Don't consume '(' here; it's handled by parseFunctionCall
                return parseFunctionCall(identifierToken.value); // Pass the already consumed function name
            } else {
                // It's just an identifier
                return { type: 'Identifier', name: identifierToken.value };
            }
        }

        throw new Error(`Unexpected token at start of expression factor: type '${exprStartToken.type}', value '${exprStartToken.value}'`);
    };

    // Handles multiplication and division
    const parseTerm = () => {
        let left = parseFactor();
        while (peek() && peek().type === 'OPERATOR' && (peek().value === '*' || peek().value === '/')) {
            const operator = consume(['OPERATOR']).value;
            const right = parseFactor();
            left = {
                type: 'BinaryExpression',
                operator: operator,
                left: left,
                right: right
            };
        }
        return left;
    };

    // Handles addition and subtraction (lowest precedence)
    const parseExpression = () => {
        let left = parseTerm();
        while (peek() && peek().type === 'OPERATOR' && (peek().value === '+' || peek().value === '-')) {
            const operator = consume(['OPERATOR']).value;
            const right = parseTerm();
            left = {
                type: 'BinaryExpression',
                operator: operator,
                left: left,
                right: right
            };
        }
        return left;
    };

    // Helper: Parses a function call specifically, assuming function name has already been parsed/peeked
    const parseFunctionCall = (functionName) => {
        consume(['PUNCTUATION'], '(');
        const args = [];
        let nextArgToken = peek();
        // Check if the next token is not a closing parenthesis, meaning there are arguments
        if (nextArgToken && (nextArgToken.type !== 'PUNCTUATION' || nextArgToken.value !== ')')) {
            args.push(parseExpression()); // Parse first argument as an expression
            while (peek() && peek().type === 'PUNCTUATION' && peek().value === ',') {
                consume(['PUNCTUATION'], ',');
                args.push(parseExpression()); // Parse subsequent arguments as expressions
            }
        }
        consume(['PUNCTUATION'], ')');
        return {
            type: 'FunctionCall',
            name: functionName,
            arguments: args
        };
    };

    // Helper to parse a single statement, used for both global and function bodies
    const parseSingleStatement = () => {
        const { token: currentToken, newCursor: currentMeaningfulCursor } = getNextMeaningfulToken(cursor);
        // If no meaningful token, or if it's a "block end" keyword, return null to signal end of statement parsing
        if (!currentToken || (currentToken.type === 'KEYWORD' && currentToken.value === 'end')) {
            return null;
        }
        cursor = currentMeaningfulCursor; // Update cursor to the current statement's start

        // Handle PRINT statement
        if (currentToken.type === 'KEYWORD' && currentToken.value === 'PRINT') {
            consume(['KEYWORD'], 'PRINT');
            const valueNode = parseExpression(); // PRINT argument can be any expression
            return {
                type: 'PrintStatement',
                value: valueNode
            };
        }
        // Handle RETURN statement (changed keyword to 'return')
        else if (currentToken.type === 'KEYWORD' && currentToken.value === 'return') {
            consume(['KEYWORD'], 'return');
            const valueNode = parseExpression(); // Return value can be any expression
            return {
                type: 'ReturnStatement',
                value: valueNode
            };
        }
        // Handle Variable Declaration/Assignment or Function Call as a statement
        else if (currentToken.type === 'IDENTIFIER') {
            const identifierToken = consume(['IDENTIFIER']); // Consume the identifier
            let explicitType = null;

            // Check for optional type annotation (e.g., 'var:type = value')
            const nextTokenAfterId = peek();
            if (nextTokenAfterId && nextTokenAfterId.type === 'PUNCTUATION' && nextTokenAfterId.value === ':') {
                consume(['PUNCTUATION'], ':'); // Consume ':'
                const typeToken = consume(['TYPE']); // Consume the type keyword (e.g., 'int', 'string', 'bool', 'float')
                explicitType = typeToken.value;
            }

            const nextTokenAfterTypeOrId = peek(); // This will be the '=' or '(' for function call
            if (nextTokenAfterTypeOrId && nextTokenAfterTypeOrId.type === 'OPERATOR' && nextTokenAfterTypeOrId.value === '=') {
                // It's a VarDeclaration/Assignment
                consume(['OPERATOR'], '=');
                const valueNode = parseExpression(); // Assignment value can be any expression
                return {
                    type: 'VarDeclaration',
                    name: identifierToken.value,
                    explicitType: explicitType, // Store the explicit type here (null if not provided)
                    value: valueNode
                };
            } else if (nextTokenAfterTypeOrId && nextTokenAfterTypeOrId.type === 'PUNCTUATION' && nextTokenAfterTypeOrId.value === '(') {
                // It's a Function Call as a standalone statement
                if (explicitType !== null) {
                    throw new Error(`Syntax Error: Type annotation for a standalone function call is not allowed. Found '${identifierToken.value}:${explicitType}(...)'.`);
                }
                const callNode = parseFunctionCall(identifierToken.value); // parseFunctionCall handles function calls
                if (callNode.type !== 'FunctionCall') {
                    throw new Error(`Internal parser error: Expected a function call, but parsed node of type ${callNode.type}.`);
                }
                return callNode; // Return the FunctionCall AST node
            } else {
                throw new Error(`Unexpected token sequence: identifier '${identifierToken.value}' not followed by '=', ':', or '(' for function call.`);
            }
        }
        // Handle _cpp_ injection
        else if (currentToken.type === 'KEYWORD' && currentToken.value === '_cpp_') {
            consume(['KEYWORD'], '_cpp_');
            consume(['PUNCTUATION'], '(');
            const cppCodeLiteral = consume(['STRING_LITERAL']);
            consume(['PUNCTUATION'], ')');

            let rawCppContent = cppCodeLiteral.value.slice(1, -1);
            // Re-escape the quotes and backslashes that were de-escaped by the lexer for raw string content
            rawCppContent = rawCppContent.replace(/\\"/g, '"');
            rawCppContent = rawCppContent.replace(/\\\\/g, '\\');

            return {
                type: 'CppInjection',
                code: rawCppContent
            };
        }
        // If the current meaningful token is a semicolon, just consume it and return null (no statement parsed)
        else if (currentToken.type === 'PUNCTUATION' && currentToken.value === ';') {
            consumeOptionalSemicolon();
            return null;
        }
        // If we encounter an ERROR token at the start of a statement, throw an error
        else if (currentToken.type === 'ERROR') {
            throw new Error(`Unexpected character: '${currentToken.value}'`);
        }
        // If no valid statement type matches
        else {
            throw new Error(`Unexpected token at start of statement: type '${currentToken.type}', value '${currentToken.value}'`);
        }
    };

    // Helper to parse a block of statements (e.g., function body) until an `end` keyword is found.
    const parseBlock = (endTokenValue) => {
        const blockStatements = [];
        const initialCursorPos = cursor; // Store cursor for better error reporting

        while (cursor < tokens.length) {
            const { token: currentTokenAtBlockStart } = getNextMeaningfulToken(cursor);

            if (!currentTokenAtBlockStart) {
                throw new Error(`Unexpected end of input. Expected '${endTokenValue}' to close block starting at token ${initialCursorPos}.`);
            }

            if (currentTokenAtBlockStart.type === 'KEYWORD' && currentTokenAtBlockStart.value === endTokenValue) {
                // The loop condition is met, the caller will consume the end token.
                return blockStatements;
            }

            const statement = parseSingleStatement();
            if (statement) {
                blockStatements.push(statement);
            }

            // Consume optional semicolon after each statement within the block
            consumeOptionalSemicolon();
        }

        // If we exit the loop without finding the endTokenValue, it means EOF was reached prematurely.
        throw new Error(`Unexpected end of input. Expected '${endTokenValue}' to close block starting at token ${initialCursorPos}.`);
    };


    // Main parsing loop for the program
    while (cursor < tokens.length) {
        const { token: currentToken, newCursor: currentMeaningfulCursor } = getNextMeaningfulToken(cursor);

        if (!currentToken) break; // Reached end of meaningful tokens

        cursor = currentMeaningfulCursor; // Update cursor to the current statement's start

        // Handle Function Declaration
        if (currentToken.type === 'KEYWORD' && currentToken.value === 'function') {
            consume(['KEYWORD'], 'function'); // Consume 'function'
            const functionName = consume(['IDENTIFIER']).value; // Consume function name
            consume(['PUNCTUATION'], '('); // Consume '('

            const parameters = [];
            let nextParamToken = peek();
            if (nextParamToken && nextParamToken.type === 'IDENTIFIER') {
                const paramName = consume(['IDENTIFIER']).value;
                let paramType = null;
                // Check for optional type annotation for parameter
                if (peek() && peek().type === 'PUNCTUATION' && peek().value === ':') {
                    consume(['PUNCTUATION'], ':'); // Consume ':'
                    paramType = consume(['TYPE']).value; // Consume the type keyword
                }
                parameters.push({ name: paramName, type: paramType });

                while (peek() && peek().type === 'PUNCTUATION' && peek().value === ',') {
                    consume(['PUNCTUATION'], ','); // Consume comma
                    const nextParamName = consume(['IDENTIFIER']).value;
                    let nextParamType = null;
                    if (peek() && peek().type === 'PUNCTUATION' && peek().value === ':') {
                        consume(['PUNCTUATION'], ':');
                        nextParamType = consume(['TYPE']).value;
                    }
                    parameters.push({ name: nextParamName, type: nextParamType });
                }
            }
            consume(['PUNCTUATION'], ')'); // Consume ')'

            let explicitReturnType = null;
            // Check for optional function return type annotation
            if (peek() && peek().type === 'PUNCTUATION' && peek().value === ':') {
                consume(['PUNCTUATION'], ':');
                explicitReturnType = consume(['TYPE']).value; // Consume the return type keyword
            }

            // Parse the function body until 'end' keyword is found
            const functionBody = parseBlock('end');

            // After parseBlock returns, the cursor is at the 'end' token. Consume it.
            consume(['KEYWORD'], 'end');

            ast.functions.push({
                type: 'FunctionDeclaration',
                name: functionName,
                parameters: parameters, // Now an array of { name, type } objects
                explicitReturnType: explicitReturnType, // New: explicit return type
                body: functionBody
            });
            // Functions don't need semicolons after 'end' keyword, continue to next token.
            continue;
        }
        // Handle global statements
        else {
            const statement = parseSingleStatement();
            if (statement) {
                // Disallow RETURN statements in global scope
                if (statement.type === 'ReturnStatement') {
                    throw new Error("RETURN statements are only allowed inside function definitions.");
                }
                ast.body.push(statement);
            }
            consumeOptionalSemicolon(); // Optional semicolon after any top-level statement
        }
    }
    return ast;
};

/**
 * 3. Code Generator: Traverses the AST and generates target code (C++ in this case).
 */
const generate = (ast) => {
    let cppCode = `#include <iostream>\n`;
    let needsStringHeader = false;
    let needsFloatDeclaration = false; // To track if 'float' keyword was used for var declaration
    const globalSymbolTable = new Map(); // Tracks variables and their types in main scope
    const functionReturnTypes = new Map(); // Tracks inferred/explicit return types for each function (funcName -> type string)

    // Helper to get C++ type string from inferred type (e.g., 'std::string' for 'string')
    const toCppType = (type) => {
        if (type === 'string') return 'std::string';
        if (type === 'int') return 'int';
        if (type === 'bool') return 'bool';
        if (type === 'float') { needsFloatDeclaration = true; return 'float'; } // Mark that float was used
        return type; // Should be 'void' or specific C++ types
    };

    // Helper for type compatibility check for assignments and returns
    const checkTypeCompatibility = (declaredType, assignedType, varName = '') => {
        // declaredType: explicit type given (e.g., 'int' for `x:int = ...`) or target return type
        // assignedType: inferred type of the value being assigned/returned
        if (declaredType === assignedType) return; // Exact match is always fine

        if (declaredType === 'string') {
            if (assignedType !== 'string') {
                throw new Error(`Type mismatch: ${varName ? `Variable '${varName}'` : 'Return value'} declared as 'string' but assigned value of type '${assignedType}'.`);
            }
        } else if (declaredType === 'bool') {
            if (!(assignedType === 'bool' || assignedType === 'int')) { // C++ allows int to bool conversion (0/1)
                throw new Error(`Type mismatch: ${varName ? `Variable '${varName}'` : 'Return value'} declared as 'bool' but assigned value of type '${assignedType}'.`);
            }
        } else if (declaredType === 'int') {
            if (assignedType === 'float') {
                throw new Error(`Type mismatch: ${varName ? `Variable '${varName}'` : 'Return value'} explicitly declared as 'int' but assigned a 'float' value. Explicit conversion required if truncation is intended.`);
            }
            if (!(assignedType === 'int' || assignedType === 'bool')) { // C++ allows bool to int conversion (0/1)
                throw new Error(`Type mismatch: ${varName ? `Variable '${varName}'` : 'Return value'} declared as 'int' but assigned value of type '${assignedType}'.`);
            }
        } else if (declaredType === 'float') {
            if (!(assignedType === 'int' || assignedType === 'float' || assignedType === 'bool')) {
                throw new Error(`Type mismatch: ${varName ? `Variable '${varName}'` : 'Return value'} declared as 'float' but assigned value of type '${assignedType}'.`);
            }
            // Float is generally permissive with int/bool
        }
        // If declaredType is 'void', it means no return value is expected.
        // If assignedType is not 'void' for a 'void' function, it means an illegal return of value.
        else if (declaredType === 'void') {
            if (assignedType !== 'void') { // Special check for function return statements
                 throw new Error(`Type mismatch: Function declared as 'void' but attempting to return value of type '${assignedType}'.`);
            }
        }
    };


    // Helper to get expression details (code and inferred type) within a given symbol table
    const getExpressionDetails = (node, currentSymbolTable) => {
        if (node.type === 'NumberLiteral') {
            // Distinguish int and float based on value
            if (Number.isInteger(node.value)) {
                return { code: node.value.toString(), type: 'int' };
            } else {
                return { code: node.value.toString(), type: 'float' };
            }
        }
        if (node.type === 'StringLiteral') { needsStringHeader = true; return { code: `"${node.value}"`, type: 'string' }; }
        if (node.type === 'BooleanLiteral') return { code: node.value ? 'true' : 'false', type: 'bool' };
        if (node.type === 'Identifier') {
            // Check local scope first, then global scope
            const varType = currentSymbolTable.get(node.name) || globalSymbolTable.get(node.name);
            if (!varType) {
                throw new Error(`Undeclared variable '${node.name}' used in expression.`);
            }
            return { code: node.name, type: varType };
        }
        if (node.type === 'FunctionCall') {
            const funcReturnType = functionReturnTypes.get(node.name);
            if (!funcReturnType) {
                throw new Error(`Call to undefined function '${node.name}'.`);
            }
            // Recursively get codes for arguments
            const argCodes = node.arguments.map(arg => getExpressionDetails(arg, currentSymbolTable).code);
            return { code: `${node.name}(${argCodes.join(', ')})`, type: funcReturnType };
        }
        // New: Handle Binary Expressions (arithmetic operations)
        if (node.type === 'BinaryExpression') {
            const leftDetails = getExpressionDetails(node.left, currentSymbolTable);
            const rightDetails = getExpressionDetails(node.right, currentSymbolTable);

            const op = node.operator;

            let resultType = null;
            // String concatenation
            if (leftDetails.type === 'string' && rightDetails.type === 'string' && op === '+') {
                needsStringHeader = true;
                resultType = 'string';
            }
            // Numeric operations (int, float, bool)
            else if ((leftDetails.type === 'int' || leftDetails.type === 'bool' || leftDetails.type === 'float') &&
                       (rightDetails.type === 'int' || rightDetails.type === 'bool' || rightDetails.type === 'float')) {
                // If any operand is float, result is float
                if (leftDetails.type === 'float' || rightDetails.type === 'float') {
                    resultType = 'float';
                } else {
                    resultType = 'int'; // Otherwise, result is int
                }
            } else {
                throw new Error(`Type mismatch for operator '${op}': Cannot apply '${op}' to types '${leftDetails.type}' and '${rightDetails.type}'.`);
            }
            return { code: `(${leftDetails.code} ${op} ${rightDetails.code})`, type: resultType };
        }
        throw new Error(`Unknown expression node type: ${node.type}`);
    };

    // Helper function to handle variable declarations/assignments with optional static typing
    const handleVarDeclaration = (node, symbolTable) => {
        const varName = node.name;
        const valueDetails = getExpressionDetails(node.value, symbolTable);
        const inferredAssignedType = valueDetails.type;

        let declaredCppType;
        let finalVarType; // The type this variable will effectively hold in the symbol table

        if (node.explicitType) {
            // Explicit type provided, perform type checking
            const explicitSimpleType = node.explicitType; // 'int', 'float', 'string', 'bool'
            checkTypeCompatibility(explicitSimpleType, inferredAssignedType, varName);
            declaredCppType = toCppType(explicitSimpleType);
            finalVarType = explicitSimpleType; // The variable holds this explicit type
        } else {
            // No explicit type, infer as before
            declaredCppType = toCppType(inferredAssignedType);
            finalVarType = inferredAssignedType;
        }

        if (symbolTable.has(varName)) {
            const existingType = symbolTable.get(varName);
            // If already declared, ensure consistency with the determined finalVarType
            if (existingType !== finalVarType) {
                // Allow re-assignment if types are compatible (e.g., int to float, bool to int)
                try {
                    checkTypeCompatibility(existingType, finalVarType, varName);
                } catch(e) {
                    throw new Error(`Type conflict: Variable '${varName}' already declared with type '${existingType}' but reassigned with a value of type '${finalVarType}'.`);
                }
            }
            return `${varName} = ${valueDetails.code};`;
        } else {
            symbolTable.set(varName, finalVarType);
            return `${declaredCppType} ${varName} = ${valueDetails.code};`;
        }
    };


    // --- Pass 1: Determine Function Return Types and build initial symbol tables for functions ---
    // This pass is necessary to know the return types of functions before generating their C++ signatures
    // and before functions can be called as expressions (e.g., `x = add(1,2)`).
    ast.functions.forEach(funcNode => {
        let inferredReturnType = funcNode.explicitReturnType || 'void'; // Start with explicit type or void
        let foundReturnStatement = false;

        // A temporary symbol table for this function's scope during type inference
        const funcScopeSymbolTable = new Map();
        funcNode.parameters.forEach(p => {
            funcScopeSymbolTable.set(p.name, p.type || 'int'); // Use explicit param type or default to int
        });

        funcNode.body.forEach(stmt => {
            if (stmt.type === 'VarDeclaration') {
                // Infer type of assigned value for local variable tracking
                let assignedType;
                try {
                     assignedType = getExpressionDetails(stmt.value, funcScopeSymbolTable).type;
                } catch (e) {
                    console.warn(`Warning: Could not fully infer type for VarDeclaration in Pass 1 in function '${funcNode.name}': ${e.message}`);
                    return;
                }

                const effectiveVarType = stmt.explicitType || assignedType;

                if (funcScopeSymbolTable.has(stmt.name)) {
                    const existingType = funcScopeSymbolTable.get(stmt.name);
                    try {
                        checkTypeCompatibility(existingType, effectiveVarType, stmt.name);
                    } catch(e) {
                        throw new Error(`Type conflict in function '${funcNode.name}': ${e.message}`);
                    }
                } else {
                    funcScopeSymbolTable.set(stmt.name, effectiveVarType);
                }
            } else if (stmt.type === 'ReturnStatement') {
                foundReturnStatement = true;
                const returnedValType = getExpressionDetails(stmt.value, funcScopeSymbolTable).type;

                // If explicit return type was specified, validate against it
                if (funcNode.explicitReturnType) {
                    checkTypeCompatibility(funcNode.explicitReturnType, returnedValType, `function '${funcNode.name}' return`);
                } else {
                    // If no explicit return type, infer from the first return statement
                    if (inferredReturnType === 'void') { // Still 'void' means this is the first return statement
                        inferredReturnType = returnedValType;
                    } else if (inferredReturnType !== returnedValType) {
                        // Check compatibility if already inferred from a previous return
                        try {
                            checkTypeCompatibility(inferredReturnType, returnedValType, `function '${funcNode.name}' return`);
                        } catch(e) {
                             throw new Error(`Conflicting return types detected in function '${funcNode.name}'. Expected '${inferredReturnType}', but found '${returnedValType}'.`);
                        }
                    }
                }
            }
        });

        // Final check: if an explicit return type was given but no return statements were found,
        // and the explicit type is not 'void', this is a potential issue but not strictly an error for compilation.
        // We'll trust the user's explicit declaration.
        // If there was an explicit type, that takes precedence. Otherwise, use the inferred type.
        functionReturnTypes.set(funcNode.name, funcNode.explicitReturnType || inferredReturnType);
    });

    // --- Generate Function Definitions (now that return types are known) ---
    ast.functions.forEach(funcNode => {
        const functionName = funcNode.name;
        const parameters = funcNode.parameters;
        const functionBody = funcNode.body;

        const returnType = toCppType(functionReturnTypes.get(functionName));
        // Use explicit parameter types or default to int
        const paramList = parameters.map(p => `${toCppType(p.type || 'int')} ${p.name}`).join(', ');

        cppCode += `\n${returnType} ${functionName}(${paramList}) {\n`;

        // Create the actual symbol table for code generation within this function's scope
        const funcLocalSymbolTable = new Map();
        parameters.forEach(p => funcLocalSymbolTable.set(p.name, p.type || 'int')); // Populate with parameter types

        // Generate function body statements
        functionBody.forEach(node => {
            if (node.type === 'VarDeclaration') {
                cppCode += `    ${handleVarDeclaration(node, funcLocalSymbolTable)}\n`;
            } else if (node.type === 'PrintStatement') {
                const valueDetails = getExpressionDetails(node.value, funcLocalSymbolTable);
                cppCode += `    std::cout << ${valueDetails.code} << std::endl;\n`;
            } else if (node.type === 'CppInjection') {
                cppCode += `    ${node.code}\n`;
            } else if (node.type === 'ReturnStatement') {
                const valueDetails = getExpressionDetails(node.value, funcLocalSymbolTable);
                cppCode += `    return ${valueDetails.code};\n`;
            } else if (node.type === 'FunctionCall') {
                const callDetails = getExpressionDetails(node, funcLocalSymbolTable);
                cppCode += `    ${callDetails.code};\n`; // Standalone function call
            }
        });
        cppCode += `}\n`;
    });


    // --- Generate Main Function ---
    cppCode += `\nint main() {\n`;
    cppCode += `    // Transpiled code from Simple Language (main section):\n`;

    ast.body.forEach(node => {
        if (node.type === 'VarDeclaration') {
            cppCode += `    ${handleVarDeclaration(node, globalSymbolTable)}\n`;
        } else if (node.type === 'PrintStatement') {
            const valueDetails = getExpressionDetails(node.value, globalSymbolTable);
            cppCode += `    std::cout << ${valueDetails.code} << std::endl;\n`;
        } else if (node.type === 'CppInjection') {
            cppCode += `    ${node.code}\n`;
        } else if (node.type === 'FunctionCall') {
            const callDetails = getExpressionDetails(node, globalSymbolTable);
            cppCode += `    ${callDetails.code};\n`; // Standalone function call
        }
        // RETURN statements in global scope are caught in parser.
    });

    cppCode += `    return 0;\n`;
    cppCode += `}\n`;

    if (needsStringHeader) {
        cppCode = `#include <string>\n` + cppCode;
    }
    // C++ doesn't strictly need a header for `float` unless complex math functions are used.
    // For simple float variables, it's a built-in type. But better be safe if user expects a header.
    // Let's add `<cmath>` if `float` type was explicitly declared or inferred.
    if (needsFloatDeclaration) {
        cppCode = `#include <cmath>\n` + cppCode;
    }


    return cppCode;
};

/**
 * Main transpiler function that orchestrates the lexing, parsing, and code generation.
 * @param {string} code - The input code in the simple programming language.
 * @returns {string} - The transpiled C++ code or an error message.
 */
export const transpile = (code) => {
    try {
        const tokens = tokenize(code);
        // console.log('Tokens:', tokens); // Uncomment for debugging
        const ast = parse(tokens);
        // console.log('AST:', JSON.stringify(ast, null, 2)); // Uncomment for debugging
        const cpp = generate(ast);
        return cpp;
    } catch (e) {
        return `Error during transpilation:\n${e.message}`;
    }
};