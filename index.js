import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types } from "../../../../script.js";
import { Popup, POPUP_TYPE, callPopup } from '../../../popup.js';

// 插件基础配置
const extensionName = "message-navigator";
const defaultSettings = {
    realTimeRendering: true,     // 实时检索渲染
    highlightKeywords: true,     // 关键词高亮
    maxResults: 20,              // 最大检索结果数
    showPreview: true,           // 显示消息预览
    caseSensitive: false,        // 区分大小写
    collapsed: false,            // 是否折叠导航面板
    position: { x: 0, y: 150 }   // 面板位置
};

// 状态管理
let dragStartPos = { x: 0, y: 0 };
let isDragging = false;
let currentSearchResults = [];
let debounceTimer = null;

/**
 * 加载插件设置
 */
function loadSettings() {
    // 初始化插件设置
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    
    // 应用默认设置
    Object.keys(defaultSettings).forEach(key => {
        if (extension_settings[extensionName][key] === undefined) {
            extension_settings[extensionName][key] = defaultSettings[key];
        }
    });
}

/**
 * 创建插件界面
 */
function createUI() {
    // 主导航面板HTML
    const navigatorHtml = `
        <div id="message-navigator" style="left:${extension_settings[extensionName].position.x}px; top:${extension_settings[extensionName].position.y}px; ${extension_settings[extensionName].collapsed ? 'height:30px;overflow:hidden;' : ''}">
            <div class="drag-handle" id="navigator-drag-handle"></div>
            <div class="navigator-title">
                消息导航
                <span class="collapsible-button" id="toggle-collapse">${extension_settings[extensionName].collapsed ? '↓' : '↑'}</span>
            </div>
            <div class="navigator-content" ${extension_settings[extensionName].collapsed ? 'style="display:none"' : ''}>
                <div class="keyword-search-area">
                    <input type="text" id="keyword-search" placeholder="输入关键词检索...">
                    <button id="search-button" class="navigator-button">${extension_settings[extensionName].realTimeRendering ? "清空" : "检索"}</button>
                    <div id="search-results"></div>
                </div>
                <div class="quick-scroll-area">
                    <button id="scroll-up">↑顶部</button>
                    <button id="scroll-down">↓底部</button>
                </div>
                <div class="advanced-controls">
                    <button id="jump-to-floor" class="navigator-button">跳转到楼层</button>
                    <button id="advanced-settings" class="navigator-button">⚙设置</button>
                </div>
            </div>
        </div>
    `;
    
    // 添加到DOM
    $("body").append(navigatorHtml);

    // 设置面板可拖动
    setupDraggable();
}

/**
 * 设置面板拖动功能
 */
function setupDraggable() {
    const $handle = $("#navigator-drag-handle");
    const $navigator = $("#message-navigator");
    
    $handle.on("mousedown", function(e) {
        isDragging = true;
        dragStartPos = {
            x: e.clientX - $navigator.position().left,
            y: e.clientY - $navigator.position().top
        };
        
        // 防止拖动时选中文本
        e.preventDefault();
    });
    
    $(document).on("mousemove", function(e) {
        if (!isDragging) return;
        
        const left = e.clientX - dragStartPos.x;
        const top = e.clientY - dragStartPos.y;
        
        // 确保不会拖出屏幕
        const maxLeft = window.innerWidth - $navigator.outerWidth();
        const maxTop = window.innerHeight - $navigator.outerHeight();
        
        const safeLeft = Math.max(0, Math.min(left, maxLeft));
        const safeTop = Math.max(0, Math.min(top, maxTop));
        
        $navigator.css({
            left: safeLeft + "px",
            top: safeTop + "px"
        });
        
        // 保存位置
        extension_settings[extensionName].position = { x: safeLeft, y: safeTop };
    });
    
    $(document).on("mouseup", function() {
        if (isDragging) {
            isDragging = false;
            saveSettingsDebounced();
        }
    });
}

/**
 * 绑定事件处理
 */
function bindEvents() {
    // 导航和滚动事件
    $("#scroll-up").on("click", scrollToFirstLoadedMessage);
    $("#scroll-down").on("click", scrollToLastMessage);
    $("#jump-to-floor").on("click", () => showJumpToFloorPopup());
    $("#advanced-settings").on("click", showAdvancedSettingsPopup);
    
    // 搜索相关事件
    $("#search-button").on("click", handleSearchButtonClick);
    $("#keyword-search").on("input", function() {
        if (extension_settings[extensionName].realTimeRendering) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(performSearch, 300);
        }
    });
    
    // 折叠/展开导航面板
    $("#toggle-collapse").on("click", function() {
        const isCollapsed = extension_settings[extensionName].collapsed;
        extension_settings[extensionName].collapsed = !isCollapsed;
        
        if (isCollapsed) {
            // 展开面板
            $(this).text("↑");
            $("#message-navigator").css({
                "height": "auto",
                "overflow": "visible"
            });
            $(".navigator-content").slideDown(200);
        } else {
            // 折叠面板
            $(this).text("↓");
            $(".navigator-content").slideUp(200, function() {
                $("#message-navigator").css({
                    "height": "30px",
                    "overflow": "hidden"
                });
            });
        }
        
        saveSettingsDebounced();
    });
    
    // 监听聊天更新事件，刷新搜索结果
    eventSource.on(event_types.MESSAGE_RECEIVED, refreshSearchResults);
    eventSource.on(event_types.MESSAGE_EDITED, refreshSearchResults);
    eventSource.on(event_types.MESSAGE_DELETED, refreshSearchResults);
    eventSource.on(event_types.MESSAGE_SWIPED, refreshSearchResults);
}

/**
 * 刷新搜索结果
 */
function refreshSearchResults() {
    const keyword = $("#keyword-search").val();
    if (keyword && extension_settings[extensionName].realTimeRendering) {
        performSearch();
    }
}

/**
 * 执行关键词搜索
 */
function performSearch() {
    const keyword = $("#keyword-search").val().trim();
    const resultsContainer = $("#search-results");
    
    resultsContainer.empty();
    
    if (!keyword) {
        currentSearchResults = [];
        return;
    }
    
    try {
        // 获取聊天记录
        const context = getContext();
        const chat = context.chat;
        
        if (!chat || !Array.isArray(chat) || chat.length === 0) {
            resultsContainer.html("<div class='search-result'>没有可检索的消息</div>");
            return;
        }
        
        // 检索逻辑
        const caseSensitive = extension_settings[extensionName].caseSensitive;
        const searchPattern = caseSensitive ? keyword : keyword.toLowerCase();
        
        currentSearchResults = chat
            .map((message, index) => {
                if (!message || !message.mes) return null;
                
                const messageText = caseSensitive 
                    ? message.mes 
                    : message.mes.toLowerCase();
                
                if (messageText.includes(searchPattern)) {
                    return {
                        mesId: index,
                        text: message.mes,
                        name: message.name || "未知"
                    };
                }
                return null;
            })
            .filter(item => item !== null)
            .slice(0, extension_settings[extensionName].maxResults);
        
        // 显示检索结果
        if (currentSearchResults.length > 0) {
            currentSearchResults.forEach(result => {
                let previewText = result.text;
                
                // 截断过长的文本
                if (previewText.length > 100) {
                    previewText = previewText.substring(0, 100) + "...";
                }
                
                // 高亮关键词
                if (extension_settings[extensionName].highlightKeywords) {
                    const regex = new RegExp(keyword, caseSensitive ? "g" : "gi");
                    previewText = previewText.replace(regex, match => 
                        `<span class="highlight">${match}</span>`);
                }
                
                resultsContainer.append(`
                    <div class="search-result" data-mesid="${result.mesId}">
                        <strong>${result.name}</strong> #${result.mesId}:
                        <div>${previewText}</div>
                        <span class="message-link">点击查看</span>
                    </div>
                `);
            });
            
            // 绑定点击事件
            $(".search-result").on("click", function() {
                const mesId = $(this).data("mesid");
                showJumpToFloorPopup(mesId);
            });
        } else {
            resultsContainer.html("<div class='search-result'>未找到匹配的消息</div>");
        }
    } catch (error) {
        console.error("检索消息时出错:", error);
        resultsContainer.html("<div class='search-result'>检索时发生错误</div>");
    }
}

/**
 * 处理搜索按钮点击
 */
function handleSearchButtonClick() {
    if (extension_settings[extensionName].realTimeRendering) {
        // 清空模式
        $("#keyword-search").val("");
        $("#search-results").empty();
        currentSearchResults = [];
    } else {
        // 手动检索模式
        performSearch();
    }
}

/**
 * 滚动到第一条已加载消息
 */
function scrollToFirstLoadedMessage() {
    const loadedMessages = $("#chat .mes");
    if (loadedMessages.length > 0) {
        const firstMesId = parseInt(loadedMessages.first().attr("mesid"));
        scrollToMessage(firstMesId);
    } else {
        toastr.info("没有已加载的消息");
    }
}

/**
 * 滚动到最新消息
 */
function scrollToLastMessage() {
    const context = getContext();
    const chat = context.chat;
    if (chat && chat.length > 0) {
        scrollToMessage(chat.length - 1);
    } else {
        toastr.info("聊天记录为空");
    }
}

/**
 * 滚动到指定 mesId 的消息
 */
function scrollToMessage(mesId) {
    try {
        const messageElement = $(`#chat .mes[mesid="${mesId}"]`);
        if (messageElement.length > 0) {
            // 高亮突出显示该消息
            messageElement.addClass("highlighted-message");
            setTimeout(() => messageElement.removeClass("highlighted-message"), 2000);
            
            // 平滑滚动到消息位置
            messageElement[0].scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
            
            // 显示提示
            toastr.success(`已滚动到消息 #${mesId}`);
        } else {
            // 如果消息未加载，尝试从聊天记录中获取
            const context = getContext();
            if (context.chat && mesId >= 0 && mesId < context.chat.length) {
                toastr.warning(`消息 #${mesId} 未在当前视图中加载，但存在于聊天记录中`);
                // 这里可以添加加载该消息的逻辑，如果SillyTavern支持的话
            } else {
                toastr.error("消息未加载或不存在");
            }
        }
    } catch (error) {
        console.error("滚动到消息时出错:", error);
        toastr.error("滚动到消息时发生错误");
    }
}

/**
 * 显示跳转到指定楼层的弹窗
 */
async function showJumpToFloorPopup(selectedMesId = null) {
    const popupHtml = `
        <div class="jump-to-floor-container">
            <h3>跳转到楼层</h3>
            <input type="number" id="floor-input" placeholder="输入楼层号" min="0">
            <div id="floor-info" style="cursor: pointer; margin-top: 5px;"></div>
            <div id="full-message-container" style="display: none; max-height: 60vh; overflow-y: auto; margin-top: 10px;"></div>
            <div class="popup-buttons">
                <button id="cancel-button" class="menu_button">取消</button>
                <button id="jump-button" class="menu_button primary">跳转</button>
            </div>
        </div>
    `;
    
    try {
        const popup = new Popup(popupHtml, POPUP_TYPE.TEXT);
        popup.show();
        
        const $floorInput = $("#floor-input");
        const $floorInfo = $("#floor-info");
        const $fullMessageContainer = $("#full-message-container");
        const $jumpButton = $("#jump-button");
        const $cancelButton = $("#cancel-button");
        
        // 设置默认值
        if (selectedMesId !== null) {
            $floorInput.val(selectedMesId);
            updateMessagePreview(selectedMesId);
        }
        
        // 输入楼层号时更新预览
        $floorInput.on("input", function() {
            const floor = parseInt($(this).val());
            if (!isNaN(floor)) {
                updateMessagePreview(floor);
            } else {
                $floorInfo.text("");
                $fullMessageContainer.hide();
            }
        });
        
        // 点击楼层预览时展开完整消息
        $floorInfo.on("click", function() {
            if ($fullMessageContainer.is(":visible")) {
                $fullMessageContainer.slideUp(200);
            } else {
                $fullMessageContainer.slideDown(200);
            }
        });
        
        // 点击跳转按钮
        $jumpButton.on("click", function() {
            const floor = parseInt($floorInput.val());
            if (!isNaN(floor)) {
                scrollToMessage(floor);
                popup.close();
            } else {
                toastr.warning("请输入有效的楼层号");
            }
        });
        
        // 点击取消按钮
        $cancelButton.on("click", function() {
            popup.close();
        });
        
        // 聚焦到输入框
        setTimeout(() => $floorInput.focus(), 100);
    } catch (error) {
        console.error("显示跳转弹窗时出错:", error);
        toastr.error("显示跳转弹窗时发生错误");
    }
    
    /**
     * 更新消息预览
     */
    function updateMessagePreview(floor) {
        const context = getContext();
        const chat = context.chat;
        
        if (chat && floor >= 0 && floor < chat.length) {
            const message = chat[floor];
            const sender = message.name || "未知";
            const previewText = message.mes.substring(0, 50) + (message.mes.length > 50 ? "..." : "");
            
            $floorInfo.html(`<strong>${sender}</strong> 在楼层 #${floor} 说: ${previewText}`);
            $fullMessageContainer.text(message.mes).show();
        } else {
            $floorInfo.text(`楼层 #${floor} 不存在`);
            $fullMessageContainer.hide();
        }
    }
}

/**
 * 显示高级设置弹窗
 */
async function showAdvancedSettingsPopup() {
    const settings = extension_settings[extensionName];
    
    const popupHtml = `
        <div>
            <h3>消息导航设置</h3>
            <div style="display: flex; flex-direction: column; gap: 10px; margin: 15px 0;">
                <label>
                    <input type="checkbox" id="real-time-rendering" ${settings.realTimeRendering ? "checked" : ""}>
                    实时渲染检索结果
                </label>
                <label>
                    <input type="checkbox" id="highlight-keywords" ${settings.highlightKeywords ? "checked" : ""}>
                    高亮显示关键词
                </label>
                <label>
                    <input type="checkbox" id="case-sensitive" ${settings.caseSensitive ? "checked" : ""}>
                    区分大小写
                </label>
                <div>
                    <label>最大显示结果数:
                        <input type="number" id="max-results" value="${settings.maxResults}" min="1" max="100" style="width: 60px;">
                    </label>
                </div>
            </div>
            <div class="popup-buttons">
                <button id="reset-position" class="menu_button">重置位置</button>
                <button id="save-settings" class="menu_button primary">保存设置</button>
            </div>
        </div>
    `;
    
    try {
        const popup = new Popup(popupHtml, POPUP_TYPE.TEXT);
        popup.show();
        
        $("#reset-position").on("click", function() {
            extension_settings[extensionName].position = { x: 0, y: 150 };
            $("#message-navigator").css({
                left: "0px",
                top: "150px"
            });
            toastr.success("面板位置已重置");
        });
        
        $("#save-settings").on("click", function() {
            // 保存设置
            extension_settings[extensionName].realTimeRendering = $("#real-time-rendering").prop("checked");
            extension_settings[extensionName].highlightKeywords = $("#highlight-keywords").prop("checked");
            extension_settings[extensionName].caseSensitive = $("#case-sensitive").prop("checked");
            extension_settings[extensionName].maxResults = parseInt($("#max-results").val()) || 20;
            
            saveSettingsDebounced();
            updateSearchButtonText();
            
            // 应用更改
            if ($("#keyword-search").val().trim()) {
                performSearch();
            }
            
            popup.close();
            toastr.success("设置已保存");
        });
    } catch (error) {
        console.error("显示设置弹窗时出错:", error);
        toastr.error("显示设置弹窗时发生错误");
    }
}

/**
 * 更新搜索按钮文本
 */
function updateSearchButtonText() {
    const realTimeRendering = extension_settings[extensionName].realTimeRendering;
    $("#search-button").text(realTimeRendering ? "清空" : "检索");
}

/**
 * 初始化插件
 */
jQuery(async () => {
    try {
        // 加载插件设置
        loadSettings();
        
        // 创建UI
        createUI();
        
        // 绑定事件
        bindEvents();
        
        // 更新搜索按钮文本
        updateSearchButtonText();
        
        console.log(`${extensionName} 插件初始化完成`);
    } catch (error) {
        console.error(`${extensionName} 插件初始化失败:`, error);
    }
});

// 添加样式到head，使消息高亮显示有动画效果
$("head").append(`
    <style>
    @keyframes highlight-pulse {
        0% { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.7); }
        70% { box-shadow: 0 0 0 15px rgba(255, 215, 0, 0); }
        100% { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0); }
    }
    
    .highlighted-message {
        animation: highlight-pulse 2s ease-out 1;
        background-color: rgba(255, 215, 0, 0.2) !important;
    }
    </style>
`);
