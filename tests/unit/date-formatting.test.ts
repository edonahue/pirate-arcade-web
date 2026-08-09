import { describe, it, expect } from "vitest";
import {
  formatDateShort,
  formatDateLong,
  formatDateTimeISO,
} from "../../src/lib/date";

describe("date formatting helpers", () => {
  // Create a date that represents 2026-06-10 in UTC
  // Note: Date constructor with ISO date-only string treats it as UTC
  const testDate = new Date("2026-06-10");

  it("formatDateShort returns Jun 10, 2026 regardless of timezone", () => {
    expect(formatDateShort(testDate)).toBe("Jun 10, 2026");
  });

  it("formatDateLong returns June 10, 2026 regardless of timezone", () => {
    expect(formatDateLong(testDate)).toBe("June 10, 2026");
  });

  it("formatDateTimeISO returns 2026-06-10 for datetime attribute", () => {
    expect(formatDateTimeISO(testDate)).toBe("2026-06-10");
  });

  it("handles year boundary dates correctly", () => {
    const newYear = new Date("2026-01-01");
    const newYearEve = new Date("2025-12-31");

    expect(formatDateShort(newYear)).toBe("Jan 1, 2026");
    expect(formatDateLong(newYear)).toBe("January 1, 2026");
    expect(formatDateTimeISO(newYear)).toBe("2026-01-01");

    expect(formatDateShort(newYearEve)).toBe("Dec 31, 2025");
    expect(formatDateLong(newYearEve)).toBe("December 31, 2025");
    expect(formatDateTimeISO(newYearEve)).toBe("2025-12-31");
  });

  it("handles leap year dates correctly", () => {
    const leapDay = new Date("2024-02-29");
    expect(formatDateShort(leapDay)).toBe("Feb 29, 2024");
    expect(formatDateLong(leapDay)).toBe("February 29, 2024");
    expect(formatDateTimeISO(leapDay)).toBe("2024-02-29");
  });
});
