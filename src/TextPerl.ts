import { TreeSitterExtractor } from "@plurnk/plurnk-mimetypes";
import type {
    HandlerContent,
    MimeRef,
    MimeSymbol,
    QueryConstructor,
    TreeSitterNode,
    TreeSitterParser,
    TreeSitterTree,
} from "@plurnk/plurnk-mimetypes";
import { extract, refsQuery } from "./perl.ts";

// text/x-perl handler. Tier 2 — tree-sitter-perl grammar built to WASM at
// publish time.
export default class TextPerl extends TreeSitterExtractor {
    protected async loadParser(): Promise<TreeSitterParser> {
        const ts = await import("web-tree-sitter" as string) as {
            Parser: {
                init(): Promise<void>;
                new (): { setLanguage(lang: unknown): void; parse(content: string): unknown };
            };
            Language: {
                load(wasmPath: string): Promise<unknown>;
            };
            Query: QueryConstructor;
        };
        await ts.Parser.init();
        const wasmUrl = new URL("../perl.wasm", import.meta.url);
        const lang = await ts.Language.load(wasmUrl.pathname);
        this.setQueryContext(lang, ts.Query);
        const parser = new ts.Parser();
        parser.setLanguage(lang);
        return parser as unknown as TreeSitterParser;
    }

    protected extractFromTree(tree: TreeSitterTree, _content: HandlerContent): MimeSymbol[] {
        return extract(tree.rootNode);
    }

    // References channel (SPEC §16): Perl emits call edges only — sub/method
    // calls. The base collectRefs() owns parse/compile/run/cleanup.
    override references(content: HandlerContent): Promise<MimeRef[]> {
        return this.collectRefs(content, refsQuery, (root) => extract(root));
    }
}
