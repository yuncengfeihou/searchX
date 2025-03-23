import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";
import { Popup, POPUP_TYPE } from '../../../popup.js';

// 插件名称和默认设置
const extensionName = "message-navigator";
const defaultSettings = {
    realTimeRendering: true,  // 默认启用实时渲染
    highlightKeywords: true   // 默认启用关键词高亮
};

// 加载插件设置
function loadSettings() {
    // 确保扩展设置对象存在
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    
    // 应用默认设置
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }
}

// 创建插件 UI
function createUI() {
    const navigatorHtml = `
        <div id="message-navigator">
            <div class="navigator-title">消息导航</div>
            <div class="keyword-search-area">
                <input type="text" id="keyword-search" placeholder="输入关键词检索...">
                <button id="search-button" class="navigator-button">搜索</button>
                <div id="search-results"></div>
            </div>
            <div class="quick-scroll-area">
                <button id="scroll-up" class="navigator-button">↑顶部</button>
                <button id="scroll-down" class="navigator-button">↓底部</button>
            </div>
            <button id="jump-to-floor" class="navigator-button">跳转到楼层</button>
            <button id="advanced-settings" class="navigator-button">设置</button>
        </div>
    `;
    
    // 添加到DOM
    $('body').append(navigatorHtml);
}

// 绑定事件
function bindEvents() {
    // 滚动到顶部
    $("#scroll-up").on("click", function() {
        const firstMessageElement = $(".mes[mesid]:first");
        if (firstMessageElement.length) {
            $('html, body').animate({
                scrollTop: firstMessageElement.offset().top - 100
            }, 300);
        }
    });
    
    // 滚动到底部
    $("#scroll-down").on("click", function() {
        const lastMessageElement = $(".mes[mesid]:last");
        if (lastMessageElement.length) {
            $('html, body').animate({
                scrollTop: lastMessageElement.offset().top - 100
            }, 300);
        }
    });
    
    // 跳转到指定楼层
    $("#jump-to-floor").on("click", function() {
        showJumpToFloorPopup();
    });
    
    // 高级设置
    $("#advanced-settings").on("click", function() {
        showAdvancedSettingsPopup();
    });
    
    // 搜索按钮
    $("#search-button").on("click", function() {
        const keyword = $("#keyword-search").val();
        if (keyword.trim() === "") {
            $("#search-results").empty();
        } else {
            performSearch(keyword);
        }
    });
    
    // 搜索输入
    $("#keyword-search").on("input", function() {
        const keyword = $(this).val();
        if (extension_settings[extensionName].realTimeRendering && keyword.trim() !== "") {
            performSearch(keyword);
        } else if (keyword.trim() === "") {
            $("#search-results").empty();
        }
    });
}

// 执行搜索
function performSearch(keyword) {
    if (!keyword || keyword.trim() === "") return;
    
    const context = getContext();
    const chat = context.chat || [];
    const results = [];
    
    // 搜索消息
    chat.forEach((message, index) => {
        if (message.mes && message.mes.includes(keyword)) {
            // 提取包含关键词的上下文
            let messageText = message.mes;
            const keywordIndex = messageText.indexOf(keyword);
            let previewText = messageText;
            
            // 如果消息太长，截取部分显示
            if (messageText.length > 100) {
                const startIndex = Math.max(0, keywordIndex - 30);
                const endIndex = Math.min(messageText.length, keywordIndex + keyword.length + 30);
                previewText = (startIndex > 0 ? "..." : "") + 
                              messageText.substring(startIndex, endIndex) + 
                              (endIndex < messageText.length ? "..." : "");
            }
            
            // 高亮关键词
            if (extension_settings[extensionName].highlightKeywords) {
                previewText = previewText.replace(new RegExp(keyword, 'g'), `<span class="highlight">${keyword}</span>`);
            }
            
            results.push({
                mesId: index,
                text: previewText,
                name: message.name || ''
            });
        }
    });
    
    // 显示结果
    const resultsContainer = $("#search-results");
    resultsContainer.empty();
    
    if (results.length > 0) {
        results.forEach(result => {
            resultsContainer.append(
                `<div class="search-result" data-mesid="${result.mesId}">
                    <strong>${result.name}</strong>: ${result.text}
                </div>`
            );
        });
        
        // 绑定点击事件
        $(".search-result").on("click", function() {
            const mesId = $(this).data("mesid");
            scrollToMessage(mesId);
        });
    } else {
        resultsContainer.append(`<div>未找到含有"${keyword}"的消息</div>`);
    }
}

// 滚动到指定消息
function scrollToMessage(mesId) {
    const messageElement = $(`.mes[mesid="${mesId}"]`);
    if (messageElement.length) {
        // 移除之前的高亮
        $(".mes").removeClass("highlighted-message");
        
        // 滚动到消息位置
        $('html, body').animate({
            scrollTop: messageElement.offset().top - 100
        }, 300, function() {
            // 添加高亮效果
            messageElement.addClass("highlighted-message");
            
            // 几秒后移除高亮
            setTimeout(() => {
                messageElement.removeClass("highlighted-message");
            }, 3000);
        });
    }
}

// 显示跳转楼层弹窗
function showJumpToFloorPopup(defaultMesId) {
    const context = getContext();
    const totalMessages = context.chat ? context.chat.length : 0;
    
    const popupHtml = `
        <div class="jump-to-floor-container">
            <p>当前共有 ${totalMessages} 条消息</p>
            <input type="number" id="floor-number" min="1" max="${totalMessages}" 
                   value="${defaultMesId ? (parseInt(defaultMesId) + 1) : ''}" 
                   placeholder="输入楼层数 (1-${totalMessages})">
            <button id="jump-confirm" class="menu_button">跳转</button>
        </div>
    `;
    
    const popup = new Popup(popupHtml, POPUP_TYPE.TEXT);
    popup.show();
    
    // 确认跳转
    $("#jump-confirm").on("click", function() {
        const floorNumber = parseInt($("#floor-number").val());
        if (!isNaN(floorNumber) && floorNumber >= 1 && floorNumber <= totalMessages) {
            const mesId = floorNumber - 1; // 转换为索引
            scrollToMessage(mesId);
            popup.close();
        } else {
            alert(`请输入有效的楼层数 (1-${totalMessages})`);
        }
    });
}

// 显示高级设置弹窗
function showAdvancedSettingsPopup() {
    const settings = extension_settings[extensionName];
    
    const popupHtml = `
        <div>
            <h3>消息导航设置</h3>
            <label>
                <input type="checkbox" id="real-time-rendering" ${settings.realTimeRendering ? 'checked' : ''}>
                实时检索 (输入时自动搜索)
            </label>
            <br>
            <label>
                <input type="checkbox" id="highlight-keywords" ${settings.highlightKeywords ? 'checked' : ''}>
                高亮关键词
            </label>
            <br><br>
            <button id="save-settings" class="menu_button">保存设置</button>
        </div>
    `;
    
    const popup = new Popup(popupHtml, POPUP_TYPE.TEXT);
    popup.show();
    
    // 保存设置
    $("#save-settings").on("click", function() {
        settings.realTimeRendering = $("#real-time-rendering").prop("checked");
        settings.highlightKeywords = $("#highlight-keywords").prop("checked");
        saveSettingsDebounced();
        
        // 更新搜索按钮文本
        updateSearchButtonText();
        
        popup.close();
    });
}

// 更新搜索按钮文本
function updateSearchButtonText() {
    const realTimeRendering = extension_settings[extensionName].realTimeRendering;
    $("#search-button").text(realTimeRendering ? "清空" : "搜索");
}

// 添加高亮样式
$("head").append(`
    <style>
    .highlighted-message {
        box-shadow: 0 0 10px yellow;
        transition: box-shadow 0.3s ease;
    }
    </style>
`);

// 插件初始化
jQuery(() => {
    try {
        loadSettings();
        createUI();
        bindEvents();
        updateSearchButtonText();
        console.log("消息导航插件已加载");
    } catch (error) {
        console.error("消息导航插件加载失败:", error);
    }
});
