import { PrivacyVaultError } from "./privacy-service.js";

const DEVICE_SECRET_STORAGE_PREFIX = "ithaca-journal:device-secret:v1:";
const DEVICE_SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

function profileRequestBody(profile) {
  return {
    version: profile.version,
    kdf: profile.kdf,
    iterations: profile.iterations,
    salt: profile.salt,
    sealed_payload: profile.verifier,
  };
}

function migrationItems(archive) {
  return [
    ...(archive.entries ?? [])
      .filter((entry) => entry.encryption_version === 0)
      .map((entry) => ({ kind: "entry", value: entry })),
    ...(archive.topics ?? [])
      .filter((topic) => topic.encryption_version === 0)
      .map((topic) => ({ kind: "topic", value: topic })),
    ...(archive.books ?? [])
      .filter((book) => book.encryption_version === 0)
      .map((book) => ({ kind: "book", value: book })),
  ];
}

function userStorageKey(user) {
  const email = typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";
  if (!email) {
    throw new PrivacyVaultError("missing_user_identity", "当前登录身份无法建立本地存档。");
  }
  return `${DEVICE_SECRET_STORAGE_PREFIX}${encodeURIComponent(email)}`;
}

export function createPrivacyFeature({
  state,
  api,
  vault,
  storage,
}) {
  let privacyStatus = null;
  let deviceStorage = storage;

  function requireStorage() {
    if (!deviceStorage) {
      try {
        deviceStorage = globalThis.localStorage;
      } catch (error) {
        throw new PrivacyVaultError(
          "device_storage_unavailable",
          "当前浏览器无法保存本地密钥，请允许站点保存浏览器数据后重试。",
          { cause: error },
        );
      }
    }
    if (
      !deviceStorage
      || typeof deviceStorage.getItem !== "function"
      || typeof deviceStorage.setItem !== "function"
    ) {
      throw new PrivacyVaultError(
        "device_storage_unavailable",
        "当前浏览器无法保存本地密钥，请允许站点保存浏览器数据后重试。",
      );
    }
    return deviceStorage;
  }

  function readDeviceSecret(user) {
    let secret;
    try {
      secret = requireStorage().getItem(userStorageKey(user));
    } catch (error) {
      if (error instanceof PrivacyVaultError) throw error;
      throw new PrivacyVaultError(
        "device_storage_unavailable",
        "当前浏览器无法读取本地密钥，请检查浏览器的站点数据设置。",
        { cause: error },
      );
    }
    if (secret === null) return null;
    if (!DEVICE_SECRET_PATTERN.test(secret)) {
      throw new PrivacyVaultError(
        "invalid_device_key",
        "这个浏览器保存的本地密钥已经损坏，无法打开现有手记。",
      );
    }
    return secret;
  }

  function clearLegacyDeviceSecret(user) {
    try {
      const currentStorage = requireStorage();
      if (typeof currentStorage.removeItem === "function") {
        currentStorage.removeItem(userStorageKey(user));
      }
    } catch {
      // The account-scoped copy is authoritative once migration succeeds.
    }
  }

  async function requestAccountSecret(deviceSecret) {
    const result = await api("/api/privacy/key", {
      method: "POST",
      body: JSON.stringify(deviceSecret ? { device_secret: deviceSecret } : {}),
    });
    if (
      result?.key_custody !== "account"
      || !DEVICE_SECRET_PATTERN.test(result?.device_secret ?? "")
    ) {
      throw new PrivacyVaultError(
        "invalid_account_key",
        "账户存档没有准备成功，请刷新页面后重试。",
      );
    }
    return result.device_secret;
  }

  async function migrateLegacyContent() {
    const archive = await api("/api/export");
    for (const item of migrationItems(archive)) {
      if (item.kind === "entry") {
        const sealedPayload = await vault.seal("entry", item.value.id, {
          title: item.value.title,
          body: item.value.body,
        });
        await api(`/api/entries/${item.value.id}`, {
          method: "PUT",
          body: JSON.stringify({ sealed_payload: sealedPayload }),
        });
      } else if (item.kind === "topic") {
        const sealedPayload = await vault.seal("topic", item.value.id, {
          title: item.value.title,
          body: item.value.body,
        });
        await api(`/api/topics/${item.value.id}`, {
          method: "PUT",
          body: JSON.stringify({ sealed_payload: sealedPayload }),
        });
      } else {
        const sealedPayload = await vault.seal("book", item.value.id, {
          title: item.value.title,
          preface: item.value.preface,
          content_snapshot: item.value.content_snapshot,
          sources: item.value.sources ?? [],
        });
        await api(`/api/books/${item.value.id}`, {
          method: "PUT",
          body: JSON.stringify({
            sealed_payload: sealedPayload,
            source_topic_ids: (item.value.sources ?? []).map((source) => source.topic_id),
          }),
        });
      }
    }

    privacyStatus = await api("/api/privacy");
    if (privacyStatus.migration_required) {
      throw new PrivacyVaultError(
        "migration_incomplete",
        "仍有旧记录没有完成本地封装，请重试。",
      );
    }
  }

  async function createProfile(deviceSecret) {
    const profile = await vault.createProfile(deviceSecret);
    try {
      privacyStatus = await api("/api/privacy", {
        method: "POST",
        body: JSON.stringify(profileRequestBody(profile)),
      });
    } catch (error) {
      vault.lock();
      const refreshedStatus = await api("/api/privacy");
      if (!refreshedStatus.profile) throw error;
      privacyStatus = refreshedStatus;
      await vault.unlock(deviceSecret, privacyStatus.profile);
    }
  }

  async function ensureUnlocked(user) {
    lock();
    try {
      privacyStatus = await api("/api/privacy");
      let deviceSecret;
      let profileUnlocked = false;

      if (privacyStatus.key_custody === "account") {
        deviceSecret = await requestAccountSecret();
      } else if (privacyStatus.key_custody === "device") {
        const legacyDeviceSecret = readDeviceSecret(user);
        if (!legacyDeviceSecret) {
          throw new PrivacyVaultError(
            "account_key_migration_required",
            "这个账号还没有完成多设备迁移，请先在原电脑打开一次。",
          );
        }
        if (!privacyStatus.profile) {
          throw new PrivacyVaultError(
            "invalid_privacy_status",
            "账户存档状态无效，请刷新页面后重试。",
          );
        }
        await vault.unlock(legacyDeviceSecret, privacyStatus.profile);
        deviceSecret = await requestAccountSecret(legacyDeviceSecret);
        profileUnlocked = deviceSecret === legacyDeviceSecret;
        clearLegacyDeviceSecret(user);
      } else if (privacyStatus.key_custody === "none") {
        deviceSecret = await requestAccountSecret();
      } else {
        throw new PrivacyVaultError(
          "invalid_privacy_status",
          "账户存档状态无效，请刷新页面后重试。",
        );
      }

      if (!privacyStatus.profile) {
        await createProfile(deviceSecret);
      } else if (!profileUnlocked) {
        await vault.unlock(deviceSecret, privacyStatus.profile);
      }

      if (privacyStatus.migration_required) {
        await migrateLegacyContent();
      }
      state.privacyUnlocked = true;
    } catch (error) {
      lock();
      throw error;
    }
  }

  async function exportPlaintext() {
    if (!vault.isUnlocked()) {
      throw new PrivacyVaultError("locked", "本地存档尚未准备好，请稍后再导出。");
    }
    const encryptedArchive = await api("/api/export");
    const archive = await vault.openArchive(encryptedArchive);
    const blob = new Blob([JSON.stringify(archive, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ithaca-journal-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  function lock() {
    vault.lock();
    state.privacyUnlocked = false;
    privacyStatus = null;
  }

  return Object.freeze({ ensureUnlocked, exportPlaintext, lock });
}
