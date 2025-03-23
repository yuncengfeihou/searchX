import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types } from "../../../../script.js";
import { Popup, POPUP_TYPE } from '../../../popup.js';

// 插件名称和默认设置
const extensionName = "message-navigator";
const defaultSettings = {
    realTimeRendering: true,  // 默认启用实时渲染
    highlightKeywords: true,  // 默认启用关键词高亮
    caseSensitive: false,     // 默认不区分大小写
    showPanel: true,          // 默认显示面板
    panelPosition: 'left',    // 默认面板位置
    maxResults: 20            // 默认最大结果数
};

// 加载插件设置
function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }
    
    // 应用设置到UI
    updatePanelVisibility();
    updatePanelPosition();
    updateSearchButtonText();
}

// 更新面板可见性
function updatePanelVisibility() {
    if (extension_settings[extensionName].showPanel) {
        $("#message-navigator").show();
    } else {
        $("#message-navigator").hide();
    }
}

// 更新面板位置
function updatePanelPosition() {
    const position = extension_settings[extensionName].panelPosition;
    const $panel = $("#message-navigator");
    
    // 重置位置
    $panel.removeClass("panel-left panel-right");
    
    if (position === 'left') {
        $panel.addClass("panel-left");
    } else {
        $panel.addClass("panel-right");
    }
}

// 更新搜索按钮文本
function updateSearchButtonText() {
    const realTimeRendering = extension_settings[extensionName].realTimeRendering;
    $("#search-button").text(realTimeRendering ? "[清空]" : "[搜索]");
}

// 搜索消息
function searchMessages(keyword) {
    if (!keyword) return [];
    
    const context = getContext();
    const chat = context.chat;
    const caseSensitive = extension_settings[extensionName].caseSensitive;
    const maxResults = extension_settings[extensionName].maxResults;
    
    // 准备搜索关键词
    const searchTerm = caseSensitive ? keyword : keyword.toLowerCase();
    
    // 搜索结果
    const results = [];
    
    // 遍历聊天记录
    for (let i = 0; i < chat.length; i++) {
        const message = chat[i];
        if (!message.mes) continue;
        
        const messageText = caseSensitive ? message.mes : message.mes.toLowerCase();
        
        if (messageText.includes(searchTerm)) {
            // 提取匹配上下文
            const index = messageText.indexOf(searchTerm);
            const startPos = Math.max(0, index - 20);
            const endPos = Math.min(messageText.length, index + searchTerm.length + 20);
            
            let previewText = messageText.substring(startPos, endPos);
            if (startPos > 0) previewText = '...' + previewText;
            if (endPos < messageText.length) previewText = previewText + '...';
            
            // 高亮关键词
            if (extension_settings[extensionName].highlightKeywords) {
                const highlightedText = highlightKeyword(previewText, searchTerm, caseSensitive);
                results.push({
                    mesId: i,
                    text: `[${i}] ${message.name}: ${highlightedText}`,
                    fullText: message.mes
                });
            } else {
                results.push({
                    mesId: i,
                    text: `[${i}] ${message.name}: ${previewText}`,
                    fullText: message.mes
                });
            }
            
            // 限制结果数量
            if (results.length >= maxResults) break;
        }
    }
    
    return results;
}

// 高亮关键词
function highlightKeyword(text, keyword, caseSensitive) {
    if (!caseSensitive) {
        const regex = new RegExp(keyword, 'gi');
        return text.replace(regex, match => `<span class="highlight">${match}</span>`);
    } else {
        return text.replace(new RegExp(keyword, 'g'), `<span class="highlight">${keyword}</span>`);
    }
}

// 滚动到指定 mesId 的消息
function scrollToMessage(mesId) {
    const messageElement = $(`#chat .mes[mesid="${mesId}"]`);
    if (messageElement.length > 0) {
        messageElement[0].scrollIntoView({ behavior: 'smooth' });
        
        // 添加闪烁效果
        messageElement.addClass("flash-highlight");
        setTimeout(() => {
            messageElement.removeClass("flash-highlight");
        }, 2000);
    } else {
        toastr.error("消息未加载或不存在");
    }
}

// 滚动到最早的已加载消息
function scrollToFirstLoadedMessage() {
    const loadedMessages = $("#chat .mes");
    if (loadedMessages.length > 0) {
        const firstMesId = parseInt(loadedMessages.first().attr("mesid"));
        scrollToMessage(firstMesId);
    } else {
        toastr.error("没有已加载的消息");
    }
}

// 滚动到最新消息
function scrollToLastMessage() {
    const context = getContext();
    const chat = context.chat;
    if (chat.length > 0) {
        scrollToMessage(chat.length - 1);
    }
}

// 处理关键词输入
function handleKeywordInput() {
    const keyword = $("#keyword-search").val();
    
    // 如果启用了实时渲染且有关键词，则执行搜索
    if (extension_settings[extensionName].realTimeRendering && keyword) {
        performSearch(keyword);
    } else if (!extension_settings[extensionName].realTimeRendering) {
        // 如果未启用实时渲染，清空结果区域
        $("#search-results").empty();
    }
}

// 执行搜索
function performSearch(keyword) {
    const results = searchMessages(keyword);
    const resultsContainer = $("#search-results");
    resultsContainer.empty();
    
    if (results.length > 0) {
        results.forEach(result => {
            resultsContainer.append(
                `<div class="search-result" data-mesid="${result.mesId}">${result.text}</div>`
            );
        });
        
        // 绑定点击事件
        $(".search-result").on("click", function() {
            const mesId = $(this).data("mesid");
            showJumpToFloorPopup(mesId);
        });
    } else {
        resultsContainer.html("<div class='no-results'>未找到匹配的消息</div>");
    }
}

// 处理搜索按钮点击
function handleSearchButtonClick() {
    const keyword = $("#keyword-search").val();
    
    if (extension_settings[extensionName].realTimeRendering) {
        // 实时渲染模式下，按钮作为清空按钮
        $("#keyword-search").val("");
        $("#search-results").empty();
    } else if (keyword) {
        // 非实时渲染模式下，按钮作为搜索按钮
        performSearch(keyword);
    }
}

// 显示跳转指定楼层弹窗
async function showJumpToFloorPopup(selectedMesId = null) {
    const context = getContext();
    const chat = context.chat;
    
    const popupHtml = `
        <div class="jump-to-floor-container">
            <div class="popup-header">
                <h3>消息导航</h3>
                <input type="number" id="floor-input" placeholder="输入楼层号" min="0" max="${chat.length - 1}">
            </div>
            <div id="floor-info" class="floor-preview"></div>
            <div id="full-message-container" class="message-content"></div>
            <div class="popup-buttons">
                <button id="prev-message" class="nav-button"><i class="fa-solid fa-chevron-left"></i> 上一条</button>
                <button id="jump-button" class="primary-button">跳转</button>
                <button id="next-message" class="nav-button">下一条 <i class="fa-solid fa-chevron-right"></i></button>
            </div>
        </div>
    `;
    
    const popup = new Popup(popupHtml, POPUP_TYPE.TEXT);
    popup.show();
    
    const $floorInput = $("#floor-input");
    const $floorInfo = $("#floor-info");
    const $fullMessageContainer = $("#full-message-container");
    const $jumpButton = $("#jump-button");
    const $prevButton = $("#prev-message");
    const $nextButton = $("#next-message");
    
    // 显示消息内容
    function displayMessageContent(mesId) {
        if (mesId >= 0 && mesId < chat.length) {
            const message = chat[mesId];
            $floorInput.val(mesId);
            $floorInfo.html(`<strong>楼层 ${mesId}</strong>: ${message.name} 说:`);
            $fullMessageContainer.html(message.mes).show();
            
            // 更新导航按钮状态
            $prevButton.prop('disabled', mesId <= 0);
            $nextButton.prop('disabled', mesId >= chat.length - 1);
            
            // 当前显示的消息ID
            $jumpButton.data('current-mesid', mesId);
        }
    }
    
    // 如果有传入的 mesId，直接显示对应消息
    if (selectedMesId !== null) {
        displayMessageContent(selectedMesId);
    }
    
    // 输入楼层号时更新预览
    $floorInput.on("input", function() {
        const floor = parseInt($(this).val());
        if (!isNaN(floor) && floor >= 0 && floor < chat.length) {
            displayMessageContent(floor);
        } else {
            $floorInfo.text("");
            $fullMessageContainer.hide();
        }
    });
    
    // 点击跳转按钮
    $jumpButton.on("click", function() {
        const mesId = parseInt($(this).data('current-mesid'));
        if (!isNaN(mesId) && mesId >= 0 && mesId < chat.length) {
            scrollToMessage(mesId);
            popup.close();
        } else {
            const floor = parseInt($floorInput.val());
            if (!isNaN(floor) && floor >= 0 && floor < chat.length) {
                scrollToMessage(floor);
                popup.close();
            }
        }
    });
    
    // 上一条消息
    $prevButton.on("click", function() {
        const currentMesId = parseInt($jumpButton.data('current-mesid'));
        if (!isNaN(currentMesId) && currentMesId > 0) {
            displayMessageContent(currentMesId - 1);
        }
    });
    
    // 下一条消息
    $nextButton.on("click", function() {
        const currentMesId = parseInt($jumpButton.data('current-mesid'));
        if (!isNaN(currentMesId) && currentMesId < chat.length - 1) {
            displayMessageContent(currentMesId + 1);
        }
    });
}

// 显示高级检索设置弹窗
async function showAdvancedSettingsPopup() {
    const settings = extension_settings[extensionName];
    
    const popupHtml = `
        <div class="settings-container">
            <h3>检索设置</h3>
            <div class="setting-item">
                <label><input type="checkbox" id="real-time-rendering" ${settings.realTimeRendering ? "checked" : ""}> 实时渲染搜索结果</label>
                <small>输入关键词时立即显示搜索结果</small>
            </div>
            <div class="setting-item">
                <label><input type="checkbox" id="highlight-keywords" ${settings.highlightKeywords ? "checked" : ""}> 高亮关键词</label>
                <small>在搜索结果中高亮显示匹配的关键词</small>
            </div>
            <div class="setting-item">
                <label><input type="checkbox" id="case-sensitive" ${settings.caseSensitive ? "checked" : ""}> 区分大小写</label>
                <small>搜索时区分大小写</small>
            </div>
            <div class="setting-item">
                <label><input type="checkbox" id="show-panel" ${settings.showPanel ? "checked" : ""}> 显示检索面板</label>
                <small>在聊天界面显示检索面板</small>
            </div>
            <div class="setting-item">
                <label>面板位置:</label>
                <select id="panel-position">
                    <option value="left" ${settings.panelPosition === 'left' ? 'selected' : ''}>左侧</option>
                    <option value="right" ${settings.panelPosition === 'right' ? 'selected' : ''}>右侧</option>
                </select>
            </div>
            <div class="setting-item">
                <label>最大结果数:</label>
                <input type="number" id="max-results" value="${settings.maxResults}" min="1" max="100">
                <small>搜索结果显示的最大数量</small>
            </div>
            <div class="popup-buttons">
                <button id="save-settings" class="primary-button">保存设置</button>
            </div>
        </div>
    `;
    
    const popup = new Popup(popupHtml, POPUP_TYPE.TEXT);
    popup.show();
    
    $("#save-settings").on("click", () => {
        // 保存设置
        extension_settings[extensionName].realTimeRendering = $("#real-time-rendering").prop("checked");
        extension_settings[extensionName].highlightKeywords = $("#highlight-keywords").prop("checked");
        extension_settings[extensionName].caseSensitive = $("#case-sensitive").prop("checked");
        extension_settings[extensionName].showPanel = $("#show-panel").prop("checked");
        extension_settings[extensionName].panelPosition = $("#panel-position").val();
        extension_settings[extensionName].maxResults = parseInt($("#max-results").val()) || 20;
        
        // 保存设置并更新UI
        saveSettingsDebounced();
        updateSearchButtonText();
        updatePanelVisibility();
        updatePanelPosition();
        
        popup.close();
        toastr.success("设置已保存");
    });
}

// 创建插件 UI
function createUI() {
    const settingsHtml = `
        <div id="message-navigator" class="panel-left">
            <div class="panel-header">
                <h3>消息检索</h3>
                <div class="panel-controls">
                    <button id="toggle-panel" class="icon-button" title="隐藏/显示面板">
                        <i class="fa-solid fa-chevron-left"></i>
                    </button>
                </div>
            </div>
            <div class="keyword-search-area">
                <div class="search-input-container">
                    <input type="text" id="keyword-search" placeholder="输入关键词搜索">
                    <button id="search-button" class="icon-button" title="搜索/清空">
                        <i class="fa-solid fa-search"></i>
                    </button>
                </div>
                <div id="search-results" class="results-container"></div>
            </div>
            <div class="quick-scroll-area">
                <button id="scroll-up" class="nav-button" title="滚动到最早消息">
                    <i class="fa-solid fa-arrow-up"></i> 最早
                </button>
                <button id="scroll-down" class="nav-button" title="滚动到最新消息">
                    <i class="fa-solid fa-arrow-down"></i> 最新
                </button>
                <button id="jump-to-floor" class="nav-button" title="跳转到指定楼层">
                    <i class="fa-solid fa-location-arrow"></i> 跳转
                </button>
            </div>
            <div class="panel-footer">
                <button id="advanced-settings" class="settings-button">
                    <i class="fa-solid fa-gear"></i> 设置
                </button>
            </div>
        </div>
    `;
    
    // 添加到页面
    $("body").append(settingsHtml);
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
    
    // 面板控制
    $("#toggle-panel").on("click", function() {
        const $panel = $("#message-navigator");
        const $icon = $(this).find("i");
        
        if ($panel.hasClass("panel-collapsed")) {
            $panel.removeClass("panel-collapsed");
            $icon.removeClass("fa-chevron-right").addClass("fa-chevron-left");
        } else {
            $panel.addClass("panel-collapsed");
            $icon.removeClass("fa-chevron-left").addClass("fa-chevron-right");
        }
    });
    
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
