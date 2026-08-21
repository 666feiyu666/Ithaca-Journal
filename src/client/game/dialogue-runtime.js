import { resolvePhaseValue } from "./scene-registry.js";

export function createDialogueRuntime(root) {
  if (!(root instanceof HTMLElement)) {
    throw new TypeError("对话运行时需要有效的根元素。");
  }
  const speaker = root.querySelector("[data-dialogue-speaker]");
  const line = root.querySelector("[data-dialogue-line]");
  const dismissButton = root.querySelector("[data-dialogue-dismiss]");
  const advanceButton = root.querySelector("[data-dialogue-advance]");

  if (!speaker || !line || !dismissButton || !advanceButton) {
    throw new Error("对话根元素缺少必要的 data-dialogue-* 节点。");
  }

  let active = null;
  let lineIndex = 0;

  const hide = () => {
    root.hidden = true;
    root.removeAttribute("data-open");
  };

  const render = () => {
    const currentLine = active.dialogue.lines[lineIndex];
    speaker.textContent = currentLine.speaker ?? active.dialogue.speaker ?? "我";
    line.textContent =
      resolvePhaseValue(currentLine.textByPhase, active.phase) ?? currentLine.text ?? "";
    const isLastLine = lineIndex === active.dialogue.lines.length - 1;
    advanceButton.textContent = isLastLine
      ? active.dialogue.actionLabel ?? "结束"
      : active.dialogue.advanceLabel ?? "继续";
    dismissButton.textContent = active.dialogue.dismissLabel ?? "返回";
  };

  const dismiss = () => {
    if (!active) return;
    const closing = active;
    active = null;
    hide();
    closing.onDismiss?.();
    closing.returnFocus?.focus({ preventScroll: true });
  };

  const advance = () => {
    if (!active) return;
    if (lineIndex < active.dialogue.lines.length - 1) {
      lineIndex += 1;
      render();
      return;
    }
    const closing = active;
    active = null;
    hide();
    closing.onConfirm?.();
  };

  dismissButton.addEventListener("click", dismiss);
  advanceButton.addEventListener("click", advance);
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      dismiss();
      return;
    }
    if (event.key === "Tab" && active) {
      const focusable = [dismissButton, advanceButton].filter((button) => !button.disabled);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  });

  return Object.freeze({
    open(dialogue, { phase, onConfirm, onDismiss, returnFocus } = {}) {
      if (!dialogue?.lines?.length) {
        onConfirm?.();
        return;
      }
      active = { dialogue, phase, onConfirm, onDismiss, returnFocus };
      lineIndex = 0;
      root.hidden = false;
      root.dataset.open = "true";
      render();
      window.requestAnimationFrame(() => advanceButton.focus({ preventScroll: true }));
    },

    close({ restoreFocus = false } = {}) {
      if (!active) return;
      const closing = active;
      active = null;
      hide();
      if (restoreFocus) closing.returnFocus?.focus({ preventScroll: true });
    },

    isOpen() {
      return Boolean(active);
    },
  });
}
