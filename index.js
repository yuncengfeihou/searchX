import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types } from "../../../../script.js";
import { Popup, POPUP_TYPE } from '../../../popup.js';

// 插件名称和默认设置
const extensionName = "message-navigator";
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
    
    // 添加到页面
    $("body").append(settingsHtml);
}

// 搜索消息
function searchMessages(keyword) {
    if (!keyword) return [];
    
    const context = getContext();
    const chat = context.chat;
    const caseSensitive = extension_settings[extensionName].caseSensitive;
    
    // 准备搜索关键词
    const searchTerm = caseSensitive ? keyword : keyword.toLowerCase();
    
    // 搜索结果
    const results = [];
    
    chat.forEach((message, index) => {
        const messageText = caseSensitive ? message.mes : message.mes.toLowerCase();
        if (messageText.includes(searchTerm)) {
            // 提取匹配上下文
            let startPos = messageText.indexOf(searchTerm);
            let previewStart = Math.max(0, startPos - 20);
            let previewEnd = Math.min(messageText.length, startPos + searchTerm.length + 20);
            let preview = message.mes.substring(previewStart, previewEnd);
            
            // 如果不是从头开始，添加省略号
            if (previewStart > 0) preview = "..." + preview;
            if (previewEnd < message.mes.length) preview = preview + "...";
            
            results.push({
                mesId: index,
                name: message.name || "Unknown",
                preview: preview,
                fullText: message.mes
            });
        }
    });
    
    return results;
}

// 执行搜索并显示结果
function performSearch(keyword) {
    const results = searchMessages(keyword);
    const resultsContainer = $("#search-results");
    resultsContainer.empty();
    
    if (results.length > 0) {
        results.forEach(result => {
            let previewText = result.preview;
            
            // 如果启用了高亮，对关键词进行高亮处理
            if (extension_settings[extensionName].highlightKeywords) {
                const regex = extension_settings[extensionName].caseSensitive 
                    ? new RegExp(keyword, 'g') 
                    : new RegExp(keyword, 'gi');
                previewText = previewText.replace(regex, match => `<span class="highlight">${match}</span>`);
            }
            
            resultsContainer.append(`
                <div class="search-result" data-mesid="${result.mesId}">
                    <div class="result-name">${result.name}</div>
                    <div class="result-preview">${previewText}</div>
                </div>
            `);
        });
        
        // 绑定点击事件
        $(".search-result").on("click", function() {
            const mesId = $(this).data("mesid");
            showMessagePopup(mesId);
        });
    } else {
        resultsContainer.html("<div class='no-results'>未找到匹配的消息</div>");
    }
}

// 显示消息弹窗
function showMessagePopup(mesId) {
    const context = getContext();
    const chat = context.chat;
    
    if (mesId < 0 || mesId >= chat.length) {
        toastr.error("无效的消息ID", "消息导航");
        return;
    }
    
    const message = chat[mesId];
    
    const popupHtml = `
        <div class="message-popup-container">
            <h3 class="message-header">
                <span class="message-author">${message.name || "Unknown"}</span>
                <span class="message-id">楼层: ${mesId}</span>
            </h3>
            <div class="message-content left-aligned">${message.mes}</div>
            <div class="message-actions">
                <button id="jump-to-message" class="popup-button">跳转到消息</button>
                <button id="close-popup" class="popup-button secondary">关闭</button>
            </div>
        </div>
    `;
    
    const popup = new Popup(popupHtml, POPUP_TYPE.TEXT);
    popup.show();
    
    $("#jump-to-message").on("click", function() {
        scrollToMessage(mesId);
        popup.close();
    });
    
    $("#close-popup").on("click", function() {
        popup.close();
    });
}


// 滚动到指定消息
function scrollToMessage(mesId) {
    // 确保消息ID是数字
    mesId = parseInt(mesId);
    if (isNaN(mesId)) return;
    
    // 尝试找到消息元素
    const messageElement = $(`.mes[mesid="${mesId}"]`);
    
    if (messageElement.length) {
        // 消息元素存在，滚动到该元素
        // 使用更可靠的滚动方法组合
        try {
            // 先使用jQuery动画滚动到元素位置
            $('html, body').animate({
                scrollTop: messageElement.offset().top - (window.innerHeight / 3)
            }, 500, function() {
                // 然后使用原生方法确保元素完全可见
                messageElement[0].scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
                
                // 添加闪烁高亮效果
                messageElement.addClass("flash-highlight");
                setTimeout(() => {
                    messageElement.removeClass("flash-highlight");
                }, 2000);
            });
        } catch (error) {
            console.error("滚动到消息时出错:", error);
            
            // 备用滚动方法
            try {
                // 只使用传统滚动
                const scrollPosition = messageElement.offset().top - 100;
                window.scrollTo({
                    top: scrollPosition,
                    behavior: 'smooth'
                });
                
                // 仍然添加高亮效果
                messageElement.addClass("flash-highlight");
                setTimeout(() => {
                    messageElement.removeClass("flash-highlight");
                }, 2000);
            } catch (fallbackError) {
                console.error("备用滚动方法也失败:", fallbackError);
                toastr.error("无法滚动到指定消息", "消息导航");
            }
        }
    } else {
        // ... existing code for handling messages not in view ...
    }
}

// ... existing code ...

// 滚动到最早的已加载消息
function scrollToFirstLoadedMessage() {
    const loadedMessages = $("#chat .mes");
    if (loadedMessages.length > 0) {
        const firstMesId = parseInt(loadedMessages.first().attr("mesid"));
        scrollToMessage(firstMesId);
    }
}

// 滚动到最后一条消息
function scrollToLastMessage() {
    const loadedMessages = $("#chat .mes");
    if (loadedMessages.length > 0) {
        const lastMesId = parseInt(loadedMessages.last().attr("mesid"));
        scrollToMessage(lastMesId);
    }
}

// 显示跳转到楼层弹窗
function showJumpToFloorPopup(defaultMesId = "") {
    const context = getContext();
    const totalMessages = context.chat.length;
    
    const popupHtml = `
        <div class="jump-to-floor-container">
            <p>当前共有 ${totalMessages} 条消息</p>
            <div>
                <label for="floor-number">输入楼层号 (0-${totalMessages - 1}):</label>
                <input type="number" id="floor-number" min="0" max="${totalMessages - 1}" value="${defaultMesId}">
            </div>
            <div class="popup-buttons">
                <button id="confirm-jump">确认跳转</button>
                <button id="cancel-jump">取消</button>
            </div>
        </div>
    `;
    
    const popup = new Popup(popupHtml, POPUP_TYPE.TEXT);
    popup.show();
    
    $("#confirm-jump").on("click", function() {
        const floorNumber = parseInt($("#floor-number").val());
        if (!isNaN(floorNumber) && floorNumber >= 0 && floorNumber < totalMessages) {
            scrollToMessage(floorNumber);
            popup.close();
        } else {
            alert("请输入有效的楼层号!");
        }
    });
    
    $("#cancel-jump").on("click", function() {
        popup.close();
    });
}

// 显示高级设置弹窗
function showAdvancedSettingsPopup() {
    const realTimeChecked = extension_settings[extensionName].realTimeRendering ? "checked" : "";
    const highlightChecked = extension_settings[extensionName].highlightKeywords ? "checked" : "";
    const caseSensitiveChecked = extension_settings[extensionName].caseSensitive ? "checked" : "";
    
    const popupHtml = `
        <div class="settings-container">
            <h3>消息检索设置</h3>
            <div class="setting-item">
                <label>
                    <input type="checkbox" id="real-time-rendering" ${realTimeChecked}>
                    实时搜索
                </label>
                <small>输入时自动搜索，关闭后需点击搜索按钮</small>
            </div>
            <div class="setting-item">
                <label>
                    <input type="checkbox" id="highlight-keywords" ${highlightChecked}>
                    关键词高亮
                </label>
                <small>在搜索结果中高亮显示匹配的关键词</small>
            </div>
            <div class="setting-item">
                <label>
                    <input type="checkbox" id="case-sensitive" ${caseSensitiveChecked}>
                    区分大小写
                </label>
                <small>搜索时区分大小写</small>
            </div>
            <div class="popup-buttons">
                <button id="save-settings">保存设置</button>
                <button id="cancel-settings">取消</button>
            </div>
        </div>
    `;
    
    const popup = new Popup(popupHtml, POPUP_TYPE.TEXT);
    popup.show();
    
    $("#save-settings").on("click", function() {
        extension_settings[extensionName].realTimeRendering = $("#real-time-rendering").prop("checked");
        extension_settings[extensionName].highlightKeywords = $("#highlight-keywords").prop("checked");
        extension_settings[extensionName].caseSensitive = $("#case-sensitive").prop("checked");
        
        saveSettingsDebounced();
        updateSearchButtonText();
        popup.close();
        
        // 如果有搜索关键词，重新执行搜索以应用新设置
        const keyword = $("#keyword-search").val();
        if (keyword) {
            performSearch(keyword);
        }
    });
    
    $("#cancel-settings").on("click", function() {
        popup.close();
    });
}

// 处理关键词输入
function handleKeywordInput() {
    const keyword = $("#keyword-search").val();
    
    if (extension_settings[extensionName].realTimeRendering) {
        if (keyword) {
            performSearch(keyword);
        } else {
            $("#search-results").empty();
        }
    }
}

// 处理搜索按钮点击
function handleSearchButtonClick() {
    if (extension_settings[extensionName].realTimeRendering) {
        // 清空模式
        $("#keyword-search").val("");
        $("#search-results").empty();
    } else {
        // 搜索模式
        const keyword = $("#keyword-search").val();
        if (keyword) {
            performSearch(keyword);
        }
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

// 添加显示错误提示的函数
function showErrorToast(message) {
    // 移除已有的错误提示
    $('.error-toast').remove();
    
    // 创建新的错误提示
    const toast = $('<div class="error-toast"></div>').text(message);
    $('body').append(toast);
    
    // 3秒后自动移除
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// 修改跳转到指定消息ID的函数
function navigateToMessage(messageId) {
    // 检查消息是否存在
    const context = getContext();
    if (!context || !context.chat || messageId >= context.chat.length) {
        showErrorToast("无效的消息ID");
        return false;
    }
    
    // 尝试查找消息元素
    const messageElement = $(`.mes[mesid="${messageId}"]`);
    if (messageElement.length === 0) {
        showErrorToast("该楼层未加载，无法跳转");
        return false;
    }
    
    // 滚动到消息位置
    messageElement[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // 添加高亮效果
    messageElement.addClass('flash-highlight');
    setTimeout(() => {
        messageElement.removeClass('flash-highlight');
    }, 2000);
    
    return true;
}

// 修改跳转到指定楼层的函数
function jumpToFloor() {
    const floorInput = $('#floor-input');
    const floorNumber = parseInt(floorInput.val());
    
    if (isNaN(floorNumber) || floorNumber < 0) {
        showErrorToast("请输入有效的楼层数字");
        return;
    }
    
    const success = navigateToMessage(floorNumber);
    if (success) {
        // 更新当前选中的消息
        updateSelectedMessage(floorNumber);
    }
}
