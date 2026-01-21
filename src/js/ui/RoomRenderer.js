/* src/js/ui/RoomRenderer.js */
import { UserData } from '../data/UserData.js';
import { DragManager } from '../logic/DragManager.js';
import { StoryManager } from '../logic/StoryManager.js';
import { CityEvent } from '../logic/CityEvent.js';
import { ModalManager } from './ModalManager.js';
import { SidebarRenderer } from './SidebarRenderer.js';
import { BookshelfRenderer } from './BookshelfRenderer.js';
import { HUDRenderer } from './HUDRenderer.js';

// 物品配置数据库
const ITEM_DB = {
    'item_desk_default':      { src: 'assets/images/room/desktop.png',   type: 'desk' },
    'item_bookshelf_default': { src: 'assets/images/room/bookshelf.png', type: 'bookshelf' },
    'item_rug_default':       { src: 'assets/images/room/rug1.png',      type: 'rug' },
    'item_chair_default':     { src: 'assets/images/room/chair.png',     type: 'chair' }, 
    'item_bed_default':       { src: 'assets/images/room/bed.png',       type: 'bed' },
    'item_shelf_default':     { src: 'assets/images/room/shelf.png',     type: 'shelf'},   
    'item_plant_01':          { src: 'assets/images/room/plant.png',      type: 'deco' },
    'item_cat_orange':        { src: 'assets/images/room/cat.png',       type: 'cat' },
    'item_bulletin_board':     { src: 'assets/images/room/bulletinboard.png', type: 'board' }
};

// 定义哪些 type 属于墙面装饰
const WALL_TYPES = ['shelf','board']; 

// 辅助函数：判断是否为墙面物品
function isWallType(type) {
    return WALL_TYPES.includes(type);
}

export const RoomRenderer = {
    
    init() {
        // 初始化逻辑 (如需)
    },

    /**
     * 主渲染方法：渲染房间内家具 + 底部物品栏
     */
    render() {
        const container = document.querySelector('.iso-room');
        if (!container) return;

        // 1. 清理旧家具
        container.querySelectorAll('.pixel-furniture').forEach(el => el.remove());

        // 2. 获取布局数据并排序 (简单的 Z-Index 处理)
        const layout = UserData.state.layout || [];
        const sortedLayout = [...layout].sort((a, b) => a.y - b.y);

        // 3. 生成房间内 DOM
        sortedLayout.forEach(itemData => {
            this.createFurnitureElement(container, itemData);
        });

        // 4. 同时刷新底部物品栏 (Inventory Bar)
        this.renderInventoryBar();
    },

    /**
     * 创建单个家具的 DOM 元素并绑定事件
     */
    createFurnitureElement(container, itemData) {
        const config = ITEM_DB[itemData.itemId];
        if (!config) return;

        const img = document.createElement('img');
        img.src = config.src;
        img.className = 'pixel-furniture';
        img.id = `furniture-${itemData.uid}`;

        // 设置位置样式
        img.style.left = itemData.x + '%';
        img.style.top = itemData.y + '%';
        img.style.zIndex = Math.floor(itemData.y); 

        // 设置朝向
        const dir = itemData.direction || 1;
        img.style.setProperty('--dir', dir);

        // 设置宽度
        img.style.width = this.getFurnitureWidth(config.type);

        // --- 事件绑定 ---
        // 1. 拖拽开始 (MouseDown)
        img.onmousedown = (e) => {
            if (DragManager.isDecorating) {
                e.stopPropagation();
                
                // ✨✨✨ 判断是否为墙面物品
                const isWallItem = isWallType(config.type);

                // 🔧 传入 isWallItem 参数 (对应 DragManager 上一步的修改)
                DragManager.startDragExisting(
                    e, 
                    itemData.uid, 
                    config.src, 
                    itemData.direction || 1, 
                    isWallItem // <--- 新增参数
                );
            }
        };

        // 2. 点击交互 (Click)
        img.onclick = (e) => {
            e.stopPropagation();
            if (DragManager.isDecorating) return;

            ModalManager.closeAll();
            this.handleFurnitureInteraction(config.type);
        };

        container.appendChild(img);
    },

    /**
     * 渲染底部物品栏 (Inventory Bar) - 补全了此处逻辑
     */
    renderInventoryBar() {
        const listEl = document.getElementById('inventory-bar');
        if (!listEl) return;
        
        listEl.innerHTML = "";

        // 统计拥有的物品
        const ownedCounts = {};
        (UserData.state.inventory || []).forEach(itemId => {
            ownedCounts[itemId] = (ownedCounts[itemId] || 0) + 1;
        });

        // 统计已摆放的物品
        const placedCounts = {};
        (UserData.state.layout || []).forEach(item => {
            placedCounts[item.itemId] = (placedCounts[item.itemId] || 0) + 1;
        });

        // 渲染每一个种类的物品槽
        Object.keys(ownedCounts).forEach(itemId => {
            const totalOwned = ownedCounts[itemId];
            const alreadyPlaced = placedCounts[itemId] || 0;
            const availableCount = totalOwned - alreadyPlaced;

            const config = ITEM_DB[itemId];
            if (!config) return;

            const slot = document.createElement('div');
            slot.className = 'inventory-slot';
            
            const img = document.createElement('img');
            img.src = config.src;
            slot.appendChild(img);
            
            if (availableCount > 0) {
                slot.title = `按住拖拽到房间 (剩余: ${availableCount})`;
                // 显示数量角标
                if (availableCount > 1) {
                    const countBadge = document.createElement('span');
                    countBadge.innerText = availableCount;
                    countBadge.style.cssText = "position:absolute; bottom:2px; right:5px; color:white; font-size:12px; font-weight:bold; text-shadow:1px 1px 1px black;";
                    slot.appendChild(countBadge);
                }

                // 绑定拖拽生成新家具事件
                slot.onmousedown = (e) => {
                    const roomEl = document.querySelector('.iso-room');
                    const roomWidth = roomEl ? roomEl.offsetWidth : 1000;
                        
                    let widthPercent = 0.15;
                    const widthStr = this.getFurnitureWidth(config.type);
                    if(widthStr.includes('%')) widthPercent = parseFloat(widthStr) / 100;
                        
                    const targetWidth = roomWidth * widthPercent;
                        
                    // ✨✨✨ 判断是否为墙面物品
                    const isWallItem = isWallType(config.type);

                    // 🔧 传入 isWallItem 参数 (对应 DragManager 上一步的修改)
                    DragManager.startDragNew(
                        e, 
                        itemId, 
                        config.src, 
                        targetWidth, 
                        isWallItem // <--- 新增参数
                     );
                };
            } else {
                // 如果用光了，变灰
                slot.style.opacity = '0.4';
                slot.style.cursor = 'default';
                slot.title = "已全部摆放";
            }
            listEl.appendChild(slot);
        });
    },

    /**
     * 处理家具点击交互
     */
    handleFurnitureInteraction(type) {
        switch (type) {
            case 'desk':
            case 'chair': // 👈 1. 新增：点击椅子也打开写字台
                ModalManager.open('modal-desk');
                SidebarRenderer.render(); 
                break;

            case 'bookshelf':
                const isStoryTriggered = StoryManager.tryTriggerBookshelfStory();
                if (!isStoryTriggered) {
                    ModalManager.open('modal-bookshelf-ui');
                    BookshelfRenderer.render();
                }
                break;

            case 'rug':
                ModalManager.open('modal-map-selection');
                CityEvent.renderSelectionMenu();
                break;

            case 'bed': // 👈 2. 新增：点击床铺
                if (confirm("是否要退出伊萨卡手记？\n(退出前会自动保存进度)")) {
                    UserData.save(); // 退出前保存
                    // 尝试关闭窗口 (Electron 环境下通常有效)
                    window.close(); 
                }
                break;

            case 'cat': // 👈 3. 新增：点击猫咪
                // 播放一个简单的文字反馈
                HUDRenderer.log("🐈 你摸了摸你的橘猫。它舒服地呼噜了两声。");
                
                // 可选：稍微让猫跳一下（复用房间震动动画类，或者只让图片动）
                const catEl = document.querySelector('.pixel-furniture[src*="cat.png"]');
                if(catEl) {
                    catEl.style.transform = "scaleX(var(--dir)) translateY(-10px)";
                    setTimeout(() => {
                        catEl.style.transform = "scaleX(var(--dir)) translateY(0)";
                    }, 200);
                }
                break;

            default:
                break;
        }
    },

    getFurnitureWidth(type) {
        switch (type) {
            case 'desk':      return '20%';
            case 'bookshelf': return '14%';
            case 'shelf':     return '12%';
            case 'rug':       return '25%';
            case 'chair':     return '12%';
            case 'cat':       return '8%';
            case 'bed':       return '32%';
            case 'board':     return '15%';
            default:          return '8%';
        }
    }
};