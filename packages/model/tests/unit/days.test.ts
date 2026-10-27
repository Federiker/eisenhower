import {
  addDays,
  addMonths,
  calendarDaySchema,
  compareDays,
  dayAsDate,
  dayNumber,
  dayOfNumber,
  dayParts,
  daysBetween,
  isCalendarDay,
  isLeapYear,
  isoWeekday,
  startOfMonth,
  startOfWeek,
  today,
} from "../../src";

describe("calendar days", () => {
  it("knows which days exist", () => {
    expect(isCalendarDay("2024-02-29")).toBe(true);
    expect(isCalendarDay("2023-02-29")).toBe(false);
    expect(isCalendarDay("2026-04-31")).toBe(false);
    expect(isCalendarDay("2026-13-01")).toBe(false);
    expect(isCalendarDay("0000-01-01")).toBe(false);
    expect(isCalendarDay("2026-1-1")).toBe(false);
    expect(dayParts("1066-10-14")).toEqual({ year: 1066, month: 10, day: 14 });
    expect(calendarDaySchema.safeParse("2026-10-27").success).toBe(true);
    expect(calendarDaySchema.safeParse("27/10/2026").success).toBe(false);
  });

  it("knows the leap years of the proleptic Gregorian calendar", () => {
    expect([1900, 2000, 2024, 2026].map(isLeapYear)).toEqual([false, true, true, false]);
    expect(isLeapYear(0)).toBe(true);
    expect(isLeapYear(-4)).toBe(true);
  });

  it("counts days across months, years and early years", () => {
    expect(dayNumber("1970-01-01")).toBe(0);
    expect(dayOfNumber(dayNumber("0001-01-01"))).toBe("0001-01-01");
    expect(dayOfNumber(dayNumber("9999-12-31"))).toBe("9999-12-31");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-10-27", "2026-11-03")).toBe(7);
    expect(daysBetween("2026-11-03", "2026-10-27")).toBe(-7);
    expect(() => dayNumber("nope")).toThrow(RangeError);
  });

  it("orders days and finds weeks and months", () => {
    expect(compareDays("2026-01-02", "2026-01-10")).toBe(-1);
    expect(compareDays("2026-01-10", "2026-01-02")).toBe(1);
    expect(compareDays("2026-01-10", "2026-01-10")).toBe(0);
    expect(isoWeekday("2026-10-26")).toBe(1);
    expect(isoWeekday("2026-11-01")).toBe(7);
    expect(startOfWeek("2026-10-29")).toBe("2026-10-26");
    expect(startOfWeek("2026-11-01")).toBe("2026-10-26");
    expect(startOfMonth("2026-10-27")).toBe("2026-10-01");
    expect(addMonths("2026-10-27", 3)).toBe("2027-01-01");
    expect(addMonths("2026-01-31", -1)).toBe("2025-12-01");
    expect(() => addMonths("x", 1)).toThrow(RangeError);
  });

  it("takes today from the local clock and gives a date safe for Intl in UTC", () => {
    expect(today(new Date(2026, 9, 27, 23, 59))).toBe("2026-10-27");
    expect(typeof today()).toBe("string");
    const date = dayAsDate("2026-10-27");
    expect(new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", dateStyle: "long" }).format(date)).toBe(
      "27 October 2026",
    );
  });
});
