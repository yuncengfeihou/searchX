import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types } from "../../../../script.js";
import { Popup, POPUP_TYPE } from '../../../popup.js';

// 插件名称和默认设置
const extensionName = "消息导航增强X1.0";
const defaultSettings = {
    realTimeRendering: true,  // 默认启用实时渲染
    highlightKeywords: true,  // 默认启用关键词高亮
    caseSensitive: false      // 默认不区分大小写
};

// 加载插件设置
function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }
    updateSearchButtonText();
}

// 更新搜索按钮文本
function updateSearchButtonText() {
    const realTimeRendering = extension_settings[extensionName].realTimeRendering;
    $("#search-button").text(realTimeRendering ? "[清空]" : "[搜索]");
}

// 创建插件 UI
function createUI() {
    const settingsHtml = `
        <div id="message-navigator">
            <div class="panel-header">
                <h3>消息检索导航器</h3>
            </div>
            <div class="keyword-search-area">
                <div class="search-input-container">
                    <input type="text" id="keyword-search" placeholder="输入关键词搜索">
                    <button id="search-button">[搜索]</button>
                </div>
                <div id="search-results"></div>
            </div>
            <div class="quick-scroll-area">
                <button id="scroll-up">↑ 最早</button>
                <button id="jump-to-floor">跳转</button>
                <button id="scroll-down">↓ 最新</button>
            </div>
            <div class="panel-footer">
                <button id="advanced-settings">设置</button>
            </div>
        </div>
    `;
    
    $("body").append(settingsHtml);
}

// 显示跳转楼层弹窗
function showJumpToFloorPopup() {
    callPopup("<input type='number' id='floor-number' placeholder='输入楼层号'><br><button id='confirm-floor' class='menu_button'>确认</button>", 'text');
    
    $('#confirm-floor').on('click', function() {
        const floorNumber = parseInt($('#floor-number').val());
        if (!isNaN(floorNumber)) {
            const success = scrollToMessage(floorNumber);
            if (!success) {
                toastr.error("该楼层未加载，无法跳转");
            }
            $('#dialogue_popup').hide();
        }
    });
}

// 显示高级设置弹窗 - 移除取消按钮
function showAdvancedSettingsPopup() {
    const popup = new Popup({
        title: '高级搜索设置',
        content: `
            <div class="advanced-settings-popup">
                <div class="setting-item">
                    <label>
                        <input type="checkbox" id="realtime-rendering" 
                               ${extension_settings[extensionName].realTimeRendering ? 'checked' : ''}>
                        实时渲染搜索结果
                    </label>
                    <div class="setting-description">输入关键词时自动更新搜索结果</div>
                </div>
                
                <div class="setting-item">
                    <label>
                        <input type="checkbox" id="highlight-keywords" 
                               ${extension_settings[extensionName].highlightKeywords ? 'checked' : ''}>
                        关键词提亮
                    </label>
                    <div class="setting-description">在聊天记录中高亮显示匹配的关键词</div>
                </div>
                
                <div class="setting-item">
                    <label>
                        <input type="checkbox" id="case-sensitive" 
                               ${extension_settings[extensionName].caseSensitive ? 'checked' : ''}>
                        区分大小写
                    </label>
                    <div class="setting-description">搜索时区分大小写</div>
                </div>
            </div>
        `,
        buttons: [
            {
                text: '保存设置',
                callback: () => {
                    extension_settings[extensionName].realTimeRendering = $('#realtime-rendering').is(':checked');
                    extension_settings[extensionName].highlightKeywords = $('#highlight-keywords').is(':checked');
                    extension_settings[extensionName].caseSensitive = $('#case-sensitive').is(':checked');
                    
                    saveSettingsDebounced();
                    updateSearchButtonText();
                    toastr.success('已保存当前设置！');
                }
            }
        ],
        type: POPUP_TYPE.CONTENT,
        zIndex: 9999
    });
}

// 滚动到第一条加载的消息
function scrollToFirstLoadedMessage() {
    const firstMessage = document.querySelector('.mes');
    if (firstMessage) {
        firstMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        toastr.error("无法找到消息");
    }
}

// 滚动到最后一条消息
function scrollToLastMessage() {
    const lastMessage = document.querySelector('.mes:last-child');
    if (lastMessage) {
        lastMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        toastr.error("无法找到消息");
    }
}

// 滚动到指定消息
async function scrollToMessage(messageId) {
    try {
        const messageElement = document.querySelector(`.mes[mesid="${messageId}"]`);
        
        if (!messageElement) {
            // 如果消息不存在
            return false;
        }
        
        // 滚动到消息位置
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // 添加高亮效果
        messageElement.classList.add('flash-highlight');
        setTimeout(() => {
            messageElement.classList.remove('flash-highlight');
        }, 2000);
        
        return true;
    } catch (error) {
        console.error("跳转到消息时出错:", error);
        return false;
    }
}

// 获取消息预览文本
function getPreviewText(text, maxLength = 100) {
    if (!text) return "无内容";
    
    // 去除HTML标签获取纯文本
    const plainText = text.replace(/<[^>]*>/g, "");
    
    if (plainText.length <= maxLength) return plainText;
    return plainText.substring(0, maxLength) + "...";
}

// 显示消息内容 - 移除关闭按钮
function showMessageContent(message) {
    const messageContent = message.mes || "无内容";
    const messageName = message.name || "未知";
    const messageId = message.message_id !== undefined ? message.message_id : "未知";
    
    callPopup(`
        <div class="message-popup-container">
            <div class="message-header">
                <span class="message-author">${messageName}</span>
                <span class="message-id">消息ID: ${messageId}</span>
            </div>
            <div class="message-content left-aligned">${messageContent}</div>
            <div class="message-actions">
                <button class="message-action-button" id="jump-to-message">跳转到此消息</button>
            </div>
        </div>
    `, 'text');
    
    $('#jump-to-message').on('click', function() {
        const success = scrollToMessage(messageId);
        if (!success) {
            toastr.error("该楼层未加载，无法跳转");
        }
        $('#dialogue_popup').hide();
    });
}

// 执行搜索
function performSearch(keyword) {
    if (!keyword) {
        $("#search-results").empty();
        return;
    }
    
    const caseSensitive = extension_settings[extensionName].caseSensitive;
    const highlightKeywords = extension_settings[extensionName].highlightKeywords;
    
    // 创建用于搜索的正则表达式
    const searchRegex = new RegExp(keyword, caseSensitive ? 'g' : 'gi');
    
    // 获取消息并搜索
    const chat = getContext().chat;
    const results = [];
    
    for (let i = 0; i < chat.length; i++) {
        const message = chat[i];
        if (!message.mes) continue;
        
        if (searchRegex.test(message.mes)) {
            results.push({ message, index: i });
            
            // 如果启用了关键词高亮，对消息元素应用高亮效果
            if (highlightKeywords) {
                const messageElement = document.querySelector(`.mes[mesid="${i}"]`);
                if (messageElement) {
                    const messageText = messageElement.querySelector('.mes_text');
                    if (messageText) {
                        // 重置搜索正则表达式对象
                        searchRegex.lastIndex = 0;
                        
                        // 创建高亮版本的消息内容
                        const highlightedContent = message.mes.replace(
                            searchRegex, 
                            match => `<span class="keyword-highlight">${match}</span>`
                        );
                        
                        // 更新消息文本内容
                        messageText.innerHTML = highlightedContent;
                    }
                }
            }
        }
    }
    
    displaySearchResults(results);
    
    return results;
}

// 显示搜索结果 - 添加分隔线和颜色区分
function displaySearchResults(results) {
    const resultsContainer = $("#search-results");
    resultsContainer.empty();
    
    if (results.length === 0) {
        resultsContainer.html('<div class="no-results">未找到匹配结果</div>');
        return;
    }
    
    results.forEach(result => {
        const { message, index } = result;
        // 确定角色类型
        const isUser = message.is_user || message.name === getContext().name1;
        const roleClass = isUser ? 'user-message' : 'assistant-message';
        
        const resultItem = $(`
            <div class="search-result-item">
                <div class="result-header ${roleClass}">
                    <span class="result-author">${message.name}</span>
                    <span class="result-id">ID: ${index}</span>
                </div>
                <div class="result-preview">${getPreviewText(message.mes, 80)}</div>
                <div class="result-actions">
                    <button class="result-action view-btn" data-index="${index}">查看</button>
                    <button class="result-action jump-btn" data-index="${index}">跳转</button>
                </div>
            </div>
        `);
        
        resultsContainer.append(resultItem);
    });
    
    // 绑定按钮事件
    $(".result-action.view-btn").on("click", function() {
        const index = $(this).data("index");
        const message = getContext().chat[index];
        showMessageContent(message);
    });
    
    $(".result-action.jump-btn").on("click", function() {
        const index = $(this).data("index");
        const success = scrollToMessage(index);
        if (!success) {
            toastr.error("该楼层未加载，无法跳转");
        }
    });
}

// 处理搜索按钮点击
function handleSearchButtonClick() {
    const keyword = $("#keyword-search").val();
    const realTimeRendering = extension_settings[extensionName].realTimeRendering;
    
    if (realTimeRendering || !keyword) {
        // 清空搜索框和结果
        $("#keyword-search").val("");
        $("#search-results").empty();
        
        // 清除高亮
        if (extension_settings[extensionName].highlightKeywords) {
            const messageElements = document.querySelectorAll('.mes .mes_text');
            messageElements.forEach(el => {
                // 保存原始内容，移除高亮
                const originalContent = el.getAttribute('data-original-content');
                if (originalContent) {
                    el.innerHTML = originalContent;
                    el.removeAttribute('data-original-content');
                }
            });
        }
    } else {
        // 非实时渲染模式下，点击按钮执行搜索
        performSearch(keyword);
    }
}

// 处理关键词输入
function handleKeywordInput() {
    const keyword = $("#keyword-search").val();
    if (extension_settings[extensionName].realTimeRendering && keyword) {
        performSearch(keyword);
    }
}

// 绑定事件
function bindEvents() {
    // 导航按钮
    $("#scroll-up").on("click", scrollToFirstLoadedMessage);
    $("#scroll-down").on("click", scrollToLastMessage);
    $("#jump-to-floor").on("click", () => showJumpToFloorPopup());
    
    // 搜索相关
    $("#search-button").on("click", handleSearchButtonClick);
    $("#keyword-search").on("input", handleKeywordInput);
    $("#keyword-search").on("keypress", function(e) {
        if (e.which === 13 && !extension_settings[extensionName].realTimeRendering) {
            handleSearchButtonClick();
        }
    });
    
    // 设置按钮
    $("#advanced-settings").on("click", showAdvancedSettingsPopup);
    
    // 监听新消息事件，更新搜索结果
    eventSource.on(event_types.MESSAGE_RECEIVED, () => {
        const keyword = $("#keyword-search").val();
        if (extension_settings[extensionName].realTimeRendering && keyword) {
            performSearch(keyword);
        }
    });
}

// 初始化插件
jQuery(async () => {
    // 创建UI
    createUI();
    
    // 加载设置
    loadSettings();
    
    // 绑定事件
    bindEvents();
    
    console.log("消息检索导航器插件已加载");
});
