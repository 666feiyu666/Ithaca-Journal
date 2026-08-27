import { ApiClientError } from "./api-client.js";
import {
  getJourneyPassage,
  journeyStory,
} from "../config/generated/journey-story.zh-CN.js";

const LAYER_LABELS = Object.freeze({
  reality: "现实",
  design: "《伊萨卡手记》设计稿",
});

export function createJourneyFeature({
  state,
  refs,
  api,
  setBusy,
  showAuth,
  showTitle,
  showScene,
  showJourney,
  ensurePrivacy,
  handleError,
}) {
  let choiceButtons = [];

  function setChoiceButtonsDisabled(disabled) {
    for (const button of choiceButtons) button.disabled = disabled;
  }

  function returnToTitle() {
    if (state.user) showTitle(state.user, state.storyJourney);
  }

  function renderPassage(storyJourney) {
    const passage = getJourneyPassage(storyJourney.current_passage);
    const chapter = journeyStory.chapters[passage.section];
    refs.journeyPassageLabel.textContent = chapter.label;
    refs.journeyLayerLabel.textContent = LAYER_LABELS[passage.layer];
    refs.storyStage.dataset.storyLayer = passage.layer;
    refs.storyHeading.textContent = chapter.title;
    refs.storyDialogue.dataset.storyKind = passage.kind;
    refs.storyDialogue.dataset.storyScene = passage.scene;
    const visibleSpeaker = passage.kind === "chapter-card" ? "" : passage.speaker;
    refs.storySpeaker.textContent = visibleSpeaker;
    refs.storySpeaker.hidden = !visibleSpeaker;

    const paragraphs = passage.paragraphs.map((content) => {
      const paragraph = document.createElement("p");
      paragraph.textContent = content;
      return paragraph;
    });
    refs.storyCopy.replaceChildren(...paragraphs);

    choiceButtons = passage.choices.map((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "story-dialogue__choice";
      button.textContent = choice.label;
      button.addEventListener("click", () => void advanceTo(choice.target));
      return button;
    });

    if (passage.kind === "ending") {
      const returnButton = document.createElement("button");
      returnButton.type = "button";
      returnButton.className = "story-dialogue__choice story-dialogue__choice--ending";
      returnButton.textContent = "回到标题页";
      returnButton.addEventListener("click", returnToTitle);
      choiceButtons.push(returnButton);
    }
    refs.storyChoices.replaceChildren(...choiceButtons);
  }

  function presentJourney(storyJourney) {
    state.storyJourney = storyJourney;
    renderPassage(storyJourney);
    showJourney(storyJourney);
  }

  async function enterCurrentJourney() {
    if (state.busy) {
      return;
    }

    setBusy(true);
    try {
      const data = await api("/api/story-journey", {
        method: "POST",
      });
      presentJourney(data.story_journey);
    } catch (error) {
      handleError(error, "暂时无法进入旅程，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function advanceTo(passage) {
    if (state.busy) return;

    setBusy(true);
    setChoiceButtonsDisabled(true);
    try {
      const data = await api("/api/story-journey", {
        method: "PUT",
        body: JSON.stringify({ passage }),
      });
      presentJourney(data.story_journey);
    } catch (error) {
      handleError(error, "暂时无法保存剧情进度，请稍后重试。");
    } finally {
      setBusy(false);
      setChoiceButtonsDisabled(false);
    }
  }

  async function restoreSession() {
    showAuth();
    setBusy(true);
    try {
      const session = await api("/api/session");
      await ensurePrivacy(session.user);
      const journeyData = await api("/api/story-journey");
      showTitle(session.user, journeyData.story_journey);
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
    refs.toolsetAction.addEventListener("click", () => showScene("room"));
    refs.journeyReturnTitleButton.addEventListener("click", returnToTitle);
  }

  return Object.freeze({ bindEvents, restoreSession, renderPassage });
}
