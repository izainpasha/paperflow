import { describe, expect, it } from "vitest";
import { validateDocumentContent } from "@/lib/validation";
import { isDocEmpty, markdownToDoc, textToDoc } from "./import";

describe("textToDoc", () => {
  it("splits paragraphs on blank lines and keeps single line breaks", () => {
    const doc = textToDoc("First line\nsecond line\r\n\r\nNext paragraph\n");
    expect(doc).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "First line" },
            { type: "hardBreak" },
            { type: "text", text: "second line" },
          ],
        },
        { type: "paragraph", content: [{ type: "text", text: "Next paragraph" }] },
      ],
    });
  });

  it("treats markdown syntax in .txt files as literal text", () => {
    const doc = textToDoc("# not a heading");
    expect(doc.content?.[0]).toEqual({ type: "paragraph", content: [{ type: "text", text: "# not a heading" }] });
  });

  it("produces an empty document for whitespace", () => {
    expect(isDocEmpty(textToDoc("  \n\n  "))).toBe(true);
  });
});

describe("markdownToDoc", () => {
  it("maps headings, emphasis and lists to editor nodes", () => {
    const doc = markdownToDoc("# Plan\n\nSome **bold** and *italic* text.\n\n- one\n- two\n\n1. first\n2. second\n");
    const types = doc.content?.map((n) => n.type);
    expect(types).toEqual(["heading", "paragraph", "bulletList", "orderedList"]);
    expect(doc.content?.[0].attrs?.level).toBe(1);

    const marks = doc.content?.[1].content?.flatMap((n) => n.marks?.map((m) => m.type) ?? []);
    expect(marks).toEqual(expect.arrayContaining(["bold", "italic"]));
    expect(doc.content?.[2].content).toHaveLength(2);
  });

  it("drops raw HTML, scripts and unsafe links, and the result passes server validation", () => {
    const doc = markdownToDoc(
      '<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n[bad](javascript:alert(1)) [good](https://example.com)\n',
    );
    const json = JSON.stringify(doc);
    expect(json).not.toContain("script");
    expect(json).not.toContain("onerror");
    expect(json).not.toContain("javascript:");
    expect(json).toContain("https://example.com");
    expect(validateDocumentContent(doc).ok).toBe(true);
  });
});
