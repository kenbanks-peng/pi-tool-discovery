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

  expect(section).toContain("<discoverable_tools>");
  expect(section).toContain('name="search_issues"');
  expect(section).toContain('description="Search GitHub issues by keyword and state."');

  const location = section.match(/location="([^"]+)"/)?.[1];
  expect(location).toBeDefined();
  const content = await readFile(location!, "utf8");
  expect(content).toContain("# search_issues");
  expect(content).toContain(tool.description);
  expect(content).toContain('"query"');
  expect(content).toContain(tool.promptGuidelines[0]);
});

test("places discoverable tools in the normal tools section", () => {
  const prompt = "Available tools:\n- read: Read files.\n\nIn addition to the tools above, more tools may exist.";
  const section = "<discoverable_tools>\n  <tool name=\"search_issues\" location=\"/tmp/tool.md\" />\n</discoverable_tools>";

  expect(injectDiscoverableTools(prompt, section)).toBe(
    "Available tools:\n- read: Read files.\n\n<discoverable_tools>\n  <tool name=\"search_issues\" location=\"/tmp/tool.md\" />\n</discoverable_tools>\n\nIn addition to the tools above, more tools may exist.",
  );
});
