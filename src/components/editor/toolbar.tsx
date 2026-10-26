"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import type { ReactNode } from "react";

type BlockType = "paragraph" | "h1" | "h2" | "h3";

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      // Keep focus (and the selection) in the editor.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`grid h-8 min-w-8 place-items-center rounded-md px-2 text-sm transition-colors disabled:opacity-40 ${
        active ? "bg-blue-100 text-blue-800" : "text-slate-700 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

export function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      block: (e.isActive("heading", { level: 1 })
        ? "h1"
        : e.isActive("heading", { level: 2 })
          ? "h2"
          : e.isActive("heading", { level: 3 })
            ? "h3"
            : "paragraph") as BlockType,
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const setBlock = (value: BlockType) => {
    const chain = editor.chain().focus();
    if (value === "paragraph") chain.setParagraph().run();
    else chain.setHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 }).run();
  };

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white px-2 py-1.5"
    >
      <label htmlFor="block-type" className="sr-only">
        Text style
      </label>
      <select
        id="block-type"
        value={state.block}
        onChange={(e) => setBlock(e.target.value as BlockType)}
        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700"
      >
        <option value="paragraph">Normal text</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
      <span aria-hidden className="mx-1 h-5 w-px bg-slate-200" />
      <ToolbarButton label="Bold" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton label="Italic" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <em className="font-serif">I</em>
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        active={state.underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <span className="underline">U</span>
      </ToolbarButton>
      <span aria-hidden className="mx-1 h-5 w-px bg-slate-200" />
      <ToolbarButton
        label="Bulleted list"
        active={state.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        • ≡
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={state.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1. ≡
      </ToolbarButton>
      <span aria-hidden className="mx-1 h-5 w-px bg-slate-200" />
      <ToolbarButton label="Undo" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}>
        ↶
      </ToolbarButton>
      <ToolbarButton label="Redo" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}>
        ↷
      </ToolbarButton>
    </div>
  );
}
