import { readFile } from "node:fs/promises";
import { parse } from "@iarna/toml";

export interface AllowList {
  tools: string[];
}

export async function resolveDirectTools(
  globalPath: string,
  projectPath: string,
  projectTrusted: boolean,
  warn: (message: string) => void,
): Promise<Set<string>> {
  const global = await readAllowListOrWarn(globalPath, warn);
  const project = projectTrusted ? await readAllowListOrWarn(projectPath, warn) : [];
  return new Set([...global, ...project]);
}

async function readAllowListOrWarn(path: string, warn: (message: string) => void): Promise<string[]> {
  try {
    return (await readAllowList(path)).tools;
  } catch (error) {
    warn(errorMessage(error));
    return [];
  }
}

export async function readAllowList(path: string): Promise<AllowList> {
  let content: string;
  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    if (isMissingFile(error)) return { tools: [] };
    throw new Error(`${path}: ${errorMessage(error)}`);
  }

  let parsed: unknown;
  try {
    parsed = parse(content);
  } catch (error) {
    throw new Error(`${path}: ${errorMessage(error)}`);
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.tools) || !parsed.tools.every((tool) => typeof tool === "string")) {
    throw new Error(`${path}: tools must be an array of strings`);
  }
  return { tools: [...new Set(parsed.tools)] };
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
