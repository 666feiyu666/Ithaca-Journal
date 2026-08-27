const PASSAGE_HEADER = /^::\s+([^\[]+?)(?:\s+\[([^\]]*)\])?\s*$/;
const LINK = /\[\[([^\[\]]+?)->([A-Za-z0-9_:-]+)\]\]/g;
const SECTION_TAGS = ["prologue", "chapter-1", "chapter-2", "chapter-3", "chapter-4"];
const LAYER_TAGS = ["layer-reality", "layer-design"];

function exactlyOne(tags, candidates, passageId, kind) {
  const matches = candidates.filter((candidate) => tags.includes(candidate));
  if (matches.length !== 1) {
    throw new Error(`${passageId} 必须且只能声明一个${kind}标签。`);
  }
  return matches[0];
}

function parseStoryData(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    throw new Error("StoryData 不是有效 JSON。", { cause: error });
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("StoryData 必须是对象。");
  }
  if (typeof data.start !== "string" || !data.start) {
    throw new Error("StoryData.start 必须指定入口 passage。");
  }
  if (typeof data.contentRevision !== "string" || !data.contentRevision) {
    throw new Error("StoryData.contentRevision 必须指定内容修订。");
  }
  if (!data.chapters || typeof data.chapters !== "object" || Array.isArray(data.chapters)) {
    throw new Error("StoryData.chapters 必须声明章节信息。");
  }
  for (const section of SECTION_TAGS) {
    const chapter = data.chapters[section];
    if (!chapter || typeof chapter.label !== "string" || typeof chapter.title !== "string") {
      throw new Error(`StoryData.chapters.${section} 缺少 label 或 title。`);
    }
  }
  return data;
}

function passageSpeaker(tags) {
  if (tags.includes("speaker-kafka")) return "卡夫卡";
  if (tags.includes("speaker-interviewer")) return "面试官";
  if (tags.includes("narration")) return "旁白";
  return "";
}

function passageKind(tags) {
  if (tags.includes("chapter-card")) return "chapter-card";
  if (tags.includes("ending")) return "ending";
  if (tags.some((tag) => tag.startsWith("interaction-"))) return "interaction";
  if (tags.includes("dialogue")) return "dialogue";
  if (tags.includes("thought")) return "thought";
  return "narration";
}

function parseContent(raw, passageId) {
  const choices = [];
  const contentWithoutLinks = raw.replace(LINK, (_match, label, target) => {
    choices.push({ label: label.trim(), target: target.trim() });
    return "";
  });
  if (contentWithoutLinks.includes("[[")) {
    throw new Error(`${passageId} 含有当前编译器不支持的链接语法。`);
  }
  const paragraphs = contentWithoutLinks
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  return { choices, paragraphs };
}

function validateReachability(story) {
  const visited = new Set();
  const queue = [story.start];
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || visited.has(id)) continue;
    visited.add(id);
    for (const choice of story.passages[id].choices) queue.push(choice.target);
  }
  const unreachable = story.passageOrder.filter((id) => !visited.has(id));
  if (unreachable.length > 0) {
    throw new Error(`以下 passage 无法从 ${story.start} 到达：${unreachable.join(", ")}`);
  }
}

export function parseTwee(source) {
  const normalized = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const records = [];
  let current = null;

  function flush() {
    if (!current) return;
    current.body = current.lines.join("\n").trim();
    delete current.lines;
    records.push(current);
    current = null;
  }

  for (const [index, line] of normalized.split("\n").entries()) {
    if (line.startsWith("::")) {
      flush();
      const match = line.match(PASSAGE_HEADER);
      if (!match) throw new Error(`第 ${index + 1} 行的 passage 标题无效。`);
      current = {
        id: match[1].trim(),
        tags: (match[2] ?? "").split(/\s+/).filter(Boolean),
        lines: [],
      };
      continue;
    }
    if (current) current.lines.push(line);
    else if (line.trim()) throw new Error(`第 ${index + 1} 行出现在首个 passage 之前。`);
  }
  flush();

  const seen = new Set();
  for (const record of records) {
    if (seen.has(record.id)) throw new Error(`passage ${record.id} 重复。`);
    seen.add(record.id);
  }

  const titleRecord = records.find(({ id }) => id === "StoryTitle");
  const dataRecord = records.find(({ id }) => id === "StoryData");
  if (!titleRecord || !dataRecord) throw new Error("Twee 必须包含 StoryTitle 与 StoryData。");
  const metadata = parseStoryData(dataRecord.body);
  const passageRecords = records.filter(({ id }) => id !== "StoryTitle" && id !== "StoryData");
  const passages = {};
  const passageOrder = [];

  for (const record of passageRecords) {
    const section = exactlyOne(record.tags, SECTION_TAGS, record.id, "章节");
    const layerTag = exactlyOne(record.tags, LAYER_TAGS, record.id, "叙事层级");
    const { choices, paragraphs } = parseContent(record.body, record.id);
    if (paragraphs.some((paragraph) => paragraph.includes("TODO:"))) {
      throw new Error(`${record.id} 仍含有可见 TODO。`);
    }
    passages[record.id] = {
      id: record.id,
      section,
      layer: layerTag === "layer-design" ? "design" : "reality",
      kind: passageKind(record.tags),
      speaker: passageSpeaker(record.tags),
      scene: record.tags.find((tag) => tag.startsWith("scene-")) ?? "scene-unspecified",
      tags: record.tags,
      paragraphs,
      choices,
    };
    passageOrder.push(record.id);
  }

  if (!passages[metadata.start]) throw new Error(`入口 passage ${metadata.start} 不存在。`);
  for (const passage of Object.values(passages)) {
    for (const choice of passage.choices) {
      if (!passages[choice.target]) {
        throw new Error(`${passage.id} 指向不存在的 passage ${choice.target}。`);
      }
    }
    if (passage.kind === "ending" && passage.choices.length > 0) {
      throw new Error(`结局 passage ${passage.id} 不应继续链接到其他 passage。`);
    }
  }

  const endingIds = passageOrder.filter((id) => passages[id].kind === "ending");
  if (endingIds.length === 0) throw new Error("故事至少需要一个 ending passage。");

  const story = {
    title: titleRecord.body,
    ifid: metadata.ifid ?? "",
    revision: metadata.contentRevision,
    start: metadata.start,
    chapters: metadata.chapters,
    passageOrder,
    endingIds,
    passages,
  };
  validateReachability(story);
  return story;
}
