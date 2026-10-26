import { generateJSON, type JSONContent } from "@tiptap/core";
import { marked } from "marked";
import { editorExtensions } from "./extensions";
import { normalizeContent } from "./formatting";
import type { ImportKind } from "@/lib/validation";

/** Plain text: blank lines separate paragraphs, single newlines become hard breaks. */
export function textToDoc(text: string): JSONContent {
  const paragraphs = text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.replace(/^\n+|\n+$/g, ""))
    .filter((block) => block.trim().length > 0);

  if (paragraphs.length === 0) return { type: "doc", content: [{ type: "paragraph" }] };

  return {
    type: "doc",
    content: paragraphs.map((block) => {
      const content: JSONContent[] = [];
      block.split("\n").forEach((line, i) => {
        if (i > 0) content.push({ type: "hardBreak" });
        if (line.length) content.push({ type: "text", text: line });
      });
      return { type: "paragraph", content };
    }),
  };
}

/**
 * Markdown -> HTML (marked) -> Tiptap JSON. Parsing through the editor schema drops
 * any element/attribute the schema doesn't define (scripts, images, raw HTML, styles),
 * and the server re-validates the resulting JSON before saving. Browser-only (uses DOMParser).
 */
export function markdownToDoc(markdown: string): JSONContent {
  const html = marked.parse(markdown, { async: false, gfm: true, breaks: false });
  return toPlainJson(generateJSON(html, editorExtensions));
}

export function fileTextToDoc(text: string, kind: ImportKind): JSONContent {
  return kind === "md" ? markdownToDoc(text) : textToDoc(text);
}

/**
 * Plain, server-acceptable copy of editor JSON. ProseMirror attrs are not plain objects (React
 * would send them to Server Actions as opaque references), and pasted content can carry styles
 * outside the allow-list. See normalizeContent. Use before every Server Action call.
 */
export function toPlainJson(doc: JSONContent): JSONContent {
  return normalizeContent(doc);
}

/** True when the converted document has no visible text. */
export function isDocEmpty(doc: JSONContent): boolean {
  const walk = (node: JSONContent): boolean =>
    (node.type === "text" && Boolean(node.text?.trim())) || (node.content ?? []).some(walk);
  return !walk(doc);
}
