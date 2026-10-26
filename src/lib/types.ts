import type { JSONContent } from "@tiptap/core";

export type SharePermission = "viewer" | "editor";
export type AccessRole = "owner" | SharePermission;
export type DocumentView = "all" | "mine" | "shared";

export type DocumentSummary = {
  id: string;
  title: string;
  updatedAt: string;
  ownerEmail: string | null;
  role: AccessRole;
};

export type DocumentDetail = {
  id: string;
  title: string;
  content: JSONContent;
  updatedAt: string;
  ownerEmail: string | null;
  role: AccessRole;
};

export type DocumentShare = {
  id: string;
  email: string;
  permission: SharePermission;
};

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };
