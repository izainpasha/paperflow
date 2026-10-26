"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import type { ReactNode } from "react";
import { FONT_FAMILIES, FONT_SIZES, TEXT_ALIGNMENTS } from "@/lib/editor/formatting";

type BlockType = "paragraph" | "h1" | "h2" | "h3";
type Align = (typeof TEXT_ALIGNMENTS)[number];

/** Minimal stroke icons (24px grid) so the toolbar has no icon-library dependency. */
const ICONS: Record<string, ReactNode> = {
  left: <path d="M4 6h16M4 10h10M4 14h16M4 18h10" />,
  center: <path d="M4 6h16M7 10h10M4 14h16M7 18h10" />,
  right: <path d="M4 6h16M10 10h10M4 14h16M10 18h10" />,
  justify: <path d="M4 6h16M4 10h16M4 14h16M4 18h16" />,
  bullets: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  numbers: (
    <>
      <path d="M10 6h10M10 12h10M10 18h10" />
      <path d="M4 5l1.5-1v5M3.5 13.5c.3-.9 2.5-1 2.5.3 0 1-2.5 1.7-2.5 2.7H6" strokeWidth={1.4} />
    </>
  ),
  indent: <path d="M4 6h16M11 10h9M11 14h9M4 18h16M4 9.5l3 2.5-3 2.5" />,
  outdent: <path d="M4 6h16M11 10h9M11 14h9M4 18h16M7 9.5L4 12l3 2.5" />,
  quote: <path d="M7 7h4v4c0 3-1.5 5-4 6M15 7h4v4c0 3-1.5 5-4 6" />,
  clear: <path d="M6 5h12M12 5l-3 14M15 15l5 5M20 15l-5 5" />,
  undo: <path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" />,
  redo: <path d="M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3" />,
};

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}

function ToolbarButton({
  label,
  shortcut,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-pressed={active}
      disabled={disabled}
      // Keep focus (and the selection) in the editor.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`grid h-8 min-w-8 place-items-center rounded-md px-1.5 text-sm transition-colors disabled:opacity-40 ${
        active ? "bg-blue-100 text-blue-800" : "text-slate-700 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

const Divider = () => <span aria-hidden className="mx-1 h-5 w-px bg-slate-200" />;
const selectClass = "h-8 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700";

export function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const style = e.getAttributes("textStyle");
      return {
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        underline: e.isActive("underline"),
        strike: e.isActive("strike"),
        bulletList: e.isActive("bulletList"),
        orderedList: e.isActive("orderedList"),
        blockquote: e.isActive("blockquote"),
        align: (TEXT_ALIGNMENTS.find((a) => a !== "left" && e.isActive({ textAlign: a })) ?? "left") as Align,
        fontFamily: (style.fontFamily as string | undefined) ?? "",
        fontSize: (style.fontSize as string | undefined) ?? "",
        block: (e.isActive("heading", { level: 1 })
          ? "h1"
          : e.isActive("heading", { level: 2 })
            ? "h2"
            : e.isActive("heading", { level: 3 })
              ? "h3"
              : "paragraph") as BlockType,
        canIndent: e.can().indent(),
        canOutdent: e.can().outdent(),
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
      };
    },
  });

  const chain = () => editor.chain().focus();

  const setBlock = (value: BlockType) => {
    if (value === "paragraph") chain().setParagraph().run();
    else chain().setHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 }).run();
  };

  const knownFamily = FONT_FAMILIES.some((f) => f.value === state.fontFamily);

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      // Mobile: one swipeable row (like mobile Docs). Desktop: wraps.
      className="flex items-center gap-1 overflow-x-auto border-t border-slate-100 bg-white px-2 py-1.5 [scrollbar-width:none] md:flex-wrap md:overflow-visible [&>*]:shrink-0"
    >
      <label htmlFor="block-type" className="sr-only">
        Text style
      </label>
      <select id="block-type" value={state.block} onChange={(e) => setBlock(e.target.value as BlockType)} className={selectClass}>
        <option value="paragraph">Normal text</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>

      <label htmlFor="font-family" className="sr-only">
        Font
      </label>
      <select
        id="font-family"
        value={knownFamily ? state.fontFamily : ""}
        onChange={(e) => (e.target.value ? chain().setFontFamily(e.target.value).run() : chain().unsetFontFamily().run())}
        className={`${selectClass} w-32 md:w-36`}
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f.label} value={f.value} style={f.value ? { fontFamily: f.value } : undefined}>
            {f.label}
          </option>
        ))}
      </select>

      <label htmlFor="font-size" className="sr-only">
        Font size
      </label>
      <select
        id="font-size"
        value={(FONT_SIZES as readonly string[]).includes(state.fontSize) ? state.fontSize : ""}
        onChange={(e) => (e.target.value ? chain().setFontSize(e.target.value).run() : chain().unsetFontSize().run())}
        className={`${selectClass} w-20`}
      >
        <option value="">Size</option>
        {FONT_SIZES.map((s) => (
          <option key={s} value={s}>
            {parseInt(s, 10)}
          </option>
        ))}
      </select>

      <Divider />
      <ToolbarButton label="Bold" shortcut="Ctrl+B" active={state.bold} onClick={() => chain().toggleBold().run()}>
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton label="Italic" shortcut="Ctrl+I" active={state.italic} onClick={() => chain().toggleItalic().run()}>
        <em className="font-serif">I</em>
      </ToolbarButton>
      <ToolbarButton label="Underline" shortcut="Ctrl+U" active={state.underline} onClick={() => chain().toggleUnderline().run()}>
        <span className="underline">U</span>
      </ToolbarButton>
      <ToolbarButton label="Strikethrough" shortcut="Ctrl+Shift+S" active={state.strike} onClick={() => chain().toggleStrike().run()}>
        <span className="line-through">S</span>
      </ToolbarButton>

      <Divider />
      {TEXT_ALIGNMENTS.map((a) => (
        <ToolbarButton
          key={a}
          label={`Align ${a}`}
          active={state.align === a}
          onClick={() => (a === "left" ? chain().unsetTextAlign().run() : chain().setTextAlign(a).run())}
        >
          <Icon name={a} />
        </ToolbarButton>
      ))}

      <Divider />
      <ToolbarButton label="Bulleted list" active={state.bulletList} onClick={() => chain().toggleBulletList().run()}>
        <Icon name="bullets" />
      </ToolbarButton>
      <ToolbarButton label="Numbered list" active={state.orderedList} onClick={() => chain().toggleOrderedList().run()}>
        <Icon name="numbers" />
      </ToolbarButton>
      <ToolbarButton label="Decrease indent" shortcut="Shift+Tab" disabled={!state.canOutdent} onClick={() => chain().outdent().run()}>
        <Icon name="outdent" />
      </ToolbarButton>
      <ToolbarButton label="Increase indent" shortcut="Tab" disabled={!state.canIndent} onClick={() => chain().indent().run()}>
        <Icon name="indent" />
      </ToolbarButton>
      <ToolbarButton label="Quote" active={state.blockquote} onClick={() => chain().toggleBlockquote().run()}>
        <Icon name="quote" />
      </ToolbarButton>

      <Divider />
      <ToolbarButton label="Clear formatting" onClick={() => chain().unsetAllMarks().clearNodes().unsetTextAlign().run()}>
        <Icon name="clear" />
      </ToolbarButton>
      <ToolbarButton label="Undo" shortcut="Ctrl+Z" disabled={!state.canUndo} onClick={() => chain().undo().run()}>
        <Icon name="undo" />
      </ToolbarButton>
      <ToolbarButton label="Redo" shortcut="Ctrl+Shift+Z" disabled={!state.canRedo} onClick={() => chain().redo().run()}>
        <Icon name="redo" />
      </ToolbarButton>
    </div>
  );
}
