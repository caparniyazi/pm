import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthForm } from "@/components/AuthForm";
import { login, register } from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, login: vi.fn(), register: vi.fn() };
});

const mockedLogin = vi.mocked(login);
const mockedRegister = vi.mocked(register);

describe("AuthForm", () => {
  beforeEach(() => {
    mockedLogin.mockReset();
    mockedRegister.mockReset();
  });

  it("defaults to sign-in mode and logs in", async () => {
    mockedLogin.mockResolvedValue({ token: "tok", user: { id: "u1", username: "alice" } });
    const onAuthenticated = vi.fn();
    render(<AuthForm onAuthenticated={onAuthenticated} />);

    expect(screen.getByRole("heading", { name: "Sign in to Kanban Studio" })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Username"), "alice");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(mockedLogin).toHaveBeenCalledWith("alice", "password123");
    expect(onAuthenticated).toHaveBeenCalledWith("tok", { id: "u1", username: "alice" });
  });

  it("switches to registration mode and registers", async () => {
    mockedRegister.mockResolvedValue({ token: "tok", user: { id: "u2", username: "bob" } });
    const onAuthenticated = vi.fn();
    render(<AuthForm onAuthenticated={onAuthenticated} />);

    await userEvent.click(screen.getByRole("button", { name: "Need an account? Create one" }));
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Username"), "bob");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(mockedRegister).toHaveBeenCalledWith("bob", "password123");
    expect(onAuthenticated).toHaveBeenCalledWith("tok", { id: "u2", username: "bob" });
  });

  it("shows the backend error message on failure", async () => {
    mockedLogin.mockRejectedValue(new Error("Invalid username or password"));
    render(<AuthForm onAuthenticated={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Username"), "alice");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid username or password"
    );
  });
});
