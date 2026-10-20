import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseTwee } from "./lib/twee-parser.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(projectRoot, "narrative", "journey", "story.zh-CN.twee");
const clientOutputPath = path.join(
  projectRoot,
  "src",
  "client",
  "config",
  "generated",
  "journey-story.zh-CN.js",
);
const serverOutputPath = path.join(
  projectRoot,
  "src",
  "server",
  "generated",
  "journey-story.ts",
);

async function writeIfChanged(filePath, content) {
  let previous = "";
  try {
    previous = await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (previous === content) return false;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
  return true;
}

function clientModule(story) {
  return `// Generated from narrative/journey/story.zh-CN.twee. Do not edit by hand.\n\n`
    + `function deepFreeze(value) {\n`
    + `  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;\n`
    + `  Object.freeze(value);\n`
    + `  for (const child of Object.values(value)) deepFreeze(child);\n`
    + `  return value;\n`
    + `}\n\n`
    + `export const journeyStory = deepFreeze(${JSON.stringify(story, null, 2)});\n\n`
    + `export function getJourneyPassage(passageId) {\n`
    + `  return journeyStory.passages[passageId] ?? journeyStory.passages[journeyStory.start];\n`
    + `}\n`;
}

function serverModule(story) {
  const transitions = Object.fromEntries(
    story.passageOrder.map((id) => [id, story.passages[id].choices.map(({ target }) => target)]),
  );
  return `// Generated from narrative/journey/story.zh-CN.twee. Do not edit by hand.\n\n`
    + `export const JOURNEY_STORY_START = ${JSON.stringify(story.start)};\n`
    + `export const JOURNEY_STORY_REVISION = ${JSON.stringify(story.revision)};\n`
    + `export const JOURNEY_STORY_TRANSITIONS: Readonly<Record<string, readonly string[]>> = ${JSON.stringify(transitions, null, 2)};\n`
    + `export const JOURNEY_STORY_PASSAGE_IDS = new Set(Object.keys(JOURNEY_STORY_TRANSITIONS));\n`
    + `export const JOURNEY_STORY_ENDINGS = new Set(${JSON.stringify(story.endingIds)});\n`;
}

const source = await readFile(sourcePath, "utf8");
const story = parseTwee(source);
const [clientChanged, serverChanged] = await Promise.all([
  writeIfChanged(clientOutputPath, clientModule(story)),
  writeIfChanged(serverOutputPath, serverModule(story)),
]);

console.log(
  `Journey narrative: ${story.passageOrder.length} passages, revision ${story.revision}`
  + `${clientChanged || serverChanged ? " (generated files updated)" : " (generated files current)"}`,
);
