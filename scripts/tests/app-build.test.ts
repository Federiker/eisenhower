import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { artefacts, clashes, formatSize, isInstaller, profileOf, programName } from "../app-build";

describe("profileOf", () => {
  it("reads --release or --debug", () => {
    expect(profileOf(["--release"])).toEqual({ profile: "release" });
    expect(profileOf(["--debug"])).toEqual({ profile: "debug" });
    expect(profileOf(["--debug", "--debug"])).toEqual({ profile: "debug" });
  });

  it("refuses none, both or anything else, saying why", () => {
    expect(profileOf([])).toEqual({ problem: expect.stringContaining("--release or --debug") });
    expect(profileOf(["--release", "--debug"])).toEqual({ problem: expect.stringContaining("--release or --debug") });
    expect(profileOf(["--fast"])).toEqual({ problem: expect.stringContaining("Unknown option --fast") });
  });
});

describe("programName", () => {
  it("is the binary with .exe on Windows, the binary on Linux and none on macOS", () => {
    expect(programName("planner", "win32")).toBe("planner.exe");
    expect(programName("planner", "linux")).toBe("planner");
    expect(programName("planner", "darwin")).toBeUndefined();
  });
});

describe("isInstaller", () => {
  it("takes every platform's installers", () => {
    for (const name of [
      "Planner_1.0.0_x64_en-GB.msi",
      "Planner_1.0.0_x64-setup.exe",
      "Planner.app",
      "Planner_1.0.0_aarch64.dmg",
      "Planner_1.0.0_amd64.deb",
      "Planner-1.0.0-1.x86_64.rpm",
      "Planner_1.0.0_amd64.AppImage",
    ]) {
      expect(isInstaller(name), name).toBe(true);
    }
  });

  it("leaves the staging folders, the scripts and a temporary disk image", () => {
    for (const name of [
      "Planner_1.0.0_amd64",
      "Planner.AppDir",
      "build_appimage.sh",
      "rw.12345.Planner.dmg",
      "icon.icns",
    ]) {
      expect(isInstaller(name), name).toBe(false);
    }
  });
});

describe("artefacts", () => {
  const folder = join("work", "target", "release");

  it("takes the program, then each format's installers in order", () => {
    const found = artefacts(
      folder,
      { nsis: ["Planner_1.0.0_x64-setup.exe"], msi: ["Planner_1.0.0_x64_en-GB.msi"] },
      "planner.exe",
    );
    expect(found).toEqual([
      { from: join(folder, "planner.exe"), name: "planner.exe" },
      { from: join(folder, "bundle", "msi", "Planner_1.0.0_x64_en-GB.msi"), name: "Planner_1.0.0_x64_en-GB.msi" },
      { from: join(folder, "bundle", "nsis", "Planner_1.0.0_x64-setup.exe"), name: "Planner_1.0.0_x64-setup.exe" },
    ]);
  });

  it("skips what is not an installer, and has no program on macOS", () => {
    const found = artefacts(
      folder,
      { macos: ["Planner.app", "rw.1.Planner.dmg"], dmg: ["Planner_1.0.0_aarch64.dmg", "bundle_dmg.sh"] },
      undefined,
    );
    expect(found.map((item) => item.name)).toEqual(["Planner_1.0.0_aarch64.dmg", "Planner.app"]);
  });

  it("finds nothing when tauri build made no bundle", () => {
    expect(artefacts(folder, {}, undefined)).toEqual([]);
    expect(artefacts(folder, { deb: ["Planner_1.0.0_amd64"] }, "planner")).toEqual([
      { from: join(folder, "planner"), name: "planner" },
    ]);
  });
});

describe("clashes", () => {
  it("names the artefacts that would take the same name, whatever the case", () => {
    expect(clashes([])).toEqual([]);
    expect(
      clashes([
        { from: "a", name: "planner.exe" },
        { from: "b", name: "Planner.exe" },
        { from: "c", name: "Planner.msi" },
      ]),
    ).toEqual(["Planner.exe"]);
  });
});

describe("formatSize", () => {
  it("shows bytes, kilobytes and megabytes", () => {
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(2048)).toBe("2.0 KB");
    expect(formatSize(5 * 1024 * 1024 + 512 * 1024)).toBe("5.5 MB");
  });
});
