/* src/js/app.js */
// 1. 引入模块
import { Journal } from './data/Journal.js';
import { UserData } from './data/UserData.js';
import { Library } from './data/Library.js';
import { IntroScene } from './logic/IntroScene.js';
import { TimeSystem } from './logic/TimeSystem.js';
import { DragManager } from './logic/DragManager.js';   
import { UIRenderer } from './ui/UIRenderer.js';

// 2. 程序入口
async function init() {
    console.log("正在启动伊萨卡手记 (Electron)...");
    
    // 等待数据加载
    await Promise.all([
        UserData.init(),
        Library.init(),
        Journal.init()
    ]);

    // 初始化系统逻辑
    TimeSystem.init();
    DragManager.init(); 
    
    // 初始化 UI (现在 UI 内部会自动绑定所有事件)
    UIRenderer.init();

    // 播放剧情
    IntroScene.init(); 
    
    UIRenderer.log("欢迎回家。");
}

// 启动程序
init();
