import { describe, expect, it } from "vitest";
import {
  CONTENT_MAX_BYTES,
  emailSchema,
  titleFromFileName,
  titleSchema,
  validateDocumentContent,
  validateImportFile,
} from "./validation";

describe("titleSchema", () => {
  it("trims and accepts normal titles", () => {
    expect(titleSchema.parse("  Q3 plan  ")).toBe("Q3 plan");
  });
  it("rejects empty and over-long titles", () => {
    expect(titleSchema.safeParse("   ").success).toBe(false);
    expect(titleSchema.safeParse("x".repeat(201)).success).toBe(false);
  });
});

describe("emailSchema", () => {
  it("normalises case and whitespace", () => {
    expect(emailSchema.parse("  Alice@Example.COM ")).toBe("alice@example.com");
  });
  it("rejects invalid addresses", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });
});

describe("validateDocumentContent", () => {
  const richDoc = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Title" }] },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "bold", marks: [{ type: "bold" }] },
          { type: "text", text: " link", marks: [{ type: "link", attrs: { href: "https://example.com" } }] },
        ],
      },
      {
        type: "bulletList",
        content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "item" }] }] }],
      },
    ],
  };

  it("accepts a document using supported formatting", () => {
    expect(validateDocumentContent(richDoc)).toEqual({ ok: true, content: richDoc });
  });

  it("rejects non-document values", () => {
    expect(validateDocumentContent(null).ok).toBe(false);
    expect(validateDocumentContent({ type: "paragraph" }).ok).toBe(false);
    expect(validateDocumentContent("<p>hi</p>").ok).toBe(false);
  });

  it("rejects node types outside the allow-list", () => {
    const result = validateDocumentContent({ type: "doc", content: [{ type: "script", text: "alert(1)" }] });
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('"script"') });
  });

  it("rejects javascript: links", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }],
        },
      ],
    };
    expect(validateDocumentContent(doc)).toMatchObject({ ok: false, error: expect.stringContaining("http") });
  });

  it("rejects oversized documents", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "a".repeat(CONTENT_MAX_BYTES) }] }] };
    expect(validateDocumentContent(doc)).toMatchObject({ ok: false, error: expect.stringContaining("too large") });
  });

  it("rejects pathologically deep nesting", () => {
    let node: Record<string, unknown> = { type: "paragraph" };
    for (let i = 0; i < 50; i++) node = { type: "blockquote", content: [node] };
    expect(validateDocumentContent({ type: "doc", content: [node] }).ok).toBe(false);
  });
});

describe("validateImportFile", () => {
  it("accepts .txt and .md (case-insensitive)", () => {
    expect(validateImportFile({ name: "notes.TXT", size: 10 })).toEqual({ ok: true, kind: "txt" });
    expect(validateImportFile({ name: "readme.md", size: 10 })).toEqual({ ok: true, kind: "md" });
  });
  it("rejects unsupported, empty and oversized files", () => {
    expect(validateImportFile({ name: "report.docx", size: 10 })).toMatchObject({ ok: false, error: expect.stringContaining("Unsupported") });
    expect(validateImportFile({ name: "md", size: 10 }).ok).toBe(false);
    expect(validateImportFile({ name: "a.txt", size: 0 })).toMatchObject({ ok: false, error: "That file is empty." });
    expect(validateImportFile({ name: "a.txt", size: 2_000_000 })).toMatchObject({ ok: false, error: expect.stringContaining("1 MB") });
  });
});

describe("titleFromFileName", () => {
  it("strips the extension", () => {
    expect(titleFromFileName("meeting-notes.md")).toBe("meeting-notes");
    expect(titleFromFileName(".md")).toBe("Untitled document");
  });
});
