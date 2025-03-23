import { extension_settings, getContext } from "../../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types } from "../../../../../script.js";
import { toastr } from "../../../../../../node_modules/toastr/toastr.js";

const extensionName = "message-navigator-enhanced";
const extensionFolderPath = `/scripts/extensions/third-party/${extensionName}`;
let navigatorVisible = true;

// 默认设置
const defaultSettings = {
    maxPreviewLength: 100,
    messagesPerPage: 10,
    highlightJumpedMessage: true,
    showFullMessageOnClick: true,
    autoScrollToPosition: true
};

// ... 保留原有的功能函数 ...

// 确保设置初始化
function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
        saveSettingsDebounced();
    }
    return extension_settings[extensionName];
}

// 添加没有找到或无法跳转到消息的错误提示
function showErrorMessage(message) {
    toastr.error(message, "消息导航", { 
        timeOut: 3000,
        closeButton: true,
        progressBar: true,
        positionClass: "toast-top-center" 
    });
}

// 跳转到指定消息ID的函数
function jumpToMessage(messageId) {
    const context = getContext();
    const chat = context.chat;
    
    // 检查消息ID是否有效
    if (messageId < 0 || messageId >= chat.length) {
        showErrorMessage("无效的消息ID");
        return false;
    }
    
    // 尝试查找消息元素
    const messageElement = document.querySelector(`[mesid="${messageId}"]`);
    if (!messageElement) {
        showErrorMessage("该楼层未加载，无法跳转");
        return false;
    }
    
    // 滚动到消息位置
    messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // 如果启用了高亮功能，添加高亮效果
    const settings = loadSettings();
    if (settings.highlightJumpedMessage) {
        messageElement.classList.add('flash-highlight');
        setTimeout(() => {
            messageElement.classList.remove('flash-highlight');
        }, 2000);
    }
    
    return true;
}

// 初始化UI
function initializeUI() {
    const settings = loadSettings();
    
    // 创建主面板
    const navigatorPanel = document.createElement('div');
    navigatorPanel.id = 'message-navigator';
    navigatorPanel.innerHTML = `
        <div class="navigator-header">
            <h3 class="navigator-title">消息导航器</h3>
            <div class="navigator-controls">
                <button class="navigator-control-btn" id="settings-btn" title="设置">⚙️</button>
                <button class="navigator-control-btn" id="minimize-btn" title="最小化">_</button>
                <button class="navigator-control-btn" id="close-btn" title="关闭">✕</button>
            </div>
        </div>
        <div class="search-container">
            <input type="text" class="search-input" id="message-search" placeholder="搜索消息内容...">
            <button class="search-btn" id="search-btn">搜索</button>
        </div>
        <div class="messages-container" id="messages-list">
            <!-- 消息列表将在这里动态生成 -->
        </div>
        <div class="navigator-footer">
            <div class="page-controls">
                <button class="page-btn" id="prev-page">上一页</button>
                <span class="page-info">1/1</span>
                <button class="page-btn" id="next-page">下一页</button>
            </div>
            <button class="nav-action-btn" id="refresh-btn">刷新</button>
        </div>
    `;
    
    document.body.appendChild(navigatorPanel);
    
    // 使面板可拖动
    makeDraggable(navigatorPanel);
    
    // 添加事件监听器
    setupEventListeners();
    
    // 初始加载消息
    refreshMessagesList();
}

// 使元素可拖动的函数
function makeDraggable(element) {
    const header = element.querySelector('.navigator-header');
    let isDragging = false;
    let offsetX, offsetY;
    
    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        offsetX = e.clientX - element.getBoundingClientRect().left;
        offsetY = e.clientY - element.getBoundingClientRect().top;
        
        // 防止文本选择
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const x = e.clientX - offsetX;
        const y = e.clientY - offsetY;
        
        // 确保不超出屏幕边界
        const maxX = window.innerWidth - element.offsetWidth;
        const maxY = window.innerHeight - element.offsetHeight;
        
        element.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
        element.style.top = `${Math.max(0, Math.min(y, maxY))}px`;
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

// 设置事件监听器
function setupEventListeners() {
    // 关闭按钮
    document.getElementById('close-btn').addEventListener('click', () => {
        const navigator = document.getElementById('message-navigator');
        if (navigator) navigator.remove();
    });
    
    // 最小化按钮
    document.getElementById('minimize-btn').addEventListener('click', () => {
        const navigator = document.getElementById('message-navigator');
        const messagesContainer = document.getElementById('messages-list');
        const footer = navigator.querySelector('.navigator-footer');
        const searchContainer = navigator.querySelector('.search-container');
        
        if (navigatorVisible) {
            messagesContainer.style.display = 'none';
            footer.style.display = 'none';
            searchContainer.style.display = 'none';
            navigatorVisible = false;
        } else {
            messagesContainer.style.display = 'block';
            footer.style.display = 'flex';
            searchContainer.style.display = 'flex';
            navigatorVisible = true;
        }
    });
    
    // 设置按钮
    document.getElementById('settings-btn').addEventListener('click', showSettings);
    
    // 刷新按钮
    document.getElementById('refresh-btn').addEventListener('click', refreshMessagesList);
    
    // 搜索按钮
    document.getElementById('search-btn').addEventListener('click', searchMessages);
    
    // 回车键搜索
    document.getElementById('message-search').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            searchMessages();
        }
    });
    
    // 翻页按钮
    document.getElementById('prev-page').addEventListener('click', goToPrevPage);
    document.getElementById('next-page').addEventListener('click', goToNextPage);
    
    // 监听新消息事件
    eventSource.on(event_types.MESSAGE_RECEIVED, () => {
        refreshMessagesList();
    });
    
    // 监听消息删除事件
    eventSource.on(event_types.MESSAGE_DELETED, () => {
        refreshMessagesList();
    });
    
    // 监听消息编辑事件
    eventSource.on(event_types.MESSAGE_EDITED, () => {
        refreshMessagesList();
    });
}

// 当前页码和搜索结果
let currentPage = 1;
let filteredMessages = [];

// 刷新消息列表
function refreshMessagesList() {
    const context = getContext();
    const settings = loadSettings();
    
    // 获取所有消息
    const allMessages = context.chat.map((msg, index) => {
        return {
            id: index,
            author: msg.name || "未知",
            content: msg.mes || "",
            isUser: msg.is_user || false,
            isSystem: msg.is_system || false
        };
    });
    
    // 保存当前搜索结果
    filteredMessages = allMessages;
    
    // 显示消息列表
    displayMessages(filteredMessages, currentPage);
}

// 搜索消息
function searchMessages() {
    const searchInput = document.getElementById('message-search');
    const searchTerm = searchInput.value.trim().toLowerCase();
    
    const context = getContext();
    
    // 如果搜索词为空，显示所有消息
    if (!searchTerm) {
        refreshMessagesList();
        return;
    }
    
    // 搜索匹配的消息
    const matchedMessages = context.chat
        .map((msg, index) => {
            return {
                id: index,
                author: msg.name || "未知",
                content: msg.mes || "",
                isUser: msg.is_user || false,
                isSystem: msg.is_system || false
            };
        })
        .filter(msg => 
            msg.content.toLowerCase().includes(searchTerm) || 
            msg.author.toLowerCase().includes(searchTerm)
        );
    
    // 更新过滤后的消息列表
    filteredMessages = matchedMessages;
    currentPage = 1;
    
    // 显示搜索结果
    displayMessages(filteredMessages, currentPage);
}

// 显示消息列表
function displayMessages(messages, page) {
    const settings = loadSettings();
    const messagesPerPage = settings.messagesPerPage;
    const maxPreviewLength = settings.maxPreviewLength;
    
    // 计算总页数
    const totalPages = Math.max(1, Math.ceil(messages.length / messagesPerPage));
    
    // 确保当前页码有效
    currentPage = Math.max(1, Math.min(page, totalPages));
    
    // 更新页码信息
    document.querySelector('.page-info').textContent = `${currentPage}/${totalPages}`;
    
    // 启用/禁用翻页按钮
    document.getElementById('prev-page').disabled = currentPage <= 1;
    document.getElementById('next-page').disabled = currentPage >= totalPages;
    
    // 计算当前页的消息
    const startIndex = (currentPage - 1) * messagesPerPage;
    const endIndex = Math.min(startIndex + messagesPerPage, messages.length);
    const pageMessages = messages.slice(startIndex, endIndex);
    
    // 清空消息列表
    const messagesList = document.getElementById('messages-list');
    messagesList.innerHTML = '';
    
    // 如果没有消息，显示提示
    if (pageMessages.length === 0) {
        messagesList.innerHTML = '<div class="no-messages">没有找到匹配的消息</div>';
        return;
    }
    
    // 添加消息项
    pageMessages.forEach(msg => {
        const messagePreview = msg.content.length > maxPreviewLength 
            ? msg.content.substring(0, maxPreviewLength) + '...' 
            : msg.content;
        
        const messageItem = document.createElement('div');
        messageItem.className = 'message-item';
        messageItem.dataset.messageId = msg.id;
        messageItem.innerHTML = `
            <div class="message-metadata">
                <span class="message-author">${msg.author}</span>
                <span class="message-id">ID: ${msg.id}</span>
            </div>
            <div class="message-preview">${messagePreview}</div>
        `;
        
        // 点击消息项跳转到对应消息
        messageItem.addEventListener('click', () => {
            // 尝试跳转到消息
            const jumpSuccess = jumpToMessage(msg.id);
            
            // 如果启用了显示完整消息并且跳转成功
            if (settings.showFullMessageOnClick && jumpSuccess) {
                showFullMessage(msg);
            }
        });
        
        messagesList.appendChild(messageItem);
    });
}

// 显示完整消息
function showFullMessage(message) {
    // 创建弹窗容器
    const popupContainer = document.createElement('div');
    popupContainer.className = 'message-popup-container';
    popupContainer.innerHTML = `
        <div class="message-popup-header">
            <span class="message-author">${message.author}</span>
            <span class="message-id">消息 ID: ${message.id}</span>
        </div>
        <div class="left-aligned">${message.content}</div>
        <div class="message-actions">
            <button class="action-btn" id="jump-to-msg">跳转到消息</button>
            <button class="action-btn secondary" id="close-popup">关闭</button>
        </div>
    `;
    
    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    overlay.style.zIndex = '2000';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    
    // 将弹窗添加到遮罩层
    overlay.appendChild(popupContainer);
    
    // 将遮罩层添加到页面
    document.body.appendChild(overlay);
    
    // 关闭弹窗
    document.getElementById('close-popup').addEventListener('click', () => {
        document.body.removeChild(overlay);
    });
    
    // 跳转到消息
    document.getElementById('jump-to-msg').addEventListener('click', () => {
        const jumpSuccess = jumpToMessage(message.id);
        if (!jumpSuccess) {
            showErrorMessage("该楼层未加载，无法跳转");
        }
        document.body.removeChild(overlay);
    });
    
    // 点击遮罩层关闭弹窗
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    });
}

// 显示设置面板
function showSettings() {
    const settings = loadSettings();
    
    // 创建设置面板
    const settingsPanel = document.createElement('div');
    settingsPanel.className = 'settings-panel';
    settingsPanel.innerHTML = `
        <div class="settings-header">消息导航器设置</div>
        <div class="setting-item">
            <label>
                <input type="checkbox" id="highlight-jumped" ${settings.highlightJumpedMessage ? 'checked' : ''}>
                高亮显示跳转的消息
            </label>
            <small>跳转到消息时临时高亮显示该消息</small>
        </div>
        <div class="setting-item">
            <label>
                <input type="checkbox" id="show-full-message" ${settings.showFullMessageOnClick ? 'checked' : ''}>
                点击时显示完整消息
            </label>
            <small>点击消息列表项时显示消息的完整内容</small>
        </div>
        <div class="setting-item">
            <label>
                <input type="checkbox" id="auto-scroll" ${settings.autoScrollToPosition ? 'checked' : ''}>
                自动滚动到指定位置
            </label>
            <small>点击消息后自动滚动到消息位置</small>
        </div>
        <div class="setting-item">
            <label>每页显示消息数：</label>
            <input type="number" id="messages-per-page" value="${settings.messagesPerPage}" min="5" max="50" step="5">
            <small>每页显示的消息数量</small>
        </div>
        <div class="setting-item">
            <label>消息预览长度：</label>
            <input type="number" id="preview-length" value="${settings.maxPreviewLength}" min="50" max="500" step="10">
            <small>消息预览显示的最大字符数</small>
        </div>
        <div class="message-actions">
            <button class="action-btn" id="save-settings">保存设置</button>
            <button class="action-btn secondary" id="close-settings">取消</button>
        </div>
    `;
    
    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    overlay.style.zIndex = '2000';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    
    // 将设置面板添加到遮罩层
    overlay.appendChild(settingsPanel);
    
    // 将遮罩层添加到页面
    document.body.appendChild(overlay);
    
    // 保存设置
    document.getElementById('save-settings').addEventListener('click', () => {
        // 获取设置值
        settings.highlightJumpedMessage = document.getElementById('highlight-jumped').checked;
        settings.showFullMessageOnClick = document.getElementById('show-full-message').checked;
        settings.autoScrollToPosition = document.getElementById('auto-scroll').checked;
        settings.messagesPerPage = parseInt(document.getElementById('messages-per-page').value);
        settings.maxPreviewLength = parseInt(document.getElementById('preview-length').value);
        
        // 保存设置
        extension_settings[extensionName] = settings;
        saveSettingsDebounced();
        
        // 刷新消息列表
        refreshMessagesList();
        
        // 关闭设置面板
        document.body.removeChild(overlay);
    });
    
    // 关闭设置面板
    document.getElementById('close-settings').addEventListener('click', () => {
        document.body.removeChild(overlay);
    });
    
    // 点击遮罩层关闭设置面板
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    });
}

// 上一页
function goToPrevPage() {
    if (currentPage > 1) {
        currentPage--;
        displayMessages(filteredMessages, currentPage);
    }
}

// 下一页
function goToNextPage() {
    const settings = loadSettings();
    const totalPages = Math.ceil(filteredMessages.length / settings.messagesPerPage);
    
    if (currentPage < totalPages) {
        currentPage++;
        displayMessages(filteredMessages, currentPage);
    }
}

// 初始化扩展
jQuery(async () => {
    // 加载设置
    loadSettings();
    
    // 初始化UI
    initializeUI();
    
    console.log(`${extensionName} 插件已加载`);
});
