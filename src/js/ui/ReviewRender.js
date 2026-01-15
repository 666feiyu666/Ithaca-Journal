/* src/js/ui/ReviewRenderer.js */
import { UserData } from '../data/UserData.js';
import { MailManager } from '../logic/MailManager.js';
import { StoryManager } from '../logic/StoryManager.js';
import { ModalManager } from './ModalManager.js';

export const ReviewRenderer = {
    init() {
        // 绑定左下角按钮点击事件
        const btn = document.getElementById('btn-review-log');
        if (btn) {
            btn.onclick = () => {
                this.render();
                ModalManager.open('modal-review-log');
            };
        }
    },

    /**
     * 渲染回顾列表
     */
    render() {
        const container = document.getElementById('review-list-container');
        if (!container) return;

        container.innerHTML = ''; // 清空列表
        const currentDay = UserData.state.day;

        // 倒序排列：从最新的一天开始显示
        for (let d = currentDay; d >= 1; d--) {
            const dayItem = this.createDayItem(d);
            container.appendChild(dayItem);
        }
    },

    createDayItem(day) {
        const item = document.createElement('div');
        item.className = 'review-day-item';

        // 1. 标题栏
        const header = document.createElement('div');
        header.className = 'review-header';
        header.innerHTML = `<span>📅 Day ${day}</span> <span class="toggle-icon">▼</span>`;
        
        // 2. 内容区域 (默认折叠)
        const content = document.createElement('div');
        content.className = 'review-content hidden';

        // --- A. 信件回顾 ---
        const mail = MailManager.letters[day];
        if (mail) {
            const mailBlock = document.createElement('div');
            mailBlock.className = 'review-block mail-block';
            mailBlock.innerHTML = `
                <div class="block-title">📧 信件：${mail.title}</div>
                <div class="block-text">${marked.parse(mail.content)}</div>
                <div class="block-reply">你的感想：${UserData.getReply(day) || "（暂无记录）"}</div>
            `;
            content.appendChild(mailBlock);
        }

        // --- B. 关键剧情回顾 (从 StoryManager 获取脚本) ---
        // 我们需要手动映射一下哪天发生了什么剧情，或者根据 UserData 判断
        const storyHtml = this.getStoryLogForDay(day);
        if (storyHtml) {
            const storyBlock = document.createElement('div');
            storyBlock.className = 'review-block story-block';
            storyBlock.innerHTML = `
                <div class="block-title">💬 记忆碎片</div>
                ${storyHtml}
            `;
            content.appendChild(storyBlock);
        }

        // 点击展开/收起逻辑
        header.onclick = () => {
            const isHidden = content.classList.contains('hidden');
            // 手风琴效果：先关闭所有其他的（可选）
            // document.querySelectorAll('.review-content').forEach(el => el.classList.add('hidden'));
            
            if (isHidden) {
                content.classList.remove('hidden');
                header.querySelector('.toggle-icon').innerText = '▲';
            } else {
                content.classList.add('hidden');
                header.querySelector('.toggle-icon').innerText = '▼';
            }
        };

        item.appendChild(header);
        item.appendChild(content);
        return item;
    },

    /**
     * 获取某一天的剧情文本 (这里需要根据你的 StoryManager 配置手动映射)
     */
    getStoryLogForDay(day) {
        let html = "";

        // 辅助函数：将脚本数组转为 HTML
        const scriptToHtml = (scriptKey) => {
            const script = StoryManager.scripts[scriptKey];
            if (!script) return "";
            return script.map(line => 
                `<p><strong style="color:#d84315">${line.speaker}:</strong> ${line.text}</p>`
            ).join("");
        };

        // --- 剧情映射表 ---
        // Day 1: 发现第一本书
        if (day === 1 && UserData.state.hasFoundMysteryEntry) {
            html += scriptToHtml('find_first_note');
        }
        
        // Day 1: 信件吐槽
        if (day === 1) { 
            html += scriptToHtml('mail_reaction_day1');
        }

        // Day 7: 收到包裹
        if (day === 7) {
            html += scriptToHtml('package_day_7');
        }
        
        // Day 14: 收到包裹
        if (day === 14) {
            html += scriptToHtml('package_day_14');
        }
        
        // Day 21: 收到包裹
        if (day === 21) {
            html += scriptToHtml('package_day_21');
        }

        return html || null;
    }
};