import { expect, test } from "bun:test";
import {
  findMatchingTools,
  selectActiveDeferredTools,
  selectDeferredTools,
  type ToolMetadata,
} from "../src/core.ts";

const tools: ToolMetadata[] = [
  { name: "search_issues", description: "Search GitHub issues by keyword and state.", parameters: { type: "object", properties: { query: { type: "string" } } }, sourceInfo: { source: "extension" } },
  { name: "deploy_preview", description: "Deploy the current project to a preview environment.", parameters: { type: "object", properties: {} }, sourceInfo: { source: "extension" } },
  { name: "read", description: "Read a file.", parameters: {}, sourceInfo: { source: "builtin" } },
  { name: "activate_tool", description: "Activate deferred tools.", parameters: {}, sourceInfo: { source: "extension" } },
  { name: "sdk_tool", description: "Run an SDK capability.", parameters: {}, sourceInfo: { source: "sdk" } },
];

test("selects active non-built-in tools except direct and discovery tools", () => {
  expect(selectDeferredTools(tools)).toEqual([tools[0], tools[1], tools[4]]);
  expect(selectActiveDeferredTools(tools, new Set(tools.map((tool) => tool.name)), new Set(["read", "search_issues"])))
    .toEqual([tools[1], tools[4]]);
});

test("matches tool requests against tool names and descriptions", () => {
  expect(findMatchingTools("find GitHub tickets", tools.slice(0, 2))).toEqual([tools[0]]);
  expect(findMatchingTools("transcode a video", tools.slice(0, 2))).toEqual([]);
});

test("does not match generic discovery words", () => {
  expect(findMatchingTools("need a tool for this capability", tools.slice(0, 2))).toEqual([]);
});

test("prefers a capability named by the request over a broad tool description", () => {
  const webSearch: ToolMetadata = {
    name: "web_search",
    description: "Search the public web and return cited results.",
    parameters: {},
    sourceInfo: { source: "extension" },
  };
  const batchCommands: ToolMetadata = {
    name: "ctx_batch_execute",
    description: "Run multiple shell commands. It can also search indexed command output and web content.",
    parameters: {},
    sourceInfo: { source: "extension" },
  };

  expect(findMatchingTools("search the web", [batchCommands, webSearch]))
    .toEqual([webSearch, batchCommands]);
});
