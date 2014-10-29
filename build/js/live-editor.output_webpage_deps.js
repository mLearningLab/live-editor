/*
  Copyright (C) 2013 Ariya Hidayat <ariya.hidayat@gmail.com>
  Copyright (C) 2013 Thaddee Tyl <thaddee.tyl@gmail.com>
  Copyright (C) 2012 Ariya Hidayat <ariya.hidayat@gmail.com>
  Copyright (C) 2012 Mathias Bynens <mathias@qiwi.be>
  Copyright (C) 2012 Joost-Wim Boekesteijn <joost-wim@boekesteijn.nl>
  Copyright (C) 2012 Kris Kowal <kris.kowal@cixar.com>
  Copyright (C) 2012 Yusuke Suzuki <utatane.tea@gmail.com>
  Copyright (C) 2012 Arpad Borsos <arpad.borsos@googlemail.com>
  Copyright (C) 2011 Ariya Hidayat <ariya.hidayat@gmail.com>

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

/*jslint bitwise:true plusplus:true */
/*global esprima:true, define:true, exports:true, window: true,
createLocationMarker: true,
throwError: true, generateStatement: true, peek: true,
parseAssignmentExpression: true, parseBlock: true, parseExpression: true,
parseFunctionDeclaration: true, parseFunctionExpression: true,
parseFunctionSourceElements: true, parseVariableIdentifier: true,
parseLeftHandSideExpression: true,
parseUnaryExpression: true,
parseStatement: true, parseSourceElement: true */

(function (root, factory) {
    'use strict';

    // Universal Module Definition (UMD) to support AMD, CommonJS/Node.js,
    // Rhino, and plain browser loading.
    if (typeof define === 'function' && define.amd) {
        define(['exports'], factory);
    } else if (typeof exports !== 'undefined') {
        factory(exports);
    } else {
        factory((root.esprima = {}));
    }
}(this, function (exports) {
    'use strict';

    var Token,
        TokenName,
        FnExprTokens,
        Syntax,
        PropertyKind,
        Messages,
        Regex,
        SyntaxTreeDelegate,
        source,
        strict,
        index,
        lineNumber,
        lineStart,
        length,
        delegate,
        lookahead,
        state,
        extra;

    Token = {
        BooleanLiteral: 1,
        EOF: 2,
        Identifier: 3,
        Keyword: 4,
        NullLiteral: 5,
        NumericLiteral: 6,
        Punctuator: 7,
        StringLiteral: 8,
        RegularExpression: 9
    };

    TokenName = {};
    TokenName[Token.BooleanLiteral] = 'Boolean';
    TokenName[Token.EOF] = '<end>';
    TokenName[Token.Identifier] = 'Identifier';
    TokenName[Token.Keyword] = 'Keyword';
    TokenName[Token.NullLiteral] = 'Null';
    TokenName[Token.NumericLiteral] = 'Numeric';
    TokenName[Token.Punctuator] = 'Punctuator';
    TokenName[Token.StringLiteral] = 'String';
    TokenName[Token.RegularExpression] = 'RegularExpression';

    // A function following one of those tokens is an expression.
    FnExprTokens = ['(', '{', '[', 'in', 'typeof', 'instanceof', 'new',
                    'return', 'case', 'delete', 'throw', 'void',
                    // assignment operators
                    '=', '+=', '-=', '*=', '/=', '%=', '<<=', '>>=', '>>>=',
                    '&=', '|=', '^=', ',',
                    // binary/unary operators
                    '+', '-', '*', '/', '%', '++', '--', '<<', '>>', '>>>', '&',
                    '|', '^', '!', '~', '&&', '||', '?', ':', '===', '==', '>=',
                    '<=', '<', '>', '!=', '!=='];

    Syntax = {
        AssignmentExpression: 'AssignmentExpression',
        ArrayExpression: 'ArrayExpression',
        BlockStatement: 'BlockStatement',
        BinaryExpression: 'BinaryExpression',
        BreakStatement: 'BreakStatement',
        CallExpression: 'CallExpression',
        CatchClause: 'CatchClause',
        ConditionalExpression: 'ConditionalExpression',
        ContinueStatement: 'ContinueStatement',
        DoWhileStatement: 'DoWhileStatement',
        DebuggerStatement: 'DebuggerStatement',
        EmptyStatement: 'EmptyStatement',
        ExpressionStatement: 'ExpressionStatement',
        ForStatement: 'ForStatement',
        ForInStatement: 'ForInStatement',
        FunctionDeclaration: 'FunctionDeclaration',
        FunctionExpression: 'FunctionExpression',
        Identifier: 'Identifier',
        IfStatement: 'IfStatement',
        Literal: 'Literal',
        LabeledStatement: 'LabeledStatement',
        LogicalExpression: 'LogicalExpression',
        MemberExpression: 'MemberExpression',
        NewExpression: 'NewExpression',
        ObjectExpression: 'ObjectExpression',
        Program: 'Program',
        Property: 'Property',
        ReturnStatement: 'ReturnStatement',
        SequenceExpression: 'SequenceExpression',
        SwitchStatement: 'SwitchStatement',
        SwitchCase: 'SwitchCase',
        ThisExpression: 'ThisExpression',
        ThrowStatement: 'ThrowStatement',
        TryStatement: 'TryStatement',
        UnaryExpression: 'UnaryExpression',
        UpdateExpression: 'UpdateExpression',
        VariableDeclaration: 'VariableDeclaration',
        VariableDeclarator: 'VariableDeclarator',
        WhileStatement: 'WhileStatement',
        WithStatement: 'WithStatement'
    };

    PropertyKind = {
        Data: 1,
        Get: 2,
        Set: 4
    };

    // Error messages should be identical to V8.
    Messages = {
        UnexpectedToken:  'Unexpected token %0',
        UnexpectedNumber:  'Unexpected number',
        UnexpectedString:  'Unexpected string',
        UnexpectedIdentifier:  'Unexpected identifier',
        UnexpectedReserved:  'Unexpected reserved word',
        UnexpectedEOS:  'Unexpected end of input',
        NewlineAfterThrow:  'Illegal newline after throw',
        InvalidRegExp: 'Invalid regular expression',
        UnterminatedRegExp:  'Invalid regular expression: missing /',
        InvalidLHSInAssignment:  'Invalid left-hand side in assignment',
        InvalidLHSInForIn:  'Invalid left-hand side in for-in',
        MultipleDefaultsInSwitch: 'More than one default clause in switch statement',
        NoCatchOrFinally:  'Missing catch or finally after try',
        UnknownLabel: 'Undefined label \'%0\'',
        Redeclaration: '%0 \'%1\' has already been declared',
        IllegalContinue: 'Illegal continue statement',
        IllegalBreak: 'Illegal break statement',
        IllegalReturn: 'Illegal return statement',
        StrictModeWith:  'Strict mode code may not include a with statement',
        StrictCatchVariable:  'Catch variable may not be eval or arguments in strict mode',
        StrictVarName:  'Variable name may not be eval or arguments in strict mode',
        StrictParamName:  'Parameter name eval or arguments is not allowed in strict mode',
        StrictParamDupe: 'Strict mode function may not have duplicate parameter names',
        StrictFunctionName:  'Function name may not be eval or arguments in strict mode',
        StrictOctalLiteral:  'Octal literals are not allowed in strict mode.',
        StrictDelete:  'Delete of an unqualified identifier in strict mode.',
        StrictDuplicateProperty:  'Duplicate data property in object literal not allowed in strict mode',
        AccessorDataProperty:  'Object literal may not have data and accessor property with the same name',
        AccessorGetSet:  'Object literal may not have multiple get/set accessors with the same name',
        StrictLHSAssignment:  'Assignment to eval or arguments is not allowed in strict mode',
        StrictLHSPostfix:  'Postfix increment/decrement may not have eval or arguments operand in strict mode',
        StrictLHSPrefix:  'Prefix increment/decrement may not have eval or arguments operand in strict mode',
        StrictReservedWord:  'Use of future reserved word in strict mode'
    };

    // See also tools/generate-unicode-regex.py.
    Regex = {
        NonAsciiIdentifierStart: new RegExp('[\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0\u08a2-\u08ac\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097f\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58\u0c59\u0c60\u0c61\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d60\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191c\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19c1-\u19c7\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua697\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa80-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc]'),
        NonAsciiIdentifierPart: new RegExp('[\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0300-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u0483-\u0487\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u05d0-\u05ea\u05f0-\u05f2\u0610-\u061a\u0620-\u0669\u066e-\u06d3\u06d5-\u06dc\u06df-\u06e8\u06ea-\u06fc\u06ff\u0710-\u074a\u074d-\u07b1\u07c0-\u07f5\u07fa\u0800-\u082d\u0840-\u085b\u08a0\u08a2-\u08ac\u08e4-\u08fe\u0900-\u0963\u0966-\u096f\u0971-\u0977\u0979-\u097f\u0981-\u0983\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bc-\u09c4\u09c7\u09c8\u09cb-\u09ce\u09d7\u09dc\u09dd\u09df-\u09e3\u09e6-\u09f1\u0a01-\u0a03\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a3c\u0a3e-\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a59-\u0a5c\u0a5e\u0a66-\u0a75\u0a81-\u0a83\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abc-\u0ac5\u0ac7-\u0ac9\u0acb-\u0acd\u0ad0\u0ae0-\u0ae3\u0ae6-\u0aef\u0b01-\u0b03\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3c-\u0b44\u0b47\u0b48\u0b4b-\u0b4d\u0b56\u0b57\u0b5c\u0b5d\u0b5f-\u0b63\u0b66-\u0b6f\u0b71\u0b82\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bbe-\u0bc2\u0bc6-\u0bc8\u0bca-\u0bcd\u0bd0\u0bd7\u0be6-\u0bef\u0c01-\u0c03\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d-\u0c44\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c58\u0c59\u0c60-\u0c63\u0c66-\u0c6f\u0c82\u0c83\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbc-\u0cc4\u0cc6-\u0cc8\u0cca-\u0ccd\u0cd5\u0cd6\u0cde\u0ce0-\u0ce3\u0ce6-\u0cef\u0cf1\u0cf2\u0d02\u0d03\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d-\u0d44\u0d46-\u0d48\u0d4a-\u0d4e\u0d57\u0d60-\u0d63\u0d66-\u0d6f\u0d7a-\u0d7f\u0d82\u0d83\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0dca\u0dcf-\u0dd4\u0dd6\u0dd8-\u0ddf\u0df2\u0df3\u0e01-\u0e3a\u0e40-\u0e4e\u0e50-\u0e59\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb9\u0ebb-\u0ebd\u0ec0-\u0ec4\u0ec6\u0ec8-\u0ecd\u0ed0-\u0ed9\u0edc-\u0edf\u0f00\u0f18\u0f19\u0f20-\u0f29\u0f35\u0f37\u0f39\u0f3e-\u0f47\u0f49-\u0f6c\u0f71-\u0f84\u0f86-\u0f97\u0f99-\u0fbc\u0fc6\u1000-\u1049\u1050-\u109d\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u135d-\u135f\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176c\u176e-\u1770\u1772\u1773\u1780-\u17d3\u17d7\u17dc\u17dd\u17e0-\u17e9\u180b-\u180d\u1810-\u1819\u1820-\u1877\u1880-\u18aa\u18b0-\u18f5\u1900-\u191c\u1920-\u192b\u1930-\u193b\u1946-\u196d\u1970-\u1974\u1980-\u19ab\u19b0-\u19c9\u19d0-\u19d9\u1a00-\u1a1b\u1a20-\u1a5e\u1a60-\u1a7c\u1a7f-\u1a89\u1a90-\u1a99\u1aa7\u1b00-\u1b4b\u1b50-\u1b59\u1b6b-\u1b73\u1b80-\u1bf3\u1c00-\u1c37\u1c40-\u1c49\u1c4d-\u1c7d\u1cd0-\u1cd2\u1cd4-\u1cf6\u1d00-\u1de6\u1dfc-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u200c\u200d\u203f\u2040\u2054\u2071\u207f\u2090-\u209c\u20d0-\u20dc\u20e1\u20e5-\u20f0\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d7f-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2de0-\u2dff\u2e2f\u3005-\u3007\u3021-\u302f\u3031-\u3035\u3038-\u303c\u3041-\u3096\u3099\u309a\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua62b\ua640-\ua66f\ua674-\ua67d\ua67f-\ua697\ua69f-\ua6f1\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua827\ua840-\ua873\ua880-\ua8c4\ua8d0-\ua8d9\ua8e0-\ua8f7\ua8fb\ua900-\ua92d\ua930-\ua953\ua960-\ua97c\ua980-\ua9c0\ua9cf-\ua9d9\uaa00-\uaa36\uaa40-\uaa4d\uaa50-\uaa59\uaa60-\uaa76\uaa7a\uaa7b\uaa80-\uaac2\uaadb-\uaadd\uaae0-\uaaef\uaaf2-\uaaf6\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabea\uabec\uabed\uabf0-\uabf9\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe00-\ufe0f\ufe20-\ufe26\ufe33\ufe34\ufe4d-\ufe4f\ufe70-\ufe74\ufe76-\ufefc\uff10-\uff19\uff21-\uff3a\uff3f\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc]')
    };

    // Ensure the condition is true, otherwise throw an error.
    // This is only to have a better contract semantic, i.e. another safety net
    // to catch a logic error. The condition shall be fulfilled in normal case.
    // Do NOT use this to enforce a certain condition on any user input.

    function assert(condition, message) {
        if (!condition) {
            throw new Error('ASSERT: ' + message);
        }
    }

    function isDecimalDigit(ch) {
        return (ch >= 48 && ch <= 57);   // 0..9
    }

    function isHexDigit(ch) {
        return '0123456789abcdefABCDEF'.indexOf(ch) >= 0;
    }

    function isOctalDigit(ch) {
        return '01234567'.indexOf(ch) >= 0;
    }


    // 7.2 White Space

    function isWhiteSpace(ch) {
        return (ch === 32) ||  // space
            (ch === 9) ||      // tab
            (ch === 0xB) ||
            (ch === 0xC) ||
            (ch === 0xA0) ||
            (ch >= 0x1680 && '\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\uFEFF'.indexOf(String.fromCharCode(ch)) > 0);
    }

    // 7.3 Line Terminators

    function isLineTerminator(ch) {
        return (ch === 10) || (ch === 13) || (ch === 0x2028) || (ch === 0x2029);
    }

    // 7.6 Identifier Names and Identifiers

    function isIdentifierStart(ch) {
        return (ch === 36) || (ch === 95) ||  // $ (dollar) and _ (underscore)
            (ch >= 65 && ch <= 90) ||         // A..Z
            (ch >= 97 && ch <= 122) ||        // a..z
            (ch === 92) ||                    // \ (backslash)
            ((ch >= 0x80) && Regex.NonAsciiIdentifierStart.test(String.fromCharCode(ch)));
    }

    function isIdentifierPart(ch) {
        return (ch === 36) || (ch === 95) ||  // $ (dollar) and _ (underscore)
            (ch >= 65 && ch <= 90) ||         // A..Z
            (ch >= 97 && ch <= 122) ||        // a..z
            (ch >= 48 && ch <= 57) ||         // 0..9
            (ch === 92) ||                    // \ (backslash)
            ((ch >= 0x80) && Regex.NonAsciiIdentifierPart.test(String.fromCharCode(ch)));
    }

    // 7.6.1.2 Future Reserved Words

    function isFutureReservedWord(id) {
        switch (id) {
        case 'class':
        case 'enum':
        case 'export':
        case 'extends':
        case 'import':
        case 'super':
            return true;
        default:
            return false;
        }
    }

    function isStrictModeReservedWord(id) {
        switch (id) {
        case 'implements':
        case 'interface':
        case 'package':
        case 'private':
        case 'protected':
        case 'public':
        case 'static':
        case 'yield':
        case 'let':
            return true;
        default:
            return false;
        }
    }

    function isRestrictedWord(id) {
        return id === 'eval' || id === 'arguments';
    }

    // 7.6.1.1 Keywords

    function isKeyword(id) {
        if (strict && isStrictModeReservedWord(id)) {
            return true;
        }

        // 'const' is specialized as Keyword in V8.
        // 'yield' and 'let' are for compatiblity with SpiderMonkey and ES.next.
        // Some others are from future reserved words.

        switch (id.length) {
        case 2:
            return (id === 'if') || (id === 'in') || (id === 'do');
        case 3:
            return (id === 'var') || (id === 'for') || (id === 'new') ||
                (id === 'try') || (id === 'let');
        case 4:
            return (id === 'this') || (id === 'else') || (id === 'case') ||
                (id === 'void') || (id === 'with') || (id === 'enum');
        case 5:
            return (id === 'while') || (id === 'break') || (id === 'catch') ||
                (id === 'throw') || (id === 'const') || (id === 'yield') ||
                (id === 'class') || (id === 'super');
        case 6:
            return (id === 'return') || (id === 'typeof') || (id === 'delete') ||
                (id === 'switch') || (id === 'export') || (id === 'import');
        case 7:
            return (id === 'default') || (id === 'finally') || (id === 'extends');
        case 8:
            return (id === 'function') || (id === 'continue') || (id === 'debugger');
        case 10:
            return (id === 'instanceof');
        default:
            return false;
        }
    }

    // 7.4 Comments

    function addComment(type, value, start, end, loc) {
        var comment;

        assert(typeof start === 'number', 'Comment must have valid position');

        // Because the way the actual token is scanned, often the comments
        // (if any) are skipped twice during the lexical analysis.
        // Thus, we need to skip adding a comment if the comment array already
        // handled it.
        if (state.lastCommentStart >= start) {
            return;
        }
        state.lastCommentStart = start;

        comment = {
            type: type,
            value: value
        };
        if (extra.range) {
            comment.range = [start, end];
        }
        if (extra.loc) {
            comment.loc = loc;
        }
        extra.comments.push(comment);
    }

    function skipSingleLineComment() {
        var start, loc, ch, comment;

        start = index - 2;
        loc = {
            start: {
                line: lineNumber,
                column: index - lineStart - 2
            }
        };

        while (index < length) {
            ch = source.charCodeAt(index);
            ++index;
            if (isLineTerminator(ch)) {
                if (extra.comments) {
                    comment = source.slice(start + 2, index - 1);
                    loc.end = {
                        line: lineNumber,
                        column: index - lineStart - 1
                    };
                    addComment('Line', comment, start, index - 1, loc);
                }
                if (ch === 13 && source.charCodeAt(index) === 10) {
                    ++index;
                }
                ++lineNumber;
                lineStart = index;
                return;
            }
        }

        if (extra.comments) {
            comment = source.slice(start + 2, index);
            loc.end = {
                line: lineNumber,
                column: index - lineStart
            };
            addComment('Line', comment, start, index, loc);
        }
    }

    function skipMultiLineComment() {
        var start, loc, ch, comment;

        if (extra.comments) {
            start = index - 2;
            loc = {
                start: {
                    line: lineNumber,
                    column: index - lineStart - 2
                }
            };
        }

        while (index < length) {
            ch = source.charCodeAt(index);
            if (isLineTerminator(ch)) {
                if (ch === 13 && source.charCodeAt(index + 1) === 10) {
                    ++index;
                }
                ++lineNumber;
                ++index;
                lineStart = index;
                if (index >= length) {
                    throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                }
            } else if (ch === 42) {
                // Block comment ends with '*/' (char #42, char #47).
                if (source.charCodeAt(index + 1) === 47) {
                    ++index;
                    ++index;
                    if (extra.comments) {
                        comment = source.slice(start + 2, index - 2);
                        loc.end = {
                            line: lineNumber,
                            column: index - lineStart
                        };
                        addComment('Block', comment, start, index, loc);
                    }
                    return;
                }
                ++index;
            } else {
                ++index;
            }
        }

        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
    }

    function skipComment() {
        var ch;

        while (index < length) {
            ch = source.charCodeAt(index);

            if (isWhiteSpace(ch)) {
                ++index;
            } else if (isLineTerminator(ch)) {
                ++index;
                if (ch === 13 && source.charCodeAt(index) === 10) {
                    ++index;
                }
                ++lineNumber;
                lineStart = index;
            } else if (ch === 47) { // 47 is '/'
                ch = source.charCodeAt(index + 1);
                if (ch === 47) {
                    ++index;
                    ++index;
                    skipSingleLineComment();
                } else if (ch === 42) {  // 42 is '*'
                    ++index;
                    ++index;
                    skipMultiLineComment();
                } else {
                    break;
                }
            } else {
                break;
            }
        }
    }

    function scanHexEscape(prefix) {
        var i, len, ch, code = 0;

        len = (prefix === 'u') ? 4 : 2;
        for (i = 0; i < len; ++i) {
            if (index < length && isHexDigit(source[index])) {
                ch = source[index++];
                code = code * 16 + '0123456789abcdef'.indexOf(ch.toLowerCase());
            } else {
                return '';
            }
        }
        return String.fromCharCode(code);
    }

    function getEscapedIdentifier() {
        var ch, id;

        ch = source.charCodeAt(index++);
        id = String.fromCharCode(ch);

        // '\u' (char #92, char #117) denotes an escaped character.
        if (ch === 92) {
            if (source.charCodeAt(index) !== 117) {
                throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
            }
            ++index;
            ch = scanHexEscape('u');
            if (!ch || ch === '\\' || !isIdentifierStart(ch.charCodeAt(0))) {
                throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
            }
            id = ch;
        }

        while (index < length) {
            ch = source.charCodeAt(index);
            if (!isIdentifierPart(ch)) {
                break;
            }
            ++index;
            id += String.fromCharCode(ch);

            // '\u' (char #92, char #117) denotes an escaped character.
            if (ch === 92) {
                id = id.substr(0, id.length - 1);
                if (source.charCodeAt(index) !== 117) {
                    throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                }
                ++index;
                ch = scanHexEscape('u');
                if (!ch || ch === '\\' || !isIdentifierPart(ch.charCodeAt(0))) {
                    throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                }
                id += ch;
            }
        }

        return id;
    }

    function getIdentifier() {
        var start, ch;

        start = index++;
        while (index < length) {
            ch = source.charCodeAt(index);
            if (ch === 92) {
                // Blackslash (char #92) marks Unicode escape sequence.
                index = start;
                return getEscapedIdentifier();
            }
            if (isIdentifierPart(ch)) {
                ++index;
            } else {
                break;
            }
        }

        return source.slice(start, index);
    }

    function scanIdentifier() {
        var start, id, type;

        start = index;

        // Backslash (char #92) starts an escaped character.
        id = (source.charCodeAt(index) === 92) ? getEscapedIdentifier() : getIdentifier();

        // There is no keyword or literal with only one character.
        // Thus, it must be an identifier.
        if (id.length === 1) {
            type = Token.Identifier;
        } else if (isKeyword(id)) {
            type = Token.Keyword;
        } else if (id === 'null') {
            type = Token.NullLiteral;
        } else if (id === 'true' || id === 'false') {
            type = Token.BooleanLiteral;
        } else {
            type = Token.Identifier;
        }

        return {
            type: type,
            value: id,
            lineNumber: lineNumber,
            lineStart: lineStart,
            range: [start, index]
        };
    }


    // 7.7 Punctuators

    function scanPunctuator() {
        var start = index,
            code = source.charCodeAt(index),
            code2,
            ch1 = source[index],
            ch2,
            ch3,
            ch4;

        switch (code) {

        // Check for most common single-character punctuators.
        case 46:   // . dot
        case 40:   // ( open bracket
        case 41:   // ) close bracket
        case 59:   // ; semicolon
        case 44:   // , comma
        case 123:  // { open curly brace
        case 125:  // } close curly brace
        case 91:   // [
        case 93:   // ]
        case 58:   // :
        case 63:   // ?
        case 126:  // ~
            ++index;
            if (extra.tokenize) {
                if (code === 40) {
                    extra.openParenToken = extra.tokens.length;
                } else if (code === 123) {
                    extra.openCurlyToken = extra.tokens.length;
                }
            }
            return {
                type: Token.Punctuator,
                value: String.fromCharCode(code),
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };

        default:
            code2 = source.charCodeAt(index + 1);

            // '=' (char #61) marks an assignment or comparison operator.
            if (code2 === 61) {
                switch (code) {
                case 37:  // %
                case 38:  // &
                case 42:  // *:
                case 43:  // +
                case 45:  // -
                case 47:  // /
                case 60:  // <
                case 62:  // >
                case 94:  // ^
                case 124: // |
                    index += 2;
                    return {
                        type: Token.Punctuator,
                        value: String.fromCharCode(code) + String.fromCharCode(code2),
                        lineNumber: lineNumber,
                        lineStart: lineStart,
                        range: [start, index]
                    };

                case 33: // !
                case 61: // =
                    index += 2;

                    // !== and ===
                    if (source.charCodeAt(index) === 61) {
                        ++index;
                    }
                    return {
                        type: Token.Punctuator,
                        value: source.slice(start, index),
                        lineNumber: lineNumber,
                        lineStart: lineStart,
                        range: [start, index]
                    };
                default:
                    break;
                }
            }
            break;
        }

        // Peek more characters.

        ch2 = source[index + 1];
        ch3 = source[index + 2];
        ch4 = source[index + 3];

        // 4-character punctuator: >>>=

        if (ch1 === '>' && ch2 === '>' && ch3 === '>') {
            if (ch4 === '=') {
                index += 4;
                return {
                    type: Token.Punctuator,
                    value: '>>>=',
                    lineNumber: lineNumber,
                    lineStart: lineStart,
                    range: [start, index]
                };
            }
        }

        // 3-character punctuators: === !== >>> <<= >>=

        if (ch1 === '>' && ch2 === '>' && ch3 === '>') {
            index += 3;
            return {
                type: Token.Punctuator,
                value: '>>>',
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        if (ch1 === '<' && ch2 === '<' && ch3 === '=') {
            index += 3;
            return {
                type: Token.Punctuator,
                value: '<<=',
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        if (ch1 === '>' && ch2 === '>' && ch3 === '=') {
            index += 3;
            return {
                type: Token.Punctuator,
                value: '>>=',
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        // Other 2-character punctuators: ++ -- << >> && ||

        if (ch1 === ch2 && ('+-<>&|'.indexOf(ch1) >= 0)) {
            index += 2;
            return {
                type: Token.Punctuator,
                value: ch1 + ch2,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        if ('<>=!+-*%&|^/'.indexOf(ch1) >= 0) {
            ++index;
            return {
                type: Token.Punctuator,
                value: ch1,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
    }

    // 7.8.3 Numeric Literals

    function scanHexLiteral(start) {
        var number = '';

        while (index < length) {
            if (!isHexDigit(source[index])) {
                break;
            }
            number += source[index++];
        }

        if (number.length === 0) {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        if (isIdentifierStart(source.charCodeAt(index))) {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        return {
            type: Token.NumericLiteral,
            value: parseInt('0x' + number, 16),
            lineNumber: lineNumber,
            lineStart: lineStart,
            range: [start, index]
        };
    }

    function scanOctalLiteral(start) {
        var number = '0' + source[index++];
        while (index < length) {
            if (!isOctalDigit(source[index])) {
                break;
            }
            number += source[index++];
        }

        if (isIdentifierStart(source.charCodeAt(index)) || isDecimalDigit(source.charCodeAt(index))) {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        return {
            type: Token.NumericLiteral,
            value: parseInt(number, 8),
            octal: true,
            lineNumber: lineNumber,
            lineStart: lineStart,
            range: [start, index]
        };
    }

    function scanNumericLiteral() {
        var number, start, ch;

        ch = source[index];
        assert(isDecimalDigit(ch.charCodeAt(0)) || (ch === '.'),
            'Numeric literal must start with a decimal digit or a decimal point');

        start = index;
        number = '';
        if (ch !== '.') {
            number = source[index++];
            ch = source[index];

            // Hex number starts with '0x'.
            // Octal number starts with '0'.
            if (number === '0') {
                if (ch === 'x' || ch === 'X') {
                    ++index;
                    return scanHexLiteral(start);
                }
                if (isOctalDigit(ch)) {
                    return scanOctalLiteral(start);
                }

                // decimal number starts with '0' such as '09' is illegal.
                if (ch && isDecimalDigit(ch.charCodeAt(0))) {
                    throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                }
            }

            while (isDecimalDigit(source.charCodeAt(index))) {
                number += source[index++];
            }
            ch = source[index];
        }

        if (ch === '.') {
            number += source[index++];
            while (isDecimalDigit(source.charCodeAt(index))) {
                number += source[index++];
            }
            ch = source[index];
        }

        if (ch === 'e' || ch === 'E') {
            number += source[index++];

            ch = source[index];
            if (ch === '+' || ch === '-') {
                number += source[index++];
            }
            if (isDecimalDigit(source.charCodeAt(index))) {
                while (isDecimalDigit(source.charCodeAt(index))) {
                    number += source[index++];
                }
            } else {
                throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
            }
        }

        if (isIdentifierStart(source.charCodeAt(index))) {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        return {
            type: Token.NumericLiteral,
            value: parseFloat(number),
            lineNumber: lineNumber,
            lineStart: lineStart,
            range: [start, index]
        };
    }

    // 7.8.4 String Literals

    function scanStringLiteral() {
        var str = '', quote, start, ch, code, unescaped, restore, octal = false;

        quote = source[index];
        assert((quote === '\'' || quote === '"'),
            'String literal must starts with a quote');

        start = index;
        ++index;

        while (index < length) {
            ch = source[index++];

            if (ch === quote) {
                quote = '';
                break;
            } else if (ch === '\\') {
                ch = source[index++];
                if (!ch || !isLineTerminator(ch.charCodeAt(0))) {
                    switch (ch) {
                    case 'n':
                        str += '\n';
                        break;
                    case 'r':
                        str += '\r';
                        break;
                    case 't':
                        str += '\t';
                        break;
                    case 'u':
                    case 'x':
                        restore = index;
                        unescaped = scanHexEscape(ch);
                        if (unescaped) {
                            str += unescaped;
                        } else {
                            index = restore;
                            str += ch;
                        }
                        break;
                    case 'b':
                        str += '\b';
                        break;
                    case 'f':
                        str += '\f';
                        break;
                    case 'v':
                        str += '\x0B';
                        break;

                    default:
                        if (isOctalDigit(ch)) {
                            code = '01234567'.indexOf(ch);

                            // \0 is not octal escape sequence
                            if (code !== 0) {
                                octal = true;
                            }

                            if (index < length && isOctalDigit(source[index])) {
                                octal = true;
                                code = code * 8 + '01234567'.indexOf(source[index++]);

                                // 3 digits are only allowed when string starts
                                // with 0, 1, 2, 3
                                if ('0123'.indexOf(ch) >= 0 &&
                                        index < length &&
                                        isOctalDigit(source[index])) {
                                    code = code * 8 + '01234567'.indexOf(source[index++]);
                                }
                            }
                            str += String.fromCharCode(code);
                        } else {
                            str += ch;
                        }
                        break;
                    }
                } else {
                    ++lineNumber;
                    if (ch ===  '\r' && source[index] === '\n') {
                        ++index;
                    }
                }
            } else if (isLineTerminator(ch.charCodeAt(0))) {
                break;
            } else {
                str += ch;
            }
        }

        if (quote !== '') {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        return {
            type: Token.StringLiteral,
            value: str,
            octal: octal,
            lineNumber: lineNumber,
            lineStart: lineStart,
            range: [start, index]
        };
    }

    function scanRegExp() {
        var str, ch, start, pattern, flags, value, classMarker = false, restore, terminated = false;

        lookahead = null;
        skipComment();

        start = index;
        ch = source[index];
        assert(ch === '/', 'Regular expression literal must start with a slash');
        str = source[index++];

        while (index < length) {
            ch = source[index++];
            str += ch;
            if (classMarker) {
                if (ch === ']') {
                    classMarker = false;
                }
            } else {
                if (ch === '\\') {
                    ch = source[index++];
                    // ECMA-262 7.8.5
                    if (isLineTerminator(ch.charCodeAt(0))) {
                        throwError({}, Messages.UnterminatedRegExp);
                    }
                    str += ch;
                } else if (ch === '/') {
                    terminated = true;
                    break;
                } else if (ch === '[') {
                    classMarker = true;
                } else if (isLineTerminator(ch.charCodeAt(0))) {
                    throwError({}, Messages.UnterminatedRegExp);
                }
            }
        }

        if (!terminated) {
            throwError({}, Messages.UnterminatedRegExp);
        }

        // Exclude leading and trailing slash.
        pattern = str.substr(1, str.length - 2);

        flags = '';
        while (index < length) {
            ch = source[index];
            if (!isIdentifierPart(ch.charCodeAt(0))) {
                break;
            }

            ++index;
            if (ch === '\\' && index < length) {
                ch = source[index];
                if (ch === 'u') {
                    ++index;
                    restore = index;
                    ch = scanHexEscape('u');
                    if (ch) {
                        flags += ch;
                        for (str += '\\u'; restore < index; ++restore) {
                            str += source[restore];
                        }
                    } else {
                        index = restore;
                        flags += 'u';
                        str += '\\u';
                    }
                } else {
                    str += '\\';
                }
            } else {
                flags += ch;
                str += ch;
            }
        }

        try {
            value = new RegExp(pattern, flags);
        } catch (e) {
            throwError({}, Messages.InvalidRegExp);
        }

        peek();


        if (extra.tokenize) {
            return {
                type: Token.RegularExpression,
                value: value,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }
        return {
            literal: str,
            value: value,
            range: [start, index]
        };
    }

    function collectRegex() {
        var pos, loc, regex, token;

        skipComment();

        pos = index;
        loc = {
            start: {
                line: lineNumber,
                column: index - lineStart
            }
        };

        regex = scanRegExp();
        loc.end = {
            line: lineNumber,
            column: index - lineStart
        };

        if (!extra.tokenize) {
            // Pop the previous token, which is likely '/' or '/='
            if (extra.tokens.length > 0) {
                token = extra.tokens[extra.tokens.length - 1];
                if (token.range[0] === pos && token.type === 'Punctuator') {
                    if (token.value === '/' || token.value === '/=') {
                        extra.tokens.pop();
                    }
                }
            }

            extra.tokens.push({
                type: 'RegularExpression',
                value: regex.literal,
                range: [pos, index],
                loc: loc
            });
        }

        return regex;
    }

    function isIdentifierName(token) {
        return token.type === Token.Identifier ||
            token.type === Token.Keyword ||
            token.type === Token.BooleanLiteral ||
            token.type === Token.NullLiteral;
    }

    function advanceSlash() {
        var prevToken,
            checkToken;
        // Using the following algorithm:
        // https://github.com/mozilla/sweet.js/wiki/design
        prevToken = extra.tokens[extra.tokens.length - 1];
        if (!prevToken) {
            // Nothing before that: it cannot be a division.
            return collectRegex();
        }
        if (prevToken.type === 'Punctuator') {
            if (prevToken.value === ')') {
                checkToken = extra.tokens[extra.openParenToken - 1];
                if (checkToken &&
                        checkToken.type === 'Keyword' &&
                        (checkToken.value === 'if' ||
                         checkToken.value === 'while' ||
                         checkToken.value === 'for' ||
                         checkToken.value === 'with')) {
                    return collectRegex();
                }
                return scanPunctuator();
            }
            if (prevToken.value === '}') {
                // Dividing a function by anything makes little sense,
                // but we have to check for that.
                if (extra.tokens[extra.openCurlyToken - 3] &&
                        extra.tokens[extra.openCurlyToken - 3].type === 'Keyword') {
                    // Anonymous function.
                    checkToken = extra.tokens[extra.openCurlyToken - 4];
                    if (!checkToken) {
                        return scanPunctuator();
                    }
                } else if (extra.tokens[extra.openCurlyToken - 4] &&
                        extra.tokens[extra.openCurlyToken - 4].type === 'Keyword') {
                    // Named function.
                    checkToken = extra.tokens[extra.openCurlyToken - 5];
                    if (!checkToken) {
                        return collectRegex();
                    }
                } else {
                    return scanPunctuator();
                }
                // checkToken determines whether the function is
                // a declaration or an expression.
                if (FnExprTokens.indexOf(checkToken.value) >= 0) {
                    // It is an expression.
                    return scanPunctuator();
                }
                // It is a declaration.
                return collectRegex();
            }
            return collectRegex();
        }
        if (prevToken.type === 'Keyword') {
            return collectRegex();
        }
        return scanPunctuator();
    }

    function advance() {
        var ch;

        skipComment();

        if (index >= length) {
            return {
                type: Token.EOF,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [index, index]
            };
        }

        ch = source.charCodeAt(index);

        // Very common: ( and ) and ;
        if (ch === 40 || ch === 41 || ch === 58) {
            return scanPunctuator();
        }

        // String literal starts with single quote (#39) or double quote (#34).
        if (ch === 39 || ch === 34) {
            return scanStringLiteral();
        }

        if (isIdentifierStart(ch)) {
            return scanIdentifier();
        }

        // Dot (.) char #46 can also start a floating-point number, hence the need
        // to check the next character.
        if (ch === 46) {
            if (isDecimalDigit(source.charCodeAt(index + 1))) {
                return scanNumericLiteral();
            }
            return scanPunctuator();
        }

        if (isDecimalDigit(ch)) {
            return scanNumericLiteral();
        }

        // Slash (/) char #47 can also start a regex.
        if (extra.tokenize && ch === 47) {
            return advanceSlash();
        }

        return scanPunctuator();
    }

    function collectToken() {
        var start, loc, token, range, value;

        skipComment();
        start = index;
        loc = {
            start: {
                line: lineNumber,
                column: index - lineStart
            }
        };

        token = advance();
        loc.end = {
            line: lineNumber,
            column: index - lineStart
        };

        if (token.type !== Token.EOF) {
            range = [token.range[0], token.range[1]];
            value = source.slice(token.range[0], token.range[1]);
            extra.tokens.push({
                type: TokenName[token.type],
                value: value,
                range: range,
                loc: loc
            });
        }

        return token;
    }

    function lex() {
        var token;

        token = lookahead;
        index = token.range[1];
        lineNumber = token.lineNumber;
        lineStart = token.lineStart;

        lookahead = (typeof extra.tokens !== 'undefined') ? collectToken() : advance();

        index = token.range[1];
        lineNumber = token.lineNumber;
        lineStart = token.lineStart;

        return token;
    }

    function peek() {
        var pos, line, start;

        pos = index;
        line = lineNumber;
        start = lineStart;
        lookahead = (typeof extra.tokens !== 'undefined') ? collectToken() : advance();
        index = pos;
        lineNumber = line;
        lineStart = start;
    }

    SyntaxTreeDelegate = {

        name: 'SyntaxTree',

        markStart: function () {
            if (extra.loc) {
                state.markerStack.push(index - lineStart);
                state.markerStack.push(lineNumber);
            }
            if (extra.range) {
                state.markerStack.push(index);
            }
        },

        markEnd: function (node) {
            if (extra.range) {
                node.range = [state.markerStack.pop(), index];
            }
            if (extra.loc) {
                node.loc = {
                    start: {
                        line: state.markerStack.pop(),
                        column: state.markerStack.pop()
                    },
                    end: {
                        line: lineNumber,
                        column: index - lineStart
                    }
                };
                this.postProcess(node);
            }
            return node;
        },

        markEndIf: function (node) {
            if (node.range || node.loc) {
                if (extra.loc) {
                    state.markerStack.pop();
                    state.markerStack.pop();
                }
                if (extra.range) {
                    state.markerStack.pop();
                }
            } else {
                this.markEnd(node);
            }
            return node;
        },

        postProcess: function (node) {
            if (extra.source) {
                node.loc.source = extra.source;
            }
            return node;
        },

        createArrayExpression: function (elements) {
            return {
                type: Syntax.ArrayExpression,
                elements: elements
            };
        },

        createAssignmentExpression: function (operator, left, right) {
            return {
                type: Syntax.AssignmentExpression,
                operator: operator,
                left: left,
                right: right
            };
        },

        createBinaryExpression: function (operator, left, right) {
            var type = (operator === '||' || operator === '&&') ? Syntax.LogicalExpression :
                        Syntax.BinaryExpression;
            return {
                type: type,
                operator: operator,
                left: left,
                right: right
            };
        },

        createBlockStatement: function (body) {
            return {
                type: Syntax.BlockStatement,
                body: body
            };
        },

        createBreakStatement: function (label) {
            return {
                type: Syntax.BreakStatement,
                label: label
            };
        },

        createCallExpression: function (callee, args) {
            return {
                type: Syntax.CallExpression,
                callee: callee,
                'arguments': args
            };
        },

        createCatchClause: function (param, body) {
            return {
                type: Syntax.CatchClause,
                param: param,
                body: body
            };
        },

        createConditionalExpression: function (test, consequent, alternate) {
            return {
                type: Syntax.ConditionalExpression,
                test: test,
                consequent: consequent,
                alternate: alternate
            };
        },

        createContinueStatement: function (label) {
            return {
                type: Syntax.ContinueStatement,
                label: label
            };
        },

        createDebuggerStatement: function () {
            return {
                type: Syntax.DebuggerStatement
            };
        },

        createDoWhileStatement: function (body, test) {
            return {
                type: Syntax.DoWhileStatement,
                body: body,
                test: test
            };
        },

        createEmptyStatement: function () {
            return {
                type: Syntax.EmptyStatement
            };
        },

        createExpressionStatement: function (expression) {
            return {
                type: Syntax.ExpressionStatement,
                expression: expression
            };
        },

        createForStatement: function (init, test, update, body) {
            return {
                type: Syntax.ForStatement,
                init: init,
                test: test,
                update: update,
                body: body
            };
        },

        createForInStatement: function (left, right, body) {
            return {
                type: Syntax.ForInStatement,
                left: left,
                right: right,
                body: body,
                each: false
            };
        },

        createFunctionDeclaration: function (id, params, defaults, body) {
            return {
                type: Syntax.FunctionDeclaration,
                id: id,
                params: params,
                defaults: defaults,
                body: body,
                rest: null,
                generator: false,
                expression: false
            };
        },

        createFunctionExpression: function (id, params, defaults, body) {
            return {
                type: Syntax.FunctionExpression,
                id: id,
                params: params,
                defaults: defaults,
                body: body,
                rest: null,
                generator: false,
                expression: false
            };
        },

        createIdentifier: function (name) {
            return {
                type: Syntax.Identifier,
                name: name
            };
        },

        createIfStatement: function (test, consequent, alternate) {
            return {
                type: Syntax.IfStatement,
                test: test,
                consequent: consequent,
                alternate: alternate
            };
        },

        createLabeledStatement: function (label, body) {
            return {
                type: Syntax.LabeledStatement,
                label: label,
                body: body
            };
        },

        createLiteral: function (token) {
            return {
                type: Syntax.Literal,
                value: token.value,
                raw: source.slice(token.range[0], token.range[1])
            };
        },

        createMemberExpression: function (accessor, object, property) {
            return {
                type: Syntax.MemberExpression,
                computed: accessor === '[',
                object: object,
                property: property
            };
        },

        createNewExpression: function (callee, args) {
            return {
                type: Syntax.NewExpression,
                callee: callee,
                'arguments': args
            };
        },

        createObjectExpression: function (properties) {
            return {
                type: Syntax.ObjectExpression,
                properties: properties
            };
        },

        createPostfixExpression: function (operator, argument) {
            return {
                type: Syntax.UpdateExpression,
                operator: operator,
                argument: argument,
                prefix: false
            };
        },

        createProgram: function (body) {
            return {
                type: Syntax.Program,
                body: body
            };
        },

        createProperty: function (kind, key, value) {
            return {
                type: Syntax.Property,
                key: key,
                value: value,
                kind: kind
            };
        },

        createReturnStatement: function (argument) {
            return {
                type: Syntax.ReturnStatement,
                argument: argument
            };
        },

        createSequenceExpression: function (expressions) {
            return {
                type: Syntax.SequenceExpression,
                expressions: expressions
            };
        },

        createSwitchCase: function (test, consequent) {
            return {
                type: Syntax.SwitchCase,
                test: test,
                consequent: consequent
            };
        },

        createSwitchStatement: function (discriminant, cases) {
            return {
                type: Syntax.SwitchStatement,
                discriminant: discriminant,
                cases: cases
            };
        },

        createThisExpression: function () {
            return {
                type: Syntax.ThisExpression
            };
        },

        createThrowStatement: function (argument) {
            return {
                type: Syntax.ThrowStatement,
                argument: argument
            };
        },

        createTryStatement: function (block, guardedHandlers, handlers, finalizer) {
            return {
                type: Syntax.TryStatement,
                block: block,
                guardedHandlers: guardedHandlers,
                handlers: handlers,
                finalizer: finalizer
            };
        },

        createUnaryExpression: function (operator, argument) {
            if (operator === '++' || operator === '--') {
                return {
                    type: Syntax.UpdateExpression,
                    operator: operator,
                    argument: argument,
                    prefix: true
                };
            }
            return {
                type: Syntax.UnaryExpression,
                operator: operator,
                argument: argument,
                prefix: true
            };
        },

        createVariableDeclaration: function (declarations, kind) {
            return {
                type: Syntax.VariableDeclaration,
                declarations: declarations,
                kind: kind
            };
        },

        createVariableDeclarator: function (id, init) {
            return {
                type: Syntax.VariableDeclarator,
                id: id,
                init: init
            };
        },

        createWhileStatement: function (test, body) {
            return {
                type: Syntax.WhileStatement,
                test: test,
                body: body
            };
        },

        createWithStatement: function (object, body) {
            return {
                type: Syntax.WithStatement,
                object: object,
                body: body
            };
        }
    };

    // Return true if there is a line terminator before the next token.

    function peekLineTerminator() {
        var pos, line, start, found;

        pos = index;
        line = lineNumber;
        start = lineStart;
        skipComment();
        found = lineNumber !== line;
        index = pos;
        lineNumber = line;
        lineStart = start;

        return found;
    }

    // Throw an exception

    function throwError(token, messageFormat) {
        var error,
            args = Array.prototype.slice.call(arguments, 2),
            msg = messageFormat.replace(
                /%(\d)/g,
                function (whole, index) {
                    assert(index < args.length, 'Message reference must be in range');
                    return args[index];
                }
            );

        if (typeof token.lineNumber === 'number') {
            error = new Error('Line ' + token.lineNumber + ': ' + msg);
            error.index = token.range[0];
            error.lineNumber = token.lineNumber;
            error.column = token.range[0] - lineStart + 1;
        } else {
            error = new Error('Line ' + lineNumber + ': ' + msg);
            error.index = index;
            error.lineNumber = lineNumber;
            error.column = index - lineStart + 1;
        }

        error.description = msg;
        throw error;
    }

    function throwErrorTolerant() {
        try {
            throwError.apply(null, arguments);
        } catch (e) {
            if (extra.errors) {
                extra.errors.push(e);
            } else {
                throw e;
            }
        }
    }


    // Throw an exception because of the token.

    function throwUnexpected(token) {
        if (token.type === Token.EOF) {
            throwError(token, Messages.UnexpectedEOS);
        }

        if (token.type === Token.NumericLiteral) {
            throwError(token, Messages.UnexpectedNumber);
        }

        if (token.type === Token.StringLiteral) {
            throwError(token, Messages.UnexpectedString);
        }

        if (token.type === Token.Identifier) {
            throwError(token, Messages.UnexpectedIdentifier);
        }

        if (token.type === Token.Keyword) {
            if (isFutureReservedWord(token.value)) {
                throwError(token, Messages.UnexpectedReserved);
            } else if (strict && isStrictModeReservedWord(token.value)) {
                throwErrorTolerant(token, Messages.StrictReservedWord);
                return;
            }
            throwError(token, Messages.UnexpectedToken, token.value);
        }

        // BooleanLiteral, NullLiteral, or Punctuator.
        throwError(token, Messages.UnexpectedToken, token.value);
    }

    // Expect the next token to match the specified punctuator.
    // If not, an exception will be thrown.

    function expect(value) {
        var token = lex();
        if (token.type !== Token.Punctuator || token.value !== value) {
            throwUnexpected(token);
        }
    }

    // Expect the next token to match the specified keyword.
    // If not, an exception will be thrown.

    function expectKeyword(keyword) {
        var token = lex();
        if (token.type !== Token.Keyword || token.value !== keyword) {
            throwUnexpected(token);
        }
    }

    // Return true if the next token matches the specified punctuator.

    function match(value) {
        return lookahead.type === Token.Punctuator && lookahead.value === value;
    }

    // Return true if the next token matches the specified keyword

    function matchKeyword(keyword) {
        return lookahead.type === Token.Keyword && lookahead.value === keyword;
    }

    // Return true if the next token is an assignment operator

    function matchAssign() {
        var op;

        if (lookahead.type !== Token.Punctuator) {
            return false;
        }
        op = lookahead.value;
        return op === '=' ||
            op === '*=' ||
            op === '/=' ||
            op === '%=' ||
            op === '+=' ||
            op === '-=' ||
            op === '<<=' ||
            op === '>>=' ||
            op === '>>>=' ||
            op === '&=' ||
            op === '^=' ||
            op === '|=';
    }

    function consumeSemicolon() {
        var line;

        // Catch the very common case first: immediately a semicolon (char #59).
        if (source.charCodeAt(index) === 59) {
            lex();
            return;
        }

        line = lineNumber;
        skipComment();
        if (lineNumber !== line) {
            return;
        }

        if (match(';')) {
            lex();
            return;
        }

        if (lookahead.type !== Token.EOF && !match('}')) {
            throwUnexpected(lookahead);
        }
    }

    // Return true if provided expression is LeftHandSideExpression

    function isLeftHandSide(expr) {
        return expr.type === Syntax.Identifier || expr.type === Syntax.MemberExpression;
    }

    // 11.1.4 Array Initialiser

    function parseArrayInitialiser() {
        var elements = [];

        expect('[');

        while (!match(']')) {
            if (match(',')) {
                lex();
                elements.push(null);
            } else {
                elements.push(parseAssignmentExpression());

                if (!match(']')) {
                    expect(',');
                }
            }
        }

        expect(']');

        return delegate.createArrayExpression(elements);
    }

    // 11.1.5 Object Initialiser

    function parsePropertyFunction(param, first) {
        var previousStrict, body;

        previousStrict = strict;
        skipComment();
        delegate.markStart();
        body = parseFunctionSourceElements();
        if (first && strict && isRestrictedWord(param[0].name)) {
            throwErrorTolerant(first, Messages.StrictParamName);
        }
        strict = previousStrict;
        return delegate.markEnd(delegate.createFunctionExpression(null, param, [], body));
    }

    function parseObjectPropertyKey() {
        var token;

        skipComment();
        delegate.markStart();
        token = lex();

        // Note: This function is called only from parseObjectProperty(), where
        // EOF and Punctuator tokens are already filtered out.

        if (token.type === Token.StringLiteral || token.type === Token.NumericLiteral) {
            if (strict && token.octal) {
                throwErrorTolerant(token, Messages.StrictOctalLiteral);
            }
            return delegate.markEnd(delegate.createLiteral(token));
        }

        return delegate.markEnd(delegate.createIdentifier(token.value));
    }

    function parseObjectProperty() {
        var token, key, id, value, param;

        token = lookahead;
        skipComment();
        delegate.markStart();

        if (token.type === Token.Identifier) {

            id = parseObjectPropertyKey();

            // Property Assignment: Getter and Setter.

            if (token.value === 'get' && !match(':')) {
                key = parseObjectPropertyKey();
                expect('(');
                expect(')');
                value = parsePropertyFunction([]);
                return delegate.markEnd(delegate.createProperty('get', key, value));
            }
            if (token.value === 'set' && !match(':')) {
                key = parseObjectPropertyKey();
                expect('(');
                token = lookahead;
                if (token.type !== Token.Identifier) {
                    expect(')');
                    throwErrorTolerant(token, Messages.UnexpectedToken, token.value);
                    value = parsePropertyFunction([]);
                } else {
                    param = [ parseVariableIdentifier() ];
                    expect(')');
                    value = parsePropertyFunction(param, token);
                }
                return delegate.markEnd(delegate.createProperty('set', key, value));
            }
            expect(':');
            value = parseAssignmentExpression();
            return delegate.markEnd(delegate.createProperty('init', id, value));
        }
        if (token.type === Token.EOF || token.type === Token.Punctuator) {
            throwUnexpected(token);
        } else {
            key = parseObjectPropertyKey();
            expect(':');
            value = parseAssignmentExpression();
            return delegate.markEnd(delegate.createProperty('init', key, value));
        }
    }

    function parseObjectInitialiser() {
        var properties = [], property, name, key, kind, map = {}, toString = String;

        expect('{');

        while (!match('}')) {
            property = parseObjectProperty();

            if (property.key.type === Syntax.Identifier) {
                name = property.key.name;
            } else {
                name = toString(property.key.value);
            }
            kind = (property.kind === 'init') ? PropertyKind.Data : (property.kind === 'get') ? PropertyKind.Get : PropertyKind.Set;

            key = '$' + name;
            if (Object.prototype.hasOwnProperty.call(map, key)) {
                if (map[key] === PropertyKind.Data) {
                    if (strict && kind === PropertyKind.Data) {
                        throwErrorTolerant({}, Messages.StrictDuplicateProperty);
                    } else if (kind !== PropertyKind.Data) {
                        throwErrorTolerant({}, Messages.AccessorDataProperty);
                    }
                } else {
                    if (kind === PropertyKind.Data) {
                        throwErrorTolerant({}, Messages.AccessorDataProperty);
                    } else if (map[key] & kind) {
                        throwErrorTolerant({}, Messages.AccessorGetSet);
                    }
                }
                map[key] |= kind;
            } else {
                map[key] = kind;
            }

            properties.push(property);

            if (!match('}')) {
                expect(',');
            }
        }

        expect('}');

        return delegate.createObjectExpression(properties);
    }

    // 11.1.6 The Grouping Operator

    function parseGroupExpression() {
        var expr;

        expect('(');

        expr = parseExpression();

        expect(')');

        return expr;
    }


    // 11.1 Primary Expressions

    function parsePrimaryExpression() {
        var type, token, expr;

        if (match('(')) {
            return parseGroupExpression();
        }

        type = lookahead.type;
        delegate.markStart();

        if (type === Token.Identifier) {
            expr =  delegate.createIdentifier(lex().value);
        } else if (type === Token.StringLiteral || type === Token.NumericLiteral) {
            if (strict && lookahead.octal) {
                throwErrorTolerant(lookahead, Messages.StrictOctalLiteral);
            }
            expr = delegate.createLiteral(lex());
        } else if (type === Token.Keyword) {
            if (matchKeyword('this')) {
                lex();
                expr = delegate.createThisExpression();
            } else if (matchKeyword('function')) {
                expr = parseFunctionExpression();
            }
        } else if (type === Token.BooleanLiteral) {
            token = lex();
            token.value = (token.value === 'true');
            expr = delegate.createLiteral(token);
        } else if (type === Token.NullLiteral) {
            token = lex();
            token.value = null;
            expr = delegate.createLiteral(token);
        } else if (match('[')) {
            expr = parseArrayInitialiser();
        } else if (match('{')) {
            expr = parseObjectInitialiser();
        } else if (match('/') || match('/=')) {
            if (typeof extra.tokens !== 'undefined') {
                expr = delegate.createLiteral(collectRegex());
            } else {
                expr = delegate.createLiteral(scanRegExp());
            }
        }

        if (expr) {
            return delegate.markEnd(expr);
        }

        throwUnexpected(lex());
    }

    // 11.2 Left-Hand-Side Expressions

    function parseArguments() {
        var args = [];

        expect('(');

        if (!match(')')) {
            while (index < length) {
                args.push(parseAssignmentExpression());
                if (match(')')) {
                    break;
                }
                expect(',');
            }
        }

        expect(')');

        return args;
    }

    function parseNonComputedProperty() {
        var token;

        delegate.markStart();
        token = lex();

        if (!isIdentifierName(token)) {
            throwUnexpected(token);
        }

        return delegate.markEnd(delegate.createIdentifier(token.value));
    }

    function parseNonComputedMember() {
        expect('.');

        return parseNonComputedProperty();
    }

    function parseComputedMember() {
        var expr;

        expect('[');

        expr = parseExpression();

        expect(']');

        return expr;
    }

    function parseNewExpression() {
        var callee, args;

        delegate.markStart();
        expectKeyword('new');
        callee = parseLeftHandSideExpression();
        args = match('(') ? parseArguments() : [];

        return delegate.markEnd(delegate.createNewExpression(callee, args));
    }

    function parseLeftHandSideExpressionAllowCall() {
        var marker, expr, args, property;

        marker = createLocationMarker();

        expr = matchKeyword('new') ? parseNewExpression() : parsePrimaryExpression();

        while (match('.') || match('[') || match('(')) {
            if (match('(')) {
                args = parseArguments();
                expr = delegate.createCallExpression(expr, args);
            } else if (match('[')) {
                property = parseComputedMember();
                expr = delegate.createMemberExpression('[', expr, property);
            } else {
                property = parseNonComputedMember();
                expr = delegate.createMemberExpression('.', expr, property);
            }
            if (marker) {
                marker.end();
                marker.apply(expr);
            }
        }

        return expr;
    }

    function parseLeftHandSideExpression() {
        var marker, expr, property;

        marker = createLocationMarker();

        expr = matchKeyword('new') ? parseNewExpression() : parsePrimaryExpression();

        while (match('.') || match('[')) {
            if (match('[')) {
                property = parseComputedMember();
                expr = delegate.createMemberExpression('[', expr, property);
            } else {
                property = parseNonComputedMember();
                expr = delegate.createMemberExpression('.', expr, property);
            }
            if (marker) {
                marker.end();
                marker.apply(expr);
            }
        }

        return expr;
    }

    // 11.3 Postfix Expressions

    function parsePostfixExpression() {
        var expr, token;

        delegate.markStart();
        expr = parseLeftHandSideExpressionAllowCall();

        if (lookahead.type === Token.Punctuator) {
            if ((match('++') || match('--')) && !peekLineTerminator()) {
                // 11.3.1, 11.3.2
                if (strict && expr.type === Syntax.Identifier && isRestrictedWord(expr.name)) {
                    throwErrorTolerant({}, Messages.StrictLHSPostfix);
                }

                if (!isLeftHandSide(expr)) {
                    throwError({}, Messages.InvalidLHSInAssignment);
                }

                token = lex();
                expr = delegate.createPostfixExpression(token.value, expr);
            }
        }

        return delegate.markEndIf(expr);
    }

    // 11.4 Unary Operators

    function parseUnaryExpression() {
        var token, expr;

        delegate.markStart();

        if (lookahead.type !== Token.Punctuator && lookahead.type !== Token.Keyword) {
            expr = parsePostfixExpression();
        } else if (match('++') || match('--')) {
            token = lex();
            expr = parseUnaryExpression();
            // 11.4.4, 11.4.5
            if (strict && expr.type === Syntax.Identifier && isRestrictedWord(expr.name)) {
                throwErrorTolerant({}, Messages.StrictLHSPrefix);
            }

            if (!isLeftHandSide(expr)) {
                throwError({}, Messages.InvalidLHSInAssignment);
            }

            expr = delegate.createUnaryExpression(token.value, expr);
        } else if (match('+') || match('-') || match('~') || match('!')) {
            token = lex();
            expr = parseUnaryExpression();
            expr = delegate.createUnaryExpression(token.value, expr);
        } else if (matchKeyword('delete') || matchKeyword('void') || matchKeyword('typeof')) {
            token = lex();
            expr = parseUnaryExpression();
            expr = delegate.createUnaryExpression(token.value, expr);
            if (strict && expr.operator === 'delete' && expr.argument.type === Syntax.Identifier) {
                throwErrorTolerant({}, Messages.StrictDelete);
            }
        } else {
            expr = parsePostfixExpression();
        }

        return delegate.markEndIf(expr);
    }

    function binaryPrecedence(token, allowIn) {
        var prec = 0;

        if (token.type !== Token.Punctuator && token.type !== Token.Keyword) {
            return 0;
        }

        switch (token.value) {
        case '||':
            prec = 1;
            break;

        case '&&':
            prec = 2;
            break;

        case '|':
            prec = 3;
            break;

        case '^':
            prec = 4;
            break;

        case '&':
            prec = 5;
            break;

        case '==':
        case '!=':
        case '===':
        case '!==':
            prec = 6;
            break;

        case '<':
        case '>':
        case '<=':
        case '>=':
        case 'instanceof':
            prec = 7;
            break;

        case 'in':
            prec = allowIn ? 7 : 0;
            break;

        case '<<':
        case '>>':
        case '>>>':
            prec = 8;
            break;

        case '+':
        case '-':
            prec = 9;
            break;

        case '*':
        case '/':
        case '%':
            prec = 11;
            break;

        default:
            break;
        }

        return prec;
    }

    // 11.5 Multiplicative Operators
    // 11.6 Additive Operators
    // 11.7 Bitwise Shift Operators
    // 11.8 Relational Operators
    // 11.9 Equality Operators
    // 11.10 Binary Bitwise Operators
    // 11.11 Binary Logical Operators

    function parseBinaryExpression() {
        var marker, markers, expr, token, prec, previousAllowIn, stack, right, operator, left, i;

        previousAllowIn = state.allowIn;
        state.allowIn = true;

        marker = createLocationMarker();
        left = parseUnaryExpression();

        token = lookahead;
        prec = binaryPrecedence(token, previousAllowIn);
        if (prec === 0) {
            return left;
        }
        token.prec = prec;
        lex();

        markers = [marker, createLocationMarker()];
        right = parseUnaryExpression();

        stack = [left, token, right];

        while ((prec = binaryPrecedence(lookahead, previousAllowIn)) > 0) {

            // Reduce: make a binary expression from the three topmost entries.
            while ((stack.length > 2) && (prec <= stack[stack.length - 2].prec)) {
                right = stack.pop();
                operator = stack.pop().value;
                left = stack.pop();
                expr = delegate.createBinaryExpression(operator, left, right);
                markers.pop();
                marker = markers.pop();
                if (marker) {
                    marker.end();
                    marker.apply(expr);
                }
                stack.push(expr);
                markers.push(marker);
            }

            // Shift.
            token = lex();
            token.prec = prec;
            stack.push(token);
            markers.push(createLocationMarker());
            expr = parseUnaryExpression();
            stack.push(expr);
        }

        state.allowIn = previousAllowIn;

        // Final reduce to clean-up the stack.
        i = stack.length - 1;
        expr = stack[i];
        markers.pop();
        while (i > 1) {
            expr = delegate.createBinaryExpression(stack[i - 1].value, stack[i - 2], expr);
            i -= 2;
            marker = markers.pop();
            if (marker) {
                marker.end();
                marker.apply(expr);
            }
        }

        return expr;
    }


    // 11.12 Conditional Operator

    function parseConditionalExpression() {
        var expr, previousAllowIn, consequent, alternate;

        delegate.markStart();
        expr = parseBinaryExpression();

        if (match('?')) {
            lex();
            previousAllowIn = state.allowIn;
            state.allowIn = true;
            consequent = parseAssignmentExpression();
            state.allowIn = previousAllowIn;
            expect(':');
            alternate = parseAssignmentExpression();

            expr = delegate.markEnd(delegate.createConditionalExpression(expr, consequent, alternate));
        } else {
            delegate.markEnd({});
        }

        return expr;
    }

    // 11.13 Assignment Operators

    function parseAssignmentExpression() {
        var token, left, right, node;

        token = lookahead;
        delegate.markStart();
        node = left = parseConditionalExpression();

        if (matchAssign()) {
            // LeftHandSideExpression
            if (!isLeftHandSide(left)) {
                throwError({}, Messages.InvalidLHSInAssignment);
            }

            // 11.13.1
            if (strict && left.type === Syntax.Identifier && isRestrictedWord(left.name)) {
                throwErrorTolerant(token, Messages.StrictLHSAssignment);
            }

            token = lex();
            right = parseAssignmentExpression();
            node = delegate.createAssignmentExpression(token.value, left, right);
        }

        return delegate.markEndIf(node);
    }

    // 11.14 Comma Operator

    function parseExpression() {
        var expr;

        delegate.markStart();
        expr = parseAssignmentExpression();

        if (match(',')) {
            expr = delegate.createSequenceExpression([ expr ]);

            while (index < length) {
                if (!match(',')) {
                    break;
                }
                lex();
                expr.expressions.push(parseAssignmentExpression());
            }
        }

        return delegate.markEndIf(expr);
    }

    // 12.1 Block

    function parseStatementList() {
        var list = [],
            statement;

        while (index < length) {
            if (match('}')) {
                break;
            }
            statement = parseSourceElement();
            if (typeof statement === 'undefined') {
                break;
            }
            list.push(statement);
        }

        return list;
    }

    function parseBlock() {
        var block;

        skipComment();
        delegate.markStart();
        expect('{');

        block = parseStatementList();

        expect('}');

        return delegate.markEnd(delegate.createBlockStatement(block));
    }

    // 12.2 Variable Statement

    function parseVariableIdentifier() {
        var token;

        skipComment();
        delegate.markStart();
        token = lex();

        if (token.type !== Token.Identifier) {
            throwUnexpected(token);
        }

        return delegate.markEnd(delegate.createIdentifier(token.value));
    }

    function parseVariableDeclaration(kind) {
        var init = null, id;

        skipComment();
        delegate.markStart();
        id = parseVariableIdentifier();

        // 12.2.1
        if (strict && isRestrictedWord(id.name)) {
            throwErrorTolerant({}, Messages.StrictVarName);
        }

        if (kind === 'const') {
            expect('=');
            init = parseAssignmentExpression();
        } else if (match('=')) {
            lex();
            init = parseAssignmentExpression();
        }

        return delegate.markEnd(delegate.createVariableDeclarator(id, init));
    }

    function parseVariableDeclarationList(kind) {
        var list = [];

        do {
            list.push(parseVariableDeclaration(kind));
            if (!match(',')) {
                break;
            }
            lex();
        } while (index < length);

        return list;
    }

    function parseVariableStatement() {
        var declarations;

        expectKeyword('var');

        declarations = parseVariableDeclarationList();

        consumeSemicolon();

        return delegate.createVariableDeclaration(declarations, 'var');
    }

    // kind may be `const` or `let`
    // Both are experimental and not in the specification yet.
    // see http://wiki.ecmascript.org/doku.php?id=harmony:const
    // and http://wiki.ecmascript.org/doku.php?id=harmony:let
    function parseConstLetDeclaration(kind) {
        var declarations;

        skipComment();
        delegate.markStart();

        expectKeyword(kind);

        declarations = parseVariableDeclarationList(kind);

        consumeSemicolon();

        return delegate.markEnd(delegate.createVariableDeclaration(declarations, kind));
    }

    // 12.3 Empty Statement

    function parseEmptyStatement() {
        expect(';');
        return delegate.createEmptyStatement();
    }

    // 12.4 Expression Statement

    function parseExpressionStatement() {
        var expr = parseExpression();
        consumeSemicolon();
        return delegate.createExpressionStatement(expr);
    }

    // 12.5 If statement

    function parseIfStatement() {
        var test, consequent, alternate;

        expectKeyword('if');

        expect('(');

        test = parseExpression();

        expect(')');

        consequent = parseStatement();

        if (matchKeyword('else')) {
            lex();
            alternate = parseStatement();
        } else {
            alternate = null;
        }

        return delegate.createIfStatement(test, consequent, alternate);
    }

    // 12.6 Iteration Statements

    function parseDoWhileStatement() {
        var body, test, oldInIteration;

        expectKeyword('do');

        oldInIteration = state.inIteration;
        state.inIteration = true;

        body = parseStatement();

        state.inIteration = oldInIteration;

        expectKeyword('while');

        expect('(');

        test = parseExpression();

        expect(')');

        if (match(';')) {
            lex();
        }

        return delegate.createDoWhileStatement(body, test);
    }

    function parseWhileStatement() {
        var test, body, oldInIteration;

        expectKeyword('while');

        expect('(');

        test = parseExpression();

        expect(')');

        oldInIteration = state.inIteration;
        state.inIteration = true;

        body = parseStatement();

        state.inIteration = oldInIteration;

        return delegate.createWhileStatement(test, body);
    }

    function parseForVariableDeclaration() {
        var token, declarations;

        delegate.markStart();
        token = lex();
        declarations = parseVariableDeclarationList();

        return delegate.markEnd(delegate.createVariableDeclaration(declarations, token.value));
    }

    function parseForStatement() {
        var init, test, update, left, right, body, oldInIteration;

        init = test = update = null;

        expectKeyword('for');

        expect('(');

        if (match(';')) {
            lex();
        } else {
            if (matchKeyword('var') || matchKeyword('let')) {
                state.allowIn = false;
                init = parseForVariableDeclaration();
                state.allowIn = true;

                if (init.declarations.length === 1 && matchKeyword('in')) {
                    lex();
                    left = init;
                    right = parseExpression();
                    init = null;
                }
            } else {
                state.allowIn = false;
                init = parseExpression();
                state.allowIn = true;

                if (matchKeyword('in')) {
                    // LeftHandSideExpression
                    if (!isLeftHandSide(init)) {
                        throwError({}, Messages.InvalidLHSInForIn);
                    }

                    lex();
                    left = init;
                    right = parseExpression();
                    init = null;
                }
            }

            if (typeof left === 'undefined') {
                expect(';');
            }
        }

        if (typeof left === 'undefined') {

            if (!match(';')) {
                test = parseExpression();
            }
            expect(';');

            if (!match(')')) {
                update = parseExpression();
            }
        }

        expect(')');

        oldInIteration = state.inIteration;
        state.inIteration = true;

        body = parseStatement();

        state.inIteration = oldInIteration;

        return (typeof left === 'undefined') ?
                delegate.createForStatement(init, test, update, body) :
                delegate.createForInStatement(left, right, body);
    }

    // 12.7 The continue statement

    function parseContinueStatement() {
        var label = null, key;

        expectKeyword('continue');

        // Optimize the most common form: 'continue;'.
        if (source.charCodeAt(index) === 59) {
            lex();

            if (!state.inIteration) {
                throwError({}, Messages.IllegalContinue);
            }

            return delegate.createContinueStatement(null);
        }

        if (peekLineTerminator()) {
            if (!state.inIteration) {
                throwError({}, Messages.IllegalContinue);
            }

            return delegate.createContinueStatement(null);
        }

        if (lookahead.type === Token.Identifier) {
            label = parseVariableIdentifier();

            key = '$' + label.name;
            if (!Object.prototype.hasOwnProperty.call(state.labelSet, key)) {
                throwError({}, Messages.UnknownLabel, label.name);
            }
        }

        consumeSemicolon();

        if (label === null && !state.inIteration) {
            throwError({}, Messages.IllegalContinue);
        }

        return delegate.createContinueStatement(label);
    }

    // 12.8 The break statement

    function parseBreakStatement() {
        var label = null, key;

        expectKeyword('break');

        // Catch the very common case first: immediately a semicolon (char #59).
        if (source.charCodeAt(index) === 59) {
            lex();

            if (!(state.inIteration || state.inSwitch)) {
                throwError({}, Messages.IllegalBreak);
            }

            return delegate.createBreakStatement(null);
        }

        if (peekLineTerminator()) {
            if (!(state.inIteration || state.inSwitch)) {
                throwError({}, Messages.IllegalBreak);
            }

            return delegate.createBreakStatement(null);
        }

        if (lookahead.type === Token.Identifier) {
            label = parseVariableIdentifier();

            key = '$' + label.name;
            if (!Object.prototype.hasOwnProperty.call(state.labelSet, key)) {
                throwError({}, Messages.UnknownLabel, label.name);
            }
        }

        consumeSemicolon();

        if (label === null && !(state.inIteration || state.inSwitch)) {
            throwError({}, Messages.IllegalBreak);
        }

        return delegate.createBreakStatement(label);
    }

    // 12.9 The return statement

    function parseReturnStatement() {
        var argument = null;

        expectKeyword('return');

        if (!state.inFunctionBody) {
            throwErrorTolerant({}, Messages.IllegalReturn);
        }

        // 'return' followed by a space and an identifier is very common.
        if (source.charCodeAt(index) === 32) {
            if (isIdentifierStart(source.charCodeAt(index + 1))) {
                argument = parseExpression();
                consumeSemicolon();
                return delegate.createReturnStatement(argument);
            }
        }

        if (peekLineTerminator()) {
            return delegate.createReturnStatement(null);
        }

        if (!match(';')) {
            if (!match('}') && lookahead.type !== Token.EOF) {
                argument = parseExpression();
            }
        }

        consumeSemicolon();

        return delegate.createReturnStatement(argument);
    }

    // 12.10 The with statement

    function parseWithStatement() {
        var object, body;

        if (strict) {
            throwErrorTolerant({}, Messages.StrictModeWith);
        }

        expectKeyword('with');

        expect('(');

        object = parseExpression();

        expect(')');

        body = parseStatement();

        return delegate.createWithStatement(object, body);
    }

    // 12.10 The swith statement

    function parseSwitchCase() {
        var test,
            consequent = [],
            statement;

        skipComment();
        delegate.markStart();
        if (matchKeyword('default')) {
            lex();
            test = null;
        } else {
            expectKeyword('case');
            test = parseExpression();
        }
        expect(':');

        while (index < length) {
            if (match('}') || matchKeyword('default') || matchKeyword('case')) {
                break;
            }
            statement = parseStatement();
            consequent.push(statement);
        }

        return delegate.markEnd(delegate.createSwitchCase(test, consequent));
    }

    function parseSwitchStatement() {
        var discriminant, cases, clause, oldInSwitch, defaultFound;

        expectKeyword('switch');

        expect('(');

        discriminant = parseExpression();

        expect(')');

        expect('{');

        if (match('}')) {
            lex();
            return delegate.createSwitchStatement(discriminant);
        }

        cases = [];

        oldInSwitch = state.inSwitch;
        state.inSwitch = true;
        defaultFound = false;

        while (index < length) {
            if (match('}')) {
                break;
            }
            clause = parseSwitchCase();
            if (clause.test === null) {
                if (defaultFound) {
                    throwError({}, Messages.MultipleDefaultsInSwitch);
                }
                defaultFound = true;
            }
            cases.push(clause);
        }

        state.inSwitch = oldInSwitch;

        expect('}');

        return delegate.createSwitchStatement(discriminant, cases);
    }

    // 12.13 The throw statement

    function parseThrowStatement() {
        var argument;

        expectKeyword('throw');

        if (peekLineTerminator()) {
            throwError({}, Messages.NewlineAfterThrow);
        }

        argument = parseExpression();

        consumeSemicolon();

        return delegate.createThrowStatement(argument);
    }

    // 12.14 The try statement

    function parseCatchClause() {
        var param, body;

        skipComment();
        delegate.markStart();
        expectKeyword('catch');

        expect('(');
        if (match(')')) {
            throwUnexpected(lookahead);
        }

        param = parseVariableIdentifier();
        // 12.14.1
        if (strict && isRestrictedWord(param.name)) {
            throwErrorTolerant({}, Messages.StrictCatchVariable);
        }

        expect(')');
        body = parseBlock();
        return delegate.markEnd(delegate.createCatchClause(param, body));
    }

    function parseTryStatement() {
        var block, handlers = [], finalizer = null;

        expectKeyword('try');

        block = parseBlock();

        if (matchKeyword('catch')) {
            handlers.push(parseCatchClause());
        }

        if (matchKeyword('finally')) {
            lex();
            finalizer = parseBlock();
        }

        if (handlers.length === 0 && !finalizer) {
            throwError({}, Messages.NoCatchOrFinally);
        }

        return delegate.createTryStatement(block, [], handlers, finalizer);
    }

    // 12.15 The debugger statement

    function parseDebuggerStatement() {
        expectKeyword('debugger');

        consumeSemicolon();

        return delegate.createDebuggerStatement();
    }

    // 12 Statements

    function parseStatement() {
        var type = lookahead.type,
            expr,
            labeledBody,
            key;

        if (type === Token.EOF) {
            throwUnexpected(lookahead);
        }

        skipComment();
        delegate.markStart();

        if (type === Token.Punctuator) {
            switch (lookahead.value) {
            case ';':
                return delegate.markEnd(parseEmptyStatement());
            case '{':
                return delegate.markEnd(parseBlock());
            case '(':
                return delegate.markEnd(parseExpressionStatement());
            default:
                break;
            }
        }

        if (type === Token.Keyword) {
            switch (lookahead.value) {
            case 'break':
                return delegate.markEnd(parseBreakStatement());
            case 'continue':
                return delegate.markEnd(parseContinueStatement());
            case 'debugger':
                return delegate.markEnd(parseDebuggerStatement());
            case 'do':
                return delegate.markEnd(parseDoWhileStatement());
            case 'for':
                return delegate.markEnd(parseForStatement());
            case 'function':
                return delegate.markEnd(parseFunctionDeclaration());
            case 'if':
                return delegate.markEnd(parseIfStatement());
            case 'return':
                return delegate.markEnd(parseReturnStatement());
            case 'switch':
                return delegate.markEnd(parseSwitchStatement());
            case 'throw':
                return delegate.markEnd(parseThrowStatement());
            case 'try':
                return delegate.markEnd(parseTryStatement());
            case 'var':
                return delegate.markEnd(parseVariableStatement());
            case 'while':
                return delegate.markEnd(parseWhileStatement());
            case 'with':
                return delegate.markEnd(parseWithStatement());
            default:
                break;
            }
        }

        expr = parseExpression();

        // 12.12 Labelled Statements
        if ((expr.type === Syntax.Identifier) && match(':')) {
            lex();

            key = '$' + expr.name;
            if (Object.prototype.hasOwnProperty.call(state.labelSet, key)) {
                throwError({}, Messages.Redeclaration, 'Label', expr.name);
            }

            state.labelSet[key] = true;
            labeledBody = parseStatement();
            delete state.labelSet[key];
            return delegate.markEnd(delegate.createLabeledStatement(expr, labeledBody));
        }

        consumeSemicolon();

        return delegate.markEnd(delegate.createExpressionStatement(expr));
    }

    // 13 Function Definition

    function parseFunctionSourceElements() {
        var sourceElement, sourceElements = [], token, directive, firstRestricted,
            oldLabelSet, oldInIteration, oldInSwitch, oldInFunctionBody;

        skipComment();
        delegate.markStart();
        expect('{');

        while (index < length) {
            if (lookahead.type !== Token.StringLiteral) {
                break;
            }
            token = lookahead;

            sourceElement = parseSourceElement();
            sourceElements.push(sourceElement);
            if (sourceElement.expression.type !== Syntax.Literal) {
                // this is not directive
                break;
            }
            directive = source.slice(token.range[0] + 1, token.range[1] - 1);
            if (directive === 'use strict') {
                strict = true;
                if (firstRestricted) {
                    throwErrorTolerant(firstRestricted, Messages.StrictOctalLiteral);
                }
            } else {
                if (!firstRestricted && token.octal) {
                    firstRestricted = token;
                }
            }
        }

        oldLabelSet = state.labelSet;
        oldInIteration = state.inIteration;
        oldInSwitch = state.inSwitch;
        oldInFunctionBody = state.inFunctionBody;

        state.labelSet = {};
        state.inIteration = false;
        state.inSwitch = false;
        state.inFunctionBody = true;

        while (index < length) {
            if (match('}')) {
                break;
            }
            sourceElement = parseSourceElement();
            if (typeof sourceElement === 'undefined') {
                break;
            }
            sourceElements.push(sourceElement);
        }

        expect('}');

        state.labelSet = oldLabelSet;
        state.inIteration = oldInIteration;
        state.inSwitch = oldInSwitch;
        state.inFunctionBody = oldInFunctionBody;

        return delegate.markEnd(delegate.createBlockStatement(sourceElements));
    }

    function parseParams(firstRestricted) {
        var param, params = [], token, stricted, paramSet, key, message;
        expect('(');

        if (!match(')')) {
            paramSet = {};
            while (index < length) {
                token = lookahead;
                param = parseVariableIdentifier();
                key = '$' + token.value;
                if (strict) {
                    if (isRestrictedWord(token.value)) {
                        stricted = token;
                        message = Messages.StrictParamName;
                    }
                    if (Object.prototype.hasOwnProperty.call(paramSet, key)) {
                        stricted = token;
                        message = Messages.StrictParamDupe;
                    }
                } else if (!firstRestricted) {
                    if (isRestrictedWord(token.value)) {
                        firstRestricted = token;
                        message = Messages.StrictParamName;
                    } else if (isStrictModeReservedWord(token.value)) {
                        firstRestricted = token;
                        message = Messages.StrictReservedWord;
                    } else if (Object.prototype.hasOwnProperty.call(paramSet, key)) {
                        firstRestricted = token;
                        message = Messages.StrictParamDupe;
                    }
                }
                params.push(param);
                paramSet[key] = true;
                if (match(')')) {
                    break;
                }
                expect(',');
            }
        }

        expect(')');

        return {
            params: params,
            stricted: stricted,
            firstRestricted: firstRestricted,
            message: message
        };
    }

    function parseFunctionDeclaration() {
        var id, params = [], body, token, stricted, tmp, firstRestricted, message, previousStrict;

        skipComment();
        delegate.markStart();

        expectKeyword('function');
        token = lookahead;
        id = parseVariableIdentifier();
        if (strict) {
            if (isRestrictedWord(token.value)) {
                throwErrorTolerant(token, Messages.StrictFunctionName);
            }
        } else {
            if (isRestrictedWord(token.value)) {
                firstRestricted = token;
                message = Messages.StrictFunctionName;
            } else if (isStrictModeReservedWord(token.value)) {
                firstRestricted = token;
                message = Messages.StrictReservedWord;
            }
        }

        tmp = parseParams(firstRestricted);
        params = tmp.params;
        stricted = tmp.stricted;
        firstRestricted = tmp.firstRestricted;
        if (tmp.message) {
            message = tmp.message;
        }

        previousStrict = strict;
        body = parseFunctionSourceElements();
        if (strict && firstRestricted) {
            throwError(firstRestricted, message);
        }
        if (strict && stricted) {
            throwErrorTolerant(stricted, message);
        }
        strict = previousStrict;

        return delegate.markEnd(delegate.createFunctionDeclaration(id, params, [], body));
    }

    function parseFunctionExpression() {
        var token, id = null, stricted, firstRestricted, message, tmp, params = [], body, previousStrict;

        delegate.markStart();
        expectKeyword('function');

        if (!match('(')) {
            token = lookahead;
            id = parseVariableIdentifier();
            if (strict) {
                if (isRestrictedWord(token.value)) {
                    throwErrorTolerant(token, Messages.StrictFunctionName);
                }
            } else {
                if (isRestrictedWord(token.value)) {
                    firstRestricted = token;
                    message = Messages.StrictFunctionName;
                } else if (isStrictModeReservedWord(token.value)) {
                    firstRestricted = token;
                    message = Messages.StrictReservedWord;
                }
            }
        }

        tmp = parseParams(firstRestricted);
        params = tmp.params;
        stricted = tmp.stricted;
        firstRestricted = tmp.firstRestricted;
        if (tmp.message) {
            message = tmp.message;
        }

        previousStrict = strict;
        body = parseFunctionSourceElements();
        if (strict && firstRestricted) {
            throwError(firstRestricted, message);
        }
        if (strict && stricted) {
            throwErrorTolerant(stricted, message);
        }
        strict = previousStrict;

        return delegate.markEnd(delegate.createFunctionExpression(id, params, [], body));
    }

    // 14 Program

    function parseSourceElement() {
        if (lookahead.type === Token.Keyword) {
            switch (lookahead.value) {
            case 'const':
            case 'let':
                return parseConstLetDeclaration(lookahead.value);
            case 'function':
                return parseFunctionDeclaration();
            default:
                return parseStatement();
            }
        }

        if (lookahead.type !== Token.EOF) {
            return parseStatement();
        }
    }

    function parseSourceElements() {
        var sourceElement, sourceElements = [], token, directive, firstRestricted;

        while (index < length) {
            token = lookahead;
            if (token.type !== Token.StringLiteral) {
                break;
            }

            sourceElement = parseSourceElement();
            sourceElements.push(sourceElement);
            if (sourceElement.expression.type !== Syntax.Literal) {
                // this is not directive
                break;
            }
            directive = source.slice(token.range[0] + 1, token.range[1] - 1);
            if (directive === 'use strict') {
                strict = true;
                if (firstRestricted) {
                    throwErrorTolerant(firstRestricted, Messages.StrictOctalLiteral);
                }
            } else {
                if (!firstRestricted && token.octal) {
                    firstRestricted = token;
                }
            }
        }

        while (index < length) {
            sourceElement = parseSourceElement();
            if (typeof sourceElement === 'undefined') {
                break;
            }
            sourceElements.push(sourceElement);
        }
        return sourceElements;
    }

    function parseProgram() {
        var body;

        skipComment();
        delegate.markStart();
        strict = false;
        peek();
        body = parseSourceElements();
        return delegate.markEnd(delegate.createProgram(body));
    }

    function filterTokenLocation() {
        var i, entry, token, tokens = [];

        for (i = 0; i < extra.tokens.length; ++i) {
            entry = extra.tokens[i];
            token = {
                type: entry.type,
                value: entry.value
            };
            if (extra.range) {
                token.range = entry.range;
            }
            if (extra.loc) {
                token.loc = entry.loc;
            }
            tokens.push(token);
        }

        extra.tokens = tokens;
    }

    function LocationMarker() {
        this.marker = [index, lineNumber, index - lineStart, 0, 0, 0];
    }

    LocationMarker.prototype = {
        constructor: LocationMarker,

        end: function () {
            this.marker[3] = index;
            this.marker[4] = lineNumber;
            this.marker[5] = index - lineStart;
        },

        apply: function (node) {
            if (extra.range) {
                node.range = [this.marker[0], this.marker[3]];
            }
            if (extra.loc) {
                node.loc = {
                    start: {
                        line: this.marker[1],
                        column: this.marker[2]
                    },
                    end: {
                        line: this.marker[4],
                        column: this.marker[5]
                    }
                };
            }
            node = delegate.postProcess(node);
        }
    };

    function createLocationMarker() {
        if (!extra.loc && !extra.range) {
            return null;
        }

        skipComment();

        return new LocationMarker();
    }

    function tokenize(code, options) {
        var toString,
            token,
            tokens;

        toString = String;
        if (typeof code !== 'string' && !(code instanceof String)) {
            code = toString(code);
        }

        delegate = SyntaxTreeDelegate;
        source = code;
        index = 0;
        lineNumber = (source.length > 0) ? 1 : 0;
        lineStart = 0;
        length = source.length;
        lookahead = null;
        state = {
            allowIn: true,
            labelSet: {},
            inFunctionBody: false,
            inIteration: false,
            inSwitch: false,
            lastCommentStart: -1,
        };

        extra = {};

        // Options matching.
        options = options || {};

        // Of course we collect tokens here.
        options.tokens = true;
        extra.tokens = [];
        extra.tokenize = true;
        // The following two fields are necessary to compute the Regex tokens.
        extra.openParenToken = -1;
        extra.openCurlyToken = -1;

        extra.range = (typeof options.range === 'boolean') && options.range;
        extra.loc = (typeof options.loc === 'boolean') && options.loc;

        if (typeof options.comment === 'boolean' && options.comment) {
            extra.comments = [];
        }
        if (typeof options.tolerant === 'boolean' && options.tolerant) {
            extra.errors = [];
        }

        if (length > 0) {
            if (typeof source[0] === 'undefined') {
                // Try first to convert to a string. This is good as fast path
                // for old IE which understands string indexing for string
                // literals only and not for string object.
                if (code instanceof String) {
                    source = code.valueOf();
                }
            }
        }

        try {
            peek();
            if (lookahead.type === Token.EOF) {
                return extra.tokens;
            }

            token = lex();
            while (lookahead.type !== Token.EOF) {
                try {
                    token = lex();
                } catch (lexError) {
                    token = lookahead;
                    if (extra.errors) {
                        extra.errors.push(lexError);
                        // We have to break on the first error
                        // to avoid infinite loops.
                        break;
                    } else {
                        throw lexError;
                    }
                }
            }

            filterTokenLocation();
            tokens = extra.tokens;
            if (typeof extra.comments !== 'undefined') {
                tokens.comments = extra.comments;
            }
            if (typeof extra.errors !== 'undefined') {
                tokens.errors = extra.errors;
            }
        } catch (e) {
            throw e;
        } finally {
            extra = {};
        }
        return tokens;
    }

    function parse(code, options) {
        var program, toString;

        toString = String;
        if (typeof code !== 'string' && !(code instanceof String)) {
            code = toString(code);
        }

        delegate = SyntaxTreeDelegate;
        source = code;
        index = 0;
        lineNumber = (source.length > 0) ? 1 : 0;
        lineStart = 0;
        length = source.length;
        lookahead = null;
        state = {
            allowIn: true,
            labelSet: {},
            inFunctionBody: false,
            inIteration: false,
            inSwitch: false,
            lastCommentStart: -1,
            markerStack: []
        };

        extra = {};
        if (typeof options !== 'undefined') {
            extra.range = (typeof options.range === 'boolean') && options.range;
            extra.loc = (typeof options.loc === 'boolean') && options.loc;

            if (extra.loc && options.source !== null && options.source !== undefined) {
                extra.source = toString(options.source);
            }

            if (typeof options.tokens === 'boolean' && options.tokens) {
                extra.tokens = [];
            }
            if (typeof options.comment === 'boolean' && options.comment) {
                extra.comments = [];
            }
            if (typeof options.tolerant === 'boolean' && options.tolerant) {
                extra.errors = [];
            }
        }

        if (length > 0) {
            if (typeof source[0] === 'undefined') {
                // Try first to convert to a string. This is good as fast path
                // for old IE which understands string indexing for string
                // literals only and not for string object.
                if (code instanceof String) {
                    source = code.valueOf();
                }
            }
        }

        try {
            program = parseProgram();
            if (typeof extra.comments !== 'undefined') {
                program.comments = extra.comments;
            }
            if (typeof extra.tokens !== 'undefined') {
                filterTokenLocation();
                program.tokens = extra.tokens;
            }
            if (typeof extra.errors !== 'undefined') {
                program.errors = extra.errors;
            }
        } catch (e) {
            throw e;
        } finally {
            extra = {};
        }

        return program;
    }

    // Sync with package.json and component.json.
    exports.version = '1.1.0-dev';

    exports.tokenize = tokenize;

    exports.parse = parse;

    // Deep copy.
    exports.Syntax = (function () {
        var name, types = {};

        if (typeof Object.create === 'function') {
            types = Object.create(null);
        }

        for (name in Syntax) {
            if (Syntax.hasOwnProperty(name)) {
                types[name] = Syntax[name];
            }
        }

        if (typeof Object.freeze === 'function') {
            Object.freeze(types);
        }

        return types;
    }());

}));
/* vim: set sw=4 ts=4 et tw=80 : */
// Generated by CommonJS Everywhere 0.9.7
(function (global) {
  function require(file, parentModule) {
    if ({}.hasOwnProperty.call(require.cache, file))
      return require.cache[file];
    var resolved = require.resolve(file);
    if (!resolved)
      throw new Error('Failed to resolve module ' + file);
    var module$ = {
        id: file,
        require: require,
        filename: file,
        exports: {},
        loaded: false,
        parent: parentModule,
        children: []
      };
    if (parentModule)
      parentModule.children.push(module$);
    var dirname = file.slice(0, file.lastIndexOf('/') + 1);
    require.cache[file] = module$.exports;
    resolved.call(module$.exports, module$, module$.exports, dirname, file);
    module$.loaded = true;
    return require.cache[file] = module$.exports;
  }
  require.modules = {};
  require.cache = {};
  require.resolve = function (file) {
    return {}.hasOwnProperty.call(require.modules, file) ? require.modules[file] : void 0;
  };
  require.define = function (file, fn) {
    require.modules[file] = fn;
  };
  var process = function () {
      var cwd = '/';
      return {
        title: 'browser',
        version: 'v0.10.26',
        browser: true,
        env: {},
        argv: [],
        nextTick: global.setImmediate || function (fn) {
          setTimeout(fn, 0);
        },
        cwd: function () {
          return cwd;
        },
        chdir: function (dir) {
          cwd = dir;
        }
      };
    }();
  require.define('/tools/entry-point.js', function (module, exports, __dirname, __filename) {
    (function () {
      'use strict';
      global.escodegen = require('/escodegen.js', module);
      escodegen.browser = true;
    }());
  });
  require.define('/escodegen.js', function (module, exports, __dirname, __filename) {
    (function () {
      'use strict';
      var Syntax, Precedence, BinaryPrecedence, SourceNode, estraverse, esutils, isArray, base, indent, json, renumber, hexadecimal, quotes, escapeless, newline, space, parentheses, semicolons, safeConcatenation, directive, extra, parse, sourceMap, FORMAT_MINIFY, FORMAT_DEFAULTS;
      estraverse = require('/node_modules/estraverse/estraverse.js', module);
      esutils = require('/node_modules/esutils/lib/utils.js', module);
      Syntax = {
        AssignmentExpression: 'AssignmentExpression',
        ArrayExpression: 'ArrayExpression',
        ArrayPattern: 'ArrayPattern',
        ArrowFunctionExpression: 'ArrowFunctionExpression',
        BlockStatement: 'BlockStatement',
        BinaryExpression: 'BinaryExpression',
        BreakStatement: 'BreakStatement',
        CallExpression: 'CallExpression',
        CatchClause: 'CatchClause',
        ComprehensionBlock: 'ComprehensionBlock',
        ComprehensionExpression: 'ComprehensionExpression',
        ConditionalExpression: 'ConditionalExpression',
        ContinueStatement: 'ContinueStatement',
        DirectiveStatement: 'DirectiveStatement',
        DoWhileStatement: 'DoWhileStatement',
        DebuggerStatement: 'DebuggerStatement',
        EmptyStatement: 'EmptyStatement',
        ExportDeclaration: 'ExportDeclaration',
        ExpressionStatement: 'ExpressionStatement',
        ForStatement: 'ForStatement',
        ForInStatement: 'ForInStatement',
        ForOfStatement: 'ForOfStatement',
        FunctionDeclaration: 'FunctionDeclaration',
        FunctionExpression: 'FunctionExpression',
        GeneratorExpression: 'GeneratorExpression',
        Identifier: 'Identifier',
        IfStatement: 'IfStatement',
        ImportDeclaration: 'ImportDeclaration',
        Literal: 'Literal',
        LabeledStatement: 'LabeledStatement',
        LogicalExpression: 'LogicalExpression',
        MemberExpression: 'MemberExpression',
        NewExpression: 'NewExpression',
        ObjectExpression: 'ObjectExpression',
        ObjectPattern: 'ObjectPattern',
        Program: 'Program',
        Property: 'Property',
        ReturnStatement: 'ReturnStatement',
        SequenceExpression: 'SequenceExpression',
        SwitchStatement: 'SwitchStatement',
        SwitchCase: 'SwitchCase',
        ThisExpression: 'ThisExpression',
        ThrowStatement: 'ThrowStatement',
        TryStatement: 'TryStatement',
        UnaryExpression: 'UnaryExpression',
        UpdateExpression: 'UpdateExpression',
        VariableDeclaration: 'VariableDeclaration',
        VariableDeclarator: 'VariableDeclarator',
        WhileStatement: 'WhileStatement',
        WithStatement: 'WithStatement',
        YieldExpression: 'YieldExpression'
      };
      Precedence = {
        Sequence: 0,
        Yield: 1,
        Assignment: 1,
        Conditional: 2,
        ArrowFunction: 2,
        LogicalOR: 3,
        LogicalAND: 4,
        BitwiseOR: 5,
        BitwiseXOR: 6,
        BitwiseAND: 7,
        Equality: 8,
        Relational: 9,
        BitwiseSHIFT: 10,
        Additive: 11,
        Multiplicative: 12,
        Unary: 13,
        Postfix: 14,
        Call: 15,
        New: 16,
        Member: 17,
        Primary: 18
      };
      BinaryPrecedence = {
        '||': Precedence.LogicalOR,
        '&&': Precedence.LogicalAND,
        '|': Precedence.BitwiseOR,
        '^': Precedence.BitwiseXOR,
        '&': Precedence.BitwiseAND,
        '==': Precedence.Equality,
        '!=': Precedence.Equality,
        '===': Precedence.Equality,
        '!==': Precedence.Equality,
        'is': Precedence.Equality,
        'isnt': Precedence.Equality,
        '<': Precedence.Relational,
        '>': Precedence.Relational,
        '<=': Precedence.Relational,
        '>=': Precedence.Relational,
        'in': Precedence.Relational,
        'instanceof': Precedence.Relational,
        '<<': Precedence.BitwiseSHIFT,
        '>>': Precedence.BitwiseSHIFT,
        '>>>': Precedence.BitwiseSHIFT,
        '+': Precedence.Additive,
        '-': Precedence.Additive,
        '*': Precedence.Multiplicative,
        '%': Precedence.Multiplicative,
        '/': Precedence.Multiplicative
      };
      function getDefaultOptions() {
        return {
          indent: null,
          base: null,
          parse: null,
          comment: false,
          format: {
            indent: {
              style: '    ',
              base: 0,
              adjustMultilineComment: false
            },
            newline: '\n',
            space: ' ',
            json: false,
            renumber: false,
            hexadecimal: false,
            quotes: 'single',
            escapeless: false,
            compact: false,
            parentheses: true,
            semicolons: true,
            safeConcatenation: false
          },
          moz: {
            comprehensionExpressionStartsWithAssignment: false,
            starlessGenerator: false,
            parenthesizedComprehensionBlock: false
          },
          sourceMap: null,
          sourceMapRoot: null,
          sourceMapWithCode: false,
          directive: false,
          raw: true,
          verbatim: null
        };
      }
      function stringRepeat(str, num) {
        var result = '';
        for (num |= 0; num > 0; num >>>= 1, str += str) {
          if (num & 1) {
            result += str;
          }
        }
        return result;
      }
      isArray = Array.isArray;
      if (!isArray) {
        isArray = function isArray(array) {
          return Object.prototype.toString.call(array) === '[object Array]';
        };
      }
      function hasLineTerminator(str) {
        return /[\r\n]/g.test(str);
      }
      function endsWithLineTerminator(str) {
        var len = str.length;
        return len && esutils.code.isLineTerminator(str.charCodeAt(len - 1));
      }
      function updateDeeply(target, override) {
        var key, val;
        function isHashObject(target) {
          return typeof target === 'object' && target instanceof Object && !(target instanceof RegExp);
        }
        for (key in override) {
          if (override.hasOwnProperty(key)) {
            val = override[key];
            if (isHashObject(val)) {
              if (isHashObject(target[key])) {
                updateDeeply(target[key], val);
              } else {
                target[key] = updateDeeply({}, val);
              }
            } else {
              target[key] = val;
            }
          }
        }
        return target;
      }
      function generateNumber(value) {
        var result, point, temp, exponent, pos;
        if (value !== value) {
          throw new Error('Numeric literal whose value is NaN');
        }
        if (value < 0 || value === 0 && 1 / value < 0) {
          throw new Error('Numeric literal whose value is negative');
        }
        if (value === 1 / 0) {
          return json ? 'null' : renumber ? '1e400' : '1e+400';
        }
        result = '' + value;
        if (!renumber || result.length < 3) {
          return result;
        }
        point = result.indexOf('.');
        if (!json && result.charCodeAt(0) === 48 && point === 1) {
          point = 0;
          result = result.slice(1);
        }
        temp = result;
        result = result.replace('e+', 'e');
        exponent = 0;
        if ((pos = temp.indexOf('e')) > 0) {
          exponent = +temp.slice(pos + 1);
          temp = temp.slice(0, pos);
        }
        if (point >= 0) {
          exponent -= temp.length - point - 1;
          temp = +(temp.slice(0, point) + temp.slice(point + 1)) + '';
        }
        pos = 0;
        while (temp.charCodeAt(temp.length + pos - 1) === 48) {
          --pos;
        }
        if (pos !== 0) {
          exponent -= pos;
          temp = temp.slice(0, pos);
        }
        if (exponent !== 0) {
          temp += 'e' + exponent;
        }
        if ((temp.length < result.length || hexadecimal && value > 1e12 && Math.floor(value) === value && (temp = '0x' + value.toString(16)).length < result.length) && +temp === value) {
          result = temp;
        }
        return result;
      }
      function escapeRegExpCharacter(ch, previousIsBackslash) {
        if ((ch & ~1) === 8232) {
          return (previousIsBackslash ? 'u' : '\\u') + (ch === 8232 ? '2028' : '2029');
        } else if (ch === 10 || ch === 13) {
          return (previousIsBackslash ? '' : '\\') + (ch === 10 ? 'n' : 'r');
        }
        return String.fromCharCode(ch);
      }
      function generateRegExp(reg) {
        var match, result, flags, i, iz, ch, characterInBrack, previousIsBackslash;
        result = reg.toString();
        if (reg.source) {
          match = result.match(/\/([^/]*)$/);
          if (!match) {
            return result;
          }
          flags = match[1];
          result = '';
          characterInBrack = false;
          previousIsBackslash = false;
          for (i = 0, iz = reg.source.length; i < iz; ++i) {
            ch = reg.source.charCodeAt(i);
            if (!previousIsBackslash) {
              if (characterInBrack) {
                if (ch === 93) {
                  characterInBrack = false;
                }
              } else {
                if (ch === 47) {
                  result += '\\';
                } else if (ch === 91) {
                  characterInBrack = true;
                }
              }
              result += escapeRegExpCharacter(ch, previousIsBackslash);
              previousIsBackslash = ch === 92;
            } else {
              result += escapeRegExpCharacter(ch, previousIsBackslash);
              previousIsBackslash = false;
            }
          }
          return '/' + result + '/' + flags;
        }
        return result;
      }
      function escapeAllowedCharacter(code, next) {
        var hex, result = '\\';
        switch (code) {
        case 8:
          result += 'b';
          break;
        case 12:
          result += 'f';
          break;
        case 9:
          result += 't';
          break;
        default:
          hex = code.toString(16).toUpperCase();
          if (json || code > 255) {
            result += 'u' + '0000'.slice(hex.length) + hex;
          } else if (code === 0 && !esutils.code.isDecimalDigit(next)) {
            result += '0';
          } else if (code === 11) {
            result += 'x0B';
          } else {
            result += 'x' + '00'.slice(hex.length) + hex;
          }
          break;
        }
        return result;
      }
      function escapeDisallowedCharacter(code) {
        var result = '\\';
        switch (code) {
        case 92:
          result += '\\';
          break;
        case 10:
          result += 'n';
          break;
        case 13:
          result += 'r';
          break;
        case 8232:
          result += 'u2028';
          break;
        case 8233:
          result += 'u2029';
          break;
        default:
          throw new Error('Incorrectly classified character');
        }
        return result;
      }
      function escapeDirective(str) {
        var i, iz, code, quote;
        quote = quotes === 'double' ? '"' : "'";
        for (i = 0, iz = str.length; i < iz; ++i) {
          code = str.charCodeAt(i);
          if (code === 39) {
            quote = '"';
            break;
          } else if (code === 34) {
            quote = "'";
            break;
          } else if (code === 92) {
            ++i;
          }
        }
        return quote + str + quote;
      }
      function escapeString(str) {
        var result = '', i, len, code, singleQuotes = 0, doubleQuotes = 0, single, quote;
        for (i = 0, len = str.length; i < len; ++i) {
          code = str.charCodeAt(i);
          if (code === 39) {
            ++singleQuotes;
          } else if (code === 34) {
            ++doubleQuotes;
          } else if (code === 47 && json) {
            result += '\\';
          } else if (esutils.code.isLineTerminator(code) || code === 92) {
            result += escapeDisallowedCharacter(code);
            continue;
          } else if (json && code < 32 || !(json || escapeless || code >= 32 && code <= 126)) {
            result += escapeAllowedCharacter(code, str.charCodeAt(i + 1));
            continue;
          }
          result += String.fromCharCode(code);
        }
        single = !(quotes === 'double' || quotes === 'auto' && doubleQuotes < singleQuotes);
        quote = single ? "'" : '"';
        if (!(single ? singleQuotes : doubleQuotes)) {
          return quote + result + quote;
        }
        str = result;
        result = quote;
        for (i = 0, len = str.length; i < len; ++i) {
          code = str.charCodeAt(i);
          if (code === 39 && single || code === 34 && !single) {
            result += '\\';
          }
          result += String.fromCharCode(code);
        }
        return result + quote;
      }
      function flattenToString(arr) {
        var i, iz, elem, result = '';
        for (i = 0, iz = arr.length; i < iz; ++i) {
          elem = arr[i];
          result += isArray(elem) ? flattenToString(elem) : elem;
        }
        return result;
      }
      function toSourceNodeWhenNeeded(generated, node) {
        if (!sourceMap) {
          if (isArray(generated)) {
            return flattenToString(generated);
          } else {
            return generated;
          }
        }
        if (node == null) {
          if (generated instanceof SourceNode) {
            return generated;
          } else {
            node = {};
          }
        }
        if (node.loc == null) {
          return new SourceNode(null, null, sourceMap, generated, node.name || null);
        }
        return new SourceNode(node.loc.start.line, node.loc.start.column, sourceMap === true ? node.loc.source || null : sourceMap, generated, node.name || null);
      }
      function noEmptySpace() {
        return space ? space : ' ';
      }
      function join(left, right) {
        var leftSource = toSourceNodeWhenNeeded(left).toString(), rightSource = toSourceNodeWhenNeeded(right).toString(), leftCharCode = leftSource.charCodeAt(leftSource.length - 1), rightCharCode = rightSource.charCodeAt(0);
        if ((leftCharCode === 43 || leftCharCode === 45) && leftCharCode === rightCharCode || esutils.code.isIdentifierPart(leftCharCode) && esutils.code.isIdentifierPart(rightCharCode) || leftCharCode === 47 && rightCharCode === 105) {
          return [
            left,
            noEmptySpace(),
            right
          ];
        } else if (esutils.code.isWhiteSpace(leftCharCode) || esutils.code.isLineTerminator(leftCharCode) || esutils.code.isWhiteSpace(rightCharCode) || esutils.code.isLineTerminator(rightCharCode)) {
          return [
            left,
            right
          ];
        }
        return [
          left,
          space,
          right
        ];
      }
      function addIndent(stmt) {
        return [
          base,
          stmt
        ];
      }
      function withIndent(fn) {
        var previousBase, result;
        previousBase = base;
        base += indent;
        result = fn.call(this, base);
        base = previousBase;
        return result;
      }
      function calculateSpaces(str) {
        var i;
        for (i = str.length - 1; i >= 0; --i) {
          if (esutils.code.isLineTerminator(str.charCodeAt(i))) {
            break;
          }
        }
        return str.length - 1 - i;
      }
      function adjustMultilineComment(value, specialBase) {
        var array, i, len, line, j, spaces, previousBase, sn;
        array = value.split(/\r\n|[\r\n]/);
        spaces = Number.MAX_VALUE;
        for (i = 1, len = array.length; i < len; ++i) {
          line = array[i];
          j = 0;
          while (j < line.length && esutils.code.isWhiteSpace(line.charCodeAt(j))) {
            ++j;
          }
          if (spaces > j) {
            spaces = j;
          }
        }
        if (typeof specialBase !== 'undefined') {
          previousBase = base;
          if (array[1][spaces] === '*') {
            specialBase += ' ';
          }
          base = specialBase;
        } else {
          if (spaces & 1) {
            --spaces;
          }
          previousBase = base;
        }
        for (i = 1, len = array.length; i < len; ++i) {
          sn = toSourceNodeWhenNeeded(addIndent(array[i].slice(spaces)));
          array[i] = sourceMap ? sn.join('') : sn;
        }
        base = previousBase;
        return array.join('\n');
      }
      function generateComment(comment, specialBase) {
        if (comment.type === 'Line') {
          if (endsWithLineTerminator(comment.value)) {
            return '//' + comment.value;
          } else {
            return '//' + comment.value + '\n';
          }
        }
        if (extra.format.indent.adjustMultilineComment && /[\n\r]/.test(comment.value)) {
          return adjustMultilineComment('/*' + comment.value + '*/', specialBase);
        }
        return '/*' + comment.value + '*/';
      }
      function addComments(stmt, result) {
        var i, len, comment, save, tailingToStatement, specialBase, fragment;
        if (stmt.leadingComments && stmt.leadingComments.length > 0) {
          save = result;
          comment = stmt.leadingComments[0];
          result = [];
          if (safeConcatenation && stmt.type === Syntax.Program && stmt.body.length === 0) {
            result.push('\n');
          }
          result.push(generateComment(comment));
          if (!endsWithLineTerminator(toSourceNodeWhenNeeded(result).toString())) {
            result.push('\n');
          }
          for (i = 1, len = stmt.leadingComments.length; i < len; ++i) {
            comment = stmt.leadingComments[i];
            fragment = [generateComment(comment)];
            if (!endsWithLineTerminator(toSourceNodeWhenNeeded(fragment).toString())) {
              fragment.push('\n');
            }
            result.push(addIndent(fragment));
          }
          result.push(addIndent(save));
        }
        if (stmt.trailingComments) {
          tailingToStatement = !endsWithLineTerminator(toSourceNodeWhenNeeded(result).toString());
          specialBase = stringRepeat(' ', calculateSpaces(toSourceNodeWhenNeeded([
            base,
            result,
            indent
          ]).toString()));
          for (i = 0, len = stmt.trailingComments.length; i < len; ++i) {
            comment = stmt.trailingComments[i];
            if (tailingToStatement) {
              if (i === 0) {
                result = [
                  result,
                  indent
                ];
              } else {
                result = [
                  result,
                  specialBase
                ];
              }
              result.push(generateComment(comment, specialBase));
            } else {
              result = [
                result,
                addIndent(generateComment(comment))
              ];
            }
            if (i !== len - 1 && !endsWithLineTerminator(toSourceNodeWhenNeeded(result).toString())) {
              result = [
                result,
                '\n'
              ];
            }
          }
        }
        return result;
      }
      function parenthesize(text, current, should) {
        if (current < should) {
          return [
            '(',
            text,
            ')'
          ];
        }
        return text;
      }
      function maybeBlock(stmt, semicolonOptional, functionBody) {
        var result, noLeadingComment;
        noLeadingComment = !extra.comment || !stmt.leadingComments;
        if (stmt.type === Syntax.BlockStatement && noLeadingComment) {
          return [
            space,
            generateStatement(stmt, { functionBody: functionBody })
          ];
        }
        if (stmt.type === Syntax.EmptyStatement && noLeadingComment) {
          return ';';
        }
        withIndent(function () {
          result = [
            newline,
            addIndent(generateStatement(stmt, {
              semicolonOptional: semicolonOptional,
              functionBody: functionBody
            }))
          ];
        });
        return result;
      }
      function maybeBlockSuffix(stmt, result) {
        var ends = endsWithLineTerminator(toSourceNodeWhenNeeded(result).toString());
        if (stmt.type === Syntax.BlockStatement && (!extra.comment || !stmt.leadingComments) && !ends) {
          return [
            result,
            space
          ];
        }
        if (ends) {
          return [
            result,
            base
          ];
        }
        return [
          result,
          newline,
          base
        ];
      }
      function generateVerbatimString(string) {
        var i, iz, result;
        result = string.split(/\r\n|\n/);
        for (i = 1, iz = result.length; i < iz; i++) {
          result[i] = newline + base + result[i];
        }
        return result;
      }
      function generateVerbatim(expr, option) {
        var verbatim, result, prec;
        verbatim = expr[extra.verbatim];
        if (typeof verbatim === 'string') {
          result = parenthesize(generateVerbatimString(verbatim), Precedence.Sequence, option.precedence);
        } else {
          result = generateVerbatimString(verbatim.content);
          prec = verbatim.precedence != null ? verbatim.precedence : Precedence.Sequence;
          result = parenthesize(result, prec, option.precedence);
        }
        return toSourceNodeWhenNeeded(result, expr);
      }
      function generateIdentifier(node) {
        return toSourceNodeWhenNeeded(node.name, node);
      }
      function generatePattern(node, options) {
        var result;
        if (node.type === Syntax.Identifier) {
          result = generateIdentifier(node);
        } else {
          result = generateExpression(node, {
            precedence: options.precedence,
            allowIn: options.allowIn,
            allowCall: true
          });
        }
        return result;
      }
      function generateFunctionBody(node) {
        var result, i, len, expr, arrow;
        arrow = node.type === Syntax.ArrowFunctionExpression;
        if (arrow && node.params.length === 1 && node.params[0].type === Syntax.Identifier) {
          result = [generateIdentifier(node.params[0])];
        } else {
          result = ['('];
          for (i = 0, len = node.params.length; i < len; ++i) {
            result.push(generatePattern(node.params[i], {
              precedence: Precedence.Assignment,
              allowIn: true
            }));
            if (i + 1 < len) {
              result.push(',' + space);
            }
          }
          result.push(')');
        }
        if (arrow) {
          result.push(space);
          result.push('=>');
        }
        if (node.expression) {
          result.push(space);
          expr = generateExpression(node.body, {
            precedence: Precedence.Assignment,
            allowIn: true,
            allowCall: true
          });
          if (expr.toString().charAt(0) === '{') {
            expr = [
              '(',
              expr,
              ')'
            ];
          }
          result.push(expr);
        } else {
          result.push(maybeBlock(node.body, false, true));
        }
        return result;
      }
      function generateIterationForStatement(operator, stmt, semicolonIsNotNeeded) {
        var result = ['for' + space + '('];
        withIndent(function () {
          if (stmt.left.type === Syntax.VariableDeclaration) {
            withIndent(function () {
              result.push(stmt.left.kind + noEmptySpace());
              result.push(generateStatement(stmt.left.declarations[0], { allowIn: false }));
            });
          } else {
            result.push(generateExpression(stmt.left, {
              precedence: Precedence.Call,
              allowIn: true,
              allowCall: true
            }));
          }
          result = join(result, operator);
          result = [
            join(result, generateExpression(stmt.right, {
              precedence: Precedence.Sequence,
              allowIn: true,
              allowCall: true
            })),
            ')'
          ];
        });
        result.push(maybeBlock(stmt.body, semicolonIsNotNeeded));
        return result;
      }
      function generateLiteral(expr) {
        var raw;
        if (expr.hasOwnProperty('raw') && parse && extra.raw) {
          try {
            raw = parse(expr.raw).body[0].expression;
            if (raw.type === Syntax.Literal) {
              if (raw.value === expr.value) {
                return expr.raw;
              }
            }
          } catch (e) {
          }
        }
        if (expr.value === null) {
          return 'null';
        }
        if (typeof expr.value === 'string') {
          return escapeString(expr.value);
        }
        if (typeof expr.value === 'number') {
          return generateNumber(expr.value);
        }
        if (typeof expr.value === 'boolean') {
          return expr.value ? 'true' : 'false';
        }
        return generateRegExp(expr.value);
      }
      function generateExpression(expr, option) {
        var result, precedence, type, currentPrecedence, i, len, fragment, multiline, leftCharCode, leftSource, rightCharCode, allowIn, allowCall, allowUnparenthesizedNew, property, isGenerator;
        precedence = option.precedence;
        allowIn = option.allowIn;
        allowCall = option.allowCall;
        type = expr.type || option.type;
        if (extra.verbatim && expr.hasOwnProperty(extra.verbatim)) {
          return generateVerbatim(expr, option);
        }
        switch (type) {
        case Syntax.SequenceExpression:
          result = [];
          allowIn |= Precedence.Sequence < precedence;
          for (i = 0, len = expr.expressions.length; i < len; ++i) {
            result.push(generateExpression(expr.expressions[i], {
              precedence: Precedence.Assignment,
              allowIn: allowIn,
              allowCall: true
            }));
            if (i + 1 < len) {
              result.push(',' + space);
            }
          }
          result = parenthesize(result, Precedence.Sequence, precedence);
          break;
        case Syntax.AssignmentExpression:
          allowIn |= Precedence.Assignment < precedence;
          result = parenthesize([
            generateExpression(expr.left, {
              precedence: Precedence.Call,
              allowIn: allowIn,
              allowCall: true
            }),
            space + expr.operator + space,
            generateExpression(expr.right, {
              precedence: Precedence.Assignment,
              allowIn: allowIn,
              allowCall: true
            })
          ], Precedence.Assignment, precedence);
          break;
        case Syntax.ArrowFunctionExpression:
          allowIn |= Precedence.ArrowFunction < precedence;
          result = parenthesize(generateFunctionBody(expr), Precedence.ArrowFunction, precedence);
          break;
        case Syntax.ConditionalExpression:
          allowIn |= Precedence.Conditional < precedence;
          result = parenthesize([
            generateExpression(expr.test, {
              precedence: Precedence.LogicalOR,
              allowIn: allowIn,
              allowCall: true
            }),
            space + '?' + space,
            generateExpression(expr.consequent, {
              precedence: Precedence.Assignment,
              allowIn: allowIn,
              allowCall: true
            }),
            space + ':' + space,
            generateExpression(expr.alternate, {
              precedence: Precedence.Assignment,
              allowIn: allowIn,
              allowCall: true
            })
          ], Precedence.Conditional, precedence);
          break;
        case Syntax.LogicalExpression:
        case Syntax.BinaryExpression:
          currentPrecedence = BinaryPrecedence[expr.operator];
          allowIn |= currentPrecedence < precedence;
          fragment = generateExpression(expr.left, {
            precedence: currentPrecedence,
            allowIn: allowIn,
            allowCall: true
          });
          leftSource = fragment.toString();
          if (leftSource.charCodeAt(leftSource.length - 1) === 47 && esutils.code.isIdentifierPart(expr.operator.charCodeAt(0))) {
            result = [
              fragment,
              noEmptySpace(),
              expr.operator
            ];
          } else {
            result = join(fragment, expr.operator);
          }
          fragment = generateExpression(expr.right, {
            precedence: currentPrecedence + 1,
            allowIn: allowIn,
            allowCall: true
          });
          if (expr.operator === '/' && fragment.toString().charAt(0) === '/' || expr.operator.slice(-1) === '<' && fragment.toString().slice(0, 3) === '!--') {
            result.push(noEmptySpace());
            result.push(fragment);
          } else {
            result = join(result, fragment);
          }
          if (expr.operator === 'in' && !allowIn) {
            result = [
              '(',
              result,
              ')'
            ];
          } else {
            result = parenthesize(result, currentPrecedence, precedence);
          }
          break;
        case Syntax.CallExpression:
          result = [generateExpression(expr.callee, {
              precedence: Precedence.Call,
              allowIn: true,
              allowCall: true,
              allowUnparenthesizedNew: false
            })];
          result.push('(');
          for (i = 0, len = expr['arguments'].length; i < len; ++i) {
            result.push(generateExpression(expr['arguments'][i], {
              precedence: Precedence.Assignment,
              allowIn: true,
              allowCall: true
            }));
            if (i + 1 < len) {
              result.push(',' + space);
            }
          }
          result.push(')');
          if (!allowCall) {
            result = [
              '(',
              result,
              ')'
            ];
          } else {
            result = parenthesize(result, Precedence.Call, precedence);
          }
          break;
        case Syntax.NewExpression:
          len = expr['arguments'].length;
          allowUnparenthesizedNew = option.allowUnparenthesizedNew === undefined || option.allowUnparenthesizedNew;
          result = join('new', generateExpression(expr.callee, {
            precedence: Precedence.New,
            allowIn: true,
            allowCall: false,
            allowUnparenthesizedNew: allowUnparenthesizedNew && !parentheses && len === 0
          }));
          if (!allowUnparenthesizedNew || parentheses || len > 0) {
            result.push('(');
            for (i = 0; i < len; ++i) {
              result.push(generateExpression(expr['arguments'][i], {
                precedence: Precedence.Assignment,
                allowIn: true,
                allowCall: true
              }));
              if (i + 1 < len) {
                result.push(',' + space);
              }
            }
            result.push(')');
          }
          result = parenthesize(result, Precedence.New, precedence);
          break;
        case Syntax.MemberExpression:
          result = [generateExpression(expr.object, {
              precedence: Precedence.Call,
              allowIn: true,
              allowCall: allowCall,
              allowUnparenthesizedNew: false
            })];
          if (expr.computed) {
            result.push('[');
            result.push(generateExpression(expr.property, {
              precedence: Precedence.Sequence,
              allowIn: true,
              allowCall: allowCall
            }));
            result.push(']');
          } else {
            if (expr.object.type === Syntax.Literal && typeof expr.object.value === 'number') {
              fragment = toSourceNodeWhenNeeded(result).toString();
              if (fragment.indexOf('.') < 0 && !/[eExX]/.test(fragment) && esutils.code.isDecimalDigit(fragment.charCodeAt(fragment.length - 1)) && !(fragment.length >= 2 && fragment.charCodeAt(0) === 48)) {
                result.push('.');
              }
            }
            result.push('.');
            result.push(generateIdentifier(expr.property));
          }
          result = parenthesize(result, Precedence.Member, precedence);
          break;
        case Syntax.UnaryExpression:
          fragment = generateExpression(expr.argument, {
            precedence: Precedence.Unary,
            allowIn: true,
            allowCall: true
          });
          if (space === '') {
            result = join(expr.operator, fragment);
          } else {
            result = [expr.operator];
            if (expr.operator.length > 2) {
              result = join(result, fragment);
            } else {
              leftSource = toSourceNodeWhenNeeded(result).toString();
              leftCharCode = leftSource.charCodeAt(leftSource.length - 1);
              rightCharCode = fragment.toString().charCodeAt(0);
              if ((leftCharCode === 43 || leftCharCode === 45) && leftCharCode === rightCharCode || esutils.code.isIdentifierPart(leftCharCode) && esutils.code.isIdentifierPart(rightCharCode)) {
                result.push(noEmptySpace());
                result.push(fragment);
              } else {
                result.push(fragment);
              }
            }
          }
          result = parenthesize(result, Precedence.Unary, precedence);
          break;
        case Syntax.YieldExpression:
          if (expr.delegate) {
            result = 'yield*';
          } else {
            result = 'yield';
          }
          if (expr.argument) {
            result = join(result, generateExpression(expr.argument, {
              precedence: Precedence.Yield,
              allowIn: true,
              allowCall: true
            }));
          }
          result = parenthesize(result, Precedence.Yield, precedence);
          break;
        case Syntax.UpdateExpression:
          if (expr.prefix) {
            result = parenthesize([
              expr.operator,
              generateExpression(expr.argument, {
                precedence: Precedence.Unary,
                allowIn: true,
                allowCall: true
              })
            ], Precedence.Unary, precedence);
          } else {
            result = parenthesize([
              generateExpression(expr.argument, {
                precedence: Precedence.Postfix,
                allowIn: true,
                allowCall: true
              }),
              expr.operator
            ], Precedence.Postfix, precedence);
          }
          break;
        case Syntax.FunctionExpression:
          isGenerator = expr.generator && !extra.moz.starlessGenerator;
          result = isGenerator ? 'function*' : 'function';
          if (expr.id) {
            result = [
              result,
              isGenerator ? space : noEmptySpace(),
              generateIdentifier(expr.id),
              generateFunctionBody(expr)
            ];
          } else {
            result = [
              result + space,
              generateFunctionBody(expr)
            ];
          }
          break;
        case Syntax.ArrayPattern:
        case Syntax.ArrayExpression:
          if (!expr.elements.length) {
            result = '[]';
            break;
          }
          multiline = expr.elements.length > 1;
          result = [
            '[',
            multiline ? newline : ''
          ];
          withIndent(function (indent) {
            for (i = 0, len = expr.elements.length; i < len; ++i) {
              if (!expr.elements[i]) {
                if (multiline) {
                  result.push(indent);
                }
                if (i + 1 === len) {
                  result.push(',');
                }
              } else {
                result.push(multiline ? indent : '');
                result.push(generateExpression(expr.elements[i], {
                  precedence: Precedence.Assignment,
                  allowIn: true,
                  allowCall: true
                }));
              }
              if (i + 1 < len) {
                result.push(',' + (multiline ? newline : space));
              }
            }
          });
          if (multiline && !endsWithLineTerminator(toSourceNodeWhenNeeded(result).toString())) {
            result.push(newline);
          }
          result.push(multiline ? base : '');
          result.push(']');
          break;
        case Syntax.Property:
          if (expr.kind === 'get' || expr.kind === 'set') {
            result = [
              expr.kind,
              noEmptySpace(),
              generateExpression(expr.key, {
                precedence: Precedence.Sequence,
                allowIn: true,
                allowCall: true
              }),
              generateFunctionBody(expr.value)
            ];
          } else {
            if (expr.shorthand) {
              result = generateExpression(expr.key, {
                precedence: Precedence.Sequence,
                allowIn: true,
                allowCall: true
              });
            } else if (expr.method) {
              result = [];
              if (expr.value.generator) {
                result.push('*');
              }
              result.push(generateExpression(expr.key, {
                precedence: Precedence.Sequence,
                allowIn: true,
                allowCall: true
              }));
              result.push(generateFunctionBody(expr.value));
            } else {
              result = [
                generateExpression(expr.key, {
                  precedence: Precedence.Sequence,
                  allowIn: true,
                  allowCall: true
                }),
                ':' + space,
                generateExpression(expr.value, {
                  precedence: Precedence.Assignment,
                  allowIn: true,
                  allowCall: true
                })
              ];
            }
          }
          break;
        case Syntax.ObjectExpression:
          if (!expr.properties.length) {
            result = '{}';
            break;
          }
          multiline = expr.properties.length > 1;
          withIndent(function () {
            fragment = generateExpression(expr.properties[0], {
              precedence: Precedence.Sequence,
              allowIn: true,
              allowCall: true,
              type: Syntax.Property
            });
          });
          if (!multiline) {
            if (!hasLineTerminator(toSourceNodeWhenNeeded(fragment).toString())) {
              result = [
                '{',
                space,
                fragment,
                space,
                '}'
              ];
              break;
            }
          }
          withIndent(function (indent) {
            result = [
              '{',
              newline,
              indent,
              fragment
            ];
            if (multiline) {
              result.push(',' + newline);
              for (i = 1, len = expr.properties.length; i < len; ++i) {
                result.push(indent);
                result.push(generateExpression(expr.properties[i], {
                  precedence: Precedence.Sequence,
                  allowIn: true,
                  allowCall: true,
                  type: Syntax.Property
                }));
                if (i + 1 < len) {
                  result.push(',' + newline);
                }
              }
            }
          });
          if (!endsWithLineTerminator(toSourceNodeWhenNeeded(result).toString())) {
            result.push(newline);
          }
          result.push(base);
          result.push('}');
          break;
        case Syntax.ObjectPattern:
          if (!expr.properties.length) {
            result = '{}';
            break;
          }
          multiline = false;
          if (expr.properties.length === 1) {
            property = expr.properties[0];
            if (property.value.type !== Syntax.Identifier) {
              multiline = true;
            }
          } else {
            for (i = 0, len = expr.properties.length; i < len; ++i) {
              property = expr.properties[i];
              if (!property.shorthand) {
                multiline = true;
                break;
              }
            }
          }
          result = [
            '{',
            multiline ? newline : ''
          ];
          withIndent(function (indent) {
            for (i = 0, len = expr.properties.length; i < len; ++i) {
              result.push(multiline ? indent : '');
              result.push(generateExpression(expr.properties[i], {
                precedence: Precedence.Sequence,
                allowIn: true,
                allowCall: true
              }));
              if (i + 1 < len) {
                result.push(',' + (multiline ? newline : space));
              }
            }
          });
          if (multiline && !endsWithLineTerminator(toSourceNodeWhenNeeded(result).toString())) {
            result.push(newline);
          }
          result.push(multiline ? base : '');
          result.push('}');
          break;
        case Syntax.ThisExpression:
          result = 'this';
          break;
        case Syntax.Identifier:
          result = generateIdentifier(expr);
          break;
        case Syntax.Literal:
          result = generateLiteral(expr);
          break;
        case Syntax.GeneratorExpression:
        case Syntax.ComprehensionExpression:
          result = type === Syntax.GeneratorExpression ? ['('] : ['['];
          if (extra.moz.comprehensionExpressionStartsWithAssignment) {
            fragment = generateExpression(expr.body, {
              precedence: Precedence.Assignment,
              allowIn: true,
              allowCall: true
            });
            result.push(fragment);
          }
          if (expr.blocks) {
            withIndent(function () {
              for (i = 0, len = expr.blocks.length; i < len; ++i) {
                fragment = generateExpression(expr.blocks[i], {
                  precedence: Precedence.Sequence,
                  allowIn: true,
                  allowCall: true
                });
                if (i > 0 || extra.moz.comprehensionExpressionStartsWithAssignment) {
                  result = join(result, fragment);
                } else {
                  result.push(fragment);
                }
              }
            });
          }
          if (expr.filter) {
            result = join(result, 'if' + space);
            fragment = generateExpression(expr.filter, {
              precedence: Precedence.Sequence,
              allowIn: true,
              allowCall: true
            });
            if (extra.moz.parenthesizedComprehensionBlock) {
              result = join(result, [
                '(',
                fragment,
                ')'
              ]);
            } else {
              result = join(result, fragment);
            }
          }
          if (!extra.moz.comprehensionExpressionStartsWithAssignment) {
            fragment = generateExpression(expr.body, {
              precedence: Precedence.Assignment,
              allowIn: true,
              allowCall: true
            });
            result = join(result, fragment);
          }
          result.push(type === Syntax.GeneratorExpression ? ')' : ']');
          break;
        case Syntax.ComprehensionBlock:
          if (expr.left.type === Syntax.VariableDeclaration) {
            fragment = [
              expr.left.kind,
              noEmptySpace(),
              generateStatement(expr.left.declarations[0], { allowIn: false })
            ];
          } else {
            fragment = generateExpression(expr.left, {
              precedence: Precedence.Call,
              allowIn: true,
              allowCall: true
            });
          }
          fragment = join(fragment, expr.of ? 'of' : 'in');
          fragment = join(fragment, generateExpression(expr.right, {
            precedence: Precedence.Sequence,
            allowIn: true,
            allowCall: true
          }));
          if (extra.moz.parenthesizedComprehensionBlock) {
            result = [
              'for' + space + '(',
              fragment,
              ')'
            ];
          } else {
            result = join('for' + space, fragment);
          }
          break;
        default:
          throw new Error('Unknown expression type: ' + expr.type);
        }
        if (extra.comment) {
          result = addComments(expr, result);
        }
        return toSourceNodeWhenNeeded(result, expr);
      }
      function generateStatement(stmt, option) {
        var i, len, result, node, specifier, allowIn, functionBody, directiveContext, fragment, semicolon, isGenerator;
        allowIn = true;
        semicolon = ';';
        functionBody = false;
        directiveContext = false;
        if (option) {
          allowIn = option.allowIn === undefined || option.allowIn;
          if (!semicolons && option.semicolonOptional === true) {
            semicolon = '';
          }
          functionBody = option.functionBody;
          directiveContext = option.directiveContext;
        }
        switch (stmt.type) {
        case Syntax.BlockStatement:
          result = [
            '{',
            newline
          ];
          withIndent(function () {
            for (i = 0, len = stmt.body.length; i < len; ++i) {
              fragment = addIndent(generateStatement(stmt.body[i], {
                semicolonOptional: i === len - 1,
                directiveContext: functionBody
              }));
              result.push(fragment);
              if (!endsWithLineTerminator(toSourceNodeWhenNeeded(fragment).toString())) {
                result.push(newline);
              }
            }
          });
          result.push(addIndent('}'));
          break;
        case Syntax.BreakStatement:
          if (stmt.label) {
            result = 'break ' + stmt.label.name + semicolon;
          } else {
            result = 'break' + semicolon;
          }
          break;
        case Syntax.ContinueStatement:
          if (stmt.label) {
            result = 'continue ' + stmt.label.name + semicolon;
          } else {
            result = 'continue' + semicolon;
          }
          break;
        case Syntax.DirectiveStatement:
          if (extra.raw && stmt.raw) {
            result = stmt.raw + semicolon;
          } else {
            result = escapeDirective(stmt.directive) + semicolon;
          }
          break;
        case Syntax.DoWhileStatement:
          result = join('do', maybeBlock(stmt.body));
          result = maybeBlockSuffix(stmt.body, result);
          result = join(result, [
            'while' + space + '(',
            generateExpression(stmt.test, {
              precedence: Precedence.Sequence,
              allowIn: true,
              allowCall: true
            }),
            ')' + semicolon
          ]);
          break;
        case Syntax.CatchClause:
          withIndent(function () {
            var guard;
            result = [
              'catch' + space + '(',
              generateExpression(stmt.param, {
                precedence: Precedence.Sequence,
                allowIn: true,
                allowCall: true
              }),
              ')'
            ];
            if (stmt.guard) {
              guard = generateExpression(stmt.guard, {
                precedence: Precedence.Sequence,
                allowIn: true,
                allowCall: true
              });
              result.splice(2, 0, ' if ', guard);
            }
          });
          result.push(maybeBlock(stmt.body));
          break;
        case Syntax.DebuggerStatement:
          result = 'debugger' + semicolon;
          break;
        case Syntax.EmptyStatement:
          result = ';';
          break;
        case Syntax.ExportDeclaration:
          result = 'export ';
          if (stmt.declaration) {
            result = [
              result,
              generateStatement(stmt.declaration, { semicolonOptional: semicolon === '' })
            ];
            break;
          }
          break;
        case Syntax.ExpressionStatement:
          result = [generateExpression(stmt.expression, {
              precedence: Precedence.Sequence,
              allowIn: true,
              allowCall: true
            })];
          fragment = toSourceNodeWhenNeeded(result).toString();
          if (fragment.charAt(0) === '{' || fragment.slice(0, 8) === 'function' && '* ('.indexOf(fragment.charAt(8)) >= 0 || directive && directiveContext && stmt.expression.type === Syntax.Literal && typeof stmt.expression.value === 'string') {
            result = [
              '(',
              result,
              ')' + semicolon
            ];
          } else {
            result.push(semicolon);
          }
          break;
        case Syntax.ImportDeclaration:
          if (stmt.specifiers.length === 0) {
            result = [
              'import',
              space,
              generateLiteral(stmt.source)
            ];
          } else {
            if (stmt.kind === 'default') {
              result = [
                'import',
                noEmptySpace(),
                stmt.specifiers[0].id.name,
                noEmptySpace()
              ];
            } else {
              result = [
                'import',
                space,
                '{'
              ];
              if (stmt.specifiers.length === 1) {
                specifier = stmt.specifiers[0];
                result.push(space + specifier.id.name);
                if (specifier.name) {
                  result.push(noEmptySpace() + 'as' + noEmptySpace() + specifier.name.name);
                }
                result.push(space + '}' + space);
              } else {
                withIndent(function (indent) {
                  var i, iz;
                  result.push(newline);
                  for (i = 0, iz = stmt.specifiers.length; i < iz; ++i) {
                    specifier = stmt.specifiers[i];
                    result.push(indent + specifier.id.name);
                    if (specifier.name) {
                      result.push(noEmptySpace() + 'as' + noEmptySpace() + specifier.name.name);
                    }
                    if (i + 1 < iz) {
                      result.push(',' + newline);
                    }
                  }
                });
                if (!endsWithLineTerminator(toSourceNodeWhenNeeded(result).toString())) {
                  result.push(newline);
                }
                result.push(base + '}' + space);
              }
            }
            result.push('from' + space);
            result.push(generateLiteral(stmt.source));
          }
          result.push(semicolon);
          break;
        case Syntax.VariableDeclarator:
          if (stmt.init) {
            result = [
              generateExpression(stmt.id, {
                precedence: Precedence.Assignment,
                allowIn: allowIn,
                allowCall: true
              }),
              space,
              '=',
              space,
              generateExpression(stmt.init, {
                precedence: Precedence.Assignment,
                allowIn: allowIn,
                allowCall: true
              })
            ];
          } else {
            result = generatePattern(stmt.id, {
              precedence: Precedence.Assignment,
              allowIn: allowIn
            });
          }
          break;
        case Syntax.VariableDeclaration:
          result = [stmt.kind];
          if (stmt.declarations.length === 1 && stmt.declarations[0].init && stmt.declarations[0].init.type === Syntax.FunctionExpression) {
            result.push(noEmptySpace());
            result.push(generateStatement(stmt.declarations[0], { allowIn: allowIn }));
          } else {
            withIndent(function () {
              node = stmt.declarations[0];
              if (extra.comment && node.leadingComments) {
                result.push('\n');
                result.push(addIndent(generateStatement(node, { allowIn: allowIn })));
              } else {
                result.push(noEmptySpace());
                result.push(generateStatement(node, { allowIn: allowIn }));
              }
              for (i = 1, len = stmt.declarations.length; i < len; ++i) {
                node = stmt.declarations[i];
                if (extra.comment && node.leadingComments) {
                  result.push(',' + newline);
                  result.push(addIndent(generateStatement(node, { allowIn: allowIn })));
                } else {
                  result.push(',' + space);
                  result.push(generateStatement(node, { allowIn: allowIn }));
                }
              }
            });
          }
          result.push(semicolon);
          break;
        case Syntax.ThrowStatement:
          result = [
            join('throw', generateExpression(stmt.argument, {
              precedence: Precedence.Sequence,
              allowIn: true,
              allowCall: true
            })),
            semicolon
          ];
          break;
        case Syntax.TryStatement:
          result = [
            'try',
            maybeBlock(stmt.block)
          ];
          result = maybeBlockSuffix(stmt.block, result);
          if (stmt.handlers) {
            for (i = 0, len = stmt.handlers.length; i < len; ++i) {
              result = join(result, generateStatement(stmt.handlers[i]));
              if (stmt.finalizer || i + 1 !== len) {
                result = maybeBlockSuffix(stmt.handlers[i].body, result);
              }
            }
          } else {
            stmt.guardedHandlers = stmt.guardedHandlers || [];
            for (i = 0, len = stmt.guardedHandlers.length; i < len; ++i) {
              result = join(result, generateStatement(stmt.guardedHandlers[i]));
              if (stmt.finalizer || i + 1 !== len) {
                result = maybeBlockSuffix(stmt.guardedHandlers[i].body, result);
              }
            }
            if (stmt.handler) {
              if (isArray(stmt.handler)) {
                for (i = 0, len = stmt.handler.length; i < len; ++i) {
                  result = join(result, generateStatement(stmt.handler[i]));
                  if (stmt.finalizer || i + 1 !== len) {
                    result = maybeBlockSuffix(stmt.handler[i].body, result);
                  }
                }
              } else {
                result = join(result, generateStatement(stmt.handler));
                if (stmt.finalizer) {
                  result = maybeBlockSuffix(stmt.handler.body, result);
                }
              }
            }
          }
          if (stmt.finalizer) {
            result = join(result, [
              'finally',
              maybeBlock(stmt.finalizer)
            ]);
          }
          break;
        case Syntax.SwitchStatement:
          withIndent(function () {
            result = [
              'switch' + space + '(',
              generateExpression(stmt.discriminant, {
                precedence: Precedence.Sequence,
                allowIn: true,
                allowCall: true
              }),
              ')' + space + '{' + newline
            ];
          });
          if (stmt.cases) {
            for (i = 0, len = stmt.cases.length; i < len; ++i) {
              fragment = addIndent(generateStatement(stmt.cases[i], { semicolonOptional: i === len - 1 }));
              result.push(fragment);
              if (!endsWithLineTerminator(toSourceNodeWhenNeeded(fragment).toString())) {
                result.push(newline);
              }
            }
          }
          result.push(addIndent('}'));
          break;
        case Syntax.SwitchCase:
          withIndent(function () {
            if (stmt.test) {
              result = [
                join('case', generateExpression(stmt.test, {
                  precedence: Precedence.Sequence,
                  allowIn: true,
                  allowCall: true
                })),
                ':'
              ];
            } else {
              result = ['default:'];
            }
            i = 0;
            len = stmt.consequent.length;
            if (len && stmt.consequent[0].type === Syntax.BlockStatement) {
              fragment = maybeBlock(stmt.consequent[0]);
              result.push(fragment);
              i = 1;
            }
            if (i !== len && !endsWithLineTerminator(toSourceNodeWhenNeeded(result).toString())) {
              result.push(newline);
            }
            for (; i < len; ++i) {
              fragment = addIndent(generateStatement(stmt.consequent[i], { semicolonOptional: i === len - 1 && semicolon === '' }));
              result.push(fragment);
              if (i + 1 !== len && !endsWithLineTerminator(toSourceNodeWhenNeeded(fragment).toString())) {
                result.push(newline);
              }
            }
          });
          break;
        case Syntax.IfStatement:
          withIndent(function () {
            result = [
              'if' + space + '(',
              generateExpression(stmt.test, {
                precedence: Precedence.Sequence,
                allowIn: true,
                allowCall: true
              }),
              ')'
            ];
          });
          if (stmt.alternate) {
            result.push(maybeBlock(stmt.consequent));
            result = maybeBlockSuffix(stmt.consequent, result);
            if (stmt.alternate.type === Syntax.IfStatement) {
              result = join(result, [
                'else ',
                generateStatement(stmt.alternate, { semicolonOptional: semicolon === '' })
              ]);
            } else {
              result = join(result, join('else', maybeBlock(stmt.alternate, semicolon === '')));
            }
          } else {
            result.push(maybeBlock(stmt.consequent, semicolon === ''));
          }
          break;
        case Syntax.ForStatement:
          withIndent(function () {
            result = ['for' + space + '('];
            if (stmt.init) {
              if (stmt.init.type === Syntax.VariableDeclaration) {
                result.push(generateStatement(stmt.init, { allowIn: false }));
              } else {
                result.push(generateExpression(stmt.init, {
                  precedence: Precedence.Sequence,
                  allowIn: false,
                  allowCall: true
                }));
                result.push(';');
              }
            } else {
              result.push(';');
            }
            if (stmt.test) {
              result.push(space);
              result.push(generateExpression(stmt.test, {
                precedence: Precedence.Sequence,
                allowIn: true,
                allowCall: true
              }));
              result.push(';');
            } else {
              result.push(';');
            }
            if (stmt.update) {
              result.push(space);
              result.push(generateExpression(stmt.update, {
                precedence: Precedence.Sequence,
                allowIn: true,
                allowCall: true
              }));
              result.push(')');
            } else {
              result.push(')');
            }
          });
          result.push(maybeBlock(stmt.body, semicolon === ''));
          break;
        case Syntax.ForInStatement:
          result = generateIterationForStatement('in', stmt, semicolon === '');
          break;
        case Syntax.ForOfStatement:
          result = generateIterationForStatement('of', stmt, semicolon === '');
          break;
        case Syntax.LabeledStatement:
          result = [
            stmt.label.name + ':',
            maybeBlock(stmt.body, semicolon === '')
          ];
          break;
        case Syntax.Program:
          len = stmt.body.length;
          result = [safeConcatenation && len > 0 ? '\n' : ''];
          for (i = 0; i < len; ++i) {
            fragment = addIndent(generateStatement(stmt.body[i], {
              semicolonOptional: !safeConcatenation && i === len - 1,
              directiveContext: true
            }));
            result.push(fragment);
            if (i + 1 < len && !endsWithLineTerminator(toSourceNodeWhenNeeded(fragment).toString())) {
              result.push(newline);
            }
          }
          break;
        case Syntax.FunctionDeclaration:
          isGenerator = stmt.generator && !extra.moz.starlessGenerator;
          result = [
            isGenerator ? 'function*' : 'function',
            isGenerator ? space : noEmptySpace(),
            generateIdentifier(stmt.id),
            generateFunctionBody(stmt)
          ];
          break;
        case Syntax.ReturnStatement:
          if (stmt.argument) {
            result = [
              join('return', generateExpression(stmt.argument, {
                precedence: Precedence.Sequence,
                allowIn: true,
                allowCall: true
              })),
              semicolon
            ];
          } else {
            result = ['return' + semicolon];
          }
          break;
        case Syntax.WhileStatement:
          withIndent(function () {
            result = [
              'while' + space + '(',
              generateExpression(stmt.test, {
                precedence: Precedence.Sequence,
                allowIn: true,
                allowCall: true
              }),
              ')'
            ];
          });
          result.push(maybeBlock(stmt.body, semicolon === ''));
          break;
        case Syntax.WithStatement:
          withIndent(function () {
            result = [
              'with' + space + '(',
              generateExpression(stmt.object, {
                precedence: Precedence.Sequence,
                allowIn: true,
                allowCall: true
              }),
              ')'
            ];
          });
          result.push(maybeBlock(stmt.body, semicolon === ''));
          break;
        default:
          throw new Error('Unknown statement type: ' + stmt.type);
        }
        if (extra.comment) {
          result = addComments(stmt, result);
        }
        fragment = toSourceNodeWhenNeeded(result).toString();
        if (stmt.type === Syntax.Program && !safeConcatenation && newline === '' && fragment.charAt(fragment.length - 1) === '\n') {
          result = sourceMap ? toSourceNodeWhenNeeded(result).replaceRight(/\s+$/, '') : fragment.replace(/\s+$/, '');
        }
        return toSourceNodeWhenNeeded(result, stmt);
      }
      function generate(node, options) {
        var defaultOptions = getDefaultOptions(), result, pair;
        if (options != null) {
          if (typeof options.indent === 'string') {
            defaultOptions.format.indent.style = options.indent;
          }
          if (typeof options.base === 'number') {
            defaultOptions.format.indent.base = options.base;
          }
          options = updateDeeply(defaultOptions, options);
          indent = options.format.indent.style;
          if (typeof options.base === 'string') {
            base = options.base;
          } else {
            base = stringRepeat(indent, options.format.indent.base);
          }
        } else {
          options = defaultOptions;
          indent = options.format.indent.style;
          base = stringRepeat(indent, options.format.indent.base);
        }
        json = options.format.json;
        renumber = options.format.renumber;
        hexadecimal = json ? false : options.format.hexadecimal;
        quotes = json ? 'double' : options.format.quotes;
        escapeless = options.format.escapeless;
        newline = options.format.newline;
        space = options.format.space;
        if (options.format.compact) {
          newline = space = indent = base = '';
        }
        parentheses = options.format.parentheses;
        semicolons = options.format.semicolons;
        safeConcatenation = options.format.safeConcatenation;
        directive = options.directive;
        parse = json ? null : options.parse;
        sourceMap = options.sourceMap;
        extra = options;
        if (sourceMap) {
          if (!exports.browser) {
            SourceNode = require('/node_modules/source-map/lib/source-map.js', module).SourceNode;
          } else {
            SourceNode = global.sourceMap.SourceNode;
          }
        }
        switch (node.type) {
        case Syntax.BlockStatement:
        case Syntax.BreakStatement:
        case Syntax.CatchClause:
        case Syntax.ContinueStatement:
        case Syntax.DirectiveStatement:
        case Syntax.DoWhileStatement:
        case Syntax.DebuggerStatement:
        case Syntax.EmptyStatement:
        case Syntax.ExpressionStatement:
        case Syntax.ForStatement:
        case Syntax.ForInStatement:
        case Syntax.ForOfStatement:
        case Syntax.FunctionDeclaration:
        case Syntax.IfStatement:
        case Syntax.LabeledStatement:
        case Syntax.Program:
        case Syntax.ReturnStatement:
        case Syntax.SwitchStatement:
        case Syntax.SwitchCase:
        case Syntax.ThrowStatement:
        case Syntax.TryStatement:
        case Syntax.VariableDeclaration:
        case Syntax.VariableDeclarator:
        case Syntax.WhileStatement:
        case Syntax.WithStatement:
          result = generateStatement(node);
          break;
        case Syntax.AssignmentExpression:
        case Syntax.ArrayExpression:
        case Syntax.ArrayPattern:
        case Syntax.BinaryExpression:
        case Syntax.CallExpression:
        case Syntax.ConditionalExpression:
        case Syntax.FunctionExpression:
        case Syntax.Identifier:
        case Syntax.Literal:
        case Syntax.LogicalExpression:
        case Syntax.MemberExpression:
        case Syntax.NewExpression:
        case Syntax.ObjectExpression:
        case Syntax.ObjectPattern:
        case Syntax.Property:
        case Syntax.SequenceExpression:
        case Syntax.ThisExpression:
        case Syntax.UnaryExpression:
        case Syntax.UpdateExpression:
        case Syntax.YieldExpression:
          result = generateExpression(node, {
            precedence: Precedence.Sequence,
            allowIn: true,
            allowCall: true
          });
          break;
        default:
          throw new Error('Unknown node type: ' + node.type);
        }
        if (!sourceMap) {
          pair = {
            code: result.toString(),
            map: null
          };
          return options.sourceMapWithCode ? pair : pair.code;
        }
        pair = result.toStringWithSourceMap({
          file: options.file,
          sourceRoot: options.sourceMapRoot
        });
        if (options.sourceContent) {
          pair.map.setSourceContent(options.sourceMap, options.sourceContent);
        }
        if (options.sourceMapWithCode) {
          return pair;
        }
        return pair.map.toString();
      }
      FORMAT_MINIFY = {
        indent: {
          style: '',
          base: 0
        },
        renumber: true,
        hexadecimal: true,
        quotes: 'auto',
        escapeless: true,
        compact: true,
        parentheses: false,
        semicolons: false
      };
      FORMAT_DEFAULTS = getDefaultOptions().format;
      exports.version = require('/package.json', module).version;
      exports.generate = generate;
      exports.attachComments = estraverse.attachComments;
      exports.Precedence = updateDeeply({}, Precedence);
      exports.browser = false;
      exports.FORMAT_MINIFY = FORMAT_MINIFY;
      exports.FORMAT_DEFAULTS = FORMAT_DEFAULTS;
    }());
  });
  require.define('/package.json', function (module, exports, __dirname, __filename) {
    module.exports = {
      'name': 'escodegen',
      'description': 'ECMAScript code generator',
      'homepage': 'http://github.com/Constellation/escodegen',
      'main': 'escodegen.js',
      'bin': {
        'esgenerate': './bin/esgenerate.js',
        'escodegen': './bin/escodegen.js'
      },
      'version': '1.3.3',
      'engines': { 'node': '>=0.10.0' },
      'maintainers': [{
          'name': 'Yusuke Suzuki',
          'email': 'utatane.tea@gmail.com',
          'web': 'http://github.com/Constellation'
        }],
      'repository': {
        'type': 'git',
        'url': 'http://github.com/Constellation/escodegen.git'
      },
      'dependencies': {
        'esutils': '~1.0.0',
        'estraverse': '~1.5.0',
        'esprima': '~1.1.1'
      },
      'optionalDependencies': { 'source-map': '~0.1.33' },
      'devDependencies': {
        'esprima-moz': '*',
        'semver': '*',
        'chai': '~1.7.2',
        'gulp': '~3.5.0',
        'gulp-mocha': '~0.4.1',
        'gulp-eslint': '~0.1.2',
        'jshint-stylish': '~0.1.5',
        'gulp-jshint': '~1.4.0',
        'commonjs-everywhere': '~0.9.6',
        'bluebird': '~1.2.0',
        'bower-registry-client': '~0.2.0'
      },
      'licenses': [{
          'type': 'BSD',
          'url': 'http://github.com/Constellation/escodegen/raw/master/LICENSE.BSD'
        }],
      'scripts': {
        'test': 'gulp travis',
        'unit-test': 'gulp test',
        'lint': 'gulp lint',
        'release': 'node tools/release.js',
        'build-min': './node_modules/.bin/cjsify -ma path: tools/entry-point.js > escodegen.browser.min.js',
        'build': './node_modules/.bin/cjsify -a path: tools/entry-point.js > escodegen.browser.js'
      }
    };
  });
  require.define('/node_modules/source-map/lib/source-map.js', function (module, exports, __dirname, __filename) {
    exports.SourceMapGenerator = require('/node_modules/source-map/lib/source-map/source-map-generator.js', module).SourceMapGenerator;
    exports.SourceMapConsumer = require('/node_modules/source-map/lib/source-map/source-map-consumer.js', module).SourceMapConsumer;
    exports.SourceNode = require('/node_modules/source-map/lib/source-map/source-node.js', module).SourceNode;
  });
  require.define('/node_modules/source-map/lib/source-map/source-node.js', function (module, exports, __dirname, __filename) {
    if (typeof define !== 'function') {
      var define = require('/node_modules/source-map/node_modules/amdefine/amdefine.js', module)(module, require);
    }
    define(function (require, exports, module) {
      var SourceMapGenerator = require('/node_modules/source-map/lib/source-map/source-map-generator.js', module).SourceMapGenerator;
      var util = require('/node_modules/source-map/lib/source-map/util.js', module);
      function SourceNode(aLine, aColumn, aSource, aChunks, aName) {
        this.children = [];
        this.sourceContents = {};
        this.line = aLine === undefined ? null : aLine;
        this.column = aColumn === undefined ? null : aColumn;
        this.source = aSource === undefined ? null : aSource;
        this.name = aName === undefined ? null : aName;
        if (aChunks != null)
          this.add(aChunks);
      }
      SourceNode.fromStringWithSourceMap = function SourceNode_fromStringWithSourceMap(aGeneratedCode, aSourceMapConsumer) {
        var node = new SourceNode;
        var remainingLines = aGeneratedCode.split('\n');
        var lastGeneratedLine = 1, lastGeneratedColumn = 0;
        var lastMapping = null;
        aSourceMapConsumer.eachMapping(function (mapping) {
          if (lastMapping !== null) {
            if (lastGeneratedLine < mapping.generatedLine) {
              var code = '';
              addMappingWithCode(lastMapping, remainingLines.shift() + '\n');
              lastGeneratedLine++;
              lastGeneratedColumn = 0;
            } else {
              var nextLine = remainingLines[0];
              var code = nextLine.substr(0, mapping.generatedColumn - lastGeneratedColumn);
              remainingLines[0] = nextLine.substr(mapping.generatedColumn - lastGeneratedColumn);
              lastGeneratedColumn = mapping.generatedColumn;
              addMappingWithCode(lastMapping, code);
              lastMapping = mapping;
              return;
            }
          }
          while (lastGeneratedLine < mapping.generatedLine) {
            node.add(remainingLines.shift() + '\n');
            lastGeneratedLine++;
          }
          if (lastGeneratedColumn < mapping.generatedColumn) {
            var nextLine = remainingLines[0];
            node.add(nextLine.substr(0, mapping.generatedColumn));
            remainingLines[0] = nextLine.substr(mapping.generatedColumn);
            lastGeneratedColumn = mapping.generatedColumn;
          }
          lastMapping = mapping;
        }, this);
        if (remainingLines.length > 0) {
          if (lastMapping) {
            var lastLine = remainingLines.shift();
            if (remainingLines.length > 0)
              lastLine += '\n';
            addMappingWithCode(lastMapping, lastLine);
          }
          node.add(remainingLines.join('\n'));
        }
        aSourceMapConsumer.sources.forEach(function (sourceFile) {
          var content = aSourceMapConsumer.sourceContentFor(sourceFile);
          if (content) {
            node.setSourceContent(sourceFile, content);
          }
        });
        return node;
        function addMappingWithCode(mapping, code) {
          if (mapping === null || mapping.source === undefined) {
            node.add(code);
          } else {
            node.add(new SourceNode(mapping.originalLine, mapping.originalColumn, mapping.source, code, mapping.name));
          }
        }
      };
      SourceNode.prototype.add = function SourceNode_add(aChunk) {
        if (Array.isArray(aChunk)) {
          aChunk.forEach(function (chunk) {
            this.add(chunk);
          }, this);
        } else if (aChunk instanceof SourceNode || typeof aChunk === 'string') {
          if (aChunk) {
            this.children.push(aChunk);
          }
        } else {
          throw new TypeError('Expected a SourceNode, string, or an array of SourceNodes and strings. Got ' + aChunk);
        }
        return this;
      };
      SourceNode.prototype.prepend = function SourceNode_prepend(aChunk) {
        if (Array.isArray(aChunk)) {
          for (var i = aChunk.length - 1; i >= 0; i--) {
            this.prepend(aChunk[i]);
          }
        } else if (aChunk instanceof SourceNode || typeof aChunk === 'string') {
          this.children.unshift(aChunk);
        } else {
          throw new TypeError('Expected a SourceNode, string, or an array of SourceNodes and strings. Got ' + aChunk);
        }
        return this;
      };
      SourceNode.prototype.walk = function SourceNode_walk(aFn) {
        var chunk;
        for (var i = 0, len = this.children.length; i < len; i++) {
          chunk = this.children[i];
          if (chunk instanceof SourceNode) {
            chunk.walk(aFn);
          } else {
            if (chunk !== '') {
              aFn(chunk, {
                source: this.source,
                line: this.line,
                column: this.column,
                name: this.name
              });
            }
          }
        }
      };
      SourceNode.prototype.join = function SourceNode_join(aSep) {
        var newChildren;
        var i;
        var len = this.children.length;
        if (len > 0) {
          newChildren = [];
          for (i = 0; i < len - 1; i++) {
            newChildren.push(this.children[i]);
            newChildren.push(aSep);
          }
          newChildren.push(this.children[i]);
          this.children = newChildren;
        }
        return this;
      };
      SourceNode.prototype.replaceRight = function SourceNode_replaceRight(aPattern, aReplacement) {
        var lastChild = this.children[this.children.length - 1];
        if (lastChild instanceof SourceNode) {
          lastChild.replaceRight(aPattern, aReplacement);
        } else if (typeof lastChild === 'string') {
          this.children[this.children.length - 1] = lastChild.replace(aPattern, aReplacement);
        } else {
          this.children.push(''.replace(aPattern, aReplacement));
        }
        return this;
      };
      SourceNode.prototype.setSourceContent = function SourceNode_setSourceContent(aSourceFile, aSourceContent) {
        this.sourceContents[util.toSetString(aSourceFile)] = aSourceContent;
      };
      SourceNode.prototype.walkSourceContents = function SourceNode_walkSourceContents(aFn) {
        for (var i = 0, len = this.children.length; i < len; i++) {
          if (this.children[i] instanceof SourceNode) {
            this.children[i].walkSourceContents(aFn);
          }
        }
        var sources = Object.keys(this.sourceContents);
        for (var i = 0, len = sources.length; i < len; i++) {
          aFn(util.fromSetString(sources[i]), this.sourceContents[sources[i]]);
        }
      };
      SourceNode.prototype.toString = function SourceNode_toString() {
        var str = '';
        this.walk(function (chunk) {
          str += chunk;
        });
        return str;
      };
      SourceNode.prototype.toStringWithSourceMap = function SourceNode_toStringWithSourceMap(aArgs) {
        var generated = {
            code: '',
            line: 1,
            column: 0
          };
        var map = new SourceMapGenerator(aArgs);
        var sourceMappingActive = false;
        var lastOriginalSource = null;
        var lastOriginalLine = null;
        var lastOriginalColumn = null;
        var lastOriginalName = null;
        this.walk(function (chunk, original) {
          generated.code += chunk;
          if (original.source !== null && original.line !== null && original.column !== null) {
            if (lastOriginalSource !== original.source || lastOriginalLine !== original.line || lastOriginalColumn !== original.column || lastOriginalName !== original.name) {
              map.addMapping({
                source: original.source,
                original: {
                  line: original.line,
                  column: original.column
                },
                generated: {
                  line: generated.line,
                  column: generated.column
                },
                name: original.name
              });
            }
            lastOriginalSource = original.source;
            lastOriginalLine = original.line;
            lastOriginalColumn = original.column;
            lastOriginalName = original.name;
            sourceMappingActive = true;
          } else if (sourceMappingActive) {
            map.addMapping({
              generated: {
                line: generated.line,
                column: generated.column
              }
            });
            lastOriginalSource = null;
            sourceMappingActive = false;
          }
          chunk.split('').forEach(function (ch, idx, array) {
            if (ch === '\n') {
              generated.line++;
              generated.column = 0;
              if (idx + 1 === array.length) {
                lastOriginalSource = null;
                sourceMappingActive = false;
              } else if (sourceMappingActive) {
                map.addMapping({
                  source: original.source,
                  original: {
                    line: original.line,
                    column: original.column
                  },
                  generated: {
                    line: generated.line,
                    column: generated.column
                  },
                  name: original.name
                });
              }
            } else {
              generated.column++;
            }
          });
        });
        this.walkSourceContents(function (sourceFile, sourceContent) {
          map.setSourceContent(sourceFile, sourceContent);
        });
        return {
          code: generated.code,
          map: map
        };
      };
      exports.SourceNode = SourceNode;
    });
  });
  require.define('/node_modules/source-map/lib/source-map/util.js', function (module, exports, __dirname, __filename) {
    if (typeof define !== 'function') {
      var define = require('/node_modules/source-map/node_modules/amdefine/amdefine.js', module)(module, require);
    }
    define(function (require, exports, module) {
      function getArg(aArgs, aName, aDefaultValue) {
        if (aName in aArgs) {
          return aArgs[aName];
        } else if (arguments.length === 3) {
          return aDefaultValue;
        } else {
          throw new Error('"' + aName + '" is a required argument.');
        }
      }
      exports.getArg = getArg;
      var urlRegexp = /^(?:([\w+\-.]+):)?\/\/(?:(\w+:\w+)@)?([\w.]*)(?::(\d+))?(\S*)$/;
      var dataUrlRegexp = /^data:.+\,.+$/;
      function urlParse(aUrl) {
        var match = aUrl.match(urlRegexp);
        if (!match) {
          return null;
        }
        return {
          scheme: match[1],
          auth: match[2],
          host: match[3],
          port: match[4],
          path: match[5]
        };
      }
      exports.urlParse = urlParse;
      function urlGenerate(aParsedUrl) {
        var url = '';
        if (aParsedUrl.scheme) {
          url += aParsedUrl.scheme + ':';
        }
        url += '//';
        if (aParsedUrl.auth) {
          url += aParsedUrl.auth + '@';
        }
        if (aParsedUrl.host) {
          url += aParsedUrl.host;
        }
        if (aParsedUrl.port) {
          url += ':' + aParsedUrl.port;
        }
        if (aParsedUrl.path) {
          url += aParsedUrl.path;
        }
        return url;
      }
      exports.urlGenerate = urlGenerate;
      function normalize(aPath) {
        var path = aPath;
        var url = urlParse(aPath);
        if (url) {
          if (!url.path) {
            return aPath;
          }
          path = url.path;
        }
        var isAbsolute = path.charAt(0) === '/';
        var parts = path.split(/\/+/);
        for (var part, up = 0, i = parts.length - 1; i >= 0; i--) {
          part = parts[i];
          if (part === '.') {
            parts.splice(i, 1);
          } else if (part === '..') {
            up++;
          } else if (up > 0) {
            if (part === '') {
              parts.splice(i + 1, up);
              up = 0;
            } else {
              parts.splice(i, 2);
              up--;
            }
          }
        }
        path = parts.join('/');
        if (path === '') {
          path = isAbsolute ? '/' : '.';
        }
        if (url) {
          url.path = path;
          return urlGenerate(url);
        }
        return path;
      }
      exports.normalize = normalize;
      function join(aRoot, aPath) {
        var aPathUrl = urlParse(aPath);
        var aRootUrl = urlParse(aRoot);
        if (aRootUrl) {
          aRoot = aRootUrl.path || '/';
        }
        if (aPathUrl && !aPathUrl.scheme) {
          if (aRootUrl) {
            aPathUrl.scheme = aRootUrl.scheme;
          }
          return urlGenerate(aPathUrl);
        }
        if (aPathUrl || aPath.match(dataUrlRegexp)) {
          return aPath;
        }
        if (aRootUrl && !aRootUrl.host && !aRootUrl.path) {
          aRootUrl.host = aPath;
          return urlGenerate(aRootUrl);
        }
        var joined = aPath.charAt(0) === '/' ? aPath : normalize(aRoot.replace(/\/+$/, '') + '/' + aPath);
        if (aRootUrl) {
          aRootUrl.path = joined;
          return urlGenerate(aRootUrl);
        }
        return joined;
      }
      exports.join = join;
      function toSetString(aStr) {
        return '$' + aStr;
      }
      exports.toSetString = toSetString;
      function fromSetString(aStr) {
        return aStr.substr(1);
      }
      exports.fromSetString = fromSetString;
      function relative(aRoot, aPath) {
        aRoot = aRoot.replace(/\/$/, '');
        var url = urlParse(aRoot);
        if (aPath.charAt(0) == '/' && url && url.path == '/') {
          return aPath.slice(1);
        }
        return aPath.indexOf(aRoot + '/') === 0 ? aPath.substr(aRoot.length + 1) : aPath;
      }
      exports.relative = relative;
      function strcmp(aStr1, aStr2) {
        var s1 = aStr1 || '';
        var s2 = aStr2 || '';
        return (s1 > s2) - (s1 < s2);
      }
      function compareByOriginalPositions(mappingA, mappingB, onlyCompareOriginal) {
        var cmp;
        cmp = strcmp(mappingA.source, mappingB.source);
        if (cmp) {
          return cmp;
        }
        cmp = mappingA.originalLine - mappingB.originalLine;
        if (cmp) {
          return cmp;
        }
        cmp = mappingA.originalColumn - mappingB.originalColumn;
        if (cmp || onlyCompareOriginal) {
          return cmp;
        }
        cmp = strcmp(mappingA.name, mappingB.name);
        if (cmp) {
          return cmp;
        }
        cmp = mappingA.generatedLine - mappingB.generatedLine;
        if (cmp) {
          return cmp;
        }
        return mappingA.generatedColumn - mappingB.generatedColumn;
      }
      ;
      exports.compareByOriginalPositions = compareByOriginalPositions;
      function compareByGeneratedPositions(mappingA, mappingB, onlyCompareGenerated) {
        var cmp;
        cmp = mappingA.generatedLine - mappingB.generatedLine;
        if (cmp) {
          return cmp;
        }
        cmp = mappingA.generatedColumn - mappingB.generatedColumn;
        if (cmp || onlyCompareGenerated) {
          return cmp;
        }
        cmp = strcmp(mappingA.source, mappingB.source);
        if (cmp) {
          return cmp;
        }
        cmp = mappingA.originalLine - mappingB.originalLine;
        if (cmp) {
          return cmp;
        }
        cmp = mappingA.originalColumn - mappingB.originalColumn;
        if (cmp) {
          return cmp;
        }
        return strcmp(mappingA.name, mappingB.name);
      }
      ;
      exports.compareByGeneratedPositions = compareByGeneratedPositions;
    });
  });
  require.define('/node_modules/source-map/node_modules/amdefine/amdefine.js', function (module, exports, __dirname, __filename) {
    'use strict';
    function amdefine(module, requireFn) {
      'use strict';
      var defineCache = {}, loaderCache = {}, alreadyCalled = false, path = require('path', module), makeRequire, stringRequire;
      function trimDots(ary) {
        var i, part;
        for (i = 0; ary[i]; i += 1) {
          part = ary[i];
          if (part === '.') {
            ary.splice(i, 1);
            i -= 1;
          } else if (part === '..') {
            if (i === 1 && (ary[2] === '..' || ary[0] === '..')) {
              break;
            } else if (i > 0) {
              ary.splice(i - 1, 2);
              i -= 2;
            }
          }
        }
      }
      function normalize(name, baseName) {
        var baseParts;
        if (name && name.charAt(0) === '.') {
          if (baseName) {
            baseParts = baseName.split('/');
            baseParts = baseParts.slice(0, baseParts.length - 1);
            baseParts = baseParts.concat(name.split('/'));
            trimDots(baseParts);
            name = baseParts.join('/');
          }
        }
        return name;
      }
      function makeNormalize(relName) {
        return function (name) {
          return normalize(name, relName);
        };
      }
      function makeLoad(id) {
        function load(value) {
          loaderCache[id] = value;
        }
        load.fromText = function (id, text) {
          throw new Error('amdefine does not implement load.fromText');
        };
        return load;
      }
      makeRequire = function (systemRequire, exports, module, relId) {
        function amdRequire(deps, callback) {
          if (typeof deps === 'string') {
            return stringRequire(systemRequire, exports, module, deps, relId);
          } else {
            deps = deps.map(function (depName) {
              return stringRequire(systemRequire, exports, module, depName, relId);
            });
            process.nextTick(function () {
              callback.apply(null, deps);
            });
          }
        }
        amdRequire.toUrl = function (filePath) {
          if (filePath.indexOf('.') === 0) {
            return normalize(filePath, path.dirname(module.filename));
          } else {
            return filePath;
          }
        };
        return amdRequire;
      };
      requireFn = requireFn || function req() {
        return module.require.apply(module, arguments);
      };
      function runFactory(id, deps, factory) {
        var r, e, m, result;
        if (id) {
          e = loaderCache[id] = {};
          m = {
            id: id,
            uri: __filename,
            exports: e
          };
          r = makeRequire(requireFn, e, m, id);
        } else {
          if (alreadyCalled) {
            throw new Error('amdefine with no module ID cannot be called more than once per file.');
          }
          alreadyCalled = true;
          e = module.exports;
          m = module;
          r = makeRequire(requireFn, e, m, module.id);
        }
        if (deps) {
          deps = deps.map(function (depName) {
            return r(depName);
          });
        }
        if (typeof factory === 'function') {
          result = factory.apply(m.exports, deps);
        } else {
          result = factory;
        }
        if (result !== undefined) {
          m.exports = result;
          if (id) {
            loaderCache[id] = m.exports;
          }
        }
      }
      stringRequire = function (systemRequire, exports, module, id, relId) {
        var index = id.indexOf('!'), originalId = id, prefix, plugin;
        if (index === -1) {
          id = normalize(id, relId);
          if (id === 'require') {
            return makeRequire(systemRequire, exports, module, relId);
          } else if (id === 'exports') {
            return exports;
          } else if (id === 'module') {
            return module;
          } else if (loaderCache.hasOwnProperty(id)) {
            return loaderCache[id];
          } else if (defineCache[id]) {
            runFactory.apply(null, defineCache[id]);
            return loaderCache[id];
          } else {
            if (systemRequire) {
              return systemRequire(originalId);
            } else {
              throw new Error('No module with ID: ' + id);
            }
          }
        } else {
          prefix = id.substring(0, index);
          id = id.substring(index + 1, id.length);
          plugin = stringRequire(systemRequire, exports, module, prefix, relId);
          if (plugin.normalize) {
            id = plugin.normalize(id, makeNormalize(relId));
          } else {
            id = normalize(id, relId);
          }
          if (loaderCache[id]) {
            return loaderCache[id];
          } else {
            plugin.load(id, makeRequire(systemRequire, exports, module, relId), makeLoad(id), {});
            return loaderCache[id];
          }
        }
      };
      function define(id, deps, factory) {
        if (Array.isArray(id)) {
          factory = deps;
          deps = id;
          id = undefined;
        } else if (typeof id !== 'string') {
          factory = id;
          id = deps = undefined;
        }
        if (deps && !Array.isArray(deps)) {
          factory = deps;
          deps = undefined;
        }
        if (!deps) {
          deps = [
            'require',
            'exports',
            'module'
          ];
        }
        if (id) {
          defineCache[id] = [
            id,
            deps,
            factory
          ];
        } else {
          runFactory(id, deps, factory);
        }
      }
      define.require = function (id) {
        if (loaderCache[id]) {
          return loaderCache[id];
        }
        if (defineCache[id]) {
          runFactory.apply(null, defineCache[id]);
          return loaderCache[id];
        }
      };
      define.amd = {};
      return define;
    }
    module.exports = amdefine;
  });
  require.define('/node_modules/source-map/lib/source-map/source-map-generator.js', function (module, exports, __dirname, __filename) {
    if (typeof define !== 'function') {
      var define = require('/node_modules/source-map/node_modules/amdefine/amdefine.js', module)(module, require);
    }
    define(function (require, exports, module) {
      var base64VLQ = require('/node_modules/source-map/lib/source-map/base64-vlq.js', module);
      var util = require('/node_modules/source-map/lib/source-map/util.js', module);
      var ArraySet = require('/node_modules/source-map/lib/source-map/array-set.js', module).ArraySet;
      function SourceMapGenerator(aArgs) {
        if (!aArgs) {
          aArgs = {};
        }
        this._file = util.getArg(aArgs, 'file', null);
        this._sourceRoot = util.getArg(aArgs, 'sourceRoot', null);
        this._sources = new ArraySet;
        this._names = new ArraySet;
        this._mappings = [];
        this._sourcesContents = null;
      }
      SourceMapGenerator.prototype._version = 3;
      SourceMapGenerator.fromSourceMap = function SourceMapGenerator_fromSourceMap(aSourceMapConsumer) {
        var sourceRoot = aSourceMapConsumer.sourceRoot;
        var generator = new SourceMapGenerator({
            file: aSourceMapConsumer.file,
            sourceRoot: sourceRoot
          });
        aSourceMapConsumer.eachMapping(function (mapping) {
          var newMapping = {
              generated: {
                line: mapping.generatedLine,
                column: mapping.generatedColumn
              }
            };
          if (mapping.source) {
            newMapping.source = mapping.source;
            if (sourceRoot) {
              newMapping.source = util.relative(sourceRoot, newMapping.source);
            }
            newMapping.original = {
              line: mapping.originalLine,
              column: mapping.originalColumn
            };
            if (mapping.name) {
              newMapping.name = mapping.name;
            }
          }
          generator.addMapping(newMapping);
        });
        aSourceMapConsumer.sources.forEach(function (sourceFile) {
          var content = aSourceMapConsumer.sourceContentFor(sourceFile);
          if (content) {
            generator.setSourceContent(sourceFile, content);
          }
        });
        return generator;
      };
      SourceMapGenerator.prototype.addMapping = function SourceMapGenerator_addMapping(aArgs) {
        var generated = util.getArg(aArgs, 'generated');
        var original = util.getArg(aArgs, 'original', null);
        var source = util.getArg(aArgs, 'source', null);
        var name = util.getArg(aArgs, 'name', null);
        this._validateMapping(generated, original, source, name);
        if (source && !this._sources.has(source)) {
          this._sources.add(source);
        }
        if (name && !this._names.has(name)) {
          this._names.add(name);
        }
        this._mappings.push({
          generatedLine: generated.line,
          generatedColumn: generated.column,
          originalLine: original != null && original.line,
          originalColumn: original != null && original.column,
          source: source,
          name: name
        });
      };
      SourceMapGenerator.prototype.setSourceContent = function SourceMapGenerator_setSourceContent(aSourceFile, aSourceContent) {
        var source = aSourceFile;
        if (this._sourceRoot) {
          source = util.relative(this._sourceRoot, source);
        }
        if (aSourceContent !== null) {
          if (!this._sourcesContents) {
            this._sourcesContents = {};
          }
          this._sourcesContents[util.toSetString(source)] = aSourceContent;
        } else {
          delete this._sourcesContents[util.toSetString(source)];
          if (Object.keys(this._sourcesContents).length === 0) {
            this._sourcesContents = null;
          }
        }
      };
      SourceMapGenerator.prototype.applySourceMap = function SourceMapGenerator_applySourceMap(aSourceMapConsumer, aSourceFile, aSourceMapPath) {
        if (!aSourceFile) {
          if (!aSourceMapConsumer.file) {
            throw new Error('SourceMapGenerator.prototype.applySourceMap requires either an explicit source file, ' + 'or the source map\'s "file" property. Both were omitted.');
          }
          aSourceFile = aSourceMapConsumer.file;
        }
        var sourceRoot = this._sourceRoot;
        if (sourceRoot) {
          aSourceFile = util.relative(sourceRoot, aSourceFile);
        }
        var newSources = new ArraySet;
        var newNames = new ArraySet;
        this._mappings.forEach(function (mapping) {
          if (mapping.source === aSourceFile && mapping.originalLine) {
            var original = aSourceMapConsumer.originalPositionFor({
                line: mapping.originalLine,
                column: mapping.originalColumn
              });
            if (original.source !== null) {
              mapping.source = original.source;
              if (aSourceMapPath) {
                mapping.source = util.join(aSourceMapPath, mapping.source);
              }
              if (sourceRoot) {
                mapping.source = util.relative(sourceRoot, mapping.source);
              }
              mapping.originalLine = original.line;
              mapping.originalColumn = original.column;
              if (original.name !== null && mapping.name !== null) {
                mapping.name = original.name;
              }
            }
          }
          var source = mapping.source;
          if (source && !newSources.has(source)) {
            newSources.add(source);
          }
          var name = mapping.name;
          if (name && !newNames.has(name)) {
            newNames.add(name);
          }
        }, this);
        this._sources = newSources;
        this._names = newNames;
        aSourceMapConsumer.sources.forEach(function (sourceFile) {
          var content = aSourceMapConsumer.sourceContentFor(sourceFile);
          if (content) {
            if (sourceRoot) {
              sourceFile = util.relative(sourceRoot, sourceFile);
            }
            this.setSourceContent(sourceFile, content);
          }
        }, this);
      };
      SourceMapGenerator.prototype._validateMapping = function SourceMapGenerator_validateMapping(aGenerated, aOriginal, aSource, aName) {
        if (aGenerated && 'line' in aGenerated && 'column' in aGenerated && aGenerated.line > 0 && aGenerated.column >= 0 && !aOriginal && !aSource && !aName) {
          return;
        } else if (aGenerated && 'line' in aGenerated && 'column' in aGenerated && aOriginal && 'line' in aOriginal && 'column' in aOriginal && aGenerated.line > 0 && aGenerated.column >= 0 && aOriginal.line > 0 && aOriginal.column >= 0 && aSource) {
          return;
        } else {
          throw new Error('Invalid mapping: ' + JSON.stringify({
            generated: aGenerated,
            source: aSource,
            original: aOriginal,
            name: aName
          }));
        }
      };
      SourceMapGenerator.prototype._serializeMappings = function SourceMapGenerator_serializeMappings() {
        var previousGeneratedColumn = 0;
        var previousGeneratedLine = 1;
        var previousOriginalColumn = 0;
        var previousOriginalLine = 0;
        var previousName = 0;
        var previousSource = 0;
        var result = '';
        var mapping;
        this._mappings.sort(util.compareByGeneratedPositions);
        for (var i = 0, len = this._mappings.length; i < len; i++) {
          mapping = this._mappings[i];
          if (mapping.generatedLine !== previousGeneratedLine) {
            previousGeneratedColumn = 0;
            while (mapping.generatedLine !== previousGeneratedLine) {
              result += ';';
              previousGeneratedLine++;
            }
          } else {
            if (i > 0) {
              if (!util.compareByGeneratedPositions(mapping, this._mappings[i - 1])) {
                continue;
              }
              result += ',';
            }
          }
          result += base64VLQ.encode(mapping.generatedColumn - previousGeneratedColumn);
          previousGeneratedColumn = mapping.generatedColumn;
          if (mapping.source) {
            result += base64VLQ.encode(this._sources.indexOf(mapping.source) - previousSource);
            previousSource = this._sources.indexOf(mapping.source);
            result += base64VLQ.encode(mapping.originalLine - 1 - previousOriginalLine);
            previousOriginalLine = mapping.originalLine - 1;
            result += base64VLQ.encode(mapping.originalColumn - previousOriginalColumn);
            previousOriginalColumn = mapping.originalColumn;
            if (mapping.name) {
              result += base64VLQ.encode(this._names.indexOf(mapping.name) - previousName);
              previousName = this._names.indexOf(mapping.name);
            }
          }
        }
        return result;
      };
      SourceMapGenerator.prototype._generateSourcesContent = function SourceMapGenerator_generateSourcesContent(aSources, aSourceRoot) {
        return aSources.map(function (source) {
          if (!this._sourcesContents) {
            return null;
          }
          if (aSourceRoot) {
            source = util.relative(aSourceRoot, source);
          }
          var key = util.toSetString(source);
          return Object.prototype.hasOwnProperty.call(this._sourcesContents, key) ? this._sourcesContents[key] : null;
        }, this);
      };
      SourceMapGenerator.prototype.toJSON = function SourceMapGenerator_toJSON() {
        var map = {
            version: this._version,
            file: this._file,
            sources: this._sources.toArray(),
            names: this._names.toArray(),
            mappings: this._serializeMappings()
          };
        if (this._sourceRoot) {
          map.sourceRoot = this._sourceRoot;
        }
        if (this._sourcesContents) {
          map.sourcesContent = this._generateSourcesContent(map.sources, map.sourceRoot);
        }
        return map;
      };
      SourceMapGenerator.prototype.toString = function SourceMapGenerator_toString() {
        return JSON.stringify(this);
      };
      exports.SourceMapGenerator = SourceMapGenerator;
    });
  });
  require.define('/node_modules/source-map/lib/source-map/array-set.js', function (module, exports, __dirname, __filename) {
    if (typeof define !== 'function') {
      var define = require('/node_modules/source-map/node_modules/amdefine/amdefine.js', module)(module, require);
    }
    define(function (require, exports, module) {
      var util = require('/node_modules/source-map/lib/source-map/util.js', module);
      function ArraySet() {
        this._array = [];
        this._set = {};
      }
      ArraySet.fromArray = function ArraySet_fromArray(aArray, aAllowDuplicates) {
        var set = new ArraySet;
        for (var i = 0, len = aArray.length; i < len; i++) {
          set.add(aArray[i], aAllowDuplicates);
        }
        return set;
      };
      ArraySet.prototype.add = function ArraySet_add(aStr, aAllowDuplicates) {
        var isDuplicate = this.has(aStr);
        var idx = this._array.length;
        if (!isDuplicate || aAllowDuplicates) {
          this._array.push(aStr);
        }
        if (!isDuplicate) {
          this._set[util.toSetString(aStr)] = idx;
        }
      };
      ArraySet.prototype.has = function ArraySet_has(aStr) {
        return Object.prototype.hasOwnProperty.call(this._set, util.toSetString(aStr));
      };
      ArraySet.prototype.indexOf = function ArraySet_indexOf(aStr) {
        if (this.has(aStr)) {
          return this._set[util.toSetString(aStr)];
        }
        throw new Error('"' + aStr + '" is not in the set.');
      };
      ArraySet.prototype.at = function ArraySet_at(aIdx) {
        if (aIdx >= 0 && aIdx < this._array.length) {
          return this._array[aIdx];
        }
        throw new Error('No element indexed by ' + aIdx);
      };
      ArraySet.prototype.toArray = function ArraySet_toArray() {
        return this._array.slice();
      };
      exports.ArraySet = ArraySet;
    });
  });
  require.define('/node_modules/source-map/lib/source-map/base64-vlq.js', function (module, exports, __dirname, __filename) {
    if (typeof define !== 'function') {
      var define = require('/node_modules/source-map/node_modules/amdefine/amdefine.js', module)(module, require);
    }
    define(function (require, exports, module) {
      var base64 = require('/node_modules/source-map/lib/source-map/base64.js', module);
      var VLQ_BASE_SHIFT = 5;
      var VLQ_BASE = 1 << VLQ_BASE_SHIFT;
      var VLQ_BASE_MASK = VLQ_BASE - 1;
      var VLQ_CONTINUATION_BIT = VLQ_BASE;
      function toVLQSigned(aValue) {
        return aValue < 0 ? (-aValue << 1) + 1 : (aValue << 1) + 0;
      }
      function fromVLQSigned(aValue) {
        var isNegative = (aValue & 1) === 1;
        var shifted = aValue >> 1;
        return isNegative ? -shifted : shifted;
      }
      exports.encode = function base64VLQ_encode(aValue) {
        var encoded = '';
        var digit;
        var vlq = toVLQSigned(aValue);
        do {
          digit = vlq & VLQ_BASE_MASK;
          vlq >>>= VLQ_BASE_SHIFT;
          if (vlq > 0) {
            digit |= VLQ_CONTINUATION_BIT;
          }
          encoded += base64.encode(digit);
        } while (vlq > 0);
        return encoded;
      };
      exports.decode = function base64VLQ_decode(aStr) {
        var i = 0;
        var strLen = aStr.length;
        var result = 0;
        var shift = 0;
        var continuation, digit;
        do {
          if (i >= strLen) {
            throw new Error('Expected more digits in base 64 VLQ value.');
          }
          digit = base64.decode(aStr.charAt(i++));
          continuation = !!(digit & VLQ_CONTINUATION_BIT);
          digit &= VLQ_BASE_MASK;
          result = result + (digit << shift);
          shift += VLQ_BASE_SHIFT;
        } while (continuation);
        return {
          value: fromVLQSigned(result),
          rest: aStr.slice(i)
        };
      };
    });
  });
  require.define('/node_modules/source-map/lib/source-map/base64.js', function (module, exports, __dirname, __filename) {
    if (typeof define !== 'function') {
      var define = require('/node_modules/source-map/node_modules/amdefine/amdefine.js', module)(module, require);
    }
    define(function (require, exports, module) {
      var charToIntMap = {};
      var intToCharMap = {};
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split('').forEach(function (ch, index) {
        charToIntMap[ch] = index;
        intToCharMap[index] = ch;
      });
      exports.encode = function base64_encode(aNumber) {
        if (aNumber in intToCharMap) {
          return intToCharMap[aNumber];
        }
        throw new TypeError('Must be between 0 and 63: ' + aNumber);
      };
      exports.decode = function base64_decode(aChar) {
        if (aChar in charToIntMap) {
          return charToIntMap[aChar];
        }
        throw new TypeError('Not a valid base 64 digit: ' + aChar);
      };
    });
  });
  require.define('/node_modules/source-map/lib/source-map/source-map-consumer.js', function (module, exports, __dirname, __filename) {
    if (typeof define !== 'function') {
      var define = require('/node_modules/source-map/node_modules/amdefine/amdefine.js', module)(module, require);
    }
    define(function (require, exports, module) {
      var util = require('/node_modules/source-map/lib/source-map/util.js', module);
      var binarySearch = require('/node_modules/source-map/lib/source-map/binary-search.js', module);
      var ArraySet = require('/node_modules/source-map/lib/source-map/array-set.js', module).ArraySet;
      var base64VLQ = require('/node_modules/source-map/lib/source-map/base64-vlq.js', module);
      function SourceMapConsumer(aSourceMap) {
        var sourceMap = aSourceMap;
        if (typeof aSourceMap === 'string') {
          sourceMap = JSON.parse(aSourceMap.replace(/^\)\]\}'/, ''));
        }
        var version = util.getArg(sourceMap, 'version');
        var sources = util.getArg(sourceMap, 'sources');
        var names = util.getArg(sourceMap, 'names', []);
        var sourceRoot = util.getArg(sourceMap, 'sourceRoot', null);
        var sourcesContent = util.getArg(sourceMap, 'sourcesContent', null);
        var mappings = util.getArg(sourceMap, 'mappings');
        var file = util.getArg(sourceMap, 'file', null);
        if (version != this._version) {
          throw new Error('Unsupported version: ' + version);
        }
        this._names = ArraySet.fromArray(names, true);
        this._sources = ArraySet.fromArray(sources, true);
        this.sourceRoot = sourceRoot;
        this.sourcesContent = sourcesContent;
        this._mappings = mappings;
        this.file = file;
      }
      SourceMapConsumer.fromSourceMap = function SourceMapConsumer_fromSourceMap(aSourceMap) {
        var smc = Object.create(SourceMapConsumer.prototype);
        smc._names = ArraySet.fromArray(aSourceMap._names.toArray(), true);
        smc._sources = ArraySet.fromArray(aSourceMap._sources.toArray(), true);
        smc.sourceRoot = aSourceMap._sourceRoot;
        smc.sourcesContent = aSourceMap._generateSourcesContent(smc._sources.toArray(), smc.sourceRoot);
        smc.file = aSourceMap._file;
        smc.__generatedMappings = aSourceMap._mappings.slice().sort(util.compareByGeneratedPositions);
        smc.__originalMappings = aSourceMap._mappings.slice().sort(util.compareByOriginalPositions);
        return smc;
      };
      SourceMapConsumer.prototype._version = 3;
      Object.defineProperty(SourceMapConsumer.prototype, 'sources', {
        get: function () {
          return this._sources.toArray().map(function (s) {
            return this.sourceRoot ? util.join(this.sourceRoot, s) : s;
          }, this);
        }
      });
      SourceMapConsumer.prototype.__generatedMappings = null;
      Object.defineProperty(SourceMapConsumer.prototype, '_generatedMappings', {
        get: function () {
          if (!this.__generatedMappings) {
            this.__generatedMappings = [];
            this.__originalMappings = [];
            this._parseMappings(this._mappings, this.sourceRoot);
          }
          return this.__generatedMappings;
        }
      });
      SourceMapConsumer.prototype.__originalMappings = null;
      Object.defineProperty(SourceMapConsumer.prototype, '_originalMappings', {
        get: function () {
          if (!this.__originalMappings) {
            this.__generatedMappings = [];
            this.__originalMappings = [];
            this._parseMappings(this._mappings, this.sourceRoot);
          }
          return this.__originalMappings;
        }
      });
      SourceMapConsumer.prototype._parseMappings = function SourceMapConsumer_parseMappings(aStr, aSourceRoot) {
        var generatedLine = 1;
        var previousGeneratedColumn = 0;
        var previousOriginalLine = 0;
        var previousOriginalColumn = 0;
        var previousSource = 0;
        var previousName = 0;
        var mappingSeparator = /^[,;]/;
        var str = aStr;
        var mapping;
        var temp;
        while (str.length > 0) {
          if (str.charAt(0) === ';') {
            generatedLine++;
            str = str.slice(1);
            previousGeneratedColumn = 0;
          } else if (str.charAt(0) === ',') {
            str = str.slice(1);
          } else {
            mapping = {};
            mapping.generatedLine = generatedLine;
            temp = base64VLQ.decode(str);
            mapping.generatedColumn = previousGeneratedColumn + temp.value;
            previousGeneratedColumn = mapping.generatedColumn;
            str = temp.rest;
            if (str.length > 0 && !mappingSeparator.test(str.charAt(0))) {
              temp = base64VLQ.decode(str);
              mapping.source = this._sources.at(previousSource + temp.value);
              previousSource += temp.value;
              str = temp.rest;
              if (str.length === 0 || mappingSeparator.test(str.charAt(0))) {
                throw new Error('Found a source, but no line and column');
              }
              temp = base64VLQ.decode(str);
              mapping.originalLine = previousOriginalLine + temp.value;
              previousOriginalLine = mapping.originalLine;
              mapping.originalLine += 1;
              str = temp.rest;
              if (str.length === 0 || mappingSeparator.test(str.charAt(0))) {
                throw new Error('Found a source and line, but no column');
              }
              temp = base64VLQ.decode(str);
              mapping.originalColumn = previousOriginalColumn + temp.value;
              previousOriginalColumn = mapping.originalColumn;
              str = temp.rest;
              if (str.length > 0 && !mappingSeparator.test(str.charAt(0))) {
                temp = base64VLQ.decode(str);
                mapping.name = this._names.at(previousName + temp.value);
                previousName += temp.value;
                str = temp.rest;
              }
            }
            this.__generatedMappings.push(mapping);
            if (typeof mapping.originalLine === 'number') {
              this.__originalMappings.push(mapping);
            }
          }
        }
        this.__generatedMappings.sort(util.compareByGeneratedPositions);
        this.__originalMappings.sort(util.compareByOriginalPositions);
      };
      SourceMapConsumer.prototype._findMapping = function SourceMapConsumer_findMapping(aNeedle, aMappings, aLineName, aColumnName, aComparator) {
        if (aNeedle[aLineName] <= 0) {
          throw new TypeError('Line must be greater than or equal to 1, got ' + aNeedle[aLineName]);
        }
        if (aNeedle[aColumnName] < 0) {
          throw new TypeError('Column must be greater than or equal to 0, got ' + aNeedle[aColumnName]);
        }
        return binarySearch.search(aNeedle, aMappings, aComparator);
      };
      SourceMapConsumer.prototype.originalPositionFor = function SourceMapConsumer_originalPositionFor(aArgs) {
        var needle = {
            generatedLine: util.getArg(aArgs, 'line'),
            generatedColumn: util.getArg(aArgs, 'column')
          };
        var mapping = this._findMapping(needle, this._generatedMappings, 'generatedLine', 'generatedColumn', util.compareByGeneratedPositions);
        if (mapping && mapping.generatedLine === needle.generatedLine) {
          var source = util.getArg(mapping, 'source', null);
          if (source && this.sourceRoot) {
            source = util.join(this.sourceRoot, source);
          }
          return {
            source: source,
            line: util.getArg(mapping, 'originalLine', null),
            column: util.getArg(mapping, 'originalColumn', null),
            name: util.getArg(mapping, 'name', null)
          };
        }
        return {
          source: null,
          line: null,
          column: null,
          name: null
        };
      };
      SourceMapConsumer.prototype.sourceContentFor = function SourceMapConsumer_sourceContentFor(aSource) {
        if (!this.sourcesContent) {
          return null;
        }
        if (this.sourceRoot) {
          aSource = util.relative(this.sourceRoot, aSource);
        }
        if (this._sources.has(aSource)) {
          return this.sourcesContent[this._sources.indexOf(aSource)];
        }
        var url;
        if (this.sourceRoot && (url = util.urlParse(this.sourceRoot))) {
          var fileUriAbsPath = aSource.replace(/^file:\/\//, '');
          if (url.scheme == 'file' && this._sources.has(fileUriAbsPath)) {
            return this.sourcesContent[this._sources.indexOf(fileUriAbsPath)];
          }
          if ((!url.path || url.path == '/') && this._sources.has('/' + aSource)) {
            return this.sourcesContent[this._sources.indexOf('/' + aSource)];
          }
        }
        throw new Error('"' + aSource + '" is not in the SourceMap.');
      };
      SourceMapConsumer.prototype.generatedPositionFor = function SourceMapConsumer_generatedPositionFor(aArgs) {
        var needle = {
            source: util.getArg(aArgs, 'source'),
            originalLine: util.getArg(aArgs, 'line'),
            originalColumn: util.getArg(aArgs, 'column')
          };
        if (this.sourceRoot) {
          needle.source = util.relative(this.sourceRoot, needle.source);
        }
        var mapping = this._findMapping(needle, this._originalMappings, 'originalLine', 'originalColumn', util.compareByOriginalPositions);
        if (mapping) {
          return {
            line: util.getArg(mapping, 'generatedLine', null),
            column: util.getArg(mapping, 'generatedColumn', null)
          };
        }
        return {
          line: null,
          column: null
        };
      };
      SourceMapConsumer.GENERATED_ORDER = 1;
      SourceMapConsumer.ORIGINAL_ORDER = 2;
      SourceMapConsumer.prototype.eachMapping = function SourceMapConsumer_eachMapping(aCallback, aContext, aOrder) {
        var context = aContext || null;
        var order = aOrder || SourceMapConsumer.GENERATED_ORDER;
        var mappings;
        switch (order) {
        case SourceMapConsumer.GENERATED_ORDER:
          mappings = this._generatedMappings;
          break;
        case SourceMapConsumer.ORIGINAL_ORDER:
          mappings = this._originalMappings;
          break;
        default:
          throw new Error('Unknown order of iteration.');
        }
        var sourceRoot = this.sourceRoot;
        mappings.map(function (mapping) {
          var source = mapping.source;
          if (source && sourceRoot) {
            source = util.join(sourceRoot, source);
          }
          return {
            source: source,
            generatedLine: mapping.generatedLine,
            generatedColumn: mapping.generatedColumn,
            originalLine: mapping.originalLine,
            originalColumn: mapping.originalColumn,
            name: mapping.name
          };
        }).forEach(aCallback, context);
      };
      exports.SourceMapConsumer = SourceMapConsumer;
    });
  });
  require.define('/node_modules/source-map/lib/source-map/binary-search.js', function (module, exports, __dirname, __filename) {
    if (typeof define !== 'function') {
      var define = require('/node_modules/source-map/node_modules/amdefine/amdefine.js', module)(module, require);
    }
    define(function (require, exports, module) {
      function recursiveSearch(aLow, aHigh, aNeedle, aHaystack, aCompare) {
        var mid = Math.floor((aHigh - aLow) / 2) + aLow;
        var cmp = aCompare(aNeedle, aHaystack[mid], true);
        if (cmp === 0) {
          return aHaystack[mid];
        } else if (cmp > 0) {
          if (aHigh - mid > 1) {
            return recursiveSearch(mid, aHigh, aNeedle, aHaystack, aCompare);
          }
          return aHaystack[mid];
        } else {
          if (mid - aLow > 1) {
            return recursiveSearch(aLow, mid, aNeedle, aHaystack, aCompare);
          }
          return aLow < 0 ? null : aHaystack[aLow];
        }
      }
      exports.search = function search(aNeedle, aHaystack, aCompare) {
        return aHaystack.length > 0 ? recursiveSearch(-1, aHaystack.length, aNeedle, aHaystack, aCompare) : null;
      };
    });
  });
  require.define('/node_modules/esutils/lib/utils.js', function (module, exports, __dirname, __filename) {
    (function () {
      'use strict';
      exports.code = require('/node_modules/esutils/lib/code.js', module);
      exports.keyword = require('/node_modules/esutils/lib/keyword.js', module);
    }());
  });
  require.define('/node_modules/esutils/lib/keyword.js', function (module, exports, __dirname, __filename) {
    (function () {
      'use strict';
      var code = require('/node_modules/esutils/lib/code.js', module);
      function isStrictModeReservedWordES6(id) {
        switch (id) {
        case 'implements':
        case 'interface':
        case 'package':
        case 'private':
        case 'protected':
        case 'public':
        case 'static':
        case 'let':
          return true;
        default:
          return false;
        }
      }
      function isKeywordES5(id, strict) {
        if (!strict && id === 'yield') {
          return false;
        }
        return isKeywordES6(id, strict);
      }
      function isKeywordES6(id, strict) {
        if (strict && isStrictModeReservedWordES6(id)) {
          return true;
        }
        switch (id.length) {
        case 2:
          return id === 'if' || id === 'in' || id === 'do';
        case 3:
          return id === 'var' || id === 'for' || id === 'new' || id === 'try';
        case 4:
          return id === 'this' || id === 'else' || id === 'case' || id === 'void' || id === 'with' || id === 'enum';
        case 5:
          return id === 'while' || id === 'break' || id === 'catch' || id === 'throw' || id === 'const' || id === 'yield' || id === 'class' || id === 'super';
        case 6:
          return id === 'return' || id === 'typeof' || id === 'delete' || id === 'switch' || id === 'export' || id === 'import';
        case 7:
          return id === 'default' || id === 'finally' || id === 'extends';
        case 8:
          return id === 'function' || id === 'continue' || id === 'debugger';
        case 10:
          return id === 'instanceof';
        default:
          return false;
        }
      }
      function isRestrictedWord(id) {
        return id === 'eval' || id === 'arguments';
      }
      function isIdentifierName(id) {
        var i, iz, ch;
        if (id.length === 0) {
          return false;
        }
        ch = id.charCodeAt(0);
        if (!code.isIdentifierStart(ch) || ch === 92) {
          return false;
        }
        for (i = 1, iz = id.length; i < iz; ++i) {
          ch = id.charCodeAt(i);
          if (!code.isIdentifierPart(ch) || ch === 92) {
            return false;
          }
        }
        return true;
      }
      module.exports = {
        isKeywordES5: isKeywordES5,
        isKeywordES6: isKeywordES6,
        isRestrictedWord: isRestrictedWord,
        isIdentifierName: isIdentifierName
      };
    }());
  });
  require.define('/node_modules/esutils/lib/code.js', function (module, exports, __dirname, __filename) {
    (function () {
      'use strict';
      var Regex;
      Regex = {
        NonAsciiIdentifierStart: new RegExp('[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0\u08A2-\u08AC\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097F\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C33\u0C35-\u0C39\u0C3D\u0C58\u0C59\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D60\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F0\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191C\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19C1-\u19C7\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA697\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA793\uA7A0-\uA7AA\uA7F8-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA80-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uABC0-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]'),
        NonAsciiIdentifierPart: new RegExp('[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u0527\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u08A0\u08A2-\u08AC\u08E4-\u08FE\u0900-\u0963\u0966-\u096F\u0971-\u0977\u0979-\u097F\u0981-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C01-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C33\u0C35-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58\u0C59\u0C60-\u0C63\u0C66-\u0C6F\u0C82\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D02\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D57\u0D60-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F0\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191C\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19D9\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1CD0-\u1CD2\u1CD4-\u1CF6\u1D00-\u1DE6\u1DFC-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u200C\u200D\u203F\u2040\u2054\u2071\u207F\u2090-\u209C\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u2E2F\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099\u309A\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA697\uA69F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA793\uA7A0-\uA7AA\uA7F8-\uA827\uA840-\uA873\uA880-\uA8C4\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A\uAA7B\uAA80-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uABC0-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE26\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]')
      };
      function isDecimalDigit(ch) {
        return ch >= 48 && ch <= 57;
      }
      function isHexDigit(ch) {
        return isDecimalDigit(ch) || 97 <= ch && ch <= 102 || 65 <= ch && ch <= 70;
      }
      function isOctalDigit(ch) {
        return ch >= 48 && ch <= 55;
      }
      function isWhiteSpace(ch) {
        return ch === 32 || ch === 9 || ch === 11 || ch === 12 || ch === 160 || ch >= 5760 && [
          5760,
          6158,
          8192,
          8193,
          8194,
          8195,
          8196,
          8197,
          8198,
          8199,
          8200,
          8201,
          8202,
          8239,
          8287,
          12288,
          65279
        ].indexOf(ch) >= 0;
      }
      function isLineTerminator(ch) {
        return ch === 10 || ch === 13 || ch === 8232 || ch === 8233;
      }
      function isIdentifierStart(ch) {
        return ch === 36 || ch === 95 || ch >= 65 && ch <= 90 || ch >= 97 && ch <= 122 || ch === 92 || ch >= 128 && Regex.NonAsciiIdentifierStart.test(String.fromCharCode(ch));
      }
      function isIdentifierPart(ch) {
        return ch === 36 || ch === 95 || ch >= 65 && ch <= 90 || ch >= 97 && ch <= 122 || ch >= 48 && ch <= 57 || ch === 92 || ch >= 128 && Regex.NonAsciiIdentifierPart.test(String.fromCharCode(ch));
      }
      module.exports = {
        isDecimalDigit: isDecimalDigit,
        isHexDigit: isHexDigit,
        isOctalDigit: isOctalDigit,
        isWhiteSpace: isWhiteSpace,
        isLineTerminator: isLineTerminator,
        isIdentifierStart: isIdentifierStart,
        isIdentifierPart: isIdentifierPart
      };
    }());
  });
  require.define('/node_modules/estraverse/estraverse.js', function (module, exports, __dirname, __filename) {
    (function (root, factory) {
      'use strict';
      if (typeof define === 'function' && define.amd) {
        define(['exports'], factory);
      } else if (typeof exports !== 'undefined') {
        factory(exports);
      } else {
        factory(root.estraverse = {});
      }
    }(this, function (exports) {
      'use strict';
      var Syntax, isArray, VisitorOption, VisitorKeys, BREAK, SKIP;
      Syntax = {
        AssignmentExpression: 'AssignmentExpression',
        ArrayExpression: 'ArrayExpression',
        ArrayPattern: 'ArrayPattern',
        ArrowFunctionExpression: 'ArrowFunctionExpression',
        BlockStatement: 'BlockStatement',
        BinaryExpression: 'BinaryExpression',
        BreakStatement: 'BreakStatement',
        CallExpression: 'CallExpression',
        CatchClause: 'CatchClause',
        ClassBody: 'ClassBody',
        ClassDeclaration: 'ClassDeclaration',
        ClassExpression: 'ClassExpression',
        ConditionalExpression: 'ConditionalExpression',
        ContinueStatement: 'ContinueStatement',
        DebuggerStatement: 'DebuggerStatement',
        DirectiveStatement: 'DirectiveStatement',
        DoWhileStatement: 'DoWhileStatement',
        EmptyStatement: 'EmptyStatement',
        ExpressionStatement: 'ExpressionStatement',
        ForStatement: 'ForStatement',
        ForInStatement: 'ForInStatement',
        FunctionDeclaration: 'FunctionDeclaration',
        FunctionExpression: 'FunctionExpression',
        Identifier: 'Identifier',
        IfStatement: 'IfStatement',
        Literal: 'Literal',
        LabeledStatement: 'LabeledStatement',
        LogicalExpression: 'LogicalExpression',
        MemberExpression: 'MemberExpression',
        MethodDefinition: 'MethodDefinition',
        NewExpression: 'NewExpression',
        ObjectExpression: 'ObjectExpression',
        ObjectPattern: 'ObjectPattern',
        Program: 'Program',
        Property: 'Property',
        ReturnStatement: 'ReturnStatement',
        SequenceExpression: 'SequenceExpression',
        SwitchStatement: 'SwitchStatement',
        SwitchCase: 'SwitchCase',
        ThisExpression: 'ThisExpression',
        ThrowStatement: 'ThrowStatement',
        TryStatement: 'TryStatement',
        UnaryExpression: 'UnaryExpression',
        UpdateExpression: 'UpdateExpression',
        VariableDeclaration: 'VariableDeclaration',
        VariableDeclarator: 'VariableDeclarator',
        WhileStatement: 'WhileStatement',
        WithStatement: 'WithStatement',
        YieldExpression: 'YieldExpression'
      };
      function ignoreJSHintError() {
      }
      isArray = Array.isArray;
      if (!isArray) {
        isArray = function isArray(array) {
          return Object.prototype.toString.call(array) === '[object Array]';
        };
      }
      function deepCopy(obj) {
        var ret = {}, key, val;
        for (key in obj) {
          if (obj.hasOwnProperty(key)) {
            val = obj[key];
            if (typeof val === 'object' && val !== null) {
              ret[key] = deepCopy(val);
            } else {
              ret[key] = val;
            }
          }
        }
        return ret;
      }
      function shallowCopy(obj) {
        var ret = {}, key;
        for (key in obj) {
          if (obj.hasOwnProperty(key)) {
            ret[key] = obj[key];
          }
        }
        return ret;
      }
      ignoreJSHintError(shallowCopy);
      function upperBound(array, func) {
        var diff, len, i, current;
        len = array.length;
        i = 0;
        while (len) {
          diff = len >>> 1;
          current = i + diff;
          if (func(array[current])) {
            len = diff;
          } else {
            i = current + 1;
            len -= diff + 1;
          }
        }
        return i;
      }
      function lowerBound(array, func) {
        var diff, len, i, current;
        len = array.length;
        i = 0;
        while (len) {
          diff = len >>> 1;
          current = i + diff;
          if (func(array[current])) {
            i = current + 1;
            len -= diff + 1;
          } else {
            len = diff;
          }
        }
        return i;
      }
      ignoreJSHintError(lowerBound);
      VisitorKeys = {
        AssignmentExpression: [
          'left',
          'right'
        ],
        ArrayExpression: ['elements'],
        ArrayPattern: ['elements'],
        ArrowFunctionExpression: [
          'params',
          'defaults',
          'rest',
          'body'
        ],
        BlockStatement: ['body'],
        BinaryExpression: [
          'left',
          'right'
        ],
        BreakStatement: ['label'],
        CallExpression: [
          'callee',
          'arguments'
        ],
        CatchClause: [
          'param',
          'body'
        ],
        ClassBody: ['body'],
        ClassDeclaration: [
          'id',
          'body',
          'superClass'
        ],
        ClassExpression: [
          'id',
          'body',
          'superClass'
        ],
        ConditionalExpression: [
          'test',
          'consequent',
          'alternate'
        ],
        ContinueStatement: ['label'],
        DebuggerStatement: [],
        DirectiveStatement: [],
        DoWhileStatement: [
          'body',
          'test'
        ],
        EmptyStatement: [],
        ExpressionStatement: ['expression'],
        ForStatement: [
          'init',
          'test',
          'update',
          'body'
        ],
        ForInStatement: [
          'left',
          'right',
          'body'
        ],
        FunctionDeclaration: [
          'id',
          'params',
          'defaults',
          'rest',
          'body'
        ],
        FunctionExpression: [
          'id',
          'params',
          'defaults',
          'rest',
          'body'
        ],
        Identifier: [],
        IfStatement: [
          'test',
          'consequent',
          'alternate'
        ],
        Literal: [],
        LabeledStatement: [
          'label',
          'body'
        ],
        LogicalExpression: [
          'left',
          'right'
        ],
        MemberExpression: [
          'object',
          'property'
        ],
        MethodDefinition: [
          'key',
          'value'
        ],
        NewExpression: [
          'callee',
          'arguments'
        ],
        ObjectExpression: ['properties'],
        ObjectPattern: ['properties'],
        Program: ['body'],
        Property: [
          'key',
          'value'
        ],
        ReturnStatement: ['argument'],
        SequenceExpression: ['expressions'],
        SwitchStatement: [
          'discriminant',
          'cases'
        ],
        SwitchCase: [
          'test',
          'consequent'
        ],
        ThisExpression: [],
        ThrowStatement: ['argument'],
        TryStatement: [
          'block',
          'handlers',
          'handler',
          'guardedHandlers',
          'finalizer'
        ],
        UnaryExpression: ['argument'],
        UpdateExpression: ['argument'],
        VariableDeclaration: ['declarations'],
        VariableDeclarator: [
          'id',
          'init'
        ],
        WhileStatement: [
          'test',
          'body'
        ],
        WithStatement: [
          'object',
          'body'
        ],
        YieldExpression: ['argument']
      };
      BREAK = {};
      SKIP = {};
      VisitorOption = {
        Break: BREAK,
        Skip: SKIP
      };
      function Reference(parent, key) {
        this.parent = parent;
        this.key = key;
      }
      Reference.prototype.replace = function replace(node) {
        this.parent[this.key] = node;
      };
      function Element(node, path, wrap, ref) {
        this.node = node;
        this.path = path;
        this.wrap = wrap;
        this.ref = ref;
      }
      function Controller() {
      }
      Controller.prototype.path = function path() {
        var i, iz, j, jz, result, element;
        function addToPath(result, path) {
          if (isArray(path)) {
            for (j = 0, jz = path.length; j < jz; ++j) {
              result.push(path[j]);
            }
          } else {
            result.push(path);
          }
        }
        if (!this.__current.path) {
          return null;
        }
        result = [];
        for (i = 2, iz = this.__leavelist.length; i < iz; ++i) {
          element = this.__leavelist[i];
          addToPath(result, element.path);
        }
        addToPath(result, this.__current.path);
        return result;
      };
      Controller.prototype.parents = function parents() {
        var i, iz, result;
        result = [];
        for (i = 1, iz = this.__leavelist.length; i < iz; ++i) {
          result.push(this.__leavelist[i].node);
        }
        return result;
      };
      Controller.prototype.current = function current() {
        return this.__current.node;
      };
      Controller.prototype.__execute = function __execute(callback, element) {
        var previous, result;
        result = undefined;
        previous = this.__current;
        this.__current = element;
        this.__state = null;
        if (callback) {
          result = callback.call(this, element.node, this.__leavelist[this.__leavelist.length - 1].node);
        }
        this.__current = previous;
        return result;
      };
      Controller.prototype.notify = function notify(flag) {
        this.__state = flag;
      };
      Controller.prototype.skip = function () {
        this.notify(SKIP);
      };
      Controller.prototype['break'] = function () {
        this.notify(BREAK);
      };
      Controller.prototype.__initialize = function (root, visitor) {
        this.visitor = visitor;
        this.root = root;
        this.__worklist = [];
        this.__leavelist = [];
        this.__current = null;
        this.__state = null;
      };
      Controller.prototype.traverse = function traverse(root, visitor) {
        var worklist, leavelist, element, node, nodeType, ret, key, current, current2, candidates, candidate, sentinel;
        this.__initialize(root, visitor);
        sentinel = {};
        worklist = this.__worklist;
        leavelist = this.__leavelist;
        worklist.push(new Element(root, null, null, null));
        leavelist.push(new Element(null, null, null, null));
        while (worklist.length) {
          element = worklist.pop();
          if (element === sentinel) {
            element = leavelist.pop();
            ret = this.__execute(visitor.leave, element);
            if (this.__state === BREAK || ret === BREAK) {
              return;
            }
            continue;
          }
          if (element.node) {
            ret = this.__execute(visitor.enter, element);
            if (this.__state === BREAK || ret === BREAK) {
              return;
            }
            worklist.push(sentinel);
            leavelist.push(element);
            if (this.__state === SKIP || ret === SKIP) {
              continue;
            }
            node = element.node;
            nodeType = element.wrap || node.type;
            candidates = VisitorKeys[nodeType];
            current = candidates.length;
            while ((current -= 1) >= 0) {
              key = candidates[current];
              candidate = node[key];
              if (!candidate) {
                continue;
              }
              if (!isArray(candidate)) {
                worklist.push(new Element(candidate, key, null, null));
                continue;
              }
              current2 = candidate.length;
              while ((current2 -= 1) >= 0) {
                if (!candidate[current2]) {
                  continue;
                }
                if ((nodeType === Syntax.ObjectExpression || nodeType === Syntax.ObjectPattern) && 'properties' === candidates[current]) {
                  element = new Element(candidate[current2], [
                    key,
                    current2
                  ], 'Property', null);
                } else {
                  element = new Element(candidate[current2], [
                    key,
                    current2
                  ], null, null);
                }
                worklist.push(element);
              }
            }
          }
        }
      };
      Controller.prototype.replace = function replace(root, visitor) {
        var worklist, leavelist, node, nodeType, target, element, current, current2, candidates, candidate, sentinel, outer, key;
        this.__initialize(root, visitor);
        sentinel = {};
        worklist = this.__worklist;
        leavelist = this.__leavelist;
        outer = { root: root };
        element = new Element(root, null, null, new Reference(outer, 'root'));
        worklist.push(element);
        leavelist.push(element);
        while (worklist.length) {
          element = worklist.pop();
          if (element === sentinel) {
            element = leavelist.pop();
            target = this.__execute(visitor.leave, element);
            if (target !== undefined && target !== BREAK && target !== SKIP) {
              element.ref.replace(target);
            }
            if (this.__state === BREAK || target === BREAK) {
              return outer.root;
            }
            continue;
          }
          target = this.__execute(visitor.enter, element);
          if (target !== undefined && target !== BREAK && target !== SKIP) {
            element.ref.replace(target);
            element.node = target;
          }
          if (this.__state === BREAK || target === BREAK) {
            return outer.root;
          }
          node = element.node;
          if (!node) {
            continue;
          }
          worklist.push(sentinel);
          leavelist.push(element);
          if (this.__state === SKIP || target === SKIP) {
            continue;
          }
          nodeType = element.wrap || node.type;
          candidates = VisitorKeys[nodeType];
          current = candidates.length;
          while ((current -= 1) >= 0) {
            key = candidates[current];
            candidate = node[key];
            if (!candidate) {
              continue;
            }
            if (!isArray(candidate)) {
              worklist.push(new Element(candidate, key, null, new Reference(node, key)));
              continue;
            }
            current2 = candidate.length;
            while ((current2 -= 1) >= 0) {
              if (!candidate[current2]) {
                continue;
              }
              if (nodeType === Syntax.ObjectExpression && 'properties' === candidates[current]) {
                element = new Element(candidate[current2], [
                  key,
                  current2
                ], 'Property', new Reference(candidate, current2));
              } else {
                element = new Element(candidate[current2], [
                  key,
                  current2
                ], null, new Reference(candidate, current2));
              }
              worklist.push(element);
            }
          }
        }
        return outer.root;
      };
      function traverse(root, visitor) {
        var controller = new Controller;
        return controller.traverse(root, visitor);
      }
      function replace(root, visitor) {
        var controller = new Controller;
        return controller.replace(root, visitor);
      }
      function extendCommentRange(comment, tokens) {
        var target;
        target = upperBound(tokens, function search(token) {
          return token.range[0] > comment.range[0];
        });
        comment.extendedRange = [
          comment.range[0],
          comment.range[1]
        ];
        if (target !== tokens.length) {
          comment.extendedRange[1] = tokens[target].range[0];
        }
        target -= 1;
        if (target >= 0) {
          comment.extendedRange[0] = tokens[target].range[1];
        }
        return comment;
      }
      function attachComments(tree, providedComments, tokens) {
        var comments = [], comment, len, i, cursor;
        if (!tree.range) {
          throw new Error('attachComments needs range information');
        }
        if (!tokens.length) {
          if (providedComments.length) {
            for (i = 0, len = providedComments.length; i < len; i += 1) {
              comment = deepCopy(providedComments[i]);
              comment.extendedRange = [
                0,
                tree.range[0]
              ];
              comments.push(comment);
            }
            tree.leadingComments = comments;
          }
          return tree;
        }
        for (i = 0, len = providedComments.length; i < len; i += 1) {
          comments.push(extendCommentRange(deepCopy(providedComments[i]), tokens));
        }
        cursor = 0;
        traverse(tree, {
          enter: function (node) {
            var comment;
            while (cursor < comments.length) {
              comment = comments[cursor];
              if (comment.extendedRange[1] > node.range[0]) {
                break;
              }
              if (comment.extendedRange[1] === node.range[0]) {
                if (!node.leadingComments) {
                  node.leadingComments = [];
                }
                node.leadingComments.push(comment);
                comments.splice(cursor, 1);
              } else {
                cursor += 1;
              }
            }
            if (cursor === comments.length) {
              return VisitorOption.Break;
            }
            if (comments[cursor].extendedRange[0] > node.range[1]) {
              return VisitorOption.Skip;
            }
          }
        });
        cursor = 0;
        traverse(tree, {
          leave: function (node) {
            var comment;
            while (cursor < comments.length) {
              comment = comments[cursor];
              if (node.range[1] < comment.extendedRange[0]) {
                break;
              }
              if (node.range[1] === comment.extendedRange[0]) {
                if (!node.trailingComments) {
                  node.trailingComments = [];
                }
                node.trailingComments.push(comment);
                comments.splice(cursor, 1);
              } else {
                cursor += 1;
              }
            }
            if (cursor === comments.length) {
              return VisitorOption.Break;
            }
            if (comments[cursor].extendedRange[0] > node.range[1]) {
              return VisitorOption.Skip;
            }
          }
        });
        return tree;
      }
      exports.version = '1.3.3-dev';
      exports.Syntax = Syntax;
      exports.traverse = traverse;
      exports.replace = replace;
      exports.attachComments = attachComments;
      exports.VisitorKeys = VisitorKeys;
      exports.VisitorOption = VisitorOption;
      exports.Controller = Controller;
    }));
  });
  require('/tools/entry-point.js');
}.call(this, this));

/*
 html2canvas 0.4.1 <http://html2canvas.hertzen.com>
 Copyright (c) 2013 Niklas von Hertzen

 Released under MIT License
 */

(function(window, document, undefined){

    "use strict";

    var _html2canvas = {},
        previousElement,
        computedCSS,
        html2canvas;

    _html2canvas.Util = {};

    _html2canvas.Util.log = function(a) {
        if (_html2canvas.logging && window.console && window.console.log) {
            window.console.log(a);
        }
    };

    _html2canvas.Util.trimText = (function(isNative){
        return function(input) {
            return isNative ? isNative.apply(input) : ((input || '') + '').replace( /^\s+|\s+$/g , '' );
        };
    })(String.prototype.trim);

    _html2canvas.Util.asFloat = function(v) {
        return parseFloat(v);
    };

    (function() {
        // TODO: support all possible length values
        var TEXT_SHADOW_PROPERTY = /((rgba|rgb)\([^\)]+\)(\s-?\d+px){0,})/g;
        var TEXT_SHADOW_VALUES = /(-?\d+px)|(#.+)|(rgb\(.+\))|(rgba\(.+\))/g;
        _html2canvas.Util.parseTextShadows = function (value) {
            if (!value || value === 'none') {
                return [];
            }

            // find multiple shadow declarations
            var shadows = value.match(TEXT_SHADOW_PROPERTY),
                results = [];
            for (var i = 0; shadows && (i < shadows.length); i++) {
                var s = shadows[i].match(TEXT_SHADOW_VALUES);
                results.push({
                    color: s[0],
                    offsetX: s[1] ? s[1].replace('px', '') : 0,
                    offsetY: s[2] ? s[2].replace('px', '') : 0,
                    blur: s[3] ? s[3].replace('px', '') : 0
                });
            }
            return results;
        };
    })();


    _html2canvas.Util.parseBackgroundImage = function (value) {
        var whitespace = ' \r\n\t',
            method, definition, prefix, prefix_i, block, results = [],
            c, mode = 0, numParen = 0, quote, args;

        var appendResult = function(){
            if(method) {
                if(definition.substr( 0, 1 ) === '"') {
                    definition = definition.substr( 1, definition.length - 2 );
                }
                if(definition) {
                    args.push(definition);
                }
                if(method.substr( 0, 1 ) === '-' &&
                    (prefix_i = method.indexOf( '-', 1 ) + 1) > 0) {
                    prefix = method.substr( 0, prefix_i);
                    method = method.substr( prefix_i );
                }
                results.push({
                    prefix: prefix,
                    method: method.toLowerCase(),
                    value: block,
                    args: args
                });
            }
            args = []; //for some odd reason, setting .length = 0 didn't work in safari
            method =
                prefix =
                    definition =
                        block = '';
        };

        appendResult();
        for(var i = 0, ii = value.length; i<ii; i++) {
            c = value[i];
            if(mode === 0 && whitespace.indexOf( c ) > -1){
                continue;
            }
            switch(c) {
                case '"':
                    if(!quote) {
                        quote = c;
                    }
                    else if(quote === c) {
                        quote = null;
                    }
                    break;

                case '(':
                    if(quote) { break; }
                    else if(mode === 0) {
                        mode = 1;
                        block += c;
                        continue;
                    } else {
                        numParen++;
                    }
                    break;

                case ')':
                    if(quote) { break; }
                    else if(mode === 1) {
                        if(numParen === 0) {
                            mode = 0;
                            block += c;
                            appendResult();
                            continue;
                        } else {
                            numParen--;
                        }
                    }
                    break;

                case ',':
                    if(quote) { break; }
                    else if(mode === 0) {
                        appendResult();
                        continue;
                    }
                    else if (mode === 1) {
                        if(numParen === 0 && !method.match(/^url$/i)) {
                            args.push(definition);
                            definition = '';
                            block += c;
                            continue;
                        }
                    }
                    break;
            }

            block += c;
            if(mode === 0) { method += c; }
            else { definition += c; }
        }
        appendResult();

        return results;
    };

    _html2canvas.Util.Bounds = function (element) {
        var clientRect, bounds = {};

        if (element.getBoundingClientRect){
            clientRect = element.getBoundingClientRect();

            // TODO add scroll position to bounds, so no scrolling of window necessary
            bounds.top = clientRect.top;
            bounds.bottom = clientRect.bottom || (clientRect.top + clientRect.height);
            bounds.left = clientRect.left;

            bounds.width = element.offsetWidth;
            bounds.height = element.offsetHeight;
        }

        return bounds;
    };

// TODO ideally, we'd want everything to go through this function instead of Util.Bounds,
// but would require further work to calculate the correct positions for elements with offsetParents
    _html2canvas.Util.OffsetBounds = function (element) {
        var parent = element.offsetParent ? _html2canvas.Util.OffsetBounds(element.offsetParent) : {top: 0, left: 0};

        return {
            top: element.offsetTop + parent.top,
            bottom: element.offsetTop + element.offsetHeight + parent.top,
            left: element.offsetLeft + parent.left,
            width: element.offsetWidth,
            height: element.offsetHeight
        };
    };

    function toPX(element, attribute, value ) {
        var rsLeft = element.runtimeStyle && element.runtimeStyle[attribute],
            left,
            style = element.style;

        // Check if we are not dealing with pixels, (Opera has issues with this)
        // Ported from jQuery css.js
        // From the awesome hack by Dean Edwards
        // http://erik.eae.net/archives/2007/07/27/18.54.15/#comment-102291

        // If we're not dealing with a regular pixel number
        // but a number that has a weird ending, we need to convert it to pixels

        if ( !/^-?[0-9]+\.?[0-9]*(?:px)?$/i.test( value ) && /^-?\d/.test(value) ) {
            // Remember the original values
            left = style.left;

            // Put in the new values to get a computed value out
            if (rsLeft) {
                element.runtimeStyle.left = element.currentStyle.left;
            }
            style.left = attribute === "fontSize" ? "1em" : (value || 0);
            value = style.pixelLeft + "px";

            // Revert the changed values
            style.left = left;
            if (rsLeft) {
                element.runtimeStyle.left = rsLeft;
            }
        }

        if (!/^(thin|medium|thick)$/i.test(value)) {
            return Math.round(parseFloat(value)) + "px";
        }

        return value;
    }

    function asInt(val) {
        return parseInt(val, 10);
    }

    function parseBackgroundSizePosition(value, element, attribute, index) {
        value = (value || '').split(',');
        value = value[index || 0] || value[0] || 'auto';
        value = _html2canvas.Util.trimText(value).split(' ');

        if(attribute === 'backgroundSize' && (!value[0] || value[0].match(/cover|contain|auto/))) {
            //these values will be handled in the parent function
        } else {
            value[0] = (value[0].indexOf( "%" ) === -1) ? toPX(element, attribute + "X", value[0]) : value[0];
            if(value[1] === undefined) {
                if(attribute === 'backgroundSize') {
                    value[1] = 'auto';
                    return value;
                } else {
                    // IE 9 doesn't return double digit always
                    value[1] = value[0];
                }
            }
            value[1] = (value[1].indexOf("%") === -1) ? toPX(element, attribute + "Y", value[1]) : value[1];
        }
        return value;
    }

    _html2canvas.Util.getCSS = function (element, attribute, index) {
        if (previousElement !== element) {
            computedCSS = document.defaultView.getComputedStyle(element, null);
        }

        var value = computedCSS[attribute];

        if (/^background(Size|Position)$/.test(attribute)) {
            return parseBackgroundSizePosition(value, element, attribute, index);
        } else if (/border(Top|Bottom)(Left|Right)Radius/.test(attribute)) {
            var arr = value.split(" ");
            if (arr.length <= 1) {
                arr[1] = arr[0];
            }
            return arr.map(asInt);
        }

        return value;
    };

    _html2canvas.Util.resizeBounds = function( current_width, current_height, target_width, target_height, stretch_mode ){
        var target_ratio = target_width / target_height,
            current_ratio = current_width / current_height,
            output_width, output_height;

        if(!stretch_mode || stretch_mode === 'auto') {
            output_width = target_width;
            output_height = target_height;
        } else if(target_ratio < current_ratio ^ stretch_mode === 'contain') {
            output_height = target_height;
            output_width = target_height * current_ratio;
        } else {
            output_width = target_width;
            output_height = target_width / current_ratio;
        }

        return {
            width: output_width,
            height: output_height
        };
    };

    function backgroundBoundsFactory( prop, el, bounds, image, imageIndex, backgroundSize ) {
        var bgposition =  _html2canvas.Util.getCSS( el, prop, imageIndex ) ,
            topPos,
            left,
            percentage,
            val;

        if (bgposition.length === 1){
            val = bgposition[0];

            bgposition = [];

            bgposition[0] = val;
            bgposition[1] = val;
        }

        if (bgposition[0].toString().indexOf("%") !== -1){
            percentage = (parseFloat(bgposition[0])/100);
            left = bounds.width * percentage;
            if(prop !== 'backgroundSize') {
                left -= (backgroundSize || image).width*percentage;
            }
        } else {
            if(prop === 'backgroundSize') {
                if(bgposition[0] === 'auto') {
                    left = image.width;
                } else {
                    if (/contain|cover/.test(bgposition[0])) {
                        var resized = _html2canvas.Util.resizeBounds(image.width, image.height, bounds.width, bounds.height, bgposition[0]);
                        left = resized.width;
                        topPos = resized.height;
                    } else {
                        left = parseInt(bgposition[0], 10);
                    }
                }
            } else {
                left = parseInt( bgposition[0], 10);
            }
        }


        if(bgposition[1] === 'auto') {
            topPos = left / image.width * image.height;
        } else if (bgposition[1].toString().indexOf("%") !== -1){
            percentage = (parseFloat(bgposition[1])/100);
            topPos =  bounds.height * percentage;
            if(prop !== 'backgroundSize') {
                topPos -= (backgroundSize || image).height * percentage;
            }

        } else {
            topPos = parseInt(bgposition[1],10);
        }

        return [left, topPos];
    }

    _html2canvas.Util.BackgroundPosition = function( el, bounds, image, imageIndex, backgroundSize ) {
        var result = backgroundBoundsFactory( 'backgroundPosition', el, bounds, image, imageIndex, backgroundSize );
        return { left: result[0], top: result[1] };
    };

    _html2canvas.Util.BackgroundSize = function( el, bounds, image, imageIndex ) {
        var result = backgroundBoundsFactory( 'backgroundSize', el, bounds, image, imageIndex );
        return { width: result[0], height: result[1] };
    };

    _html2canvas.Util.Extend = function (options, defaults) {
        for (var key in options) {
            if (options.hasOwnProperty(key)) {
                defaults[key] = options[key];
            }
        }
        return defaults;
    };


    /*
     * Derived from jQuery.contents()
     * Copyright 2010, John Resig
     * Dual licensed under the MIT or GPL Version 2 licenses.
     * http://jquery.org/license
     */
    _html2canvas.Util.Children = function( elem ) {
        var children;
        try {
            children = (elem.nodeName && elem.nodeName.toUpperCase() === "IFRAME") ? elem.contentDocument || elem.contentWindow.document : (function(array) {
                var ret = [];
                if (array !== null) {
                    (function(first, second ) {
                        var i = first.length,
                            j = 0;

                        if (typeof second.length === "number") {
                            for (var l = second.length; j < l; j++) {
                                first[i++] = second[j];
                            }
                        } else {
                            while (second[j] !== undefined) {
                                first[i++] = second[j++];
                            }
                        }

                        first.length = i;

                        return first;
                    })(ret, array);
                }
                return ret;
            })(elem.childNodes);

        } catch (ex) {
            _html2canvas.Util.log("html2canvas.Util.Children failed with exception: " + ex.message);
            children = [];
        }
        return children;
    };

    _html2canvas.Util.isTransparent = function(backgroundColor) {
        return (backgroundColor === "transparent" || backgroundColor === "rgba(0, 0, 0, 0)");
    };
    _html2canvas.Util.Font = (function () {

        var fontData = {};

        return function(font, fontSize, doc) {
            if (fontData[font + "-" + fontSize] !== undefined) {
                return fontData[font + "-" + fontSize];
            }

            var container = doc.createElement('div'),
                img = doc.createElement('img'),
                span = doc.createElement('span'),
                sampleText = 'Hidden Text',
                baseline,
                middle,
                metricsObj;

            container.style.visibility = "hidden";
            container.style.fontFamily = font;
            container.style.fontSize = fontSize;
            container.style.margin = 0;
            container.style.padding = 0;

            doc.body.appendChild(container);

            // http://probablyprogramming.com/2009/03/15/the-tiniest-gif-ever (handtinywhite.gif)
            img.src = "data:image/gif;base64,R0lGODlhAQABAIABAP///wAAACwAAAAAAQABAAACAkQBADs=";
            img.width = 1;
            img.height = 1;

            img.style.margin = 0;
            img.style.padding = 0;
            img.style.verticalAlign = "baseline";

            span.style.fontFamily = font;
            span.style.fontSize = fontSize;
            span.style.margin = 0;
            span.style.padding = 0;

            span.appendChild(doc.createTextNode(sampleText));
            container.appendChild(span);
            container.appendChild(img);
            baseline = (img.offsetTop - span.offsetTop) + 1;

            container.removeChild(span);
            container.appendChild(doc.createTextNode(sampleText));

            container.style.lineHeight = "normal";
            img.style.verticalAlign = "super";

            middle = (img.offsetTop-container.offsetTop) + 1;
            metricsObj = {
                baseline: baseline,
                lineWidth: 1,
                middle: middle
            };

            fontData[font + "-" + fontSize] = metricsObj;

            doc.body.removeChild(container);

            return metricsObj;
        };
    })();

    (function(){
        var Util = _html2canvas.Util,
            Generate = {};

        _html2canvas.Generate = Generate;

        var reGradients = [
            /^(-webkit-linear-gradient)\(([a-z\s]+)([\w\d\.\s,%\(\)]+)\)$/,
            /^(-o-linear-gradient)\(([a-z\s]+)([\w\d\.\s,%\(\)]+)\)$/,
            /^(-webkit-gradient)\((linear|radial),\s((?:\d{1,3}%?)\s(?:\d{1,3}%?),\s(?:\d{1,3}%?)\s(?:\d{1,3}%?))([\w\d\.\s,%\(\)\-]+)\)$/,
            /^(-moz-linear-gradient)\(((?:\d{1,3}%?)\s(?:\d{1,3}%?))([\w\d\.\s,%\(\)]+)\)$/,
            /^(-webkit-radial-gradient)\(((?:\d{1,3}%?)\s(?:\d{1,3}%?)),\s(\w+)\s([a-z\-]+)([\w\d\.\s,%\(\)]+)\)$/,
            /^(-moz-radial-gradient)\(((?:\d{1,3}%?)\s(?:\d{1,3}%?)),\s(\w+)\s?([a-z\-]*)([\w\d\.\s,%\(\)]+)\)$/,
            /^(-o-radial-gradient)\(((?:\d{1,3}%?)\s(?:\d{1,3}%?)),\s(\w+)\s([a-z\-]+)([\w\d\.\s,%\(\)]+)\)$/
        ];

        /*
         * TODO: Add IE10 vendor prefix (-ms) support
         * TODO: Add W3C gradient (linear-gradient) support
         * TODO: Add old Webkit -webkit-gradient(radial, ...) support
         * TODO: Maybe some RegExp optimizations are possible ;o)
         */
        Generate.parseGradient = function(css, bounds) {
            var gradient, i, len = reGradients.length, m1, stop, m2, m2Len, step, m3, tl,tr,br,bl;

            for(i = 0; i < len; i+=1){
                m1 = css.match(reGradients[i]);
                if(m1) {
                    break;
                }
            }

            if(m1) {
                switch(m1[1]) {
                    case '-webkit-linear-gradient':
                    case '-o-linear-gradient':

                        gradient = {
                            type: 'linear',
                            x0: null,
                            y0: null,
                            x1: null,
                            y1: null,
                            colorStops: []
                        };

                        // get coordinates
                        m2 = m1[2].match(/\w+/g);
                        if(m2){
                            m2Len = m2.length;
                            for(i = 0; i < m2Len; i+=1){
                                switch(m2[i]) {
                                    case 'top':
                                        gradient.y0 = 0;
                                        gradient.y1 = bounds.height;
                                        break;

                                    case 'right':
                                        gradient.x0 = bounds.width;
                                        gradient.x1 = 0;
                                        break;

                                    case 'bottom':
                                        gradient.y0 = bounds.height;
                                        gradient.y1 = 0;
                                        break;

                                    case 'left':
                                        gradient.x0 = 0;
                                        gradient.x1 = bounds.width;
                                        break;
                                }
                            }
                        }
                        if(gradient.x0 === null && gradient.x1 === null){ // center
                            gradient.x0 = gradient.x1 = bounds.width / 2;
                        }
                        if(gradient.y0 === null && gradient.y1 === null){ // center
                            gradient.y0 = gradient.y1 = bounds.height / 2;
                        }

                        // get colors and stops
                        m2 = m1[3].match(/((?:rgb|rgba)\(\d{1,3},\s\d{1,3},\s\d{1,3}(?:,\s[0-9\.]+)?\)(?:\s\d{1,3}(?:%|px))?)+/g);
                        if(m2){
                            m2Len = m2.length;
                            step = 1 / Math.max(m2Len - 1, 1);
                            for(i = 0; i < m2Len; i+=1){
                                m3 = m2[i].match(/((?:rgb|rgba)\(\d{1,3},\s\d{1,3},\s\d{1,3}(?:,\s[0-9\.]+)?\))\s*(\d{1,3})?(%|px)?/);
                                if(m3[2]){
                                    stop = parseFloat(m3[2]);
                                    if(m3[3] === '%'){
                                        stop /= 100;
                                    } else { // px - stupid opera
                                        stop /= bounds.width;
                                    }
                                } else {
                                    stop = i * step;
                                }
                                gradient.colorStops.push({
                                    color: m3[1],
                                    stop: stop
                                });
                            }
                        }
                        break;

                    case '-webkit-gradient':

                        gradient = {
                            type: m1[2] === 'radial' ? 'circle' : m1[2], // TODO: Add radial gradient support for older mozilla definitions
                            x0: 0,
                            y0: 0,
                            x1: 0,
                            y1: 0,
                            colorStops: []
                        };

                        // get coordinates
                        m2 = m1[3].match(/(\d{1,3})%?\s(\d{1,3})%?,\s(\d{1,3})%?\s(\d{1,3})%?/);
                        if(m2){
                            gradient.x0 = (m2[1] * bounds.width) / 100;
                            gradient.y0 = (m2[2] * bounds.height) / 100;
                            gradient.x1 = (m2[3] * bounds.width) / 100;
                            gradient.y1 = (m2[4] * bounds.height) / 100;
                        }

                        // get colors and stops
                        m2 = m1[4].match(/((?:from|to|color-stop)\((?:[0-9\.]+,\s)?(?:rgb|rgba)\(\d{1,3},\s\d{1,3},\s\d{1,3}(?:,\s[0-9\.]+)?\)\))+/g);
                        if(m2){
                            m2Len = m2.length;
                            for(i = 0; i < m2Len; i+=1){
                                m3 = m2[i].match(/(from|to|color-stop)\(([0-9\.]+)?(?:,\s)?((?:rgb|rgba)\(\d{1,3},\s\d{1,3},\s\d{1,3}(?:,\s[0-9\.]+)?\))\)/);
                                stop = parseFloat(m3[2]);
                                if(m3[1] === 'from') {
                                    stop = 0.0;
                                }
                                if(m3[1] === 'to') {
                                    stop = 1.0;
                                }
                                gradient.colorStops.push({
                                    color: m3[3],
                                    stop: stop
                                });
                            }
                        }
                        break;

                    case '-moz-linear-gradient':

                        gradient = {
                            type: 'linear',
                            x0: 0,
                            y0: 0,
                            x1: 0,
                            y1: 0,
                            colorStops: []
                        };

                        // get coordinates
                        m2 = m1[2].match(/(\d{1,3})%?\s(\d{1,3})%?/);

                        // m2[1] == 0%   -> left
                        // m2[1] == 50%  -> center
                        // m2[1] == 100% -> right

                        // m2[2] == 0%   -> top
                        // m2[2] == 50%  -> center
                        // m2[2] == 100% -> bottom

                        if(m2){
                            gradient.x0 = (m2[1] * bounds.width) / 100;
                            gradient.y0 = (m2[2] * bounds.height) / 100;
                            gradient.x1 = bounds.width - gradient.x0;
                            gradient.y1 = bounds.height - gradient.y0;
                        }

                        // get colors and stops
                        m2 = m1[3].match(/((?:rgb|rgba)\(\d{1,3},\s\d{1,3},\s\d{1,3}(?:,\s[0-9\.]+)?\)(?:\s\d{1,3}%)?)+/g);
                        if(m2){
                            m2Len = m2.length;
                            step = 1 / Math.max(m2Len - 1, 1);
                            for(i = 0; i < m2Len; i+=1){
                                m3 = m2[i].match(/((?:rgb|rgba)\(\d{1,3},\s\d{1,3},\s\d{1,3}(?:,\s[0-9\.]+)?\))\s*(\d{1,3})?(%)?/);
                                if(m3[2]){
                                    stop = parseFloat(m3[2]);
                                    if(m3[3]){ // percentage
                                        stop /= 100;
                                    }
                                } else {
                                    stop = i * step;
                                }
                                gradient.colorStops.push({
                                    color: m3[1],
                                    stop: stop
                                });
                            }
                        }
                        break;

                    case '-webkit-radial-gradient':
                    case '-moz-radial-gradient':
                    case '-o-radial-gradient':

                        gradient = {
                            type: 'circle',
                            x0: 0,
                            y0: 0,
                            x1: bounds.width,
                            y1: bounds.height,
                            cx: 0,
                            cy: 0,
                            rx: 0,
                            ry: 0,
                            colorStops: []
                        };

                        // center
                        m2 = m1[2].match(/(\d{1,3})%?\s(\d{1,3})%?/);
                        if(m2){
                            gradient.cx = (m2[1] * bounds.width) / 100;
                            gradient.cy = (m2[2] * bounds.height) / 100;
                        }

                        // size
                        m2 = m1[3].match(/\w+/);
                        m3 = m1[4].match(/[a-z\-]*/);
                        if(m2 && m3){
                            switch(m3[0]){
                                case 'farthest-corner':
                                case 'cover': // is equivalent to farthest-corner
                                case '': // mozilla removes "cover" from definition :(
                                    tl = Math.sqrt(Math.pow(gradient.cx, 2) + Math.pow(gradient.cy, 2));
                                    tr = Math.sqrt(Math.pow(gradient.cx, 2) + Math.pow(gradient.y1 - gradient.cy, 2));
                                    br = Math.sqrt(Math.pow(gradient.x1 - gradient.cx, 2) + Math.pow(gradient.y1 - gradient.cy, 2));
                                    bl = Math.sqrt(Math.pow(gradient.x1 - gradient.cx, 2) + Math.pow(gradient.cy, 2));
                                    gradient.rx = gradient.ry = Math.max(tl, tr, br, bl);
                                    break;
                                case 'closest-corner':
                                    tl = Math.sqrt(Math.pow(gradient.cx, 2) + Math.pow(gradient.cy, 2));
                                    tr = Math.sqrt(Math.pow(gradient.cx, 2) + Math.pow(gradient.y1 - gradient.cy, 2));
                                    br = Math.sqrt(Math.pow(gradient.x1 - gradient.cx, 2) + Math.pow(gradient.y1 - gradient.cy, 2));
                                    bl = Math.sqrt(Math.pow(gradient.x1 - gradient.cx, 2) + Math.pow(gradient.cy, 2));
                                    gradient.rx = gradient.ry = Math.min(tl, tr, br, bl);
                                    break;
                                case 'farthest-side':
                                    if(m2[0] === 'circle'){
                                        gradient.rx = gradient.ry = Math.max(
                                            gradient.cx,
                                            gradient.cy,
                                            gradient.x1 - gradient.cx,
                                            gradient.y1 - gradient.cy
                                        );
                                    } else { // ellipse

                                        gradient.type = m2[0];

                                        gradient.rx = Math.max(
                                            gradient.cx,
                                            gradient.x1 - gradient.cx
                                        );
                                        gradient.ry = Math.max(
                                            gradient.cy,
                                            gradient.y1 - gradient.cy
                                        );
                                    }
                                    break;
                                case 'closest-side':
                                case 'contain': // is equivalent to closest-side
                                    if(m2[0] === 'circle'){
                                        gradient.rx = gradient.ry = Math.min(
                                            gradient.cx,
                                            gradient.cy,
                                            gradient.x1 - gradient.cx,
                                            gradient.y1 - gradient.cy
                                        );
                                    } else { // ellipse

                                        gradient.type = m2[0];

                                        gradient.rx = Math.min(
                                            gradient.cx,
                                            gradient.x1 - gradient.cx
                                        );
                                        gradient.ry = Math.min(
                                            gradient.cy,
                                            gradient.y1 - gradient.cy
                                        );
                                    }
                                    break;

                                // TODO: add support for "30px 40px" sizes (webkit only)
                            }
                        }

                        // color stops
                        m2 = m1[5].match(/((?:rgb|rgba)\(\d{1,3},\s\d{1,3},\s\d{1,3}(?:,\s[0-9\.]+)?\)(?:\s\d{1,3}(?:%|px))?)+/g);
                        if(m2){
                            m2Len = m2.length;
                            step = 1 / Math.max(m2Len - 1, 1);
                            for(i = 0; i < m2Len; i+=1){
                                m3 = m2[i].match(/((?:rgb|rgba)\(\d{1,3},\s\d{1,3},\s\d{1,3}(?:,\s[0-9\.]+)?\))\s*(\d{1,3})?(%|px)?/);
                                if(m3[2]){
                                    stop = parseFloat(m3[2]);
                                    if(m3[3] === '%'){
                                        stop /= 100;
                                    } else { // px - stupid opera
                                        stop /= bounds.width;
                                    }
                                } else {
                                    stop = i * step;
                                }
                                gradient.colorStops.push({
                                    color: m3[1],
                                    stop: stop
                                });
                            }
                        }
                        break;
                }
            }

            return gradient;
        };

        function addScrollStops(grad) {
            return function(colorStop) {
                try {
                    grad.addColorStop(colorStop.stop, colorStop.color);
                }
                catch(e) {
                    Util.log(['failed to add color stop: ', e, '; tried to add: ', colorStop]);
                }
            };
        }

        Generate.Gradient = function(src, bounds) {
            if(bounds.width === 0 || bounds.height === 0) {
                return;
            }

            var canvas = document.createElement('canvas'),
                ctx = canvas.getContext('2d'),
                gradient, grad;

            canvas.width = bounds.width;
            canvas.height = bounds.height;

            // TODO: add support for multi defined background gradients
            gradient = _html2canvas.Generate.parseGradient(src, bounds);

            if(gradient) {
                switch(gradient.type) {
                    case 'linear':
                        grad = ctx.createLinearGradient(gradient.x0, gradient.y0, gradient.x1, gradient.y1);
                        gradient.colorStops.forEach(addScrollStops(grad));
                        ctx.fillStyle = grad;
                        ctx.fillRect(0, 0, bounds.width, bounds.height);
                        break;

                    case 'circle':
                        grad = ctx.createRadialGradient(gradient.cx, gradient.cy, 0, gradient.cx, gradient.cy, gradient.rx);
                        gradient.colorStops.forEach(addScrollStops(grad));
                        ctx.fillStyle = grad;
                        ctx.fillRect(0, 0, bounds.width, bounds.height);
                        break;

                    case 'ellipse':
                        var canvasRadial = document.createElement('canvas'),
                            ctxRadial = canvasRadial.getContext('2d'),
                            ri = Math.max(gradient.rx, gradient.ry),
                            di = ri * 2;

                        canvasRadial.width = canvasRadial.height = di;

                        grad = ctxRadial.createRadialGradient(gradient.rx, gradient.ry, 0, gradient.rx, gradient.ry, ri);
                        gradient.colorStops.forEach(addScrollStops(grad));

                        ctxRadial.fillStyle = grad;
                        ctxRadial.fillRect(0, 0, di, di);

                        ctx.fillStyle = gradient.colorStops[gradient.colorStops.length - 1].color;
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(canvasRadial, gradient.cx - gradient.rx, gradient.cy - gradient.ry, 2 * gradient.rx, 2 * gradient.ry);
                        break;
                }
            }

            return canvas;
        };

        Generate.ListAlpha = function(number) {
            var tmp = "",
                modulus;

            do {
                modulus = number % 26;
                tmp = String.fromCharCode((modulus) + 64) + tmp;
                number = number / 26;
            }while((number*26) > 26);

            return tmp;
        };

        Generate.ListRoman = function(number) {
            var romanArray = ["M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"],
                decimal = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1],
                roman = "",
                v,
                len = romanArray.length;

            if (number <= 0 || number >= 4000) {
                return number;
            }

            for (v=0; v < len; v+=1) {
                while (number >= decimal[v]) {
                    number -= decimal[v];
                    roman += romanArray[v];
                }
            }

            return roman;
        };
    })();
    function h2cRenderContext(width, height) {
        var storage = [];
        return {
            storage: storage,
            width: width,
            height: height,
            clip: function() {
                storage.push({
                    type: "function",
                    name: "clip",
                    'arguments': arguments
                });
            },
            translate: function() {
                storage.push({
                    type: "function",
                    name: "translate",
                    'arguments': arguments
                });
            },
            fill: function() {
                storage.push({
                    type: "function",
                    name: "fill",
                    'arguments': arguments
                });
            },
            save: function() {
                storage.push({
                    type: "function",
                    name: "save",
                    'arguments': arguments
                });
            },
            restore: function() {
                storage.push({
                    type: "function",
                    name: "restore",
                    'arguments': arguments
                });
            },
            fillRect: function () {
                storage.push({
                    type: "function",
                    name: "fillRect",
                    'arguments': arguments
                });
            },
            createPattern: function() {
                storage.push({
                    type: "function",
                    name: "createPattern",
                    'arguments': arguments
                });
            },
            drawShape: function() {

                var shape = [];

                storage.push({
                    type: "function",
                    name: "drawShape",
                    'arguments': shape
                });

                return {
                    moveTo: function() {
                        shape.push({
                            name: "moveTo",
                            'arguments': arguments
                        });
                    },
                    lineTo: function() {
                        shape.push({
                            name: "lineTo",
                            'arguments': arguments
                        });
                    },
                    arcTo: function() {
                        shape.push({
                            name: "arcTo",
                            'arguments': arguments
                        });
                    },
                    bezierCurveTo: function() {
                        shape.push({
                            name: "bezierCurveTo",
                            'arguments': arguments
                        });
                    },
                    quadraticCurveTo: function() {
                        shape.push({
                            name: "quadraticCurveTo",
                            'arguments': arguments
                        });
                    }
                };

            },
            drawImage: function () {
                storage.push({
                    type: "function",
                    name: "drawImage",
                    'arguments': arguments
                });
            },
            fillText: function () {
                storage.push({
                    type: "function",
                    name: "fillText",
                    'arguments': arguments
                });
            },
            setVariable: function (variable, value) {
                storage.push({
                    type: "variable",
                    name: variable,
                    'arguments': value
                });
                return value;
            }
        };
    }
    _html2canvas.Parse = function (images, options) {
        window.scroll(0,0);

        var element = (( options.elements === undefined ) ? document.body : options.elements[0]), // select body by default
            numDraws = 0,
            doc = element.ownerDocument,
            Util = _html2canvas.Util,
            support = Util.Support(options, doc),
            ignoreElementsRegExp = new RegExp("(" + options.ignoreElements + ")"),
            body = doc.body,
            getCSS = Util.getCSS,
            pseudoHide = "___html2canvas___pseudoelement",
            hidePseudoElements = doc.createElement('style');

        hidePseudoElements.innerHTML = '.' + pseudoHide + '-before:before { content: "" !important; display: none !important; }' +
            '.' + pseudoHide + '-after:after { content: "" !important; display: none !important; }';

        body.appendChild(hidePseudoElements);

        images = images || {};

        function documentWidth () {
            return Math.max(
                Math.max(doc.body.scrollWidth, doc.documentElement.scrollWidth),
                Math.max(doc.body.offsetWidth, doc.documentElement.offsetWidth),
                Math.max(doc.body.clientWidth, doc.documentElement.clientWidth)
            );
        }

        function documentHeight () {
            return Math.max(
                Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight),
                Math.max(doc.body.offsetHeight, doc.documentElement.offsetHeight),
                Math.max(doc.body.clientHeight, doc.documentElement.clientHeight)
            );
        }

        function getCSSInt(element, attribute) {
            var val = parseInt(getCSS(element, attribute), 10);
            return (isNaN(val)) ? 0 : val; // borders in old IE are throwing 'medium' for demo.html
        }

        function renderRect (ctx, x, y, w, h, bgcolor) {
            if (bgcolor !== "transparent"){
                ctx.setVariable("fillStyle", bgcolor);
                ctx.fillRect(x, y, w, h);
                numDraws+=1;
            }
        }

        function capitalize(m, p1, p2) {
            if (m.length > 0) {
                return p1 + p2.toUpperCase();
            }
        }

        function textTransform (text, transform) {
            switch(transform){
                case "lowercase":
                    return text.toLowerCase();
                case "capitalize":
                    return text.replace( /(^|\s|:|-|\(|\))([a-z])/g, capitalize);
                case "uppercase":
                    return text.toUpperCase();
                default:
                    return text;
            }
        }

        function noLetterSpacing(letter_spacing) {
            return (/^(normal|none|0px)$/.test(letter_spacing));
        }

        function drawText(currentText, x, y, ctx){
            if (currentText !== null && Util.trimText(currentText).length > 0) {
                ctx.fillText(currentText, x, y);
                numDraws+=1;
            }
        }

        function setTextVariables(ctx, el, text_decoration, color) {
            var align = false,
                bold = getCSS(el, "fontWeight"),
                family = getCSS(el, "fontFamily"),
                size = getCSS(el, "fontSize"),
                shadows = Util.parseTextShadows(getCSS(el, "textShadow"));

            switch(parseInt(bold, 10)){
                case 401:
                    bold = "bold";
                    break;
                case 400:
                    bold = "normal";
                    break;
            }

            ctx.setVariable("fillStyle", color);
            ctx.setVariable("font", [getCSS(el, "fontStyle"), getCSS(el, "fontVariant"), bold, size, family].join(" "));
            ctx.setVariable("textAlign", (align) ? "right" : "left");

            if (shadows.length) {
                // TODO: support multiple text shadows
                // apply the first text shadow
                ctx.setVariable("shadowColor", shadows[0].color);
                ctx.setVariable("shadowOffsetX", shadows[0].offsetX);
                ctx.setVariable("shadowOffsetY", shadows[0].offsetY);
                ctx.setVariable("shadowBlur", shadows[0].blur);
            }

            if (text_decoration !== "none"){
                return Util.Font(family, size, doc);
            }
        }

        function renderTextDecoration(ctx, text_decoration, bounds, metrics, color) {
            switch(text_decoration) {
                case "underline":
                    // Draws a line at the baseline of the font
                    // TODO As some browsers display the line as more than 1px if the font-size is big, need to take that into account both in position and size
                    renderRect(ctx, bounds.left, Math.round(bounds.top + metrics.baseline + metrics.lineWidth), bounds.width, 1, color);
                    break;
                case "overline":
                    renderRect(ctx, bounds.left, Math.round(bounds.top), bounds.width, 1, color);
                    break;
                case "line-through":
                    // TODO try and find exact position for line-through
                    renderRect(ctx, bounds.left, Math.ceil(bounds.top + metrics.middle + metrics.lineWidth), bounds.width, 1, color);
                    break;
            }
        }

        function getTextBounds(state, text, textDecoration, isLast, transform) {
            var bounds;
            if (support.rangeBounds && !transform) {
                if (textDecoration !== "none" || Util.trimText(text).length !== 0) {
                    bounds = textRangeBounds(text, state.node, state.textOffset);
                }
                state.textOffset += text.length;
            } else if (state.node && typeof state.node.nodeValue === "string" ){
                var newTextNode = (isLast) ? state.node.splitText(text.length) : null;
                bounds = textWrapperBounds(state.node, transform);
                state.node = newTextNode;
            }
            return bounds;
        }

        function textRangeBounds(text, textNode, textOffset) {
            var range = doc.createRange();
            range.setStart(textNode, textOffset);
            range.setEnd(textNode, textOffset + text.length);
            return range.getBoundingClientRect();
        }

        function textWrapperBounds(oldTextNode, transform) {
            var parent = oldTextNode.parentNode,
                wrapElement = doc.createElement('wrapper'),
                backupText = oldTextNode.cloneNode(true);

            wrapElement.appendChild(oldTextNode.cloneNode(true));
            parent.replaceChild(wrapElement, oldTextNode);

            var bounds = transform ? Util.OffsetBounds(wrapElement) : Util.Bounds(wrapElement);
            parent.replaceChild(backupText, wrapElement);
            return bounds;
        }

        function renderText(el, textNode, stack) {
            var ctx = stack.ctx,
                color = getCSS(el, "color"),
                textDecoration = getCSS(el, "textDecoration"),
                textAlign = getCSS(el, "textAlign"),
                metrics,
                textList,
                state = {
                    node: textNode,
                    textOffset: 0
                };

            if (Util.trimText(textNode.nodeValue).length > 0) {
                textNode.nodeValue = textTransform(textNode.nodeValue, getCSS(el, "textTransform"));
                textAlign = textAlign.replace(["-webkit-auto"],["auto"]);

                textList = (!options.letterRendering && /^(left|right|justify|auto)$/.test(textAlign) && noLetterSpacing(getCSS(el, "letterSpacing"))) ?
                    textNode.nodeValue.split(/(\b| )/)
                    : textNode.nodeValue.split("");

                metrics = setTextVariables(ctx, el, textDecoration, color);

                if (options.chinese) {
                    textList.forEach(function(word, index) {
                        if (/.*[\u4E00-\u9FA5].*$/.test(word)) {
                            word = word.split("");
                            word.unshift(index, 1);
                            textList.splice.apply(textList, word);
                        }
                    });
                }

                textList.forEach(function(text, index) {
                    var bounds = getTextBounds(state, text, textDecoration, (index < textList.length - 1), stack.transform.matrix);
                    if (bounds) {
                        drawText(text, bounds.left, bounds.bottom, ctx);
                        renderTextDecoration(ctx, textDecoration, bounds, metrics, color);
                    }
                });
            }
        }

        function listPosition (element, val) {
            var boundElement = doc.createElement( "boundelement" ),
                originalType,
                bounds;

            boundElement.style.display = "inline";

            originalType = element.style.listStyleType;
            element.style.listStyleType = "none";

            boundElement.appendChild(doc.createTextNode(val));

            element.insertBefore(boundElement, element.firstChild);

            bounds = Util.Bounds(boundElement);
            element.removeChild(boundElement);
            element.style.listStyleType = originalType;
            return bounds;
        }

        function elementIndex(el) {
            var i = -1,
                count = 1,
                childs = el.parentNode.childNodes;

            if (el.parentNode) {
                while(childs[++i] !== el) {
                    if (childs[i].nodeType === 1) {
                        count++;
                    }
                }
                return count;
            } else {
                return -1;
            }
        }

        function listItemText(element, type) {
            var currentIndex = elementIndex(element), text;
            switch(type){
                case "decimal":
                    text = currentIndex;
                    break;
                case "decimal-leading-zero":
                    text = (currentIndex.toString().length === 1) ? currentIndex = "0" + currentIndex.toString() : currentIndex.toString();
                    break;
                case "upper-roman":
                    text = _html2canvas.Generate.ListRoman( currentIndex );
                    break;
                case "lower-roman":
                    text = _html2canvas.Generate.ListRoman( currentIndex ).toLowerCase();
                    break;
                case "lower-alpha":
                    text = _html2canvas.Generate.ListAlpha( currentIndex ).toLowerCase();
                    break;
                case "upper-alpha":
                    text = _html2canvas.Generate.ListAlpha( currentIndex );
                    break;
            }

            return text + ". ";
        }

        function renderListItem(element, stack, elBounds) {
            var x,
                text,
                ctx = stack.ctx,
                type = getCSS(element, "listStyleType"),
                listBounds;

            if (/^(decimal|decimal-leading-zero|upper-alpha|upper-latin|upper-roman|lower-alpha|lower-greek|lower-latin|lower-roman)$/i.test(type)) {
                text = listItemText(element, type);
                listBounds = listPosition(element, text);
                setTextVariables(ctx, element, "none", getCSS(element, "color"));

                if (getCSS(element, "listStylePosition") === "inside") {
                    ctx.setVariable("textAlign", "left");
                    x = elBounds.left;
                } else {
                    return;
                }

                drawText(text, x, listBounds.bottom, ctx);
            }
        }

        function loadImage (src){
            var img = images[src];
            return (img && img.succeeded === true) ? img.img : false;
        }

        function clipBounds(src, dst){
            var x = Math.max(src.left, dst.left),
                y = Math.max(src.top, dst.top),
                x2 = Math.min((src.left + src.width), (dst.left + dst.width)),
                y2 = Math.min((src.top + src.height), (dst.top + dst.height));

            return {
                left:x,
                top:y,
                width:x2-x,
                height:y2-y
            };
        }

        function setZ(element, stack, parentStack){
            var newContext,
                isPositioned = stack.cssPosition !== 'static',
                zIndex = isPositioned ? getCSS(element, 'zIndex') : 'auto',
                opacity = getCSS(element, 'opacity'),
                isFloated = getCSS(element, 'cssFloat') !== 'none';

            // https://developer.mozilla.org/en-US/docs/Web/Guide/CSS/Understanding_z_index/The_stacking_context
            // When a new stacking context should be created:
            // the root element (HTML),
            // positioned (absolutely or relatively) with a z-index value other than "auto",
            // elements with an opacity value less than 1. (See the specification for opacity),
            // on mobile WebKit and Chrome 22+, position: fixed always creates a new stacking context, even when z-index is "auto" (See this post)

            stack.zIndex = newContext = h2czContext(zIndex);
            newContext.isPositioned = isPositioned;
            newContext.isFloated = isFloated;
            newContext.opacity = opacity;
            newContext.ownStacking = (zIndex !== 'auto' || opacity < 1);

            if (parentStack) {
                parentStack.zIndex.children.push(stack);
            }
        }

        function renderImage(ctx, element, image, bounds, borders) {

            var paddingLeft = getCSSInt(element, 'paddingLeft'),
                paddingTop = getCSSInt(element, 'paddingTop'),
                paddingRight = getCSSInt(element, 'paddingRight'),
                paddingBottom = getCSSInt(element, 'paddingBottom');

            drawImage(
                ctx,
                image,
                0, //sx
                0, //sy
                image.width, //sw
                image.height, //sh
                bounds.left + paddingLeft + borders[3].width, //dx
                bounds.top + paddingTop + borders[0].width, // dy
                bounds.width - (borders[1].width + borders[3].width + paddingLeft + paddingRight), //dw
                bounds.height - (borders[0].width + borders[2].width + paddingTop + paddingBottom) //dh
            );
        }

        function getBorderData(element) {
            return ["Top", "Right", "Bottom", "Left"].map(function(side) {
                return {
                    width: getCSSInt(element, 'border' + side + 'Width'),
                    color: getCSS(element, 'border' + side + 'Color')
                };
            });
        }

        function getBorderRadiusData(element) {
            return ["TopLeft", "TopRight", "BottomRight", "BottomLeft"].map(function(side) {
                return getCSS(element, 'border' + side + 'Radius');
            });
        }

        var getCurvePoints = (function(kappa) {

            return function(x, y, r1, r2) {
                var ox = (r1) * kappa, // control point offset horizontal
                    oy = (r2) * kappa, // control point offset vertical
                    xm = x + r1, // x-middle
                    ym = y + r2; // y-middle
                return {
                    topLeft: bezierCurve({
                        x:x,
                        y:ym
                    }, {
                        x:x,
                        y:ym - oy
                    }, {
                        x:xm - ox,
                        y:y
                    }, {
                        x:xm,
                        y:y
                    }),
                    topRight: bezierCurve({
                        x:x,
                        y:y
                    }, {
                        x:x + ox,
                        y:y
                    }, {
                        x:xm,
                        y:ym - oy
                    }, {
                        x:xm,
                        y:ym
                    }),
                    bottomRight: bezierCurve({
                        x:xm,
                        y:y
                    }, {
                        x:xm,
                        y:y + oy
                    }, {
                        x:x + ox,
                        y:ym
                    }, {
                        x:x,
                        y:ym
                    }),
                    bottomLeft: bezierCurve({
                        x:xm,
                        y:ym
                    }, {
                        x:xm - ox,
                        y:ym
                    }, {
                        x:x,
                        y:y + oy
                    }, {
                        x:x,
                        y:y
                    })
                };
            };
        })(4 * ((Math.sqrt(2) - 1) / 3));

        function bezierCurve(start, startControl, endControl, end) {

            var lerp = function (a, b, t) {
                return {
                    x:a.x + (b.x - a.x) * t,
                    y:a.y + (b.y - a.y) * t
                };
            };

            return {
                start: start,
                startControl: startControl,
                endControl: endControl,
                end: end,
                subdivide: function(t) {
                    var ab = lerp(start, startControl, t),
                        bc = lerp(startControl, endControl, t),
                        cd = lerp(endControl, end, t),
                        abbc = lerp(ab, bc, t),
                        bccd = lerp(bc, cd, t),
                        dest = lerp(abbc, bccd, t);
                    return [bezierCurve(start, ab, abbc, dest), bezierCurve(dest, bccd, cd, end)];
                },
                curveTo: function(borderArgs) {
                    borderArgs.push(["bezierCurve", startControl.x, startControl.y, endControl.x, endControl.y, end.x, end.y]);
                },
                curveToReversed: function(borderArgs) {
                    borderArgs.push(["bezierCurve", endControl.x, endControl.y, startControl.x, startControl.y, start.x, start.y]);
                }
            };
        }

        function parseCorner(borderArgs, radius1, radius2, corner1, corner2, x, y) {
            if (radius1[0] > 0 || radius1[1] > 0) {
                borderArgs.push(["line", corner1[0].start.x, corner1[0].start.y]);
                corner1[0].curveTo(borderArgs);
                corner1[1].curveTo(borderArgs);
            } else {
                borderArgs.push(["line", x, y]);
            }

            if (radius2[0] > 0 || radius2[1] > 0) {
                borderArgs.push(["line", corner2[0].start.x, corner2[0].start.y]);
            }
        }

        function drawSide(borderData, radius1, radius2, outer1, inner1, outer2, inner2) {
            var borderArgs = [];

            if (radius1[0] > 0 || radius1[1] > 0) {
                borderArgs.push(["line", outer1[1].start.x, outer1[1].start.y]);
                outer1[1].curveTo(borderArgs);
            } else {
                borderArgs.push([ "line", borderData.c1[0], borderData.c1[1]]);
            }

            if (radius2[0] > 0 || radius2[1] > 0) {
                borderArgs.push(["line", outer2[0].start.x, outer2[0].start.y]);
                outer2[0].curveTo(borderArgs);
                borderArgs.push(["line", inner2[0].end.x, inner2[0].end.y]);
                inner2[0].curveToReversed(borderArgs);
            } else {
                borderArgs.push([ "line", borderData.c2[0], borderData.c2[1]]);
                borderArgs.push([ "line", borderData.c3[0], borderData.c3[1]]);
            }

            if (radius1[0] > 0 || radius1[1] > 0) {
                borderArgs.push(["line", inner1[1].end.x, inner1[1].end.y]);
                inner1[1].curveToReversed(borderArgs);
            } else {
                borderArgs.push([ "line", borderData.c4[0], borderData.c4[1]]);
            }

            return borderArgs;
        }

        function calculateCurvePoints(bounds, borderRadius, borders) {

            var x = bounds.left,
                y = bounds.top,
                width = bounds.width,
                height = bounds.height,

                tlh = borderRadius[0][0],
                tlv = borderRadius[0][1],
                trh = borderRadius[1][0],
                trv = borderRadius[1][1],
                brh = borderRadius[2][0],
                brv = borderRadius[2][1],
                blh = borderRadius[3][0],
                blv = borderRadius[3][1],

                topWidth = width - trh,
                rightHeight = height - brv,
                bottomWidth = width - brh,
                leftHeight = height - blv;

            return {
                topLeftOuter: getCurvePoints(
                    x,
                    y,
                    tlh,
                    tlv
                ).topLeft.subdivide(0.5),

                topLeftInner: getCurvePoints(
                    x + borders[3].width,
                    y + borders[0].width,
                    Math.max(0, tlh - borders[3].width),
                    Math.max(0, tlv - borders[0].width)
                ).topLeft.subdivide(0.5),

                topRightOuter: getCurvePoints(
                    x + topWidth,
                    y,
                    trh,
                    trv
                ).topRight.subdivide(0.5),

                topRightInner: getCurvePoints(
                    x + Math.min(topWidth, width + borders[3].width),
                    y + borders[0].width,
                    (topWidth > width + borders[3].width) ? 0 :trh - borders[3].width,
                    trv - borders[0].width
                ).topRight.subdivide(0.5),

                bottomRightOuter: getCurvePoints(
                    x + bottomWidth,
                    y + rightHeight,
                    brh,
                    brv
                ).bottomRight.subdivide(0.5),

                bottomRightInner: getCurvePoints(
                    x + Math.min(bottomWidth, width + borders[3].width),
                    y + Math.min(rightHeight, height + borders[0].width),
                    Math.max(0, brh - borders[1].width),
                    Math.max(0, brv - borders[2].width)
                ).bottomRight.subdivide(0.5),

                bottomLeftOuter: getCurvePoints(
                    x,
                    y + leftHeight,
                    blh,
                    blv
                ).bottomLeft.subdivide(0.5),

                bottomLeftInner: getCurvePoints(
                    x + borders[3].width,
                    y + leftHeight,
                    Math.max(0, blh - borders[3].width),
                    Math.max(0, blv - borders[2].width)
                ).bottomLeft.subdivide(0.5)
            };
        }

        function getBorderClip(element, borderPoints, borders, radius, bounds) {
            var backgroundClip = getCSS(element, 'backgroundClip'),
                borderArgs = [];

            switch(backgroundClip) {
                case "content-box":
                case "padding-box":
                    parseCorner(borderArgs, radius[0], radius[1], borderPoints.topLeftInner, borderPoints.topRightInner, bounds.left + borders[3].width, bounds.top + borders[0].width);
                    parseCorner(borderArgs, radius[1], radius[2], borderPoints.topRightInner, borderPoints.bottomRightInner, bounds.left + bounds.width - borders[1].width, bounds.top + borders[0].width);
                    parseCorner(borderArgs, radius[2], radius[3], borderPoints.bottomRightInner, borderPoints.bottomLeftInner, bounds.left + bounds.width - borders[1].width, bounds.top + bounds.height - borders[2].width);
                    parseCorner(borderArgs, radius[3], radius[0], borderPoints.bottomLeftInner, borderPoints.topLeftInner, bounds.left + borders[3].width, bounds.top + bounds.height - borders[2].width);
                    break;

                default:
                    parseCorner(borderArgs, radius[0], radius[1], borderPoints.topLeftOuter, borderPoints.topRightOuter, bounds.left, bounds.top);
                    parseCorner(borderArgs, radius[1], radius[2], borderPoints.topRightOuter, borderPoints.bottomRightOuter, bounds.left + bounds.width, bounds.top);
                    parseCorner(borderArgs, radius[2], radius[3], borderPoints.bottomRightOuter, borderPoints.bottomLeftOuter, bounds.left + bounds.width, bounds.top + bounds.height);
                    parseCorner(borderArgs, radius[3], radius[0], borderPoints.bottomLeftOuter, borderPoints.topLeftOuter, bounds.left, bounds.top + bounds.height);
                    break;
            }

            return borderArgs;
        }

        function parseBorders(element, bounds, borders){
            var x = bounds.left,
                y = bounds.top,
                width = bounds.width,
                height = bounds.height,
                borderSide,
                bx,
                by,
                bw,
                bh,
                borderArgs,
            // http://www.w3.org/TR/css3-background/#the-border-radius
                borderRadius = getBorderRadiusData(element),
                borderPoints = calculateCurvePoints(bounds, borderRadius, borders),
                borderData = {
                    clip: getBorderClip(element, borderPoints, borders, borderRadius, bounds),
                    borders: []
                };

            for (borderSide = 0; borderSide < 4; borderSide++) {

                if (borders[borderSide].width > 0) {
                    bx = x;
                    by = y;
                    bw = width;
                    bh = height - (borders[2].width);

                    switch(borderSide) {
                        case 0:
                            // top border
                            bh = borders[0].width;

                            borderArgs = drawSide({
                                    c1: [bx, by],
                                    c2: [bx + bw, by],
                                    c3: [bx + bw - borders[1].width, by + bh],
                                    c4: [bx + borders[3].width, by + bh]
                                }, borderRadius[0], borderRadius[1],
                                borderPoints.topLeftOuter, borderPoints.topLeftInner, borderPoints.topRightOuter, borderPoints.topRightInner);
                            break;
                        case 1:
                            // right border
                            bx = x + width - (borders[1].width);
                            bw = borders[1].width;

                            borderArgs = drawSide({
                                    c1: [bx + bw, by],
                                    c2: [bx + bw, by + bh + borders[2].width],
                                    c3: [bx, by + bh],
                                    c4: [bx, by + borders[0].width]
                                }, borderRadius[1], borderRadius[2],
                                borderPoints.topRightOuter, borderPoints.topRightInner, borderPoints.bottomRightOuter, borderPoints.bottomRightInner);
                            break;
                        case 2:
                            // bottom border
                            by = (by + height) - (borders[2].width);
                            bh = borders[2].width;

                            borderArgs = drawSide({
                                    c1: [bx + bw, by + bh],
                                    c2: [bx, by + bh],
                                    c3: [bx + borders[3].width, by],
                                    c4: [bx + bw - borders[3].width, by]
                                }, borderRadius[2], borderRadius[3],
                                borderPoints.bottomRightOuter, borderPoints.bottomRightInner, borderPoints.bottomLeftOuter, borderPoints.bottomLeftInner);
                            break;
                        case 3:
                            // left border
                            bw = borders[3].width;

                            borderArgs = drawSide({
                                    c1: [bx, by + bh + borders[2].width],
                                    c2: [bx, by],
                                    c3: [bx + bw, by + borders[0].width],
                                    c4: [bx + bw, by + bh]
                                }, borderRadius[3], borderRadius[0],
                                borderPoints.bottomLeftOuter, borderPoints.bottomLeftInner, borderPoints.topLeftOuter, borderPoints.topLeftInner);
                            break;
                    }

                    borderData.borders.push({
                        args: borderArgs,
                        color: borders[borderSide].color
                    });

                }
            }

            return borderData;
        }

        function createShape(ctx, args) {
            var shape = ctx.drawShape();
            args.forEach(function(border, index) {
                shape[(index === 0) ? "moveTo" : border[0] + "To" ].apply(null, border.slice(1));
            });
            return shape;
        }

        function renderBorders(ctx, borderArgs, color) {
            if (color !== "transparent") {
                ctx.setVariable( "fillStyle", color);
                createShape(ctx, borderArgs);
                ctx.fill();
                numDraws+=1;
            }
        }

        function renderFormValue (el, bounds, stack){

            var valueWrap = doc.createElement('valuewrap'),
                cssPropertyArray = ['lineHeight','textAlign','fontFamily','color','fontSize','paddingLeft','paddingTop','width','height','border','borderLeftWidth','borderTopWidth'],
                textValue,
                textNode;

            cssPropertyArray.forEach(function(property) {
                try {
                    valueWrap.style[property] = getCSS(el, property);
                } catch(e) {
                    // Older IE has issues with "border"
                    Util.log("html2canvas: Parse: Exception caught in renderFormValue: " + e.message);
                }
            });

            valueWrap.style.borderColor = "black";
            valueWrap.style.borderStyle = "solid";
            valueWrap.style.display = "block";
            valueWrap.style.position = "absolute";

            if (/^(submit|reset|button|text|password)$/.test(el.type) || el.nodeName === "SELECT"){
                valueWrap.style.lineHeight = getCSS(el, "height");
            }

            valueWrap.style.top = bounds.top + "px";
            valueWrap.style.left = bounds.left + "px";

            textValue = (el.nodeName === "SELECT") ? (el.options[el.selectedIndex] || 0).text : el.value;
            if(!textValue) {
                textValue = el.placeholder;
            }

            textNode = doc.createTextNode(textValue);

            valueWrap.appendChild(textNode);
            body.appendChild(valueWrap);

            renderText(el, textNode, stack);
            body.removeChild(valueWrap);
        }

        function drawImage (ctx) {
            ctx.drawImage.apply(ctx, Array.prototype.slice.call(arguments, 1));
            numDraws+=1;
        }

        function getPseudoElement(el, which) {
            var elStyle = window.getComputedStyle(el, which);
            if(!elStyle || !elStyle.content || elStyle.content === "none" || elStyle.content === "-moz-alt-content" || elStyle.display === "none") {
                return;
            }
            var content = elStyle.content + '',
                first = content.substr( 0, 1 );
            //strips quotes
            if(first === content.substr( content.length - 1 ) && first.match(/'|"/)) {
                content = content.substr( 1, content.length - 2 );
            }

            var isImage = content.substr( 0, 3 ) === 'url',
                elps = document.createElement( isImage ? 'img' : 'span' );

            elps.className = pseudoHide + "-before " + pseudoHide + "-after";

            Object.keys(elStyle).filter(indexedProperty).forEach(function(prop) {
                // Prevent assigning of read only CSS Rules, ex. length, parentRule
                try {
                    elps.style[prop] = elStyle[prop];
                } catch (e) {
                    Util.log(['Tried to assign readonly property ', prop, 'Error:', e]);
                }
            });

            if(isImage) {
                elps.src = Util.parseBackgroundImage(content)[0].args[0];
            } else {
                elps.innerHTML = content;
            }
            return elps;
        }

        function indexedProperty(property) {
            return (isNaN(window.parseInt(property, 10)));
        }

        function injectPseudoElements(el, stack) {
            var before = getPseudoElement(el, ':before'),
                after = getPseudoElement(el, ':after');
            if(!before && !after) {
                return;
            }

            if(before) {
                el.className += " " + pseudoHide + "-before";
                el.parentNode.insertBefore(before, el);
                parseElement(before, stack, true);
                el.parentNode.removeChild(before);
                el.className = el.className.replace(pseudoHide + "-before", "").trim();
            }

            if (after) {
                el.className += " " + pseudoHide + "-after";
                el.appendChild(after);
                parseElement(after, stack, true);
                el.removeChild(after);
                el.className = el.className.replace(pseudoHide + "-after", "").trim();
            }

        }

        function renderBackgroundRepeat(ctx, image, backgroundPosition, bounds) {
            var offsetX = Math.round(bounds.left + backgroundPosition.left),
                offsetY = Math.round(bounds.top + backgroundPosition.top);

            ctx.createPattern(image);
            ctx.translate(offsetX, offsetY);
            ctx.fill();
            ctx.translate(-offsetX, -offsetY);
        }

        function backgroundRepeatShape(ctx, image, backgroundPosition, bounds, left, top, width, height) {
            var args = [];
            args.push(["line", Math.round(left), Math.round(top)]);
            args.push(["line", Math.round(left + width), Math.round(top)]);
            args.push(["line", Math.round(left + width), Math.round(height + top)]);
            args.push(["line", Math.round(left), Math.round(height + top)]);
            createShape(ctx, args);
            ctx.save();
            ctx.clip();
            renderBackgroundRepeat(ctx, image, backgroundPosition, bounds);
            ctx.restore();
        }

        function renderBackgroundColor(ctx, backgroundBounds, bgcolor) {
            renderRect(
                ctx,
                backgroundBounds.left,
                backgroundBounds.top,
                backgroundBounds.width,
                backgroundBounds.height,
                bgcolor
            );
        }

        function renderBackgroundRepeating(el, bounds, ctx, image, imageIndex) {
            var backgroundSize = Util.BackgroundSize(el, bounds, image, imageIndex),
                backgroundPosition = Util.BackgroundPosition(el, bounds, image, imageIndex, backgroundSize),
                backgroundRepeat = getCSS(el, "backgroundRepeat").split(",").map(Util.trimText);

            image = resizeImage(image, backgroundSize);

            backgroundRepeat = backgroundRepeat[imageIndex] || backgroundRepeat[0];

            switch (backgroundRepeat) {
                case "repeat-x":
                    backgroundRepeatShape(ctx, image, backgroundPosition, bounds,
                        bounds.left, bounds.top + backgroundPosition.top, 99999, image.height);
                    break;

                case "repeat-y":
                    backgroundRepeatShape(ctx, image, backgroundPosition, bounds,
                        bounds.left + backgroundPosition.left, bounds.top, image.width, 99999);
                    break;

                case "no-repeat":
                    backgroundRepeatShape(ctx, image, backgroundPosition, bounds,
                        bounds.left + backgroundPosition.left, bounds.top + backgroundPosition.top, image.width, image.height);
                    break;

                default:
                    renderBackgroundRepeat(ctx, image, backgroundPosition, {
                        top: bounds.top,
                        left: bounds.left,
                        width: image.width,
                        height: image.height
                    });
                    break;
            }
        }

        function renderBackgroundImage(element, bounds, ctx) {
            var backgroundImage = getCSS(element, "backgroundImage"),
                backgroundImages = Util.parseBackgroundImage(backgroundImage),
                image,
                imageIndex = backgroundImages.length;

            while(imageIndex--) {
                backgroundImage = backgroundImages[imageIndex];

                if (!backgroundImage.args || backgroundImage.args.length === 0) {
                    continue;
                }

                var key = backgroundImage.method === 'url' ?
                    backgroundImage.args[0] :
                    backgroundImage.value;

                image = loadImage(key);

                // TODO add support for background-origin
                if (image) {
                    renderBackgroundRepeating(element, bounds, ctx, image, imageIndex);
                } else {
                    Util.log("html2canvas: Error loading background:", backgroundImage);
                }
            }
        }

        function resizeImage(image, bounds) {
            if(image.width === bounds.width && image.height === bounds.height) {
                return image;
            }

            var ctx, canvas = doc.createElement('canvas');
            canvas.width = bounds.width;
            canvas.height = bounds.height;
            ctx = canvas.getContext("2d");
            drawImage(ctx, image, 0, 0, image.width, image.height, 0, 0, bounds.width, bounds.height );
            return canvas;
        }

        function setOpacity(ctx, element, parentStack) {
            return ctx.setVariable("globalAlpha", getCSS(element, "opacity") * ((parentStack) ? parentStack.opacity : 1));
        }

        function removePx(str) {
            return str.replace("px", "");
        }

        var transformRegExp = /(matrix)\((.+)\)/;

        function getTransform(element, parentStack) {
            var transform = getCSS(element, "transform") || getCSS(element, "-webkit-transform") || getCSS(element, "-moz-transform") || getCSS(element, "-ms-transform") || getCSS(element, "-o-transform");
            var transformOrigin = getCSS(element, "transform-origin") || getCSS(element, "-webkit-transform-origin") || getCSS(element, "-moz-transform-origin") || getCSS(element, "-ms-transform-origin") || getCSS(element, "-o-transform-origin") || "0px 0px";

            transformOrigin = transformOrigin.split(" ").map(removePx).map(Util.asFloat);

            var matrix;
            if (transform && transform !== "none") {
                var match = transform.match(transformRegExp);
                if (match) {
                    switch(match[1]) {
                        case "matrix":
                            matrix = match[2].split(",").map(Util.trimText).map(Util.asFloat);
                            break;
                    }
                }
            }

            return {
                origin: transformOrigin,
                matrix: matrix
            };
        }

        function createStack(element, parentStack, bounds, transform) {
            var ctx = h2cRenderContext((!parentStack) ? documentWidth() : bounds.width , (!parentStack) ? documentHeight() : bounds.height),
                stack = {
                    ctx: ctx,
                    opacity: setOpacity(ctx, element, parentStack),
                    cssPosition: getCSS(element, "position"),
                    borders: getBorderData(element),
                    transform: transform,
                    clip: (parentStack && parentStack.clip) ? Util.Extend( {}, parentStack.clip ) : null
                };

            setZ(element, stack, parentStack);

            // TODO correct overflow for absolute content residing under a static position
            if (options.useOverflow === true && /(hidden|scroll|auto)/.test(getCSS(element, "overflow")) === true && /(BODY)/i.test(element.nodeName) === false){
                stack.clip = (stack.clip) ? clipBounds(stack.clip, bounds) : bounds;
            }

            return stack;
        }

        function getBackgroundBounds(borders, bounds, clip) {
            var backgroundBounds = {
                left: bounds.left + borders[3].width,
                top: bounds.top + borders[0].width,
                width: bounds.width - (borders[1].width + borders[3].width),
                height: bounds.height - (borders[0].width + borders[2].width)
            };

            if (clip) {
                backgroundBounds = clipBounds(backgroundBounds, clip);
            }

            return backgroundBounds;
        }

        function getBounds(element, transform) {
            var bounds = (transform.matrix) ? Util.OffsetBounds(element) : Util.Bounds(element);
            transform.origin[0] += bounds.left;
            transform.origin[1] += bounds.top;
            return bounds;
        }

        function renderElement(element, parentStack, pseudoElement, ignoreBackground) {
            var transform = getTransform(element, parentStack),
                bounds = getBounds(element, transform),
                image,
                stack = createStack(element, parentStack, bounds, transform),
                borders = stack.borders,
                ctx = stack.ctx,
                backgroundBounds = getBackgroundBounds(borders, bounds, stack.clip),
                borderData = parseBorders(element, bounds, borders),
                backgroundColor = (ignoreElementsRegExp.test(element.nodeName)) ? "#efefef" : getCSS(element, "backgroundColor");


            createShape(ctx, borderData.clip);

            ctx.save();
            ctx.clip();

            if (backgroundBounds.height > 0 && backgroundBounds.width > 0 && !ignoreBackground) {
                renderBackgroundColor(ctx, bounds, backgroundColor);
                renderBackgroundImage(element, backgroundBounds, ctx);
            } else if (ignoreBackground) {
                stack.backgroundColor =  backgroundColor;
            }

            ctx.restore();

            borderData.borders.forEach(function(border) {
                renderBorders(ctx, border.args, border.color);
            });

            if (!pseudoElement) {
                injectPseudoElements(element, stack);
            }

            switch(element.nodeName){
                case "IMG":
                    if ((image = loadImage(element.getAttribute('src')))) {
                        renderImage(ctx, element, image, bounds, borders);
                    } else {
                        Util.log("html2canvas: Error loading <img>:" + element.getAttribute('src'));
                    }
                    break;
                case "INPUT":
                    // TODO add all relevant type's, i.e. HTML5 new stuff
                    // todo add support for placeholder attribute for browsers which support it
                    if (/^(text|url|email|submit|button|reset)$/.test(element.type) && (element.value || element.placeholder || "").length > 0){
                        renderFormValue(element, bounds, stack);
                    }
                    break;
                case "TEXTAREA":
                    if ((element.value || element.placeholder || "").length > 0){
                        renderFormValue(element, bounds, stack);
                    }
                    break;
                case "SELECT":
                    if ((element.options||element.placeholder || "").length > 0){
                        renderFormValue(element, bounds, stack);
                    }
                    break;
                case "LI":
                    renderListItem(element, stack, backgroundBounds);
                    break;
                case "CANVAS":
                    renderImage(ctx, element, element, bounds, borders);
                    break;
            }

            return stack;
        }

        function isElementVisible(element) {
            return (getCSS(element, 'display') !== "none" && getCSS(element, 'visibility') !== "hidden" && !element.hasAttribute("data-html2canvas-ignore"));
        }

        function parseElement (element, stack, pseudoElement) {
            if (isElementVisible(element)) {
                stack = renderElement(element, stack, pseudoElement, false) || stack;
                if (!ignoreElementsRegExp.test(element.nodeName)) {
                    parseChildren(element, stack, pseudoElement);
                }
            }
        }

        function parseChildren(element, stack, pseudoElement) {
            Util.Children(element).forEach(function(node) {
                if (node.nodeType === node.ELEMENT_NODE) {
                    parseElement(node, stack, pseudoElement);
                } else if (node.nodeType === node.TEXT_NODE) {
                    renderText(element, node, stack);
                }
            });
        }

        function init() {
            var background = getCSS(document.documentElement, "backgroundColor"),
                transparentBackground = (Util.isTransparent(background) && element === document.body),
                stack = renderElement(element, null, false, transparentBackground);
            parseChildren(element, stack);

            if (transparentBackground) {
                background = stack.backgroundColor;
            }

            body.removeChild(hidePseudoElements);
            return {
                backgroundColor: background,
                stack: stack
            };
        }

        return init();
    };

    function h2czContext(zindex) {
        return {
            zindex: zindex,
            children: []
        };
    }

    _html2canvas.Preload = function( options ) {

        var images = {
                numLoaded: 0,   // also failed are counted here
                numFailed: 0,
                numTotal: 0,
                cleanupDone: false
            },
            pageOrigin,
            Util = _html2canvas.Util,
            methods,
            i,
            count = 0,
            element = options.elements[0] || document.body,
            doc = element.ownerDocument,
            domImages = element.getElementsByTagName('img'), // Fetch images of the present element only
            imgLen = domImages.length,
            link = doc.createElement("a"),
            supportCORS = (function( img ){
                return (img.crossOrigin !== undefined);
            })(new Image()),
            timeoutTimer;

        link.href = window.location.href;
        pageOrigin  = link.protocol + link.host;

        function isSameOrigin(url){
            link.href = url;
            link.href = link.href; // YES, BELIEVE IT OR NOT, that is required for IE9 - http://jsfiddle.net/niklasvh/2e48b/
            var origin = link.protocol + link.host;
            return (origin === pageOrigin);
        }

        function start(){
            Util.log("html2canvas: start: images: " + images.numLoaded + " / " + images.numTotal + " (failed: " + images.numFailed + ")");
            if (!images.firstRun && images.numLoaded >= images.numTotal){
                Util.log("Finished loading images: # " + images.numTotal + " (failed: " + images.numFailed + ")");

                if (typeof options.complete === "function"){
                    options.complete(images);
                }

            }
        }

        // TODO modify proxy to serve images with CORS enabled, where available
        function proxyGetImage(url, img, imageObj){
            var callback_name,
                scriptUrl = options.proxy,
                script;

            link.href = url;
            url = link.href; // work around for pages with base href="" set - WARNING: this may change the url

            callback_name = 'html2canvas_' + (count++);
            imageObj.callbackname = callback_name;

            if (scriptUrl.indexOf("?") > -1) {
                scriptUrl += "&";
            } else {
                scriptUrl += "?";
            }
            scriptUrl += 'url=' + encodeURIComponent(url) + '&callback=' + callback_name;
            script = doc.createElement("script");

            window[callback_name] = function(a){
                if (a.substring(0,6) === "error:"){
                    imageObj.succeeded = false;
                    images.numLoaded++;
                    images.numFailed++;
                    start();
                } else {
                    setImageLoadHandlers(img, imageObj);
                    img.src = a;
                }
                window[callback_name] = undefined; // to work with IE<9  // NOTE: that the undefined callback property-name still exists on the window object (for IE<9)
                try {
                    delete window[callback_name];  // for all browser that support this
                } catch(ex) {}
                script.parentNode.removeChild(script);
                script = null;
                delete imageObj.script;
                delete imageObj.callbackname;
            };

            script.setAttribute("type", "text/javascript");
            script.setAttribute("src", scriptUrl);
            imageObj.script = script;
            window.document.body.appendChild(script);

        }

        function loadPseudoElement(element, type) {
            var style = window.getComputedStyle(element, type),
                content = style.content;
            if (content.substr(0, 3) === 'url') {
                methods.loadImage(_html2canvas.Util.parseBackgroundImage(content)[0].args[0]);
            }
            loadBackgroundImages(style.backgroundImage, element);
        }

        function loadPseudoElementImages(element) {
            loadPseudoElement(element, ":before");
            loadPseudoElement(element, ":after");
        }

        function loadGradientImage(backgroundImage, bounds) {
            var img = _html2canvas.Generate.Gradient(backgroundImage, bounds);

            if (img !== undefined){
                images[backgroundImage] = {
                    img: img,
                    succeeded: true
                };
                images.numTotal++;
                images.numLoaded++;
                start();
            }
        }

        function invalidBackgrounds(background_image) {
            return (background_image && background_image.method && background_image.args && background_image.args.length > 0 );
        }

        function loadBackgroundImages(background_image, el) {
            var bounds;

            _html2canvas.Util.parseBackgroundImage(background_image).filter(invalidBackgrounds).forEach(function(background_image) {
                if (background_image.method === 'url') {
                    methods.loadImage(background_image.args[0]);
                } else if(background_image.method.match(/\-?gradient$/)) {
                    if(bounds === undefined) {
                        bounds = _html2canvas.Util.Bounds(el);
                    }
                    loadGradientImage(background_image.value, bounds);
                }
            });
        }

        function getImages (el) {
            var elNodeType = false;

            // Firefox fails with permission denied on pages with iframes
            try {
                Util.Children(el).forEach(getImages);
            }
            catch( e ) {}

            try {
                elNodeType = el.nodeType;
            } catch (ex) {
                elNodeType = false;
                Util.log("html2canvas: failed to access some element's nodeType - Exception: " + ex.message);
            }

            if (elNodeType === 1 || elNodeType === undefined) {
                loadPseudoElementImages(el);
                try {
                    loadBackgroundImages(Util.getCSS(el, 'backgroundImage'), el);
                } catch(e) {
                    Util.log("html2canvas: failed to get background-image - Exception: " + e.message);
                }
                loadBackgroundImages(el);
            }
        }

        function setImageLoadHandlers(img, imageObj) {
            img.onload = function() {
                if ( imageObj.timer !== undefined ) {
                    // CORS succeeded
                    window.clearTimeout( imageObj.timer );
                }

                images.numLoaded++;
                imageObj.succeeded = true;
                img.onerror = img.onload = null;
                start();
            };
            img.onerror = function() {
                if (img.crossOrigin === "anonymous") {
                    // CORS failed
                    window.clearTimeout( imageObj.timer );

                    // let's try with proxy instead
                    if ( options.proxy ) {
                        var src = img.src;
                        img = new Image();
                        imageObj.img = img;
                        img.src = src;

                        proxyGetImage( img.src, img, imageObj );
                        return;
                    }
                }

                images.numLoaded++;
                images.numFailed++;
                imageObj.succeeded = false;
                img.onerror = img.onload = null;
                start();
            };
        }

        methods = {
            loadImage: function( src ) {
                var img, imageObj;
                if ( src && images[src] === undefined ) {
                    img = new Image();
                    if ( src.match(/data:image\/.*;base64,/i) ) {
                        img.src = src.replace(/url\(['"]{0,}|['"]{0,}\)$/ig, '');
                        imageObj = images[src] = {
                            img: img
                        };
                        images.numTotal++;
                        setImageLoadHandlers(img, imageObj);
                    } else if ( isSameOrigin( src ) || options.allowTaint ===  true ) {
                        imageObj = images[src] = {
                            img: img
                        };
                        images.numTotal++;
                        setImageLoadHandlers(img, imageObj);
                        img.src = src;
                    } else if ( supportCORS && !options.allowTaint && options.useCORS ) {
                        // attempt to load with CORS

                        img.crossOrigin = "anonymous";
                        imageObj = images[src] = {
                            img: img
                        };
                        images.numTotal++;
                        setImageLoadHandlers(img, imageObj);
                        img.src = src;
                    } else if ( options.proxy ) {
                        imageObj = images[src] = {
                            img: img
                        };
                        images.numTotal++;
                        proxyGetImage( src, img, imageObj );
                    }
                }

            },
            cleanupDOM: function(cause) {
                var img, src;
                if (!images.cleanupDone) {
                    if (cause && typeof cause === "string") {
                        Util.log("html2canvas: Cleanup because: " + cause);
                    } else {
                        Util.log("html2canvas: Cleanup after timeout: " + options.timeout + " ms.");
                    }

                    for (src in images) {
                        if (images.hasOwnProperty(src)) {
                            img = images[src];
                            if (typeof img === "object" && img.callbackname && img.succeeded === undefined) {
                                // cancel proxy image request
                                window[img.callbackname] = undefined; // to work with IE<9  // NOTE: that the undefined callback property-name still exists on the window object (for IE<9)
                                try {
                                    delete window[img.callbackname];  // for all browser that support this
                                } catch(ex) {}
                                if (img.script && img.script.parentNode) {
                                    img.script.setAttribute("src", "about:blank");  // try to cancel running request
                                    img.script.parentNode.removeChild(img.script);
                                }
                                images.numLoaded++;
                                images.numFailed++;
                                Util.log("html2canvas: Cleaned up failed img: '" + src + "' Steps: " + images.numLoaded + " / " + images.numTotal);
                            }
                        }
                    }

                    // cancel any pending requests
                    if(window.stop !== undefined) {
                        window.stop();
                    } else if(document.execCommand !== undefined) {
                        document.execCommand("Stop", false);
                    }
                    if (document.close !== undefined) {
                        document.close();
                    }
                    images.cleanupDone = true;
                    if (!(cause && typeof cause === "string")) {
                        start();
                    }
                }
            },

            renderingDone: function() {
                if (timeoutTimer) {
                    window.clearTimeout(timeoutTimer);
                }
            }
        };

        if (options.timeout > 0) {
            timeoutTimer = window.setTimeout(methods.cleanupDOM, options.timeout);
        }

        Util.log('html2canvas: Preload starts: finding background-images');
        images.firstRun = true;

        getImages(element);

        Util.log('html2canvas: Preload: Finding images');
        // load <img> images
        for (i = 0; i < imgLen; i+=1){
            methods.loadImage( domImages[i].getAttribute( "src" ) );
        }

        images.firstRun = false;
        Util.log('html2canvas: Preload: Done.');
        if (images.numTotal === images.numLoaded) {
            start();
        }

        return methods;
    };

    _html2canvas.Renderer = function(parseQueue, options){

        // http://www.w3.org/TR/CSS21/zindex.html
        function createRenderQueue(parseQueue) {
            var queue = [],
                rootContext;

            rootContext = (function buildStackingContext(rootNode) {
                var rootContext = {};
                function insert(context, node, specialParent) {
                    var zi = (node.zIndex.zindex === 'auto') ? 0 : Number(node.zIndex.zindex),
                        contextForChildren = context, // the stacking context for children
                        isPositioned = node.zIndex.isPositioned,
                        isFloated = node.zIndex.isFloated,
                        stub = {node: node},
                        childrenDest = specialParent; // where children without z-index should be pushed into

                    if (node.zIndex.ownStacking) {
                        // '!' comes before numbers in sorted array
                        contextForChildren = stub.context = { '!': [{node:node, children: []}]};
                        childrenDest = undefined;
                    } else if (isPositioned || isFloated) {
                        childrenDest = stub.children = [];
                    }

                    if (zi === 0 && specialParent) {
                        specialParent.push(stub);
                    } else {
                        if (!context[zi]) { context[zi] = []; }
                        context[zi].push(stub);
                    }

                    node.zIndex.children.forEach(function(childNode) {
                        insert(contextForChildren, childNode, childrenDest);
                    });
                }
                insert(rootContext, rootNode);
                return rootContext;
            })(parseQueue);

            function sortZ(context) {
                Object.keys(context).sort().forEach(function(zi) {
                    var nonPositioned = [],
                        floated = [],
                        positioned = [],
                        list = [];

                    // positioned after static
                    context[zi].forEach(function(v) {
                        if (v.node.zIndex.isPositioned || v.node.zIndex.opacity < 1) {
                            // http://www.w3.org/TR/css3-color/#transparency
                            // non-positioned element with opactiy < 1 should be stacked as if it were a positioned element with ‘z-index: 0’ and ‘opacity: 1’.
                            positioned.push(v);
                        } else if (v.node.zIndex.isFloated) {
                            floated.push(v);
                        } else {
                            nonPositioned.push(v);
                        }
                    });

                    (function walk(arr) {
                        arr.forEach(function(v) {
                            list.push(v);
                            if (v.children) { walk(v.children); }
                        });
                    })(nonPositioned.concat(floated, positioned));

                    list.forEach(function(v) {
                        if (v.context) {
                            sortZ(v.context);
                        } else {
                            queue.push(v.node);
                        }
                    });
                });
            }

            sortZ(rootContext);

            return queue;
        }

        function getRenderer(rendererName) {
            var renderer;

            if (typeof options.renderer === "string" && _html2canvas.Renderer[rendererName] !== undefined) {
                renderer = _html2canvas.Renderer[rendererName](options);
            } else if (typeof rendererName === "function") {
                renderer = rendererName(options);
            } else {
                throw new Error("Unknown renderer");
            }

            if ( typeof renderer !== "function" ) {
                throw new Error("Invalid renderer defined");
            }
            return renderer;
        }

        return getRenderer(options.renderer)(parseQueue, options, document, createRenderQueue(parseQueue.stack), _html2canvas);
    };

    _html2canvas.Util.Support = function (options, doc) {

        function supportSVGRendering() {
            var img = new Image(),
                canvas = doc.createElement("canvas"),
                ctx = (canvas.getContext === undefined) ? false : canvas.getContext("2d");
            if (ctx === false) {
                return false;
            }
            canvas.width = canvas.height = 10;
            img.src = [
                "data:image/svg+xml,",
                "<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'>",
                "<foreignObject width='10' height='10'>",
                "<div xmlns='http://www.w3.org/1999/xhtml' style='width:10;height:10;'>",
                "sup",
                "</div>",
                "</foreignObject>",
                "</svg>"
            ].join("");
            try {
                ctx.drawImage(img, 0, 0);
                canvas.toDataURL();
            } catch(e) {
                return false;
            }
            _html2canvas.Util.log('html2canvas: Parse: SVG powered rendering available');
            return true;
        }

        // Test whether we can use ranges to measure bounding boxes
        // Opera doesn't provide valid bounds.height/bottom even though it supports the method.

        function supportRangeBounds() {
            var r, testElement, rangeBounds, rangeHeight, support = false;

            if (doc.createRange) {
                r = doc.createRange();
                if (r.getBoundingClientRect) {
                    testElement = doc.createElement('boundtest');
                    testElement.style.height = "123px";
                    testElement.style.display = "block";
                    doc.body.appendChild(testElement);

                    r.selectNode(testElement);
                    rangeBounds = r.getBoundingClientRect();
                    rangeHeight = rangeBounds.height;

                    if (rangeHeight === 123) {
                        support = true;
                    }
                    doc.body.removeChild(testElement);
                }
            }

            return support;
        }

        return {
            rangeBounds: supportRangeBounds(),
            svgRendering: options.svgRendering && supportSVGRendering()
        };
    };
    window.html2canvas = function(elements, opts) {
        elements = (elements.length) ? elements : [elements];
        var queue,
            canvas,
            options = {
                // general
                logging: false,
                elements: elements,
                background: "#fff",

                // preload options
                proxy: null,
                timeout: 0,    // no timeout
                useCORS: false, // try to load images as CORS (where available), before falling back to proxy
                allowTaint: false, // whether to allow images to taint the canvas, won't need proxy if set to true

                // parse options
                svgRendering: false, // use svg powered rendering where available (FF11+)
                ignoreElements: "IFRAME|OBJECT|PARAM",
                useOverflow: true,
                letterRendering: false,
                chinese: false,

                // render options

                width: null,
                height: null,
                taintTest: true, // do a taint test with all images before applying to canvas
                renderer: "Canvas"
            };

        options = _html2canvas.Util.Extend(opts, options);

        _html2canvas.logging = options.logging;
        options.complete = function( images ) {

            if (typeof options.onpreloaded === "function") {
                if ( options.onpreloaded( images ) === false ) {
                    return;
                }
            }
            queue = _html2canvas.Parse( images, options );

            if (typeof options.onparsed === "function") {
                if ( options.onparsed( queue ) === false ) {
                    return;
                }
            }

            canvas = _html2canvas.Renderer( queue, options );

            if (typeof options.onrendered === "function") {
                options.onrendered( canvas );
            }


        };

        // for pages without images, we still want this to be async, i.e. return methods before executing
        window.setTimeout( function(){
            _html2canvas.Preload( options );
        }, 0 );

        return {
            render: function( queue, opts ) {
                return _html2canvas.Renderer( queue, _html2canvas.Util.Extend(opts, options) );
            },
            parse: function( images, opts ) {
                return _html2canvas.Parse( images, _html2canvas.Util.Extend(opts, options) );
            },
            preload: function( opts ) {
                return _html2canvas.Preload( _html2canvas.Util.Extend(opts, options) );
            },
            log: _html2canvas.Util.log
        };
    };

    window.html2canvas.log = _html2canvas.Util.log; // for renderers
    window.html2canvas.Renderer = {
        Canvas: undefined // We are assuming this will be used
    };
    _html2canvas.Renderer.Canvas = function(options) {
        options = options || {};

        var doc = document,
            safeImages = [],
            testCanvas = document.createElement("canvas"),
            testctx = testCanvas.getContext("2d"),
            Util = _html2canvas.Util,
            canvas = options.canvas || doc.createElement('canvas');

        function createShape(ctx, args) {
            ctx.beginPath();
            args.forEach(function(arg) {
                ctx[arg.name].apply(ctx, arg['arguments']);
            });
            ctx.closePath();
        }

        function safeImage(item) {
            if (safeImages.indexOf(item['arguments'][0].src ) === -1) {
                testctx.drawImage(item['arguments'][0], 0, 0);
                try {
                    testctx.getImageData(0, 0, 1, 1);
                } catch(e) {
                    testCanvas = doc.createElement("canvas");
                    testctx = testCanvas.getContext("2d");
                    return false;
                }
                safeImages.push(item['arguments'][0].src);
            }
            return true;
        }

        function renderItem(ctx, item) {
            switch(item.type){
                case "variable":
                    ctx[item.name] = item['arguments'];
                    break;
                case "function":
                    switch(item.name) {
                        case "createPattern":
                            if (item['arguments'][0].width > 0 && item['arguments'][0].height > 0) {
                                try {
                                    ctx.fillStyle = ctx.createPattern(item['arguments'][0], "repeat");
                                }
                                catch(e) {
                                    Util.log("html2canvas: Renderer: Error creating pattern", e.message);
                                }
                            }
                            break;
                        case "drawShape":
                            createShape(ctx, item['arguments']);
                            break;
                        case "drawImage":
                            if (item['arguments'][8] > 0 && item['arguments'][7] > 0) {
                                if (!options.taintTest || (options.taintTest && safeImage(item))) {
                                    ctx.drawImage.apply( ctx, item['arguments'] );
                                }
                            }
                            break;
                        default:
                            ctx[item.name].apply(ctx, item['arguments']);
                    }
                    break;
            }
        }

        return function(parsedData, options, document, queue, _html2canvas) {
            var ctx = canvas.getContext("2d"),
                newCanvas,
                bounds,
                fstyle,
                zStack = parsedData.stack;

            canvas.width = canvas.style.width =  options.width || zStack.ctx.width;
            canvas.height = canvas.style.height = options.height || zStack.ctx.height;

            fstyle = ctx.fillStyle;
            ctx.fillStyle = (Util.isTransparent(zStack.backgroundColor) && options.background !== undefined) ? options.background : parsedData.backgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = fstyle;

            queue.forEach(function(storageContext) {
                // set common settings for canvas
                ctx.textBaseline = "bottom";
                ctx.save();

                if (storageContext.transform.matrix) {
                    ctx.translate(storageContext.transform.origin[0], storageContext.transform.origin[1]);
                    ctx.transform.apply(ctx, storageContext.transform.matrix);
                    ctx.translate(-storageContext.transform.origin[0], -storageContext.transform.origin[1]);
                }

                if (storageContext.clip){
                    ctx.beginPath();
                    ctx.rect(storageContext.clip.left, storageContext.clip.top, storageContext.clip.width, storageContext.clip.height);
                    ctx.clip();
                }

                if (storageContext.ctx.storage) {
                    storageContext.ctx.storage.forEach(function(item) {
                        renderItem(ctx, item);
                    });
                }

                ctx.restore();
            });

            Util.log("html2canvas: Renderer: Canvas renderer done - returning canvas obj");

            if (options.elements.length === 1) {
                if (typeof options.elements[0] === "object" && options.elements[0].nodeName !== "BODY") {
                    // crop image to the bounds of selected (single) element
                    bounds = _html2canvas.Util.Bounds(options.elements[0]);
                    newCanvas = document.createElement('canvas');
                    newCanvas.width = Math.ceil(bounds.width);
                    newCanvas.height = Math.ceil(bounds.height);
                    ctx = newCanvas.getContext("2d");

                    ctx.drawImage(canvas, bounds.left, bounds.top, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
                    canvas = null;
                    return newCanvas;
                }
            }

            return canvas;
        };
    };
})(window,document);
// Slowparse is a token stream parser for HTML and CSS text,
// recording regions of interest during the parse run and
// signaling any errors detected accompanied by relevant
// regions in the text stream, to make debugging easy. Each
// error type is documented in the [error specification][].
//
// Slowparse also builds a DOM as it goes, attaching metadata
// to each node build that points to where it came from in
// the original source.
//
// For more information on the rationale behind Slowparse, as
// well as its design goals, see the [README][].
//
// If [RequireJS] is detected, this file is defined as a module via
// `define()`. Otherwise, a global called `Slowparse` is exposed.
//
// ## Implementation
//
// Slowparse is effectively a finite state machine for
// HTML and CSS strings, and will switch between the HTML
// and CSS parsers while maintaining a single token stream.
//
//   [RequireJS]: http://requirejs.org/
//   [error specification]: spec/
//   [README]: https://github.com/mozilla/slowparse#readme
(function() {
  "use strict";

  // ### Character Entity Parsing
  //
  // We currently only parse the most common named character entities.
  var CHARACTER_ENTITY_REFS = {
    lt: "<",
    gt: ">",
    apos: "'",
    quot: '"',
    amp: "&"
  };

  // HTML attribute parsing rules are based on
  // http://www.w3.org/TR/2011/WD-html5-20110525/elements.html#attr-data
  // -> ref http://www.w3.org/TR/2011/WD-html5-20110525/infrastructure.html#xml-compatible
  //    -> ref http://www.w3.org/TR/REC-xml/#NT-NameChar
  // note: this lacks the final \\u10000-\\uEFFFF in the startchar set, because JavaScript
  //       cannot cope with unciode characters with points over 0xFFFF.
  var attributeNameStartChar = "A-Za-z_\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD";
  var nameStartChar = new RegExp("[" + attributeNameStartChar + "]");
  var attributeNameChar = attributeNameStartChar + "0-9\\-\\.\\u00B7\\u0300-\\u036F\\u203F-\\u2040:";
  var nameChar = new RegExp("[" + attributeNameChar + "]");

  //Define a property checker for https page
  var checkMixedContent = (typeof window !== "undefined" ? (window.location.protocol === "https:") : false);

  //Define activeContent with tag-attribute pairs
  function isActiveContent (tagName, attrName) {
    if (attrName === "href") {
      return ["link"].indexOf(tagName) > -1;
    }
    if (attrName === "src") {
      return ["script", "iframe"].indexOf(tagName) > -1;
    }
    if (attrName === "data") {
      return ["object"].indexOf(tagName) > -1;
    }
    return false;
  }

  // the current active omittable html Element
  var activeTagNode = false;

  // the parent html Element for optional closing tag tags
  var parentTagNode = false;

  // 'foresee' if there is no more content in the parent element, and the
  // parent element is not an a element in the case of activeTag is a p element.
  function isNextTagParent(stream, parentTagName) {
    return stream.findNext(/<\/([\w\-]+)\s*>/, 1) === parentTagName;
  }

  // 'foresee' if the next tag is a close tag
  function isNextCloseTag(stream) {
    return stream.findNext(/<\/([\w\-]+)\s*>/, 1);
  }

  // Check exception for Tag omission rules: for p tag, if there is no more
  // content in the parent element and the parent element is not an a element.
  function allowsOmmitedEndTag(parentTagName, tagName) {
    if (tagName === "p") {
      return ["a"].indexOf(parentTagName) > -1;
    }
    return false;
  }

  // `replaceEntityRefs()` will replace named character entity references
  // (e.g. `&lt;`) in the given text string and return the result. If an
  // entity name is unrecognized, don't replace it at all. Writing HTML
  // would be surprisingly painful without this forgiving behavior.
  //
  // This function does not currently replace numeric character entity
  // references (e.g., `&#160;`).
  function replaceEntityRefs(text) {
    return text.replace(/&([A-Za-z]+);/g, function(ref, name) {
      name = name.toLowerCase();
      if (name in CHARACTER_ENTITY_REFS)
        return CHARACTER_ENTITY_REFS[name];
      return ref;
    });
  }


  // ### Errors
  //
  // `ParseError` is an internal error class used to indicate a parsing error.
  // It never gets seen by Slowparse clients, as parse errors are an
  // expected occurrence. However, they are used internally to simplify
  // flow control.
  //
  // The first argument is the name of an error type, followed by
  // arbitrary positional arguments specific to that error type. Every
  // instance has a `parseInfo` property which contains the error
  // object that will be exposed to Slowparse clients when parsing errors
  // occur.
  function ParseError(type) {
    this.name = "ParseError";
    if (!(type in ParseErrorBuilders))
      throw new Error("Unknown ParseError type: " + type);
    var args = [];
    for (var i = 1; i < arguments.length; i++)
      args.push(arguments[i]);
    var parseInfo = ParseErrorBuilders[type].apply(ParseErrorBuilders, args);

    /* This may seem a weird way of setting an attribute, but we want
     * to make the JSON serialize so the 'type' appears first, as it
     * makes our documentation read better. */
    parseInfo = ParseErrorBuilders._combine({
      type: type
    }, parseInfo);
    this.message = type;
    this.parseInfo = parseInfo;
  }

  ParseError.prototype = Error.prototype;

  // `ParseErrorBuilders` contains Factory functions for all our types of
  // parse errors, indexed by error type.
  //
  // Each public factory function returns a `parseInfo` object, sans the
  // `type` property. For more information on each type of error,
  // see the [error specification][].
  //
  //   [error specification]: spec/
  var ParseErrorBuilders = {
    /* Create a new object that has the properties of both arguments
     * and return it. */
    _combine: function(a, b) {
      var obj = {}, name;
      for (name in a) {
        obj[name] = a[name];
      }
      for (name in b) {
        obj[name] = b[name];
      }
      return obj;
    },
    // These are HTML errors.
    UNCLOSED_TAG: function(parser) {
      var currentNode = parser.domBuilder.currentNode,
          openTag = this._combine({
            name: currentNode.nodeName.toLowerCase()
          }, currentNode.parseInfo.openTag);
      return {
        openTag: openTag,
        cursor: openTag.start
      };
    },
    INVALID_TAG_NAME: function(tagName, token) {
      var openTag = this._combine({
            name: tagName
          }, token.interval);
      return {
        openTag: openTag,
        cursor: openTag.start
      };
    },
    SCRIPT_ELEMENT_NOT_ALLOWED: function(tagName, token) {
      var openTag = this._combine({
            name: tagName
          }, token.interval);
      return {
        openTag: openTag,
        cursor: openTag.start
      };
    },
    ELEMENT_NOT_ALLOWED: function(tagName, token) {
      var openTag = this._combine({
            name: tagName
          }, token.interval);
      return {
        openTag: openTag,
        cursor: openTag.start
      };
    },
    UNEXPECTED_CLOSE_TAG: function(parser, closeTagName, token) {
      var closeTag = this._combine({
            name: closeTagName
          }, token.interval);
      return {
        closeTag: closeTag,
        cursor: closeTag.start
      };
    },
    MISMATCHED_CLOSE_TAG: function(parser, openTagName, closeTagName, token) {
      var openTag = this._combine({
            name: openTagName
          }, parser.domBuilder.currentNode.parseInfo.openTag),
          closeTag = this._combine({
            name: closeTagName
          }, token.interval);
      return {
        openTag: openTag,
        closeTag: closeTag,
        cursor: closeTag.start
      };
    },
    ATTRIBUTE_IN_CLOSING_TAG: function(parser) {
      var currentNode = parser.domBuilder.currentNode;
      var end = parser.stream.pos;
      if (!parser.stream.end()) {
        end = parser.stream.makeToken().interval.start;
      }
      var closeTag = {
        name: currentNode.nodeName.toLowerCase(),
        start: currentNode.parseInfo.closeTag.start,
        end: end
      };
      return {
        closeTag: closeTag,
        cursor: closeTag.start
      };
    },
    CLOSE_TAG_FOR_VOID_ELEMENT: function(parser, closeTagName, token) {
      var closeTag = this._combine({
            name: closeTagName
          }, token.interval);
      return {
        closeTag: closeTag,
        cursor: closeTag.start
      };
    },
    UNTERMINATED_COMMENT: function(token) {
      var commentStart = token.interval.start;
      return {
        start: commentStart,
        cursor: commentStart
      };
    },
    UNTERMINATED_ATTR_VALUE: function(parser, nameTok) {
      var currentNode = parser.domBuilder.currentNode,
          openTag = this._combine({
            name: currentNode.nodeName.toLowerCase()
          }, currentNode.parseInfo.openTag),
          valueTok = parser.stream.makeToken(),
          attribute = {
            name: {
              value: nameTok.value,
              start: nameTok.interval.start,
              end: nameTok.interval.end
            },
            value: {
              start: valueTok.interval.start
            }
          };
      return {
        openTag: openTag,
        attribute: attribute,
        cursor: attribute.value.start
      };
    },
    UNQUOTED_ATTR_VALUE: function(parser) {
      var pos = parser.stream.pos;
      if (!parser.stream.end()) {
        pos = parser.stream.makeToken().interval.start;
      }
      return {
        start: pos,
        cursor: pos
      };
    },
    INVALID_ATTR_NAME: function(parser, attrToken) {
      return {
        start: attrToken.interval.start,
        end: attrToken.interval.end,
        attribute: {
          name: {
            value: attrToken.value
          }
        },
        cursor: attrToken.interval.start
      };
    },
    EVENT_HANDLER_ATTR_NOT_ALLOWED: function(parser, attrToken) {
      return {
        start: attrToken.interval.start,
        end: attrToken.interval.end,
        attribute: {
          name: {
            value: attrToken.value
          }
        },
        cursor: attrToken.interval.start
      };
    },
    JAVASCRIPT_URL_NOT_ALLOWED: function(parser, nameTok, valueTok) {
      var currentNode = parser.domBuilder.currentNode,
          openTag = this._combine({
            name: currentNode.nodeName.toLowerCase()
          }, currentNode.parseInfo.openTag),
          attribute = {
            name: {
              value: nameTok.value,
              start: nameTok.interval.start,
              end: nameTok.interval.end
            },
            value: {
              start: valueTok.interval.start + 1,
              end: valueTok.interval.end - 1
            }
          };
      return {
        openTag: openTag,
        attribute: attribute,
        cursor: attribute.value.start
      };
    },
    MULTIPLE_ATTR_NAMESPACES: function(parser, attrToken) {
      return {
        start: attrToken.interval.start,
        end: attrToken.interval.end,
        attribute: {
          name: {
            value: attrToken.value
          }
        },
        cursor: attrToken.interval.start
      };
    },
    UNSUPPORTED_ATTR_NAMESPACE: function(parser, attrToken) {
      return {
        start: attrToken.interval.start,
        end: attrToken.interval.end,
        attribute: {
          name: {
            value: attrToken.value
          }
        },
        cursor: attrToken.interval.start
      };
    },
    UNTERMINATED_OPEN_TAG: function(parser) {
      var currentNode = parser.domBuilder.currentNode,
          openTag = {
            start: currentNode.parseInfo.openTag.start,
            end: parser.stream.pos,
            name: currentNode.nodeName.toLowerCase()
          };
      return {
        openTag: openTag,
        cursor: openTag.start
      };
    },
    SELF_CLOSING_NON_VOID_ELEMENT: function(parser, tagName) {
      var start = parser.domBuilder.currentNode.parseInfo.openTag.start,
          end = parser.stream.makeToken().interval.end;
      return {
        name: tagName,
        start: start,
        end: end,
        cursor: start
      };
    },
    UNTERMINATED_CLOSE_TAG: function(parser) {
      var currentNode = parser.domBuilder.currentNode;
      var end = parser.stream.pos;
      if (!parser.stream.end()) {
        end = parser.stream.makeToken().interval.start;
      }
      var closeTag = {
            name: currentNode.nodeName.toLowerCase(),
            start: currentNode.parseInfo.closeTag.start,
            end: end
          };
      return {
        closeTag: closeTag,
        cursor: closeTag.start
      };
    },
    //Special error type for a http link does not work in a https page
    HTTP_LINK_FROM_HTTPS_PAGE: function(parser, nameTok, valueTok) {
      var currentNode = parser.domBuilder.currentNode,
          openTag = this._combine({
            name: currentNode.nodeName.toLowerCase()
          }, currentNode.parseInfo.openTag),
          attribute = {
            name: {
              value: nameTok.value,
              start: nameTok.interval.start,
              end: nameTok.interval.end
            },
            value: {
              start: valueTok.interval.start + 1,
              end: valueTok.interval.end - 1
            }
          };
      return {
        openTag: openTag,
        attribute: attribute,
        cursor: attribute.value.start
      };
    },
    // These are CSS errors.
    UNKOWN_CSS_KEYWORD: function(parser, start, end, value) {
      return {
        cssKeyword: {
          start: start,
          end: end,
          value: value
        },
        cursor: start
      };
    },
    MISSING_CSS_SELECTOR: function(parser, start, end) {
      return {
        cssBlock: {
          start: start,
          end: end
        },
        cursor: start
      };
    },
    UNFINISHED_CSS_SELECTOR: function(parser, start, end, selector) {
      return {
        cssSelector: {
          start: start,
          end: end,
          selector: selector
        },
        cursor: start
      };
    },
    MISSING_CSS_BLOCK_OPENER: function(parser, start, end, selector) {
      return {
        cssSelector: {
          start: start,
          end: end,
          selector: selector
        },
        cursor: start
      };
    },
    INVALID_CSS_PROPERTY_NAME: function(parser, start, end, property) {
      return {
        cssProperty: {
          start: start,
          end: end,
          property: property
        },
        cursor: start
      };
    },
    MISSING_CSS_PROPERTY: function(parser, start, end, selector) {
      return {
        cssSelector: {
          start: start,
          end: end,
          selector: selector
        },
        cursor: start
      };
    },
    UNFINISHED_CSS_PROPERTY: function(parser, start, end, property) {
      return {
        cssProperty: {
          start: start,
          end: end,
          property: property
        },
        cursor: start
      };
    },
    MISSING_CSS_VALUE: function(parser, start, end, property) {
      return {
        cssProperty: {
          start: start,
          end: end,
          property: property
        },
        cursor: start
      };
    },
    UNFINISHED_CSS_VALUE: function(parser, start, end, value) {
      return {
        cssValue: {
          start: start,
          end: end,
          value: value
        },
        cursor: start
      };
    },
    CSS_MIXED_ACTIVECONTENT: function(parser, property, propertyStart, value, valueStart, valueEnd) {
      var cssProperty = {
            property: property,
            start: propertyStart,
            end: propertyStart + property.length
          },
          cssValue = {
            value: value,
            start: valueStart,
            end: valueEnd
          };
      return {
        cssProperty: cssProperty,
        cssValue: cssValue,
        cursor: cssValue.start
      };
    },
    MISSING_CSS_BLOCK_CLOSER: function(parser, start, end, value) {
      return {
        cssValue: {
          start: start,
          end: end,
          value: value
        },
        cursor: start
      };
    },
    UNCAUGHT_CSS_PARSE_ERROR: function(parser, start, end, msg) {
      return {
        error: {
          start: start,
          end: end,
          msg: msg
        },
        cursor: start
      };
    },
    UNTERMINATED_CSS_COMMENT: function(start) {
      return {
        start: start,
        cursor: start
      };
    },
    HTML_CODE_IN_CSS_BLOCK: function(parser, start, end) {
      return {
        html: {
          start: start,
          end: end
        },
        cursor: start
      };
    }
  };

  // ### Streams
  //
  // `Stream` is an internal class used for tokenization. The interface for
  // this class is inspired by the analogous class in [CodeMirror][].
  //
  //   [CodeMirror]: http://codemirror.net/doc/manual.html#modeapi
  function Stream(text) {
    this.text = text;
    this.pos = 0;
    this.tokenStart = 0;
  }

  Stream.prototype = {
    // `Stream.peek()` returns the next character in the stream without
    // advancing it. It will return `undefined` at the end of the text.
    peek: function() {
      return this.text[this.pos];
    },
    // `Stream.substream(len)` returns a substream from the stream
    // without advancing it, with length `len`.
    substream: function(len) {
      return this.text.substring(this.pos, this.pos + len);
    },
    // `Stream.next()` returns the next character in the stream and advances
    // it. It also returns `undefined` when no more characters are available.
    next: function() {
      if (!this.end())
        return this.text[this.pos++];
    },
    // `Stream.rewind()` rewinds the stream position by X places.
    rewind: function(x) {
      this.pos -= x;
      if (this.pos < 0) {
        this.pos = 0;
      }
    },
    // `Stream.end()` returns true only if the stream is at the end of the
    // text.
    end: function() {
      return (this.pos == this.text.length);
    },
    // `Stream.eat()` takes a regular expression. If the next character in
    // the stream matches the given argument, it is consumed and returned.
    // Otherwise, `undefined` is returned.
    eat: function(match) {
      if (!this.end() && this.peek().match(match))
        return this.next();
    },
    // `Stream.eatWhile()` repeatedly calls `eat()` with the given argument,
    // until it fails. Returns `true` if any characters were eaten.
    eatWhile: function(matcher) {
      var wereAnyEaten = false;
      while (!this.end()) {
        if (this.eat(matcher))
          wereAnyEaten = true;
        else
          return wereAnyEaten;
      }
    },
    // `Stream.eatSpace()` is a shortcut for `eatWhile()` when matching
    // white-space (including newlines).
    eatSpace: function() {
      return this.eatWhile(/[\s\n]/);
    },
    // `Stream.eatCSSWhile()` is like `eatWhile()`, but it
    // automatically deals with eating block comments like `/* foo */`.
    eatCSSWhile: function(matcher) {
      var wereAnyEaten = false,
          chr = '',
          peek = '',
          next = '';
      while (!this.end()) {
        chr = this.eat(matcher);
        if (chr)
          wereAnyEaten = true;
        else
          return wereAnyEaten;
        if (chr === '/') {
          peek = this.peek();
          if (peek === '*') {
            /* Block comment found. Gobble until resolved. */
            while(next !== '/' && !this.end()) {
              this.eatWhile(/[^*]/);
              this.next();
              next = this.next();
            }
            next = '';
          }
        }
      }
    },
    // `Stream.markTokenStart()` will set the start for the next token to
    // the current stream position (i.e., "where we are now").
    markTokenStart: function() {
      this.tokenStart = this.pos;
    },
    // `Stream.markTokenStartAfterSpace()` is a wrapper function for eating
    // up space, then marking the start for a new token.
    markTokenStartAfterSpace: function() {
      this.eatSpace();
      this.markTokenStart();
    },
    // `Stream.makeToken()` generates a JSON-serializable token object
    // representing the interval of text between the end of the last
    // generated token and the current stream position.
    makeToken: function() {
      if (this.pos == this.tokenStart)
        return null;
      var token = {
        value: this.text.slice(this.tokenStart, this.pos),
        interval: {
          start: this.tokenStart,
          end: this.pos
        }
      };
      this.tokenStart = this.pos;
      return token;
    },
    // `Stream.match()` acts like a multi-character eat—if *consume* is `true`
    // or not given—or a look-ahead that doesn't update the stream
    // position—if it is `false`. *string* must be a string. *caseFold* can
    // be set to `true` to make the match case-insensitive.
    match: function(string, consume, caseFold) {
      var substring = this.text.slice(this.pos, this.pos + string.length);
      if (caseFold) {
        string = string.toLowerCase();
        substring = substring.toLowerCase();
      }
      if (string == substring) {
        if (consume)
          this.pos += string.length;
        return true;
      }
      return false;
    },
    // `Stream.findNext()` is a look-ahead match that doesn't update the stream position
    // by a given regular expression
    findNext: function(pattern, groupNumber) {
      var currentPos = this.pos;
      this.eatWhile(/[^>]/);
      this.next();
      var nextPos = this.pos;
      this.pos = currentPos;
      var token = this.substream(nextPos - currentPos);
      var captureGroups = token.match(pattern);
      this.pos = currentPos;
      if(captureGroups) {
        return captureGroups[groupNumber];
      }
      return false;
    }
  };


  // ### CSS Parsing
  //
  // `CSSParser` is our internal CSS token stream parser object. This object
  // has references to the stream, as well as the HTML DOM builder that is
  // used by the HTML parser.
  function CSSParser(stream, domBuilder, warnings) {
    this.stream = stream;
    this.domBuilder = domBuilder;
    this.warnings = warnings;
  }

  CSSParser.prototype = {
    // We keep a list of all currently valid CSS properties (CSS1-CSS3).
    // This list does not contain vendor prefixes.
    cssProperties: [
      "alignment-adjust","alignment-baseline","animation","animation-delay",
      "animation-direction","animation-duration","animation-iteration-count",
      "animation-name","animation-play-state","animation-timing-function",
      "appearance","azimuth","backface-visibility","background",
      "background-attachment","background-clip","background-color",
      "background-image","background-origin","background-position",
      "background-repeat","background-size","baseline-shift","binding",
      "bleed","bookmark-label","bookmark-level","bookmark-state",
      "bookmark-target","border","border-bottom","border-bottom-color",
      "border-bottom-left-radius","border-bottom-right-radius",
      "border-bottom-style","border-bottom-width","border-collapse",
      "border-color","border-image","border-image-outset",
      "border-image-repeat","border-image-slice","border-image-source",
      "border-image-width","border-left","border-left-color",
      "border-left-style","border-left-width","border-radius","border-right",
      "border-right-color","border-right-style","border-right-width",
      "border-spacing","border-style","border-top","border-top-color",
      "border-top-left-radius","border-top-right-radius","border-top-style",
      "border-top-width","border-width","bottom","box-decoration-break",
      "box-shadow","box-sizing","break-after","break-before","break-inside",
      "caption-side","clear","clip","color","color-profile","column-count",
      "column-fill","column-gap","column-rule","column-rule-color",
      "column-rule-style","column-rule-width","column-span","column-width",
      "columns","content","counter-increment","counter-reset","crop","cue",
      "cue-after","cue-before","cursor","direction","display",
      "dominant-baseline","drop-initial-after-adjust",
      "drop-initial-after-align","drop-initial-before-adjust",
      "drop-initial-before-align","drop-initial-size","drop-initial-value",
      "elevation","empty-cells","filter","fit","fit-position","flex-align",
      "flex-flow","flex-line-pack","flex-order","flex-pack","float","float-offset",
      "font","font-family","font-size","font-size-adjust","font-stretch",
      "font-style","font-variant","font-weight","grid-columns","grid-rows",
      "hanging-punctuation","height","hyphenate-after","hyphenate-before",
      "hyphenate-character","hyphenate-lines","hyphenate-resource","hyphens",
      "icon","image-orientation","image-rendering","image-resolution",
      "inline-box-align","left","letter-spacing","line-break","line-height",
      "line-stacking","line-stacking-ruby","line-stacking-shift",
      "line-stacking-strategy","list-style","list-style-image",
      "list-style-position","list-style-type","margin","margin-bottom",
      "margin-left","margin-right","margin-top","marker-offset","marks",
      "marquee-direction","marquee-loop","marquee-play-count","marquee-speed",
      "marquee-style","max-height","max-width","min-height","min-width",
      "move-to","nav-down","nav-index","nav-left","nav-right","nav-up",
      "opacity","orphans","outline","outline-color","outline-offset",
      "outline-style","outline-width","overflow","overflow-style",
      "overflow-wrap","overflow-x","overflow-y","padding","padding-bottom",
      "padding-left","padding-right","padding-top","page","page-break-after",
      "page-break-before","page-break-inside","page-policy","pause",
      "pause-after","pause-before","perspective","perspective-origin",
      "phonemes","pitch","pitch-range","play-during","pointer-events",
      "position",
      "presentation-level","punctuation-trim","quotes","rendering-intent",
      "resize","rest","rest-after","rest-before","richness","right",
      "rotation","rotation-point","ruby-align","ruby-overhang",
      "ruby-position","ruby-span","src","size","speak","speak-header",
      "speak-numeral","speak-punctuation","speech-rate","stress","string-set",
      "tab-size","table-layout","target","target-name","target-new",
      "target-position","text-align","text-align-last","text-decoration",
      "text-decoration-color","text-decoration-line","text-decoration-skip",
      "text-decoration-style","text-emphasis","text-emphasis-color",
      "text-emphasis-position","text-emphasis-style","text-height",
      "text-indent","text-justify","text-outline","text-shadow",
      "text-space-collapse","text-transform","text-underline-position",
      "text-wrap","top","transform","transform-origin","transform-style",
      "transition","transition-delay","transition-duration",
      "transition-property","transition-timing-function","unicode-bidi",
      "vertical-align","visibility","voice-balance","voice-duration",
      "voice-family","voice-pitch","voice-pitch-range","voice-rate",
      "voice-stress","voice-volume","volume","white-space","widows","width",
      "word-break","word-spacing","word-wrap","z-index",
      // flexbox:
      "align-content", "align-items", "align-self", "flex", "flex-basis",
      "flex-direction", "flex-flow", "flex-grow", "flex-shrink", "flex-wrap",
      "justify-content"],

    // This helper verifies that a specific string is a known CSS property.
    // We include vendor-prefixed known CSS properties, like `-o-transition`.
    _knownCSSProperty: function(propertyName) {
      propertyName = propertyName.replace(/^-.+?-/,'');
      return this.cssProperties.indexOf(propertyName) > -1;
    },
    // #### The CSS Master Parse Function
    //
    // Here we process the token stream, assumed to have its pointer inside a
    // CSS element, and will try to parse the content inside it as CSS until
    // we hit the end of the CSS element.
    //
    // Any parse errors along the way will result in a `ParseError`
    // being thrown.
    parse: function() {
      // We'll use some instance variables to keep track of our parse
      // state:

      // * A list of the CSS rulesets for the CSS block.
      this.rules = [];

      // * A list of comment blocks inside the CSS.
      this.comments = [];

      // Parsing is based on finite states, and a call
      // to `_parseBlockType()` will run through any number
      // of states until it either throws an error,
      // or terminates cleanly.
      var sliceStart = this.stream.pos;
      this.stream.markTokenStartAfterSpace();
      this._parseBlockType();
      var sliceEnd = this.stream.pos;

      // If we get here, the CSS block has no errors,
      // and we report the start/end of the CSS block
      // in the stream, as well as the rules/comments
      // for the calling `HTMLparser` instance to work with.
      var cssBlock = {
        value: this.stream.text.slice(sliceStart, sliceEnd),
        parseInfo: {
          start: sliceStart,
          end: sliceEnd,
          rules: this.rules,
          comments: this.comments
        }
      };

      this.rules = null;
      this.comments = null;
      return cssBlock;
    },
    // #### CSS Comment Parsing
    //
    // Here we record the position of comments in *term* in the instance's
    // comment list, and return *term* with all its comments stripped.
    stripComments: function(term, startPos) {
      var pos,
          last = term.length,
          commentStart, commentEnd,
          prev, next,
          stripped = "";
      for (pos=0; pos < last; pos++) {
        if (term[pos] === '/' && pos<last-1 && term[pos+1] === '*') {
          commentStart = startPos + pos;
          pos += 3;
          while(pos < last-1 && term.substr(pos-1,2) !== "*/") {
            pos++;
          }
          if (pos >= last-1 && term.substr(pos-1,2) !== "*/")
            throw new ParseError("UNTERMINATED_CSS_COMMENT", commentStart);
          commentEnd = startPos + pos + 1;
          this.comments.push({start: commentStart, end: commentEnd});
        } else {
          stripped += term[pos];
        }
      }
      return stripped.trim();
    },
    // #### CSS Comment Filtering
    //
    // Here we filter a token so that its start and end positions
    // point to the content without leading and trailing comments,
    // with comments in the token.value completely removed.
    filterComments: function(token) {
      var text = token.value,
          tsize = text.length,
          ntsize,
          stripped = this.stripComments(text, token.interval.start);
      // strip leading comments
      text = text.replace(/^\s+/,"");
      text = text.replace(/^\/\*[\w\W]*?\*\/\s*/,'');
      ntsize = text.length;
      token.interval.start += tsize - ntsize;
      // strip trailing comments (=reverse and repeat previous)
      tsize = ntsize;
      text = text.split('').reverse().join('');
      text = text.replace(/^\s+/,"");
      text = text.replace(/^\/\*[\w\W]*?\*\/\s*/,'');
      // FIXME: this still fails comments like this: /* ... /* ... */,
      //        which is a single block. The problems is that in the
      //        reversed string this looks like /* ... */ ... */ which
      //        counts as one block plus left-over junk.
      ntsize = text.length;
      token.interval.end -= tsize - ntsize;
      // commit text change
      token.value = stripped;
    },
    _parseBlockType: function() {
      // Depending on our state, we may be coming from having just parsed
      // a rule. If that's the case, add it to our list of rules.
      if (this.currentRule) {
        this.rules.push(this.currentRule);
        this.currentRule = null;
      }

      this.stream.markTokenStartAfterSpace();

      // are we looking at an @block?
      if (this.stream.peek() === "@") {
        this.stream.eatCSSWhile(/[^\{]/);
        var token = this.stream.makeToken(),
            name = token.value.trim();

        // we currently support @keyframes (with prefixes)
        if(name.match(/@(-[^-]+-)?keyframes/)) {
          this.stream.next();
          return this._parseSelector();
        }

        // and media queries
        if(name.match(/@media\s*\([^{)]+\)/)) {
          this.stream.next();
          return this._parseSelector();
        }

        // and @font-face
        if(name === "@font-face") {
          this.stream.rewind(token.value.length);
          this.stream.markTokenStart();
          return this._parseSelector();
        }

        // anything else is completely unknown
        throw new ParseError("UNKOWN_CSS_KEYWORD", this, token.interval.start, token.interval.end, name);
      }

      this._parseSelector();
    },
    // #### CSS Selector Parsing
    //
    // A selector is a string, and terminates on `{`, which signals
    // the start of a CSS property/value pair (which may be empty).
    //
    // There are a few characters in selectors that are an immediate error:
    //
    // * `;`  Rule terminator (ERROR: missing block opener)
    // * `}`  End of css block (ERROR: missing block opener)
    // * `<`  End of `<style>` element, start of `</style>`
    //   (ERROR: css declaration has no body)
    //
    // Note that we cannot flag `:` as an error because pseudo-classes use
    // it as their prefix.
    _parseSelector: function() {
      // Gobble all characters that could be part of the selector.
      this.stream.eatCSSWhile(/[^\{;\}<]/);
      var token = this.stream.makeToken(),
          peek = this.stream.peek();

      // if we encounter } we're actually inside a block, like
      // @keyframes or the like, and need to try for a new block.
      if (peek === "}") {
        this.stream.next();
        return this._parseBlockType();
      }

      // If there was nothing to select, we're either done,
      // or an error occurred.
      if (token === null) {
        if (!this.stream.end() && this.stream.peek() === '<') {
          // if this is the start of <!-- make sure to throw an error
          if (this.stream.substream(2) !== "</") {
            throw new ParseError("HTML_CODE_IN_CSS_BLOCK", this, this.stream.pos-1, this.stream.pos);
          }
          return;
        }
        throw new ParseError("MISSING_CSS_SELECTOR", this, this.stream.pos-1, this.stream.pos);
      }

      // If we get here, we have a selector string.
      // Filter the token for comments before continueing.
      this.filterComments(token);
      var selector = token.value,
          selectorStart = token.interval.start,
          selectorEnd = token.interval.end;

      if (selector === '') {
        this._parseBlockType();
        return;
      }

      // Now we'll set up a ruleset object for this selector.
      this.currentRule = {
        selector: {
          value: selector,
          start: selectorStart,
          end: selectorEnd
        },
        declarations: {
          start: null,
          end: null,
          properties: []
        }
      };

      // Now we start to analyse whether we can continue,
      // or whether we're in a terminal state, based on the
      // next character in the stream.
      if (this.stream.end() || peek === '<') {
        throw new ParseError("UNFINISHED_CSS_SELECTOR", this, selectorStart, selectorEnd, selector);
      }

      if (!this.stream.end()) {
        var next = this.stream.next(),
            errorMsg = "[_parseBlockType] Expected {, }, ; or :, instead found " + next;
        if (next === '{') {
          // The only legal continuation after a selector is the opening
          // `{` character. If that's the character we see, we can mark the
          // start of the declarations block and start parsing them.
          this.currentRule.declarations.start = this.stream.pos-1;
          this._parseDeclaration(selector, selectorStart);
        } else if (next === ';' || next === '}') {
          // Otherwise, this is a parse error; we should have seen `{`
          // instead.
          throw new ParseError("MISSING_CSS_BLOCK_OPENER", this, selectorStart, selectorEnd, selector);
        } else {
          // We get here if an unexpected character was found.
          throw new ParseError("UNCAUGHT_CSS_PARSE_ERROR", this, token.interval.start, token.interval.end, errorMsg);
        }
      } else {
        // If the stream ended after the selector, we want the user to follow
        // up with `{`.
        throw new ParseError("MISSING_CSS_BLOCK_OPENER", this, selectorStart, selectorEnd, selector);
      }
    },
    // #### CSS Declaration Parsing
    //
    // A declaration is a `property: value;` pair. It can be empty,
    // in which case the next character must be `}`.
    _parseDeclaration: function(selector, selectorStart, value) {
      // First, we forward the stream to the next non-space character.
      this.stream.markTokenStartAfterSpace();
      var peek = this.stream.peek();
      if (peek === '}') {
        // If the next character is `}` then this is an empty block, and we
        // should move on to trying to read a new selector ruleset.
        this.stream.next();
        this.currentRule.declarations.end = this.stream.pos;
        this.stream.markTokenStartAfterSpace();
        this._parseBlockType();
      }
      // Administratively important: there are two ways for this function
      // to have been called. One is from `_parseBlockType()`, which is
      // "the normal way", the other from `_parseValue()`, after finding a
      // properly closed `property:value;` pair. In this case *value* will be
      // the last declaration's value, which will let us throw a sensible
      // debug error in case the stream is empty at this point, or points to
      // `</style>`.
      else if (value && (this.stream.end() || peek === '<')) {
        throw new ParseError("MISSING_CSS_BLOCK_CLOSER", this, selectorStart, selectorStart+value.length, value);
      }

      // If we're still in this function at this point, all is well
      // and we can move on to property parsing.
      else {
        this._parseProperty(selector, selectorStart);
      }
    },
    // #### CSS Property Parsing
    // There is a fixed list of CSS properties, and we must check two things:
    //
    // 1. Does the token string contain a syntax-legal property?
    // 2. Is that property in the set of known ones?
    //
    // Properties are terminated by `:`, but we might also see the following
    // characters, which should signal an error:
    //
    // * `;` rule terminator (ERROR: missing value)
    // * `}` end of CSS block (ERROR: missing value)
    // * `<` end of `<style>` element, start of `</style>`
    //   (ERROR: missing value)
    _parseProperty: function(selector, selectorStart) {
      this.stream.eatCSSWhile(/[^\{\}<;:]/);
      var token = this.stream.makeToken();

      if (token === null) {
        throw new ParseError("MISSING_CSS_PROPERTY", this, selectorStart, selectorStart + selector.length, selector);
      }

      this.filterComments(token);
      var property = token.value,
          propertyStart = token.interval.start,
          propertyEnd = token.interval.end;

      if (property === '') {
        this._parseDeclaration(selector, selectorStart);
        return;
      }

      var next = this.stream.next(),
          errorMsg = "[_parseProperty] Expected }, {, <, ; or :, instead found " + next;

      if (next === '{') {
        throw new ParseError("MISSING_CSS_BLOCK_CLOSER", this, selectorStart, propertyStart, selector);
      }


      if ((this.stream.end() && next !== ':') || next === '<' ||
          next === '}') {
        throw new ParseError("UNFINISHED_CSS_PROPERTY", this, propertyStart, propertyEnd, property);
      }

      // We record `property: value` pairs as we run through the stream,
      // which are added to the set of `property: value` pairs in the
      // instance's `rules.properties` array. The push happens when we have a
      // clean run in `_parseValue()`.
      this.currentProperty = {
        name: {
          value: property,
          start: propertyStart,
          end: propertyEnd
        }
      };

      // If we find a colon, we have a property and now need a value to go
      // along with it.
      if (next === ':') {
        // Before we continue, we must make sure the string we found is a real
        // CSS property.
        if (!( property && property.match(/^[a-z\-]+$/)) || !this._knownCSSProperty(property)) {
          throw new ParseError("INVALID_CSS_PROPERTY_NAME", this, propertyStart, propertyEnd, property);
        }
        this.stream.markTokenStartAfterSpace();
        this._parseValue(selector, selectorStart, property, propertyStart);
      }
      // Otherwise, anything else at this point constitutes an error.
      else if (next === ';') {
        throw new ParseError("MISSING_CSS_VALUE", this, propertyStart, propertyEnd, property);
      }
      else {
        throw new ParseError("UNCAUGHT_CSS_PARSE_ERROR", this, token.interval.start, token.interval.end, errorMsg);
      }
    },
    // #### CSS Value Parsing
    //
    // A value must end either in `;` or in `}`. However, we may also find:
    //
    // * `<` end of `<style>` element, start of `</style>`
    //   (ERROR: missing block closer)
    _parseValue: function(selector, selectorStart, property, propertyStart) {
      var rule = this.stream.eatCSSWhile(/[^}<;]/),
          token = this.stream.makeToken();

      if(token === null) {
        throw new ParseError("MISSING_CSS_VALUE", this, propertyStart, propertyStart+property.length, property);
      }

      var next = (!this.stream.end() ? this.stream.next() : "end of stream"),
          errorMsg = "[_parseValue] Expected }, <, or ;, instead found "+next;

      this.filterComments(token);
      var value = token.value,
          valueStart = token.interval.start,
          valueEnd = token.interval.end;

      if (value === '') {
        throw new ParseError("MISSING_CSS_VALUE", this, this.stream.pos-1, this.stream.pos);
      }

      // At this point we can fill in the *value* part of the current
      // `property: value;` pair. However, we hold off binding it until
      // we are sure there are no parse errors.
      this.currentProperty.value = {
        value: value,
        start: valueStart,
        end: valueEnd
      };

      if ((this.stream.end() && next !== ';') || next === '<') {
        throw new ParseError("UNFINISHED_CSS_VALUE", this, valueStart,
                             valueEnd, value);
      }
      //Add a new validator to check if there is mixed active content in css value
      if (checkMixedContent && value.match(/,?\s*url\(\s*['"]?http:\/\/.+\)/)) {
        valueStart = valueStart + value.indexOf('url');
        this.warnings.push(
          new ParseError("CSS_MIXED_ACTIVECONTENT", this, property, propertyStart, value, valueStart, valueEnd)
        );
      }
      if (next === ';') {
        // This is normal CSS rule termination; try to read a new
        // property/value pair.
        this._bindCurrentRule();
        this.stream.markTokenStartAfterSpace();
        this._parseDeclaration(selector, valueStart, value);
      }
      else if (next === '}') {
        // This is block level termination; try to read a new selector.
        this.currentRule.declarations.end = this.stream.pos;
        this._bindCurrentRule();
        this.stream.markTokenStartAfterSpace();
        this._parseBlockType();
      }
      else {
        throw new ParseError("UNCAUGHT_CSS_PARSE_ERROR", this, token.interval.start, token.interval.end, errorMsg);
      }
    },
    // This helper function binds the currrent `property: value` object
    // in the current ruleset, and resets it for the next selector block.
    _bindCurrentRule: function() {
      this.currentRule.declarations.properties.push(this.currentProperty);
      this.currentProperty = null;
    }
  };


  // ### HTML Parsing
  //
  // The HTML token stream parser object has references to the stream,
  // as well as a DOM builder that is used to construct the DOM while we
  // run through the token stream.
  function HTMLParser(stream, domBuilder, options) {
    this.options = options || {};
    this.warnings = [];
    this.stream = stream;
    this.domBuilder = domBuilder;
    this.cssParser = new CSSParser(stream, domBuilder, this.warnings);
  }

  HTMLParser.prototype = {
    // since SVG requires a slightly different code path,
    // we need to track whether we're in HTML or SVG mode.
    parsingSVG: false,

    // For SVG DOM elements, we need to know the SVG namespace.
    svgNameSpace: "http://www.w3.org/2000/svg",

    // HTML5 documents have a special doctype that we must use
    html5Doctype: "<!DOCTYPE html>",

    // Void HTML elements are the ones that don't need to have a closing tag.
    voidHtmlElements: ["area", "base", "br", "col", "command", "embed", "hr",
                       "img", "input", "keygen", "link", "meta", "param",
                       "source", "track", "wbr"],

    // Tag Omission Rules, based on the rules on optional tags as outlined in
    // http://www.w3.org/TR/html5/syntax.html#optional-tags

    // HTML elements that with omittable close tag
    omittableCloseTagHtmlElements: ["p", "li", "td", "th"],

    // HTML elements that paired with omittable close tag list
    omittableCloseTags: {
      "p": ["address", "article", "aside", "blockquote", "dir", "div", "dl",
            "fieldset", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6",
            "header", "hgroup", "hr", "main", "nav", "ol", "p", "pre",
            "section", "table", "ul"],
      "th": ["th", "td"],
      "td": ["th", "td"],
      "li": ["li"]
    },

    // We keep a list of all valid HTML5 elements.
    htmlElements: ["a", "abbr", "address", "area", "article", "aside",
                   "audio", "b", "base", "bdi", "bdo", "bgsound", "blink",
                   "blockquote", "body", "br", "button", "canvas", "caption",
                   "cite", "code", "col", "colgroup", "command", "datalist",
                   "dd", "del", "details", "dfn", "div", "dl", "dt", "em",
                   "embed", "fieldset", "figcaption", "figure", "footer",
                   "form", "frame", "frameset", "h1", "h2", "h3", "h4", "h5",
                   "h6", "head", "header", "hgroup", "hr", "html", "i",
                   "iframe", "img", "input", "ins", "kbd", "keygen", "label",
                   "legend", "li", "link", "main", "map", "mark", "marquee", "menu",
                   "meta", "meter", "nav", "nobr", "noscript", "object", "ol",
                   "optgroup", "option", "output", "p", "param", "pre",
                   "progress", "q", "rp", "rt", "ruby", "samp", "script",
                   "section", "select", "small", "source", "spacer", "span",
                   "strong", "style", "sub", "summary", "sup", "svg", "table",
                   "tbody", "td", "textarea", "tfoot", "th", "thead", "time",
                   "title", "tr", "track", "u", "ul", "var", "video", "wbr"],

    // HTML5 allows SVG elements
    svgElements:  ["a", "altglyph", "altglyphdef", "altglyphitem", "animate",
                   "animatecolor", "animatemotion", "animatetransform", "circle",
                   "clippath", "color-profile", "cursor", "defs", "desc",
                   "ellipse", "feblend", "fecolormatrix", "fecomponenttransfer",
                   "fecomposite", "feconvolvematrix", "fediffuselighting",
                   "fedisplacementmap", "fedistantlight", "feflood", "fefunca",
                   "fefuncb", "fefuncg", "fefuncr", "fegaussianblur", "feimage",
                   "femerge", "femergenode", "femorphology", "feoffset",
                   "fepointlight", "fespecularlighting", "fespotlight",
                   "fetile", "feturbulence", "filter", "font", "font-face",
                   "font-face-format", "font-face-name", "font-face-src",
                   "font-face-uri", "foreignobject", "g", "glyph", "glyphref",
                   "hkern", "image", "line", "lineargradient", "marker", "mask",
                   "metadata", "missing-glyph", "mpath", "path", "pattern",
                   "polygon", "polyline", "radialgradient", "rect", "script",
                   "set", "stop", "style", "svg", "switch", "symbol", "text",
                   "textpath", "title", "tref", "tspan", "use", "view", "vkern"],

    // HTML5 doesn't use namespaces, but actually it does. These are supported:
    attributeNamespaces: ["xlink", "xml"],

    // We also keep a list of HTML elements that are now obsolete, but
    // may still be encountered in the wild on popular sites.
    obsoleteHtmlElements: ["acronym", "applet", "basefont", "big", "center",
                           "dir", "font", "isindex", "listing", "noframes",
                           "plaintext", "s", "strike", "tt", "xmp"],

    webComponentElements: ["template", "shadow", "content"],

    // This is a helper function to determine whether a given string
    // is a custom HTML element as per Custom Elements spec
    // (see http://www.w3.org/TR/2013/WD-custom-elements-20130514/#terminology).
    _isCustomElement: function(tagName) {
      return tagName.search(/^[\w\d]+-[\w\d]+$/) > -1;
    },

    // This is a helper function to determine whether a given string
    // is a legal HTML5 element tag.
    _knownHTMLElement: function(tagName) {
      return this.voidHtmlElements.indexOf(tagName) > -1 ||
              this.htmlElements.indexOf(tagName) > -1 ||
              this.obsoleteHtmlElements.indexOf(tagName) > -1 ||
              this.webComponentElements.indexOf(tagName) > -1;
    },

    // This is a helper function to determine whether a given string
    // is a legal SVG element tag.
    _knownSVGElement: function(tagName) {
      return this.svgElements.indexOf(tagName) > -1;
    },

    // This is a helper function to determine whether a given string
    // is a void HTML element tag.
    _knownVoidHTMLElement: function(tagName) {
      return this.voidHtmlElements.indexOf(tagName) > -1;
    },

    // This is a helper function to determine whether a given string
    // is a HTML element tag which can optional omit its close tag.
    _knownOmittableCloseTagHtmlElement: function(tagName) {
      return this.omittableCloseTagHtmlElements.indexOf(tagName) > -1;
    },

    // This is a helper function to determine whether a given string
    // is in the list of ommittableCloseTags which enable an active tag omit its close tag.
    _knownOmittableCloseTags: function(activeTagName, foundTagName) {
      return this.omittableCloseTags[activeTagName].indexOf(foundTagName) > -1;
    },

    // This is a helper function to determine whether an attribute namespace
    // is supposed in the HTML spec. Currently these are "xlink" and "xml".
    _supportedAttributeNameSpace: function(ns) {
      return this.attributeNamespaces.indexOf(ns) !== -1;
    },

    // #### The HTML Master Parse Function
    //
    // The HTML master parse function works the same as the CSS
    // parser: it takes the token stream and will try to parse
    // the content as a sequence of HTML elements.
    //
    // Any parse errors along the way will result in the code
    // throwing a `ParseError`.
    parse: function() {
      // First we check to see if the beginning of our stream is
      // an HTML5 doctype tag. We're currently quite strict and don't
      // parse XHTML or other doctypes.
      if (this.stream.match(this.html5Doctype, true, true))
        this.domBuilder.fragment.parseInfo = {
          doctype: {
            start: 0,
            end: this.stream.pos
          }
        };

      // Next, we parse "tag soup", creating text nodes and diving into
      // tags as we find them.
      while (!this.stream.end()) {
        if (this.stream.peek() == '<') {
          this._buildTextNode();
          this._parseStartTag();
        } else
          this.stream.next();
      }

      this._buildTextNode();

      // At the end, it's possible we're left with an open tag, so
      // we test for that.
      if (this.domBuilder.currentNode != this.domBuilder.fragment)
        throw new ParseError("UNCLOSED_TAG", this);

      return {
        warnings: (this.warnings.length > 0 ? this.warnings : false)
      };
    },

    // This is a helper to build a DOM text node.
    _buildTextNode: function() {
      var token = this.stream.makeToken();
      if (token) {
        this.domBuilder.text(replaceEntityRefs(token.value), token.interval);
      }
    },

    // #### HTML Tag Parsing
    //
    // This is the entry point for parsing the beginning of an HTML tag.
    // It assumes the stream is on a `<` character.
    _parseStartTag: function() {
      if (this.stream.next() != '<')
        throw new Error('assertion failed, expected to be on "<"');

      if (this.stream.match('!--', true)) {
        this.domBuilder.pushContext("text", this.stream.pos);
        this._parseComment();
        this.domBuilder.pushContext("html", this.stream.pos);
        return;
      }

      this.stream.eat(/\//);
      this.stream.eatWhile(/[\w\d-]/);
      var token = this.stream.makeToken();
      var tagName = token.value.slice(1).toLowerCase();

      if (tagName === "svg")
        this.parsingSVG = true;

      // If the character after the `<` is a `/`, we're on a closing tag.
      // We want to report useful errors about whether the tag is unexpected
      // or doesn't match with the most recent opening tag.
      if (tagName[0] == '/') {
        activeTagNode = false;
        var closeTagName = tagName.slice(1).toLowerCase();
        if (closeTagName === "svg")
          this.parsingSVG = false;
        if (this._knownVoidHTMLElement(closeTagName))
          throw new ParseError("CLOSE_TAG_FOR_VOID_ELEMENT", this,
                               closeTagName, token);
        if (!this.domBuilder.currentNode.parseInfo)
          throw new ParseError("UNEXPECTED_CLOSE_TAG", this, closeTagName,
                               token);
        this.domBuilder.currentNode.parseInfo.closeTag = {
          start: token.interval.start
        };
        var openTagName = this.domBuilder.currentNode.nodeName.toLowerCase();
        if (closeTagName != openTagName)
          throw new ParseError("MISMATCHED_CLOSE_TAG", this, openTagName,
                               closeTagName, token);
        this._parseEndCloseTag();
      }

      else {
        if (tagName) {
          var badSVG = this.parsingSVG && !this._knownSVGElement(tagName);
          var badHTML = !this.parsingSVG && !this._knownHTMLElement(tagName) && !this._isCustomElement(tagName);
          if (badSVG || badHTML) {
            throw new ParseError("INVALID_TAG_NAME", tagName, token);
          } else if (this.options.noScript && tagName === "script") {
            throw new ParseError("SCRIPT_ELEMENT_NOT_ALLOWED", tagName, token);
          } else if (this.options.disableTags) {
            for (var i = 0; i < this.options.disableTags.length; i++) {
              if (tagName === this.options.disableTags[i]) {
                throw new ParseError("ELEMENT_NOT_ALLOWED", tagName, token);
              }
            }
          }
        }
        else {
          throw new ParseError("INVALID_TAG_NAME", tagName, token);
        }

        var parseInfo = { openTag: { start: token.interval.start }};
        var nameSpace = (this.parsingSVG ? this.svgNameSpace : undefined);

        // If the preceding tag and the active tag is omittableCloseTag pairs,
        // we tell our DOM builder that we're done.
        if (activeTagNode && parentTagNode != this.domBuilder.fragment){
          var activeTagName = activeTagNode.nodeName.toLowerCase();
          if(this._knownOmittableCloseTags(activeTagName, tagName)) {
            this.domBuilder.popElement();
          }
        }
        // Store currentNode as the parentTagNode
        parentTagNode = this.domBuilder.currentNode;
        this.domBuilder.pushElement(tagName, parseInfo, nameSpace);

        if (!this.stream.end())
          this._parseEndOpenTag(tagName);
      }
    },
    // This helper parses HTML comments. It assumes the stream has just
    // passed the beginning `<!--` of an HTML comment.
    _parseComment: function() {
      var token;
      while (!this.stream.end()) {
        if (this.stream.match('-->', true)) {
          token = this.stream.makeToken();
          this.domBuilder.comment(token.value.slice(4, -3), token.interval);
          return;
        }
        this.stream.next();
      }
      token = this.stream.makeToken();
      throw new ParseError("UNTERMINATED_COMMENT", token);
    },
    // This helper parses CDATA content, which should be treated as raw text,
    // rather than being parsed for markup. It assumes the stream has just
    // passed the beginning `<tagname` of an HTML element.
    _parseCDATA: function(tagname) {
      var token,
           matchString = '</'+tagname+'>',
           text,
           textInterval = { start: 0, end: 0 },
           openTagEnd = this.domBuilder.currentNode.parseInfo.openTag.end,
           closeTagInterval;

      this.stream.makeToken();
      while (!this.stream.end()) {
        if (this.stream.match(matchString, true)) {
          token = this.stream.makeToken();
          text = token.value.slice(0, -matchString.length);
          closeTagInterval = {
            start: openTagEnd + text.length,
            end: token.interval.end
          };
          this.domBuilder.currentNode.parseInfo.closeTag = closeTagInterval;
          textInterval.start = token.interval.start;
          textInterval.end = token.interval.end - (closeTagInterval.end - closeTagInterval.start);
          if (tagname === "script") {
            this.domBuilder.script(text, textInterval);
          } else {
            this.domBuilder.text(text, textInterval);
          }
          this.domBuilder.popElement();
          return;
        }
        this.stream.next();
      }
      throw new ParseError("UNCLOSED_TAG", this);
    },
    // This helper function checks if the current tag contains an attribute
    containsAttribute: function (stream) {
      return stream.eat(nameStartChar);
    },
    // This helper function parses the end of a closing tag. It expects
    // the stream to be right after the end of the closing tag's tag
    // name.
    _parseEndCloseTag: function() {
      this.stream.eatSpace();
      if (this.stream.next() != '>') {
        if(this.containsAttribute(this.stream)) {
          throw new ParseError("ATTRIBUTE_IN_CLOSING_TAG", this);
        } else {
          throw new ParseError("UNTERMINATED_CLOSE_TAG", this);
        }
      }
      var end = this.stream.makeToken().interval.end;
      this.domBuilder.currentNode.parseInfo.closeTag.end = end;
      this.domBuilder.popElement();
    },
    // This helper function parses the rest of an opening tag after
    // its tag name, looking for `attribute="value"` data until a
    // `>` is encountered.
    _parseEndOpenTag: function(tagName) {
      var tagMark = this.stream.pos,
          startMark = this.stream.pos;

      while (!this.stream.end()) {
        if (this.containsAttribute(this.stream)) {
          if (this.stream.peek !== "=") {
            this.stream.eatWhile(nameChar);
          }
          this._parseAttribute(tagName);
        }
        else if (this.stream.eatSpace()) {
          this.stream.makeToken();
          startMark = this.stream.pos;
        }
        else if (this.stream.peek() == '>' || this.stream.match("/>")) {
          var selfClosing = this.stream.match("/>", true);
          if (selfClosing) {
            if (!this.parsingSVG && !this._knownVoidHTMLElement(tagName))
              throw new ParseError("SELF_CLOSING_NON_VOID_ELEMENT", this,
                                   tagName);
          } else
            this.stream.next();
          var end = this.stream.makeToken().interval.end;
          this.domBuilder.currentNode.parseInfo.openTag.end = end;

          // If the opening tag represents a void element, there will not be
          // a closing element, so we tell our DOM builder that we're done.
          if (tagName && ((selfClosing && this._knownSVGElement(tagName)) || this._knownVoidHTMLElement(tagName)))
            this.domBuilder.popElement();

          // If the open tag represents a optional-omit-close-tag element, there may be
          // an optional closing element, so we save the currentNode into activeTag for next step check.
          activeTagNode = false;
          if (tagName && this._knownOmittableCloseTagHtmlElement(tagName)){
            activeTagNode = this.domBuilder.currentNode;
          }

          // If the opening tag represents a `<style>` element, we hand
          // off parsing to our CSS parser.
          if (!this.stream.end() && tagName === "style") {
            this.domBuilder.pushContext("css", this.stream.pos);
            var cssBlock = this.cssParser.parse();
            this.domBuilder.pushContext("html", this.stream.pos);
            this.domBuilder.text(cssBlock.value, cssBlock.parseInfo);
          }

          // If the opening tag represents a `<textarea>` element, we need
          // to parse all its contents as CDATA (unparsed character data)
          if (tagName && tagName === "script") {
            this.domBuilder.pushContext("javascript", this.stream.pos);
            this._parseCDATA("script");
            this.domBuilder.pushContext("html", this.stream.pos);
          }

          // If the opening tag represents a `<textarea>` element, we need
          // to parse all its contents as CDATA (unparsed character data)
          if (tagName && tagName === "textarea") {
            this.domBuilder.pushContext("text", this.stream.pos);
            this._parseCDATA("textarea");
            this.domBuilder.pushContext("html", this.stream.pos);
          }

          // if there is no more content in the parent element, we tell DOM builder that we're done.
          if(parentTagNode && parentTagNode != this.domBuilder.fragment) {
            var parentTagName = parentTagNode.nodeName.toLowerCase(),
                nextIsParent = isNextTagParent(this.stream, parentTagName),
                needsEndTag = !allowsOmmitedEndTag(parentTagName, tagName),
                optionalEndTag = this._knownOmittableCloseTagHtmlElement(parentTagName),
                nextTagCloses = isNextCloseTag(this.stream);
            if(nextIsParent && (needsEndTag || (optionalEndTag && nextTagCloses))) {
              if(this._knownOmittableCloseTagHtmlElement(tagName)) {
                this.domBuilder.popElement();
              }
            }
          }
          return;
        }
        // error cases: bad attribute name, or unclosed tag
        else {
          this.stream.eatWhile(/[^'"\s=<>]/);
          var attrToken = this.stream.makeToken();
          if (!attrToken) {
            this.stream.tokenStart = tagMark;
            attrToken = this.stream.makeToken();
            throw new ParseError("UNTERMINATED_OPEN_TAG", this);
          }
          attrToken.interval.start = startMark;
          throw new ParseError("INVALID_ATTR_NAME", this, attrToken);
        }
      }
    },
    // This helper function parses an HTML tag attribute. It expects
    // the stream to be right after the end of an attribute name.
    _parseAttribute: function(tagName) {
      var nameTok = this.stream.makeToken();
      nameTok.value = nameTok.value.toLowerCase();
      this.stream.eatSpace();
      // If the character after the attribute name is a `=`, then we
      // look for an attribute value; otherwise, this is a boolean
      // attribute.
      if (this.stream.peek() == '=') {
        this.stream.next();

        if(nameTok.value.indexOf(":") !== -1) {
          var parts = nameTok.value.split(":");
          if(parts.length > 2) {
            throw new ParseError("MULTIPLE_ATTR_NAMESPACES", this, nameTok);
          }
          var nameSpace = parts[0],
              attributeName = parts[1];
          if(!this._supportedAttributeNameSpace(nameSpace)) {
            throw new ParseError("UNSUPPORTED_ATTR_NAMESPACE", this, nameTok);
          }
        }

        if (this.options.noScript && /^on/i.test(nameTok.value)) {
            throw new ParseError("EVENT_HANDLER_ATTR_NOT_ALLOWED", this,
                nameTok);
        }

        // Currently, we only support quoted attribute values, even
        // though the HTML5 standard allows them to sometimes go unquoted.
        this.stream.eatSpace();
        this.stream.makeToken();
        var quoteType = this.stream.next();
        if (quoteType !== '"' && quoteType !== "'") {
          throw new ParseError("UNQUOTED_ATTR_VALUE", this);
        }
        if (quoteType === '"') {
          this.stream.eatWhile(/[^"]/);
        } else {
          this.stream.eatWhile(/[^']/);
        }
        if (this.stream.next() !== quoteType) {
          throw new ParseError("UNTERMINATED_ATTR_VALUE", this, nameTok);
        }
        var valueTok = this.stream.makeToken();

        //Add a new validator to check if there is a http link in a https page
        if (checkMixedContent && valueTok.value.match(/http:/) && isActiveContent(tagName, nameTok.value)) {
          this.warnings.push(
            new ParseError("HTTP_LINK_FROM_HTTPS_PAGE", this, nameTok, valueTok)
          );
        }

        var unquotedValue = replaceEntityRefs(valueTok.value.slice(1, -1));

        if (this.options.noScript && /^javascript:/i.test(unquotedValue)) {
            throw new ParseError("JAVASCRIPT_URL_NOT_ALLOWED", this, nameTok,
                valueTok);
        }

        this.domBuilder.attribute(nameTok.value, unquotedValue, {
          name: nameTok.interval,
          value: valueTok.interval
        });
      } else {
        this.stream.makeToken();
        this.domBuilder.attribute(nameTok.value, '', {
          name: nameTok.interval
        });
      }
    }
  };

  // ### The DOM Builder
  //
  // The DOM builder is used to construct a DOM representation of the
  // HTML/CSS being parsed. Each node contains a `parseInfo` expando
  // property that contains information about the text extents of the
  // original source code that the DOM element maps to.
  //
  // The DOM builder is given a single document DOM object that will
  // be used to create all necessary DOM nodes.
  function DOMBuilder(document, disallowActiveAttributes) {
    this.document = document;
    this.fragment = document.createDocumentFragment();
    this.currentNode = this.fragment;
    this.contexts = [];
    this.pushContext("html", 0);
    this.disallowActiveAttributes = disallowActiveAttributes;
  }

  DOMBuilder.prototype = {
    // This method pushes a new element onto the DOM builder's stack.
    // The element is appended to the currently active element and is
    // then made the new currently active element.
    pushElement: function(tagName, parseInfo, nameSpace) {
      var node = (nameSpace ? this.document.createElementNS(nameSpace,tagName)
                            : this.document.createElement(tagName));
      node.parseInfo = parseInfo;
      this.currentNode.appendChild(node);
      this.currentNode = node;
    },
    // This method pops the current element off the DOM builder's stack,
    // making its parent element the currently active element.
    popElement: function() {
      this.currentNode = this.currentNode.parentNode;
    },
    // record the cursor position for a context change (text/html/css/script)
    pushContext: function(context, position) {
      this.contexts.push({
        context: context,
        position: position
      });
    },
    // This method appends an HTML comment node to the currently active
    // element.
    comment: function(data, parseInfo) {
      var comment = this.document.createComment('');
      comment.nodeValue = data;
      comment.parseInfo = parseInfo;
      this.currentNode.appendChild(comment);
    },
    // This method appends an attribute to the currently active element.
    attribute: function(name, value, parseInfo) {
      var attrNode = this.document.createAttribute(name);
      attrNode.parseInfo = parseInfo;
      if (this.disallowActiveAttributes && name.substring(0,2).toLowerCase() === "on") {
        attrNode.nodeValue = "";
      } else {
        attrNode.nodeValue = value;
      }
      this.currentNode.attributes.setNamedItem(attrNode);
    },
    // This method appends a text node to the currently active element.
    text: function(text, parseInfo) {
      if (this.currentNode === this.fragment) {
        return;
      }
      var textNode = this.document.createTextNode(text);
      textNode.parseInfo = parseInfo;
      this.currentNode.appendChild(textNode);
    }
  };

  // ### DOM Cacher
  // I'm such a Haxor :)
  function DOMCacher(document, disallowActiveAttributes, scriptPreprocessor) {
    this.log = [];
    this.disallowActiveAttributes = disallowActiveAttributes;
    this.scriptPreprocessor = scriptPreprocessor;
  }

  DOMCacher.prototype = {
    // This method pushes a new element onto the DOM builder's stack.
    // The element is appended to the currently active element and is
    // then made the new currently active element.
    pushElement: function(tagName, parseInfo, nameSpace) {
      this.log.push(["pushElement", arguments]);
      this.currentNode = {nodeName: tagName, parseInfo: parseInfo, parent: this.currentNode};
    },
    // This method pops the current element off the DOM builder's stack,
    // making its parent element the currently active element.
    popElement: function() {
      this.log.push(["popElement", arguments]);
      this.currentNode = this.currentNode.parent;
    },
    // record the cursor position for a context change (text/html/css/script)
    pushContext: function(context, position) {
      this.log.push(["pushContext", arguments]);
    },
    // This method appends an HTML comment node to the currently active
    // element.
    comment: function(data, parseInfo) {
      this.log.push(["comment", arguments]);
    },
    // This method appends an attribute to the currently active element.
    attribute: function(name, value, parseInfo) {
      this.log.push(["attribute", arguments]);
    },
    // This method appends a text node to the currently active element.
    text: function(text, parseInfo) {
      this.log.push(["text", arguments]);
    },
    // This method appends a text node to the currently active element.
    script: function(text, parseInfo) {
      try {
        text = this.scriptPreprocessor(text);
      } catch(err) {
        // This is meant to handle esprima errors
        if (err.index && err.description && err.message) {
          var cursor = this.currentNode.parseInfo.openTag.end + err.index;
          throw {parseInfo: {type: "JAVASCRIPT_ERROR", message: err.description, cursor: cursor} };
        } else {
          throw err;
        }
      }
      this.log.push(["text", [text, parseInfo]]);
    }
  };

  DOMCacher.prototype.replayOn = function(doc) {
    var domBuilder = new DOMBuilder(document, this.disallowActiveAttributes);
    domBuilder.currentNode = domBuilder.fragment = doc;
    this.log.forEach(function(action) {
      domBuilder[action[0]].apply(domBuilder, action[1]);
    });
  };

  // ### Exported Symbols
  //
  // `Slowparse` is the object that holds all exported symbols from
  // this library.
  var Slowparse = {
    // We export our list of recognized HTML elements and CSS properties
    // for clients to use if needed.
    HTML_ELEMENT_NAMES: HTMLParser.prototype.voidHtmlElements.concat(
                          HTMLParser.prototype.htmlElements.concat(
                            HTMLParser.prototype.obsoleteHtmlElements)),
    CSS_PROPERTY_NAMES: CSSParser.prototype.cssProperties,

    // We also export a few internal symbols for use by Slowparse's
    // testing suite.
    replaceEntityRefs: replaceEntityRefs,
    Stream: Stream,

    // `Slowparse.HTML()` is the primary function we export. Given
    // a DOM document object (or a DOMBuilder instance) and a string
    // of HTML, we return an object with the following keys:
    //
    // * `document` is a DOM document fragment containing the DOM of
    //   the parsed HTML. If an error occurred while parsing, this
    //   document is incomplete, and represents what was built before
    //   the error was encountered.
    //
    // * `error` is a JSON-serializable object representing any error
    //   that occurred while parsing. If no errors occurred while parsing,
    //   its value is `null`. For a list of the types of errors that
    //   can be returned, see the [error specification][].
    //
    // An array of error detector functions can also be passed as a
    // third argument to this function. An error detector function takes
    // the HTML and generated document fragment as arguments and returns
    // an error object if an error is detected, or `undefined` otherwise.
    // This can be used for further error checking on the parsed document.
    //
    //   [error specification]: spec/
    HTML: function(document, html, options) {
      var options = options || {};
      var stream = new Stream(html),
          parser,
          warnings = null,
          error = null,
          errorDetectors = options.errorDetectors || [],
          disallowActiveAttributes = (typeof options.disallowActiveAttributes === "undefined") ? false : options.disallowActiveAttributes;

      var scriptPreprocessor = options.scriptPreprocessor || function(x){return x;};
      var domCacher = new DOMCacher(document, disallowActiveAttributes, scriptPreprocessor);
      var parser = new HTMLParser(stream, domCacher);

      try {
        var _ = parser.parse();
        if (_.warnings) {
          warnings = _.warnings;
        }
      } catch (e) {
        if (e.parseInfo) {
          error = e.parseInfo;
        } else {
          throw e;
        }
      }

      errorDetectors.forEach(function(detector) {
        if (!error) {
          error = detector(html, domBuilder.fragment) || null;
        }
      });

      return {
        cache: domCacher,
        warnings: warnings,
        error: error
      };
    },
    // `Slowparse.findError()` just returns any error in the given HTML
    // string, or `null` if the HTML contains no errors.
    findError: function(html, errorDetectors) {
      return this.HTML(document, html, errorDetectors).error;
    }
  };

  // AMD context
  if (typeof define !== "undefined") {
    define(function() { return Slowparse; });
  }

  // Node.js context
  else if(typeof module !== "undefined" && module.exports) {
    module.exports = Slowparse;
  }

  // browser context
  else if (typeof window !== "undefined") {
    window.Slowparse = Slowparse;
  }
}());