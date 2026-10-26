import StarterKit from "@tiptap/starter-kit";

export const HEADING_LEVELS = [1, 2, 3] as const;

/** Single source of truth for the editor schema, shared by the editor and file import. */
export const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [...HEADING_LEVELS] },
    link: {
      openOnClick: false,
      autolink: true,
      protocols: ["http", "https", "mailto"],
      HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
    },
  }),
];
