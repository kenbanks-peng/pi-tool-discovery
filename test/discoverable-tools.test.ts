import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { createDiscoverableTools, injectDiscoverableTools } from "../src/discoverable-tools.ts";

const tool = {
  name: "search_issues",
  description: "Search GitHub issues by keyword and state. Supports repository filters.",
  parameters: { type: "object", properties: { query: { type: "string" } } },
  promptGuidelines: ["Use search_issues to find GitHub issues."],
  sourceInfo: { source: "extension" },
};

test("writes full tool metadata and returns compact XML pointers", async () => {
  const section = await createDiscoverableTools([tool], "test/session");

  expect(section).toContain("<tool_discovery>");
  expect(section).toContain('  <tool\n    name="search_issues"');
  expect(section).toContain('    description="Search GitHub issues by keyword and state."');

  const location = section.match(/location="([^"]+)"/)?.[1];
  expect(location).toBeDefined();
  const content = await readFile(location!, "utf8");
  expect(content).toContain("# search_issues");
  expect(content).toContain(tool.description);
  expect(content).toContain('"query"');
  expect(content).toContain(tool.promptGuidelines[0]);
});

test("places tool discovery below the tools section", () => {
  const prompt = "<tools>\n  <tool name=\"read\" />\n</tools>\n\n<instructions>Use tools safely.</instructions>";
  const section = "<tool_discovery>\n  <tool\n    name=\"search_issues\"\n    location=\"/tmp/tool.md\"\n  />\n</tool_discovery>";

  expect(injectDiscoverableTools(prompt, section)).toBe(
    "<tools>\n  <tool name=\"read\" />\n</tools>\n\n<tool_discovery>\n  <tool\n    name=\"search_issues\"\n    location=\"/tmp/tool.md\"\n  />\n</tool_discovery>\n\n<instructions>Use tools safely.</instructions>",
  );
});
