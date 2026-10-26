import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { validateDocumentContent } from "@/lib/validation";
import { normalizeContent } from "./formatting";

const para = (attrs: Record<string, unknown>, marks?: { type: string; attrs?: Record<string, unknown> }[]): JSONContent => ({
  type: "doc",
  content: [{ type: "paragraph", attrs, content: [{ type: "text", text: "x", ...(marks ? { marks } : {}) }] }],
});

describe("server validation of rich formatting", () => {
  it("accepts allow-listed fonts, sizes, alignment and indent", () => {
    const doc = para({ textAlign: "center", indent: 2 }, [
      { type: "textStyle", attrs: { fontFamily: "Georgia, serif", fontSize: "24px" } },
    ]);
    expect(validateDocumentContent(doc).ok).toBe(true);
  });

  it("rejects arbitrary CSS values smuggled through style attributes", () => {
    const badFont = para({}, [{ type: "textStyle", attrs: { fontFamily: "x; background:url(//evil)" } }]);
    expect(validateDocumentContent(badFont)).toMatchObject({ ok: false, error: expect.stringContaining("font") });
    const badSize = para({}, [{ type: "textStyle", attrs: { fontSize: "999px" } }]);
    expect(validateDocumentContent(badSize).ok).toBe(false);
    const color = para({}, [{ type: "textStyle", attrs: { color: "red" } }]);
    expect(validateDocumentContent(color).ok).toBe(false);
    expect(validateDocumentContent(para({ textAlign: "start" })).ok).toBe(false);
    expect(validateDocumentContent(para({ indent: 99 })).ok).toBe(false);
  });
});

describe("normalizeContent", () => {
  it("drops unsupported pasted styles and relative links instead of failing the save", () => {
    const pasted = para({ textAlign: "start", indent: 50 }, [
      { type: "bold" },
      { type: "textStyle", attrs: { fontFamily: "Comic Sans MS", fontSize: "18px" } },
      { type: "link", attrs: { href: "notes.md" } },
    ]);
    const normalized = normalizeContent(pasted);
    const para0 = normalized.content![0];
    expect(para0.attrs).toEqual({ textAlign: null, indent: 0 });
    expect(para0.content![0].marks).toEqual([
      { type: "bold" },
      { type: "textStyle", attrs: { fontFamily: null, fontSize: "18px" } },
    ]);
    expect(validateDocumentContent(normalized).ok).toBe(true);
  });

  it("returns plain objects", () => {
    const attrs = Object.create(null);
    attrs.level = 1;
    const out = normalizeContent({ type: "doc", content: [{ type: "heading", attrs }] });
    expect(Object.getPrototypeOf(out.content![0].attrs)).toBe(Object.prototype);
  });
});
