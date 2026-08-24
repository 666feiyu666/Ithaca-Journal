const SCENE_ASSET_ROOT = "/assets/scenes";

export const sceneAssets = Object.freeze({
  root: SCENE_ASSET_ROOT,
  room: Object.freeze({
    placeholderBackground: `${SCENE_ASSET_ROOT}/room/room-placeholder-v01.png`,
    background: `${SCENE_ASSET_ROOT}/room/background-base.webp`,
    rug: `${SCENE_ASSET_ROOT}/room/rug.png`,
    doorClosed: `${SCENE_ASSET_ROOT}/room/door-closed.png`,
    bulletinBoard: `${SCENE_ASSET_ROOT}/room/bulletin-board.png`,
    bookshelf: `${SCENE_ASSET_ROOT}/room/bookshelf.png`,
    plant: `${SCENE_ASSET_ROOT}/room/plant.png`,
    deskClosed: `${SCENE_ASSET_ROOT}/room/desk-closed.png`,
    lampOff: `${SCENE_ASSET_ROOT}/room/lamp-off.png`,
    chairBack: `${SCENE_ASSET_ROOT}/room/chair-back.png`,
  }),
  doorway: Object.freeze({
    background: `${SCENE_ASSET_ROOT}/doorway/background-base.webp`,
    door: `${SCENE_ASSET_ROOT}/doorway/door.png`,
    lamp: `${SCENE_ASSET_ROOT}/doorway/lamp.png`,
    mailbox: `${SCENE_ASSET_ROOT}/doorway/mailbox.png`,
  }),
});
