import { describe, expect, it } from "vitest";

import { dialogues } from "../../src/client/config/dialogues.js";
import { sceneAssets } from "../../src/client/config/scene-assets.js";
import { doorwayScene } from "../../src/client/config/scenes/doorway.js";
import { roomScene } from "../../src/client/config/scenes/room.js";
import { createSceneRegistry, resolvePhaseValue } from "../../src/client/game/scene-registry.js";
import {
  clampSceneObjectPosition,
  createSceneLayoutStore,
} from "../../src/client/game/scene-layout.js";
import { createSceneStateStore } from "../../src/client/game/scene-state.js";
import { createTimeSnapshot, getTimePhase } from "../../src/client/game/time-service.js";

function at(hour, minute = 0) {
  return new Date(2026, 7, 21, hour, minute, 0, 0);
}

function createScene(id, target = null) {
  return {
    id,
    title: id,
    layers: [{ id: "background", type: "placeholder" }],
    objects: [
      {
        id: "door",
        label: "门",
        hitArea: { x: 10, y: 10, width: 20, height: 40 },
        action: target ? { type: "scene", target } : { type: "close" },
      },
    ],
  };
}

describe("现实时间阶段", () => {
  it.each([
    [at(4, 59), "lateNight", "深夜"],
    [at(5), "morning", "早上"],
    [at(11, 59), "morning", "早上"],
    [at(12), "afternoon", "下午"],
    [at(16, 59), "afternoon", "下午"],
    [at(17), "dusk", "黄昏"],
    [at(21, 59), "dusk", "黄昏"],
    [at(22), "lateNight", "深夜"],
  ])("在边界 %s 返回 %s", (date, expectedId, expectedLabel) => {
    expect(getTimePhase(date)).toEqual({
      id: expectedId,
      label: expectedLabel,
      ...(expectedId === "morning" ? { startsAt: 5, endsAt: 12 } : {}),
      ...(expectedId === "afternoon" ? { startsAt: 12, endsAt: 17 } : {}),
      ...(expectedId === "dusk" ? { startsAt: 17, endsAt: 22 } : {}),
    });
  });

  it("从同一时刻生成日期、星期和阶段快照", () => {
    const snapshot = createTimeSnapshot(at(17));
    expect(snapshot.date).toEqual(at(17));
    expect(snapshot.weekdayLabel).toBeTruthy();
    expect(snapshot.phase).toBe("dusk");
    expect(snapshot.phaseLabel).toBe("黄昏");
    expect(snapshot.timeMode).toBe("night");
    expect(createTimeSnapshot(at(12)).timeMode).toBe("day");
  });

  it.each([
    ["morning", "早上想从哪里开始？"],
    ["afternoon", "下午想从哪里开始？"],
    ["dusk", "黄昏想从哪里开始？"],
    ["lateNight", "深夜想从哪里开始？"],
  ])("房间标题随 %s 阶段切换", (phase, expectedTitle) => {
    expect(resolvePhaseValue(roomScene.titleByPhase, phase)).toBe(expectedTitle);
  });
});

describe("房间布置", () => {
  it("把移动位置限制在场景画布内", () => {
    const rect = { x: 10, y: 15, width: 24, height: 58 };
    expect(clampSceneObjectPosition(rect, { x: -8, y: 92 })).toEqual({ x: 0, y: 42 });
  });

  it("保存、读取并重置单个场景的布置", () => {
    const values = new Map();
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
    const store = createSceneLayoutStore({ storage });

    store.set("room", "desk", { x: 41.5, y: 34 });
    expect(store.get("room", "desk")).toEqual({ x: 41.5, y: 34 });
    store.reset("room");
    expect(store.get("room", "desk")).toBeNull();
  });
});

describe("场景灯光状态", () => {
  it("分别保存房间与走廊灯光并可重复切换", () => {
    const values = new Map();
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
    const store = createSceneStateStore({ storage });

    expect(store.get("room", "light")).toBe(false);
    expect(store.toggle("room", "light")).toBe(true);
    expect(store.get("doorway", "light")).toBe(false);

    const restored = createSceneStateStore({ storage });
    expect(restored.get("room", "light")).toBe(true);
    expect(restored.toggle("room", "light")).toBe(false);
    expect(restored.toggle("doorway", "light")).toBe(true);
  });
});

describe("首次旅程序章", () => {
  it("使用不可跳出的统一场景对话配置", () => {
    expect(dialogues["journey.intro"]).toMatchObject({
      id: "journey.intro",
      dismissible: false,
      actionLabel: "开始探索",
    });
    expect(dialogues["journey.intro"].lines).toHaveLength(4);
  });
});

describe("场景注册表", () => {
  it("注册场景并冻结嵌套配置", () => {
    const registry = createSceneRegistry([createScene("doorway", "room"), createScene("room")]);
    const doorway = registry.get("doorway");
    expect(registry.list()).toHaveLength(2);
    expect(Object.isFrozen(doorway)).toBe(true);
    expect(Object.isFrozen(doorway.layers)).toBe(true);
    expect(Object.isFrozen(doorway.objects[0].hitArea)).toBe(true);
  });

  it("拒绝指向未注册场景的门", () => {
    expect(() => createSceneRegistry([createScene("doorway", "missing")])).toThrow(
      "指向了未注册场景 missing",
    );
  });

  it("拒绝越过画布边界的对象", () => {
    const scene = createScene("room");
    scene.objects[0].hitArea = { x: 90, y: 10, width: 20, height: 20 };
    expect(() => createSceneRegistry([scene])).toThrow("超出了场景画布");
  });

  it("分时段素材缺失时回退到默认素材", () => {
    expect(resolvePhaseValue({ morning: "morning.webp", default: "base.webp" }, "dusk")).toBe(
      "base.webp",
    );
    expect(resolvePhaseValue("single.webp", "lateNight")).toBe("single.webp");
  });

  it("拒绝可切换状态中的空素材路径", () => {
    const scene = createScene("room");
    scene.objects[0].toggleState = {
      key: "light",
      defaultValue: false,
      off: { actionLabel: "打开", statusText: "灯已关闭" },
      on: { actionLabel: "关闭", statusText: "灯已打开", visualSource: "" },
    };
    expect(() => createSceneRegistry([scene])).toThrow("toggleState.on.visualSource");
  });
});

describe("正式场景素材目录", () => {
  it("统一声明标题、门外与房间的正式素材槽位", () => {
    expect(sceneAssets.root).toBe("/assets/scenes");
    expect(sceneAssets.title).toEqual({
      morning: "/assets/scenes/title/title-morning.png",
      afternoon: "/assets/scenes/title/title-morning.png",
      dusk: "/assets/scenes/title/title-dusk.png",
      lateNight: "/assets/scenes/title/title-late-night.png",
    });
    expect(sceneAssets.room).toEqual({
      placeholderBackground: "/assets/scenes/room/room-placeholder-v01.png",
      background: "/assets/scenes/room/background-base.webp",
      rug: "/assets/scenes/room/rug.png",
      doorClosed: "/assets/scenes/room/door-closed.png",
      bulletinBoard: "/assets/scenes/room/bulletin-board.png",
      bookshelf: "/assets/scenes/room/bookshelf.png",
      plant: "/assets/scenes/room/plant.png",
      deskClosed: "/assets/scenes/room/desk-closed.png",
      lampOff: "/assets/scenes/room/lamp-off.png",
      chairBack: "/assets/scenes/room/chair-back.png",
    });
    expect(sceneAssets.doorway).toEqual({
      background: "/assets/scenes/doorway/background-base.webp",
      door: "/assets/scenes/doorway/door.png",
      lampOff: "/assets/scenes/doorway/lamp.png",
      lampOn: "/assets/scenes/doorway/lamp-on.png",
      mailbox: "/assets/scenes/doorway/mailbox.png",
    });
  });

  it("两个场景使用正式背景和独立对象素材", () => {
    expect(roomScene.layers[0].source).toBe(sceneAssets.room.background);
    expect(roomScene.objects.find((object) => object.id === "desk")?.visualSource).toBe(
      sceneAssets.room.deskClosed,
    );
    expect(roomScene.objects.find((object) => object.id === "bookshelf")?.visualSource).toBe(
      sceneAssets.room.bookshelf,
    );
    expect(doorwayScene.layers[0].source).toBe(sceneAssets.doorway.background);
    expect(doorwayScene.objects.find((object) => object.id === "mailbox")?.visualSource).toBe(
      sceneAssets.doorway.mailbox,
    );
    expect(doorwayScene.objects.find((object) => object.id === "door")?.visualSource).toBe(
      sceneAssets.doorway.door,
    );
  });

  it("按 0.4.0 分层布局放置房间家具", () => {
    expect(roomScene.objects.find((object) => object.id === "bookshelf")?.movable).toBe(true);
    expect(roomScene.objects.find((object) => object.id === "desk")?.movable).toBe(true);
    expect(roomScene.objects.find((object) => object.id === "plant")?.interactive).toBe(false);
    expect(roomScene.objects.find((object) => object.id === "rug")?.movable).not.toBe(true);
    expect(roomScene.objects.find((object) => object.id === "door")?.movable).not.toBe(true);
    expect(roomScene.objects.find((object) => object.id === "bookshelf")?.hitArea).toEqual({
      x: 5.2198,
      y: 19.3627,
      width: 22.4588,
      height: 68.3824,
    });
    expect(roomScene.objects.find((object) => object.id === "desk")?.hitArea).toEqual({
      x: 34.6154,
      y: 60.9069,
      width: 32.0742,
      height: 28.1863,
    });
    expect(roomScene.objects.map((object) => object.z)).toEqual([10, 20, 30, 40, 50, 60, 70, 80]);
  });

  it("把房间台灯与走廊壁灯声明为可切换对象", () => {
    const roomLamp = roomScene.objects.find((object) => object.id === "desk-lamp");
    const hallwayLamp = doorwayScene.objects.find((object) => object.id === "lamp");

    expect(roomLamp).toMatchObject({
      kind: "light",
      movable: true,
      toggleState: { key: "light", defaultValue: false },
    });
    expect(hallwayLamp).toMatchObject({
      kind: "light",
      visualSource: sceneAssets.doorway.lampOff,
      toggleState: {
        key: "light",
        defaultValue: false,
        off: { visualSource: sceneAssets.doorway.lampOff },
        on: { visualSource: sceneAssets.doorway.lampOn },
      },
    });
    expect(roomLamp?.interactive).not.toBe(false);
    expect(hallwayLamp?.interactive).not.toBe(false);
  });
});
