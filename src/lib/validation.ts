import type { JSONContent } from "@tiptap/core";
import { z } from "zod";
import {
  SAFE_HREF,
  isAllowedAlign,
  isAllowedFontFamily,
  isAllowedFontSize,
  isAllowedIndent,
} from "@/lib/editor/formatting";

export const TITLE_MAX_LENGTH = 200;
export const CONTENT_MAX_BYTES = 500_000;
export const MAX_IMPORT_BYTES = 1_000_000;
export const SUPPORTED_IMPORT_EXTENSIONS = [".txt", ".md"] as const;
export const DEFAULT_TITLE = "Untitled document";

export const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

export const titleSchema = z
  .string()
  .trim()
  .min(1, "Title can't be empty.")
  .max(TITLE_MAX_LENGTH, `Title must be ${TITLE_MAX_LENGTH} characters or fewer.`);

export const documentIdSchema = z.uuid("Invalid document id.");

export const permissionSchema = z.enum(["viewer", "editor"]);

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address."));

export const credentialsSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "Password must be at least 8 characters.").max(72),
});

const ALLOWED_NODES = new Set([
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "hardBreak",
  "horizontalRule",
]);
const ALLOWED_MARKS = new Set(["bold", "italic", "underline", "strike", "code", "link", "textStyle"]);
const TEXT_STYLE_ATTRS = new Set(["fontFamily", "fontSize"]);
const MAX_DEPTH = 40;

function checkMarks(marks: unknown): string | null {
  if (marks === undefined) return null;
  if (!Array.isArray(marks)) return "marks must be an array";
  for (const mark of marks) {
    if (!mark || typeof mark !== "object") return "invalid mark";
    const { type, attrs } = mark as { type?: unknown; attrs?: Record<string, unknown> };
    if (typeof type !== "string" || !ALLOWED_MARKS.has(type)) return `mark "${String(type)}" is not allowed`;
    if (type === "link") {
      const href = attrs?.href;
      if (typeof href !== "string" || !SAFE_HREF.test(href.trim())) return "links must use http, https or mailto";
    }
    if (type === "textStyle") {
      for (const [key, value] of Object.entries(attrs ?? {})) {
        if (!TEXT_STYLE_ATTRS.has(key) && value != null) return `text style "${key}" is not allowed`;
      }
      if (!isAllowedFontFamily(attrs?.fontFamily)) return "unsupported font";
      if (!isAllowedFontSize(attrs?.fontSize)) return "unsupported font size";
    }
  }
  return null;
}

function checkNode(node: unknown, depth: number): string | null {
  if (depth > MAX_DEPTH) return "document is nested too deeply";
  if (!node || typeof node !== "object" || Array.isArray(node)) return "invalid node";
  const { type, content, text, attrs, marks } = node as Record<string, unknown>;
  if (typeof type !== "string" || !ALLOWED_NODES.has(type)) return `node "${String(type)}" is not allowed`;
  if (attrs !== undefined && (attrs === null || typeof attrs !== "object" || Array.isArray(attrs))) {
    return "attrs must be an object";
  }
  const nodeAttrs = (attrs ?? {}) as Record<string, unknown>;
  if (type === "heading" && ![1, 2, 3, 4, 5, 6].includes(nodeAttrs.level as number)) return "invalid heading level";
  if (!isAllowedAlign(nodeAttrs.textAlign)) return "unsupported text alignment";
  if (!isAllowedIndent(nodeAttrs.indent)) return "invalid indent";
  if (type === "text") {
    if (typeof text !== "string" || text.length === 0) return "text nodes need non-empty text";
  } else if (text !== undefined) {
    return "only text nodes may have text";
  }
  const markError = checkMarks(marks);
  if (markError) return markError;
  if (content !== undefined) {
    if (!Array.isArray(content)) return "content must be an array";
    for (const child of content) {
      const error = checkNode(child, depth + 1);
      if (error) return error;
    }
  }
  return null;
}

/**
 * Validates Tiptap JSON before it is persisted: an allow-list of node/mark types,
 * safe link protocols, bounded depth and size. Content is only ever rendered
 * through the Tiptap schema, never as raw HTML.
 */
export function validateDocumentContent(
  value: unknown,
): { ok: true; content: JSONContent } | { ok: false; error: string } {
  let size: number;
  try {
    size = new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return { ok: false, error: "Document content is not valid JSON." };
  }
  if (size > CONTENT_MAX_BYTES) {
    return { ok: false, error: "Document is too large to save (limit is about 500 KB)." };
  }
  if (!value || typeof value !== "object" || (value as { type?: unknown }).type !== "doc") {
    return { ok: false, error: "Document content must be a Tiptap document." };
  }
  const error = checkNode(value, 0);
  return error ? { ok: false, error: `Invalid document content: ${error}.` } : { ok: true, content: value as JSONContent };
}

export type ImportKind = "txt" | "md";

/** Validates an uploaded file's name and size before it is read. */
export function validateImportFile(file: {
  name: string;
  size: number;
}): { ok: true; kind: ImportKind } | { ok: false; error: string } {
  const lower = file.name.toLowerCase();
  const dot = lower.lastIndexOf(".");
  const ext = dot === -1 ? "" : lower.slice(dot);
  if (!(SUPPORTED_IMPORT_EXTENSIONS as readonly string[]).includes(ext)) {
    return {
      ok: false,
      error: `Unsupported file type. Only ${SUPPORTED_IMPORT_EXTENSIONS.join(" and ")} files can be imported.`,
    };
  }
  if (file.size === 0) return { ok: false, error: "That file is empty." };
  if (file.size > MAX_IMPORT_BYTES) return { ok: false, error: "File is too large. The limit is 1 MB." };
  return { ok: true, kind: ext === ".md" ? "md" : "txt" };
}

/** Derives a document title from a file name, e.g. "meeting-notes.md" -> "meeting-notes". */
export function titleFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").trim();
  return (base || DEFAULT_TITLE).slice(0, TITLE_MAX_LENGTH);
}
