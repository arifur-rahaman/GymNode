import { describe, expect, it } from "vitest";
import { isStaffLoginEmail, loginIdentifierToEmail, staffLoginEmail } from "./staff-login";

describe("staff login", () => {
  it("maps any phone format to the same internal login", () => {
    expect(staffLoginEmail("01722222222")).toBe("8801722222222@staff.gymnode.invalid");
    expect(staffLoginEmail("+880 1722-222222")).toBe("8801722222222@staff.gymnode.invalid");
  });
  it("rejects invalid phones", () => {
    expect(() => staffLoginEmail("12345")).toThrow(RangeError);
  });
  it("treats the login box input as phone or email", () => {
    expect(loginIdentifierToEmail(" 01722222222 ")).toBe("8801722222222@staff.gymnode.invalid");
    expect(loginIdentifierToEmail(" Owner@GymNode.test ")).toBe("owner@gymnode.test");
  });
  it("recognises internal staff logins", () => {
    expect(isStaffLoginEmail("8801722222222@staff.gymnode.invalid")).toBe(true);
    expect(isStaffLoginEmail("owner@gymnode.test")).toBe(false);
  });
});
