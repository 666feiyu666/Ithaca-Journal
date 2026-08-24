import { SUPPORTED_LOCALES } from "./i18n.js";

export function createSettingsFeature({ refs, i18n }) {
  function render() {
    const locale = i18n.getLocale();
    for (const input of refs.languageOptions.querySelectorAll('input[name="interface-language"]')) {
      input.checked = input.value === locale;
    }
  }

  function open() {
    render();
    if (!refs.settingsDialog.open) refs.settingsDialog.showModal();
  }

  function bindEvents() {
    refs.titleSettingsButton.addEventListener("click", open);
    refs.languageOptions.addEventListener("change", (event) => {
      const input = event.target.closest?.('input[name="interface-language"]');
      if (!input || !SUPPORTED_LOCALES.some(({ id }) => id === input.value)) return;
      i18n.setLocale(input.value);
      render();
    });
    document.addEventListener("ithaca:localechange", render);
  }

  return Object.freeze({ bindEvents, open, render });
}
