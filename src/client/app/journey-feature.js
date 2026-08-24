import { ApiClientError } from "./api-client.js";
import { localDateString } from "./format.js";

export function createJourneyFeature({
  state,
  refs,
  api,
  setBusy,
  showAuth,
  showTitle,
  showScene,
  showIntro,
  ensurePrivacy,
  handleError,
  onJourneyEntered = () => {},
}) {
  async function enterCurrentJourney() {
    if (state.busy) {
      return;
    }

    setBusy(true);
    try {
      const data = await api("/api/journey", {
        method: "POST",
        body: JSON.stringify({ local_date: localDateString() }),
      });
      state.journey = data.journey;
      state.letters = [];
      onJourneyEntered(data.journey);
      if (data.journey.intro_completed_at) {
        showScene("room");
      } else {
        showIntro();
      }
    } catch (error) {
      handleError(error, "暂时无法进入旅程，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function completeIntro() {
    setBusy(true);
    try {
      const data = await api("/api/journey/intro", { method: "PUT" });
      state.journey = data.journey;
    } finally {
      setBusy(false);
    }
  }

  async function loadLetters() {
    const data = await api("/api/letters");
    state.letters = data.letters;
  }

  function renderLetterSelect(selectedDay) {
    refs.letterSelect.replaceChildren();
    for (const letter of state.letters) {
      const option = document.createElement("option");
      option.value = String(letter.day);
      option.textContent = `第 ${letter.day} 天 · ${letter.title}${letter.opened_at ? "" : " · 新"}`;
      option.selected = letter.day === selectedDay;
      refs.letterSelect.append(option);
    }
  }

  async function openLetter(day = state.journey?.current_day ?? 1) {
    if (state.busy) return;
    setBusy(true);
    try {
      if (!state.letters.length) await loadLetters();
      const data = await api(`/api/letters/${day}/open`, { method: "PUT" });
      const summary = state.letters.find((letter) => letter.day === day);
      if (summary) summary.opened_at = data.letter.opened_at;
      refs.letterDay.textContent = `第 ${data.letter.day} 天来信`;
      refs.letterTitle.textContent = data.letter.title;
      refs.letterSender.textContent = `From: ${data.letter.sender}`;
      refs.letterContent.textContent = data.letter.content;
      renderLetterSelect(data.letter.day);
      if (!refs.letterDialog.open) refs.letterDialog.showModal();
    } catch (error) {
      handleError(error, "无法打开今天的来信。");
    } finally {
      setBusy(false);
    }
  }

  async function restoreSession() {
    showAuth();
    setBusy(true);
    try {
      const session = await api("/api/session");
      await ensurePrivacy(session.user);
      const journeyData = await api("/api/journey");
      showTitle(session.user, journeyData.journey);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        showAuth({
          title: "需要访问验证",
          status: "只有管理员加入允许名单的邮箱可以接收验证码并进入测试。",
          error: "当前访问身份无效或已经过期。",
          canLogin: true,
        });
        return;
      }
      showAuth({
        title: "暂时无法进入",
        status: "应用没有建立本地替代存档，以免与云端数据分叉。",
        error: error instanceof Error ? error.message : "暂时无法连接服务，请稍后重试。",
      });
    } finally {
      setBusy(false);
    }
  }

  function bindEvents() {
    refs.accessRetry.addEventListener("click", () => void restoreSession());
    refs.journeyAction.addEventListener("click", () => void enterCurrentJourney());
    refs.letterSelect.addEventListener("change", () => void openLetter(Number(refs.letterSelect.value)));
  }

  return Object.freeze({ bindEvents, completeIntro, openLetter, restoreSession });
}
