import { describe, expect, it } from "vitest";
import { CHANGELOG, parseVersion, versionLabel } from "./changelog";

describe("changelog", () => {
  it("reads the date and time out of a release tag", () => {
    expect(parseVersion("20261111-093015")).toEqual({ date: "2026-11-11", time: "09:30" });
    expect(parseVersion("dev")).toBeNull();
    expect(versionLabel("20261006-231457")).toBe("6 ຕຸລາ 2026 · 23:14");
  });
  it("leaves only the newest entry without a version", () => {
    expect(CHANGELOG[0].version).toBeUndefined();
    expect(CHANGELOG.slice(1).every((e) => e.version && parseVersion(e.version))).toBe(true);
  });
});
