import type { MimeSymbol, SymbolKind, TreeSitterNode } from "@plurnk/plurnk-mimetypes";

// Perl SPEC §3 mapping for tree-sitter-perl.
//
//   package_statement                   → module
//   subroutine_declaration_statement    → function (with signature params if present)
//   expression_statement → assignment with variable_declaration → variable / constant
//   use_statement of module "constant"  → constant per name=>value pair
export function extract(root: TreeSitterNode): MimeSymbol[] {
    const out: MimeSymbol[] = [];
    for (let i = 0; i < root.namedChildCount; i += 1) {
        const child = root.namedChild(i);
        if (!child) continue;
        dispatch(child, out);
    }
    return out;
}

function dispatch(node: TreeSitterNode, out: MimeSymbol[]): void {
    switch (node.type) {
        case "package_statement": {
            const name = node.childForFieldName("name");
            if (name) push(out, "module", name.text, node);
            return;
        }
        case "subroutine_declaration_statement": {
            const name = node.childForFieldName("name");
            if (!name) return;
            const sig = findChildOfType(node, "signature");
            const params: string[] = [];
            if (sig) {
                for (let i = 0; i < sig.namedChildCount; i += 1) {
                    const p = sig.namedChild(i);
                    if (!p) continue;
                    if (p.type === "mandatory_parameter" || p.type === "optional_parameter"
                        || p.type === "slurpy_parameter") {
                        const varname = deepFirst(p, "varname");
                        if (varname) params.push(varname);
                    }
                }
            }
            out.push({
                name: name.text,
                kind: "function",
                line: node.startPosition.row + 1,
                endLine: node.endPosition.row + 1,
                params,
            });
            return;
        }
        case "expression_statement": {
            // Look for assignment_expression with variable_declaration LHS —
            // that's a my/our declaration at the top level.
            const assign = findChildOfType(node, "assignment_expression");
            if (!assign) return;
            const left = assign.childForFieldName("left");
            if (!left || left.type !== "variable_declaration") return;
            const varName = extractVarName(left);
            if (!varName) return;
            const kind: SymbolKind = isScreamingSnake(varName) ? "constant" : "variable";
            push(out, kind, varName, node);
            return;
        }
        case "use_statement": {
            // `use constant PI => 3.14;` or `use constant { ALPHA => 1, BETA => 2 };`
            // emits one constant per bareword. The hash form nests barewords
            // through anonymous_hash_expression → list_expression, so we
            // recursively scan for every autoquoted_bareword in the statement.
            const mod = node.childForFieldName("module");
            if (!mod || mod.text !== "constant") return;
            collectByType(node, "autoquoted_bareword", (n) => {
                push(out, "constant", n.text, n);
            });
            return;
        }
        default:
            return;
    }
}

// variable_declaration wraps a scalar/array/hash node whose first named
// child is a varname (the name without the sigil).
function extractVarName(decl: TreeSitterNode): string | null {
    for (let i = 0; i < decl.namedChildCount; i += 1) {
        const child = decl.namedChild(i);
        if (!child) continue;
        if (child.type === "scalar" || child.type === "array" || child.type === "hash") {
            const varname = deepFirst(child, "varname");
            if (varname) return varname;
        }
    }
    return null;
}

function findChildOfType(node: TreeSitterNode, type: string): TreeSitterNode | null {
    for (let i = 0; i < node.namedChildCount; i += 1) {
        const child = node.namedChild(i);
        if (child && child.type === type) return child;
    }
    return null;
}

function collectByType(node: TreeSitterNode, type: string, visit: (n: TreeSitterNode) => void): void {
    if (node.type === type) visit(node);
    for (let i = 0; i < node.namedChildCount; i += 1) {
        const child = node.namedChild(i);
        if (child) collectByType(child, type, visit);
    }
}

function deepFirst(node: TreeSitterNode, type: string): string | null {
    const stack: TreeSitterNode[] = [node];
    while (stack.length > 0) {
        const cur = stack.pop()!;
        if (cur.type === type) return cur.text;
        for (let i = cur.namedChildCount - 1; i >= 0; i -= 1) {
            const child = cur.namedChild(i);
            if (child) stack.push(child);
        }
    }
    return null;
}

function isScreamingSnake(name: string): boolean {
    if (name.length < 2) return false;
    let hasLetter = false;
    for (const c of name) {
        if (c >= "A" && c <= "Z") hasLetter = true;
        else if (c === "_" || (c >= "0" && c <= "9")) continue;
        else return false;
    }
    return hasLetter;
}

function push(out: MimeSymbol[], kind: SymbolKind, name: string, node: TreeSitterNode): void {
    out.push({
        name,
        kind,
        line: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
    });
}

// References query for tree-sitter-perl (SPEC §16). Conservative — precision
// over recall. Only call edges are honest in Perl: imports are bareword module
// paths (`use List::Util`) with no bound symbol to join (like Go), so they are
// not emitted, and bare scalar/array reads are not refs.
//
//   function_call_expression → call (callee name). Two callee shapes:
//     bareword `foo(...)` / `Foo::other(...)` — the `function` field is a leaf;
//     `&foo(...)` — the `function` field wraps a (varname). The bareword pattern
//     excludes the `&` form (its leaf text carries the sigil) via #not-match?,
//     and the amp form captures the inner varname so the name stays sigil-free.
//   method_call_expression → call on the method name (covers `$obj->m(...)`,
//     `Class->new(...)` — Perl has no syntactic instantiate, so it is a call).
export const refsQuery = `
((function_call_expression
  function: (function) @ref.call)
 (#not-match? @ref.call "^&"))

(function_call_expression
  function: (function (varname) @ref.call))

(method_call_expression
  method: (method) @ref.call)
`;
