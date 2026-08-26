import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthGate } from "@/components/AuthGate";
import { AUTH_STORAGE_KEY } from "@/lib/auth";

describe("AuthGate", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("requires valid credentials before showing the board", async () => {
    render(<AuthGate />);

    expect(screen.queryByRole("heading", { name: "Kanban Studio" })).not.toBeInTheDocument();

    await userEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid username or password.");

    await userEvent.type(screen.getByLabelText("Username"), "user");
    await userEvent.type(screen.getByLabelText("Password"), "password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBe("true");
  });

  it("restores the session and supports logout", async () => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
    render(<AuthGate />);

    expect(await screen.findByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Sign in to Kanban Studio" })).toBeInTheDocument()
    );
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });
});
