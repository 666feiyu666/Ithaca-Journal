export function formatDate(value) {
  if (!value) {
    return globalThis.document?.documentElement?.lang === "en" ? "Not saved yet" : "尚未保存";
  }
  const locale = globalThis.document?.documentElement?.lang === "en" ? "en" : "zh-CN";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function focusWhenReady(element) {
  window.requestAnimationFrame(() => {
    if (!element.disabled && !element.closest("[hidden]")) {
      element.focus({ preventScroll: true });
    }
  });
}
