import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImportButton } from "./import-button";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
// The real server action pulls in server-only modules; tests inject `create` instead.
vi.mock("@/app/actions/documents", () => ({ createDocument: vi.fn() }));

describe("ImportButton", () => {
  beforeEach(() => push.mockReset());

  it("rejects unsupported file types without calling the server", async () => {
    const create = vi.fn();
    render(<ImportButton create={create} />);

    // applyAccept: false simulates a user bypassing the file picker's filter.
    await userEvent.setup({ applyAccept: false }).upload(
      screen.getByTestId("import-input"),
      new File(["%PDF"], "report.pdf", { type: "application/pdf" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Only .txt and .md files can be imported");
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects files with no text", async () => {
    const create = vi.fn();
    render(<ImportButton create={create} />);
    await userEvent.upload(screen.getByTestId("import-input"), new File(["   \n  "], "blank.txt", { type: "text/plain" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("empty");
    expect(create).not.toHaveBeenCalled();
  });

  it("converts a markdown file into a new document and opens it", async () => {
    const create = vi.fn().mockResolvedValue({ ok: true, data: { id: "doc-123" } });
    render(<ImportButton create={create} />);

    await userEvent.upload(
      screen.getByTestId("import-input"),
      new File(["# Launch plan\n\n- **Ship** it\n"], "launch-plan.md", { type: "text/markdown" }),
    );

    await waitFor(() => expect(push).toHaveBeenCalledWith("/documents/doc-123"));
    const { title, content } = create.mock.calls[0][0];
    expect(title).toBe("launch-plan");
    expect(content.content[0]).toMatchObject({ type: "heading", attrs: { level: 1 } });
    expect(content.content[1].type).toBe("bulletList");
  });

  it("shows server errors", async () => {
    const create = vi.fn().mockResolvedValue({ ok: false, error: "Your session has expired. Please sign in again." });
    render(<ImportButton create={create} />);
    await userEvent.upload(screen.getByTestId("import-input"), new File(["hello"], "a.txt", { type: "text/plain" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("session has expired");
    expect(push).not.toHaveBeenCalled();
  });
});
