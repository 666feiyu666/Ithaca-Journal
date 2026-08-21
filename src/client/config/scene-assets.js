const SCENE_ASSET_ROOT = "/assets/scenes";

export const sceneAssets = Object.freeze({
  root: SCENE_ASSET_ROOT,
  room: Object.freeze({
    placeholderBackground: `${SCENE_ASSET_ROOT}/room/room-placeholder-v01.png`,
    background: `${SCENE_ASSET_ROOT}/room/background-base.webp`,
    deskChair: `${SCENE_ASSET_ROOT}/room/desk-chair.png`,
    bookshelf: `${SCENE_ASSET_ROOT}/room/bookshelf.png`,
  }),
  doorway: Object.freeze({
    background: `${SCENE_ASSET_ROOT}/doorway/background-base.webp`,
    mailbox: `${SCENE_ASSET_ROOT}/doorway/mailbox.png`,
  }),
});
