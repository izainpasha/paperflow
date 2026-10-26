import TextAlign from "@tiptap/extension-text-align";
import { FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import StarterKit from "@tiptap/starter-kit";
import { SAFE_HREF, TEXT_ALIGNMENTS } from "./formatting";
import { Indent } from "./indent";

export const HEADING_LEVELS = [1, 2, 3] as const;

/** Single source of truth for the editor schema, shared by the editor and file import. */
export const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [...HEADING_LEVELS] },
    link: {
      openOnClick: false,
      autolink: true,
      protocols: ["http", "https", "mailto"],
      // Relative links (e.g. "README.md" in imported Markdown) have no meaning inside Paperflow,
      // so they become plain text on import/paste rather than links the server would reject.
      isAllowedUri: (url) => SAFE_HREF.test(url.trim()),
      HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
    },
  }),
  TextStyle,
  FontFamily,
  FontSize,
  TextAlign.configure({ types: ["heading", "paragraph"], alignments: [...TEXT_ALIGNMENTS] }),
  Indent,
];
