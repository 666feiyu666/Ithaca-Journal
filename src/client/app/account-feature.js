export function createAccountFeature({
  state,
  refs,
  api,
  setBusy,
  canLeaveCurrentDraft,
  restoreSession,
}) {
  function setDeleteAccountError(message = "") {
    refs.deleteAccountError.textContent = message;
    refs.deleteAccountError.hidden = !message;
  }

  function configureControls(user = state.user, journey = state.journey) {
    const isDevelopment = user?.source === "development";
    const accountLabel = isDevelopment ? "重新体验 0.4.0" : "删除数据";
    refs.titleAccountButton.textContent = accountLabel;
    refs.sceneAccountButton.textContent = isDevelopment ? "重置测试" : "删除数据";
    refs.accountButton.textContent = isDevelopment ? "重置测试" : "删除数据";
    refs.titleAccountButton.hidden = isDevelopment && !journey;

    if (isDevelopment) {
      refs.deleteAccountIndex.textContent = "本地验收工具";
      refs.deleteAccountTitle.textContent = "重新体验完整流程？";
      refs.deleteAccountCopy.textContent =
        "这会清除当前本地开发身份的旅程、来信阅读状态、碎片、主题和成书，然后自动回到“开始旅程”。它不会影响 staging、production 或 Cloudflare Access 允许名单。";
      refs.deleteAccountLabel.innerHTML = "输入 <strong>RESET</strong> 以重新开始";
      refs.deleteConfirmation.placeholder = "RESET";
      refs.confirmDeleteAccount.textContent = "清除并重新开始";
      return;
    }

    refs.deleteAccountIndex.textContent = "永久删除";
    refs.deleteAccountTitle.textContent = "删除全部云端数据？";
    refs.deleteAccountCopy.textContent =
      "这将删除当前应用账户、旅程、来信阅读状态、碎片、主题和成书，但不会修改 Cloudflare Access 的邮箱允许名单。再次登录会建立一个空账户。该操作无法撤销。";
    refs.deleteAccountLabel.innerHTML = "输入 <strong>DELETE</strong> 以继续";
    refs.deleteConfirmation.placeholder = "DELETE";
    refs.confirmDeleteAccount.textContent = "永久删除";
  }

  function openDeleteAccountDialog() {
    configureControls();
    setDeleteAccountError();
    refs.deleteConfirmation.value = "";
    refs.deleteAccountDialog.showModal();
    refs.deleteConfirmation.focus();
  }

  function logout() {
    if (!canLeaveCurrentDraft()) {
      return;
    }
    window.location.assign("/cdn-cgi/access/logout");
  }

  async function deleteAccount(event) {
    event.preventDefault();
    const identitySource = state.user?.source;
    const expectedConfirmation = identitySource === "development" ? "RESET" : "DELETE";
    const confirmation = refs.deleteConfirmation.value.trim();
    if (confirmation !== expectedConfirmation) {
      setDeleteAccountError(`请输入 ${expectedConfirmation} 以确认。`);
      refs.deleteConfirmation.focus();
      return;
    }

    setBusy(true);
    try {
      await api("/api/account", {
        method: "DELETE",
        body: JSON.stringify({ confirmation: "DELETE" }),
      });
      refs.deleteAccountDialog.close();
      refs.deleteConfirmation.value = "";
      if (identitySource === "cloudflare-access") {
        window.location.assign("/cdn-cgi/access/logout");
        return;
      }
      await restoreSession();
    } catch (error) {
      setDeleteAccountError(
        error instanceof Error ? error.message : "删除失败，请稍后重试。",
      );
    } finally {
      setBusy(false);
    }
  }

  function bindEvents() {
    refs.accountButton.addEventListener("click", openDeleteAccountDialog);
    refs.titleAccountButton.addEventListener("click", openDeleteAccountDialog);
    refs.sceneAccountButton.addEventListener("click", openDeleteAccountDialog);
    refs.logoutButton.addEventListener("click", logout);
    refs.titleLogoutButton.addEventListener("click", logout);
    refs.sceneLogoutButton.addEventListener("click", logout);
    refs.cancelDeleteAccount.addEventListener("click", () => refs.deleteAccountDialog.close());
    refs.deleteAccountForm.addEventListener("submit", (event) => void deleteAccount(event));
  }

  return Object.freeze({ bindEvents, configureControls, logout, openDeleteAccountDialog });
}
