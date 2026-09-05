import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthGate } from "@/components/AuthGate";
import * as api from "@/lib/api";
import { ApiError } from "@/lib/api";
import { getStoredToken, storeToken } from "@/lib/auth";
import { initialData } from "@/lib/kanban";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    register: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    fetchCurrentUser: vi.fn(),
    listBoards: vi.fn(),
    createBoard: vi.fn(),
    renameBoard: vi.fn(),
    deleteBoard: vi.fn(),
    fetchBoard: vi.fn(),
    saveBoard: vi.fn(),
    askAI: vi.fn(),
  };
});

const mockedApi = vi.mocked(api);

const BOARD_SUMMARY = { id: "board-1", title: "Kanban Studio", updatedAt: "2024-01-01" };

describe("AuthGate", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("shows the sign-in form when there is no session", async () => {
    render(<AuthGate />);

    expect(
      await screen.findByRole("heading", { name: "Sign in to Kanban Studio" })
    ).toBeInTheDocument();
  });

  it("registers a new user and loads their board", async () => {
    mockedApi.register.mockResolvedValue({
      token: "tok",
      user: { id: "u1", username: "alice" },
    });
    mockedApi.listBoards.mockResolvedValue([BOARD_SUMMARY]);
    mockedApi.fetchBoard.mockResolvedValue(initialData);
    render(<AuthGate />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Need an account? Create one" })
    );
    await userEvent.type(screen.getByLabelText("Username"), "alice");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();
    expect(getStoredToken()).toBe("tok");
    expect(mockedApi.register).toHaveBeenCalledWith("alice", "password123");
  });

  it("shows an error for invalid login credentials", async () => {
    mockedApi.login.mockRejectedValue(new Error("Invalid username or password"));
    render(<AuthGate />);

    await screen.findByRole("heading", { name: "Sign in to Kanban Studio" });
    await userEvent.type(screen.getByLabelText("Username"), "alice");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid username or password"
    );
  });

  it("restores an existing session from a stored token", async () => {
    storeToken("tok");
    mockedApi.fetchCurrentUser.mockResolvedValue({ id: "u1", username: "alice" });
    mockedApi.listBoards.mockResolvedValue([BOARD_SUMMARY]);
    mockedApi.fetchBoard.mockResolvedValue(initialData);

    render(<AuthGate />);

    expect(await screen.findByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();
  });

  it("keeps a stored token when session restore fails transiently, and shows a notice", async () => {
    storeToken("tok");
    mockedApi.fetchCurrentUser.mockRejectedValue(new ApiError(500, "Server error"));

    render(<AuthGate />);

    expect(
      await screen.findByRole("heading", { name: "Sign in to Kanban Studio" })
    ).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to reach the server"
    );
    expect(getStoredToken()).toBe("tok");
  });

  it("clears a stored token when the session is genuinely invalid", async () => {
    storeToken("tok");
    mockedApi.fetchCurrentUser.mockRejectedValue(new ApiError(401, "Invalid session"));

    render(<AuthGate />);

    expect(
      await screen.findByRole("heading", { name: "Sign in to Kanban Studio" })
    ).toBeInTheDocument();
    expect(getStoredToken()).toBeNull();
  });

  it("logs out and returns to the sign-in form", async () => {
    storeToken("tok");
    mockedApi.fetchCurrentUser.mockResolvedValue({ id: "u1", username: "alice" });
    mockedApi.listBoards.mockResolvedValue([BOARD_SUMMARY]);
    mockedApi.fetchBoard.mockResolvedValue(initialData);
    mockedApi.logout.mockResolvedValue(undefined);
    render(<AuthGate />);
    await screen.findByRole("heading", { name: "Kanban Studio" });

    await userEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Sign in to Kanban Studio" })
      ).toBeInTheDocument()
    );
    expect(getStoredToken()).toBeNull();
  });

  it("creates a new board and switches to it", async () => {
    storeToken("tok");
    mockedApi.fetchCurrentUser.mockResolvedValue({ id: "u1", username: "alice" });
    mockedApi.listBoards.mockResolvedValue([BOARD_SUMMARY]);
    mockedApi.fetchBoard.mockResolvedValue(initialData);
    mockedApi.createBoard.mockResolvedValue({
      id: "board-2",
      title: "Second",
      updatedAt: "2024-01-02",
    });
    render(<AuthGate />);
    await screen.findByRole("heading", { name: "Kanban Studio" });

    await userEvent.click(screen.getByRole("button", { name: "New board" }));
    await userEvent.type(screen.getByLabelText("New board name"), "Second");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(mockedApi.fetchBoard).toHaveBeenLastCalledWith("board-2"));
  });
});
