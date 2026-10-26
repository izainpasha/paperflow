import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { editorExtensions } from "@/lib/editor/extensions";
import { Toolbar } from "./toolbar";

let editor: Editor | null = null;

function makeEditor(text: string) {
  editor = new Editor({
    extensions: editorExtensions,
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] },
  });
  return editor;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("Toolbar", () => {
  it("applies bold/underline to the selection and reflects active state", async () => {
    const ed = makeEditor("Hello world");
    render(<Toolbar editor={ed} />);
    act(() => {
      ed.commands.setTextSelection({ from: 1, to: 6 }); // "Hello"
    });

    const bold = screen.getByRole("button", { name: "Bold" });
    expect(bold).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(bold);
    await userEvent.click(screen.getByRole("button", { name: "Underline" }));

    expect(bold).toHaveAttribute("aria-pressed", "true");
    const firstText = ed.getJSON().content?.[0].content?.[0];
    expect(firstText).toMatchObject({ text: "Hello" });
    expect(firstText?.marks?.map((m) => m.type)).toEqual(expect.arrayContaining(["bold", "underline"]));
  });

  it("switches block type to a heading and toggles lists", async () => {
    const ed = makeEditor("Agenda");
    render(<Toolbar editor={ed} />);

    await userEvent.selectOptions(screen.getByLabelText("Text style"), "h2");
    expect(ed.getJSON().content?.[0]).toMatchObject({ type: "heading", attrs: { level: 2 } });
    expect(screen.getByLabelText("Text style")).toHaveValue("h2");

    await userEvent.selectOptions(screen.getByLabelText("Text style"), "paragraph");
    await userEvent.click(screen.getByRole("button", { name: "Numbered list" }));
    expect(ed.getJSON().content?.[0].type).toBe("orderedList");
    expect(screen.getByRole("button", { name: "Numbered list" })).toHaveAttribute("aria-pressed", "true");
  });

  it("applies font, size, alignment and indentation", async () => {
    const ed = makeEditor("Styled");
    render(<Toolbar editor={ed} />);
    act(() => {
      ed.commands.selectAll();
    });

    await userEvent.selectOptions(screen.getByLabelText("Font"), "Georgia");
    await userEvent.selectOptions(screen.getByLabelText("Font size"), "24");
    await userEvent.click(screen.getByRole("button", { name: "Align center" }));
    await userEvent.click(screen.getByRole("button", { name: "Increase indent" }));

    const para = ed.getJSON().content?.[0];
    expect(para?.attrs).toMatchObject({ textAlign: "center", indent: 1 });
    expect(para?.content?.[0].marks).toContainEqual({
      type: "textStyle",
      attrs: { fontFamily: "Georgia, serif", fontSize: "24px" },
    });
    expect(screen.getByRole("button", { name: "Align center" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Decrease indent" })).toBeEnabled();

    await userEvent.click(screen.getByRole("button", { name: "Decrease indent" }));
    expect(ed.getJSON().content?.[0].attrs?.indent).toBe(0);
    expect(screen.getByRole("button", { name: "Decrease indent" })).toBeDisabled();
  });

  it("formatting round-trips through JSON, which is what gets persisted", () => {
    const ed = makeEditor("Persist me");
    ed.chain().selectAll().toggleItalic().setHeading({ level: 1 }).run();
    const saved = JSON.parse(JSON.stringify(ed.getJSON()));

    const reopened = new Editor({ extensions: editorExtensions, content: saved });
    expect(reopened.getJSON()).toEqual(saved);
    // StarterKit's trailingNode keeps an empty paragraph after a final heading.
    expect(reopened.getHTML()).toContain("<h1><em>Persist me</em></h1>");
    reopened.destroy();
  });
});
