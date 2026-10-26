import type { JSONContent } from "@tiptap/core";

/**
 * Formatting options offered by the toolbar. The server accepts only these values,
 * so styles can't be used to inject arbitrary CSS.
 */
export const FONT_FAMILIES = [
  { label: "Default font", value: "" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "Times New Roman, Times, serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Courier New", value: "Courier New, Courier, monospace" },
] as const;

export const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "30px", "36px"] as const;
export const TEXT_ALIGNMENTS = ["left", "center", "right", "justify"] as const;
export const MAX_INDENT = 8;

/** Absolute http(s)/mailto only. Relative links mean nothing inside Paperflow. */
export const SAFE_HREF = /^(https?:|mailto:)/i;

const FAMILY_VALUES = new Set<string>(FONT_FAMILIES.map((f) => f.value).filter(Boolean));
const SIZE_VALUES = new Set<string>(FONT_SIZES);
const ALIGN_VALUES = new Set<string>(TEXT_ALIGNMENTS);

export const isAllowedFontFamily = (v: unknown) => v == null || (typeof v === "string" && FAMILY_VALUES.has(v));
export const isAllowedFontSize = (v: unknown) => v == null || (typeof v === "string" && SIZE_VALUES.has(v));
export const isAllowedAlign = (v: unknown) => v == null || (typeof v === "string" && ALIGN_VALUES.has(v));
export const isAllowedIndent = (v: unknown) =>
  v == null || (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_INDENT);

type Mark = NonNullable<JSONContent["marks"]>[number];

function normalizeMark(mark: Mark): Mark | null {
  if (mark.type === "link") {
    const href = mark.attrs?.href;
    return typeof href === "string" && SAFE_HREF.test(href.trim()) ? mark : null;
  }
  if (mark.type === "textStyle") {
    const fontFamily = isAllowedFontFamily(mark.attrs?.fontFamily) ? (mark.attrs?.fontFamily ?? null) : null;
    const fontSize = isAllowedFontSize(mark.attrs?.fontSize) ? (mark.attrs?.fontSize ?? null) : null;
    return fontFamily || fontSize ? { type: "textStyle", attrs: { fontFamily, fontSize } } : null;
  }
  return mark;
}

/**
 * Brings editor JSON in line with what the server accepts: drops unsafe links and
 * unsupported style values (e.g. a pasted "Comic Sans" font) instead of failing the save.
 * Also returns plain objects — ProseMirror attrs are not plain, and React serialises
 * non-plain objects passed to Server Actions as opaque references.
 */
export function normalizeContent(node: JSONContent): JSONContent {
  const out: JSONContent = { type: node.type };
  if (node.attrs) {
    const attrs: Record<string, unknown> = { ...node.attrs };
    if ("textAlign" in attrs && !isAllowedAlign(attrs.textAlign)) attrs.textAlign = null;
    if ("indent" in attrs && !isAllowedIndent(attrs.indent)) attrs.indent = 0;
    out.attrs = JSON.parse(JSON.stringify(attrs));
  }
  if (node.text !== undefined) out.text = node.text;
  if (node.marks) {
    const marks = node.marks.map(normalizeMark).filter((m): m is Mark => m !== null);
    if (marks.length) out.marks = JSON.parse(JSON.stringify(marks));
  }
  if (node.content) out.content = node.content.map(normalizeContent);
  return out;
}
