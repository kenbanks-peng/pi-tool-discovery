import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readAllowList, resolveDirectTools } from "../src/config.ts";

describe("readAllowList", () => {
  test("reads tool names from a TOML tools array", async () => {
    const directory = await mkdtemp(join(tmpdir(), "tool-discovery-config-"));
    const path = join(directory, "tool-discovery.toml");
    await writeFile(path, 'tools = ["search_issues", "deploy_preview"]\n');

    await expect(readAllowList(path)).resolves.toEqual({ tools: ["search_issues", "deploy_preview"] });
  });

  test("accepts a missing file as an empty allow-list", async () => {
    await expect(readAllowList("/definitely/not/a/config.toml")).resolves.toEqual({ tools: [] });
  });

  test("merges global and trusted project allow-lists", async () => {
    const directory = await mkdtemp(join(tmpdir(), "tool-discovery-config-"));
    const globalPath = join(directory, "global.toml");
    const projectPath = join(directory, "project.toml");
    await writeFile(globalPath, 'tools = ["search_issues"]\n');
    await writeFile(projectPath, 'tools = ["deploy_preview"]\n');

    await expect(resolveDirectTools(globalPath, projectPath, true, () => {})).resolves.toEqual(
      new Set(["search_issues", "deploy_preview"]),
    );
    await expect(resolveDirectTools(globalPath, projectPath, false, () => {})).resolves.toEqual(
      new Set(["search_issues"]),
    );
  });

  test("warns and ignores invalid files", async () => {
    const warnings: string[] = [];
    const directory = await mkdtemp(join(tmpdir(), "tool-discovery-config-"));
    const path = join(directory, "tool-discovery.toml");
    await writeFile(path, "tools = [42]\n");

    await expect(resolveDirectTools(path, "/not-used.toml", false, (warning) => warnings.push(warning))).resolves.toEqual(new Set());
    expect(warnings).toEqual([`${path}: tools must be an array of strings`]);
  });

  test("identifies invalid files and validation errors", async () => {
    const directory = await mkdtemp(join(tmpdir(), "tool-discovery-config-"));
    const path = join(directory, "tool-discovery.toml");
    await writeFile(path, "tools = [42]\n");

    await expect(readAllowList(path)).rejects.toThrow(`${path}: tools must be an array of strings`);
  });
});
