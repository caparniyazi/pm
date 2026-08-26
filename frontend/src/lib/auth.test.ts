import { isValidCredentials } from "@/lib/auth";

describe("isValidCredentials", () => {
  it("accepts the MVP credentials", () => {
    expect(isValidCredentials("user", "password")).toBe(true);
  });

  it("rejects invalid credentials", () => {
    expect(isValidCredentials("user", "wrong")).toBe(false);
    expect(isValidCredentials("other", "password")).toBe(false);
  });
});
