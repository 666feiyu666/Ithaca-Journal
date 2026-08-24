export const ACHIEVEMENTS = Object.freeze([
  Object.freeze({
    key: "arrival",
    mark: "I",
    title: "抵达",
    description: "开始第一天的旅程",
    reached: (archive) => Boolean(archive.journey),
  }),
  Object.freeze({
    key: "first_page",
    mark: "✦",
    title: "留下一页",
    description: "保存第一张纸页",
    reached: (archive) => (archive.entries?.length ?? 0) > 0,
  }),
  Object.freeze({
    key: "first_journal",
    mark: "日",
    title: "写日记",
    description: "写下第一篇日记",
    reached: (archive) => archive.entries?.some(({ category }) => category === "journal") ?? false,
  }),
  Object.freeze({
    key: "first_theme",
    mark: "◇",
    title: "连起碎片",
    description: "建立第一块主题板",
    reached: (archive) => (archive.topics?.length ?? 0) > 0,
  }),
  Object.freeze({
    key: "first_letter",
    mark: "✉",
    title: "寄出回声",
    description: "寄出第一封书信",
    reached: (archive) => (archive.sent_letters?.length ?? 0) > 0,
  }),
  Object.freeze({
    key: "first_book",
    mark: "§",
    title: "成为作者",
    description: "装订并上架第一本书",
    reached: (archive) => (archive.books?.length ?? 0) > 0,
  }),
  Object.freeze({
    key: "thousand_marks",
    mark: "1K",
    title: "积跬步",
    description: "纸页正文累计写下 1,000 个字符",
    reached: (archive) => totalWrittenCharacters(archive.entries) >= 1_000,
  }),
  Object.freeze({
    key: "journey_complete",
    mark: "21",
    title: "这就是伊萨卡手记",
    description: "完成二十一天的旅程",
    reached: (archive) => archive.journey?.status === "completed",
  }),
]);

export function totalWrittenCharacters(entries = []) {
  return entries.reduce(
    (total, entry) => total + Array.from(String(entry.body ?? "").replace(/\s/gu, "")).length,
    0,
  );
}

export function reachedAchievementKeys(archive) {
  return ACHIEVEMENTS.filter(({ reached }) => reached(archive)).map(({ key }) => key);
}

export function createAchievementsFeature({
  state,
  refs,
  api,
  vault,
  setBusy,
  handleError,
}) {
  let unlocked = new Map();
  let toastTimer = null;

  function render() {
    refs.achievementList.replaceChildren();
    refs.achievementProgress.textContent = `${unlocked.size} / ${ACHIEVEMENTS.length} 已解锁`;
    for (const achievement of ACHIEVEMENTS) {
      const isUnlocked = unlocked.has(achievement.key);
      const item = document.createElement("article");
      item.className = `achievement-card ${isUnlocked ? "achievement-card--unlocked" : "achievement-card--locked"}`;
      item.setAttribute("role", "listitem");

      const mark = document.createElement("span");
      mark.className = "achievement-card__mark";
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = isUnlocked ? achievement.mark : "—";

      const copy = document.createElement("span");
      copy.className = "achievement-card__copy";
      const title = document.createElement("strong");
      title.textContent = achievement.title;
      const description = document.createElement("small");
      description.textContent = achievement.description;
      copy.append(title, description);

      const status = document.createElement("span");
      status.className = "achievement-card__status";
      status.textContent = isUnlocked ? "已解锁" : "未解锁";
      item.append(mark, copy, status);
      refs.achievementList.append(item);
    }
  }

  function showToast(achievement) {
    if (!achievement) return;
    if (toastTimer) window.clearTimeout(toastTimer);
    refs.achievementToastTitle.textContent = achievement.title;
    refs.achievementToast.hidden = false;
    window.requestAnimationFrame(() => refs.achievementToast.dataset.open = "true");
    toastTimer = window.setTimeout(() => {
      refs.achievementToast.dataset.open = "false";
      toastTimer = window.setTimeout(() => {
        refs.achievementToast.hidden = true;
      }, 240);
    }, 4_000);
  }

  async function persist(keys, { announce = false } = {}) {
    const additions = keys.filter((key) => !unlocked.has(key));
    if (!additions.length) return;
    const records = await Promise.all(additions.map(async (key) => {
      const data = await api("/api/achievements", {
        method: "POST",
        body: JSON.stringify({ key }),
      });
      return data.achievement;
    }));
    for (const record of records) unlocked.set(record.key, record);
    render();
    if (announce) {
      const newest = [...ACHIEVEMENTS].reverse().find(({ key }) => additions.includes(key));
      showToast(newest);
    }
  }

  async function unlock(key, { announce = true } = {}) {
    if (!ACHIEVEMENTS.some((achievement) => achievement.key === key) || unlocked.has(key)) return;
    try {
      await persist([key], { announce });
    } catch (error) {
      handleError(error, "里程碑暂时没有存好，请稍后重试。");
    }
  }

  async function syncFromState({ announce = true } = {}) {
    const snapshot = {
      journey: state.journey,
      entries: state.entries,
      topics: state.topics,
      books: state.books,
      sent_letters: state.sentLetters,
    };
    try {
      await persist(reachedAchievementKeys(snapshot), { announce });
    } catch (error) {
      handleError(error, "里程碑暂时没有存好，请稍后重试。");
    }
  }

  async function open() {
    if (!state.user || state.busy) return;
    if (!refs.achievementsDialog.open) refs.achievementsDialog.showModal();
    refs.achievementLoading.hidden = false;
    refs.achievementList.hidden = true;
    setBusy(true);
    try {
      const encryptedArchive = await api("/api/export");
      const archive = await vault.openArchive(encryptedArchive);
      unlocked = new Map((archive.achievements ?? []).map((record) => [record.key, record]));
      const reached = reachedAchievementKeys(archive);
      await persist(reached, { announce: true });
      render();
      refs.achievementLoading.hidden = true;
      refs.achievementList.hidden = false;
    } catch (error) {
      refs.achievementLoading.textContent = "暂时无法读取里程碑。";
      handleError(error, "暂时无法读取里程碑。");
    } finally {
      setBusy(false);
    }
  }

  function bindEvents() {
    refs.titleEasterEggButton.addEventListener("click", () => void open());
  }

  return Object.freeze({ bindEvents, open, syncFromState, unlock });
}
