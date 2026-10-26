import { Extension } from "@tiptap/core";
import { MAX_INDENT } from "./formatting";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    indent: {
      /** Nests a list item, or indents the selected paragraphs/headings. */
      indent: () => ReturnType;
      /** Un-nests a list item, or outdents the selected paragraphs/headings. */
      outdent: () => ReturnType;
    };
  }
}

const TYPES = ["paragraph", "heading"];

/** Paragraph/heading indentation (Tiptap only ships list nesting). Stored as an integer level. */
export const Indent = Extension.create({
  name: "indent",

  addGlobalAttributes() {
    return [
      {
        types: TYPES,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => {
              const level = Number(el.getAttribute("data-indent"));
              return Number.isInteger(level) ? Math.min(Math.max(level, 0), MAX_INDENT) : 0;
            },
            renderHTML: (attrs) =>
              attrs.indent ? { "data-indent": attrs.indent, style: `margin-left: ${attrs.indent * 2}em` } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    const shift =
      (delta: number) =>
      () =>
      ({ state, tr, dispatch }: import("@tiptap/core").CommandProps) => {
        let changed = false;
        const { from, to } = state.selection;
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (!TYPES.includes(node.type.name)) return;
          const current = (node.attrs.indent as number) ?? 0;
          const next = Math.min(Math.max(current + delta, 0), MAX_INDENT);
          if (next !== current) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
            changed = true;
          }
          return false;
        });
        if (changed && dispatch) dispatch(tr);
        return changed;
      };

    return {
      indent:
        () =>
        (props) =>
          props.editor.isActive("listItem") ? props.commands.sinkListItem("listItem") : shift(1)()(props),
      outdent:
        () =>
        (props) =>
          props.editor.isActive("listItem") ? props.commands.liftListItem("listItem") : shift(-1)()(props),
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.indent(),
      "Shift-Tab": () => this.editor.commands.outdent(),
    };
  },
});
