import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as actions from "@/app/actions/documents";
import { SharePanel } from "./share-panel";

vi.mock("@/app/actions/documents", () => ({
  fetchShares: vi.fn(),
  shareDocument: vi.fn(),
  updateSharePermission: vi.fn(),
  revokeShare: vi.fn(),
}));

const DOC = "11111111-1111-4111-8111-111111111111";
const bob = { id: "s1", email: "bob@paperflow.test", permission: "viewer" as const };

describe("SharePanel permission changes", () => {
  beforeEach(() => {
    vi.mocked(actions.fetchShares).mockResolvedValue({ ok: true, data: [bob] });
  });

  it("shows saving, then saved, and confirms the new access", async () => {
    let resolve!: (v: Awaited<ReturnType<typeof actions.updateSharePermission>>) => void;
    vi.mocked(actions.updateSharePermission).mockReturnValue(new Promise((r) => (resolve = r)));
    render(<SharePanel documentId={DOC} onClose={() => {}} />);

    const select = await screen.findByLabelText(`Permission for ${bob.email}`);
    await userEvent.selectOptions(select, "editor");

    const status = screen.getByTestId(`share-status-${bob.email}`);
    expect(status).toHaveTextContent("Saving…");
    expect(select).toBeDisabled();
    expect(select).toHaveValue("editor"); // optimistic

    resolve({ ok: true, data: [{ ...bob, permission: "editor" }] });
    expect(await screen.findByText("✓ Saved")).toBeInTheDocument();
    expect(select).toBeEnabled();
    expect(screen.getByText(`${bob.email} can now edit.`)).toBeInTheDocument();
  });

  it("rolls back and shows the error when the change fails", async () => {
    vi.mocked(actions.updateSharePermission).mockResolvedValue({ ok: false, error: "Only the owner can change access." });
    render(<SharePanel documentId={DOC} onClose={() => {}} />);

    const select = await screen.findByLabelText(`Permission for ${bob.email}`);
    await userEvent.selectOptions(select, "editor");

    expect(await screen.findByRole("alert")).toHaveTextContent("Only the owner can change access.");
    expect(select).toHaveValue("viewer");
    expect(screen.queryByText("✓ Saved")).not.toBeInTheDocument();
  });
});
