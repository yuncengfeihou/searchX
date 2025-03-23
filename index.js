/* 主面板样式 */
#message-navigator {
    position: fixed;
    left: 10px;
    top: 120px;
    width: 300px;
    background-color: #292932 !important; /* 深灰蓝色背景 */
    color: #e8e8e8 !important;
    border-radius: 12px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.4);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    max-height: 80vh;
    overflow: hidden;
    border: 1px solid #3d3d47 !important;
}

/* 面板头部 */
.panel-header {
    padding: 10px 15px;
    border-bottom: 1px solid #444;
    background-color: #383838 !important;
    border-radius: 10px 10px 0 0;
}

.panel-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #e0e0e0 !important;
}

/* 搜索区域 */
.keyword-search-area {
    padding: 10px;
    border-bottom: 1px solid #444;
}

.search-input-container {
    display: flex;
    margin-bottom: 10px;
}

#keyword-search {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #555;
    border-radius: 4px 0 0 4px;
    background-color: #333 !important;
    color: #e0e0e0 !important;
    outline: none;
}

#search-button {
    padding: 8px 12px;
    border: 1px solid #555;
    border-left: none;
    border-radius: 0 4px 4px 0;
    background-color: #444 !important;
    color: #e0e0e0 !important;
    cursor: pointer;
    transition: background-color 0.2s;
}

#search-button:hover {
    background-color: #555 !important;
}

/* 搜索结果区域 */
#search-results {
    max-height: 300px;
    overflow-y: auto;
    margin-top: 10px;
}

/* 搜索结果项 - 添加红色分隔线 */
.search-result-item {
    padding: 8px;
    margin-bottom: 5px;
    background-color: #333 !important;
    border-radius: 4px;
    cursor: pointer;
    border-bottom: 2px solid #ff3333 !important; /* 红色分隔线 */
}

.search-result-item:last-child {
    border-bottom: none !important;
}

/* 结果头部 */
.result-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 5px;
    font-size: 12px;
}

/* 角色颜色区分 */
.user-message .result-author {
    color: #4285f4 !important; /* 用户消息蓝色 */
    font-weight: bold;
}

.assistant-message .result-author {
    color: #ff9800 !important; /* 助手消息橙色 */
    font-weight: bold;
}

.result-id {
    color: #888 !important;
}

/* 结果预览 */
.result-preview {
    font-size: 13px;
    margin-bottom: 8px;
    white-space: normal;
    word-break: break-word;
    color: #ccc !important;
}

/* 结果操作按钮 */
.result-actions {
    display: flex;
    gap: 8px;
}

.result-action {
    padding: 4px 8px;
    font-size: 12px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    background-color: #555 !important;
    color: #fff !important;
    transition: background-color 0.2s;
}

.result-action:hover {
    background-color: #666 !important;
}

/* 快速滚动区域 */
.quick-scroll-area {
    display: flex;
    padding: 10px;
    gap: 8px;
    border-bottom: 1px solid #444;
}

.quick-scroll-area button {
    flex: 1;
    padding: 8px;
    border: none;
    border-radius: 4px;
    background-color: #444 !important;
    color: #e0e0e0 !important;
    cursor: pointer;
    transition: background-color 0.2s;
}

.quick-scroll-area button:hover {
    background-color: #555 !important;
}

/* 面板底部 */
.panel-footer {
    padding: 10px;
    display: flex;
    justify-content: flex-end;
}

#advanced-settings {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    background-color: #444 !important;
    color: #e0e0e0 !important;
    cursor: pointer;
    transition: background-color 0.2s;
}

#advanced-settings:hover {
    background-color: #555 !important;
}

/* 设置弹窗样式 */
.advanced-settings-popup {
    padding: 10px;
    color: #e0e0e0 !important;
}

.setting-item {
    margin-bottom: 15px;
}

.setting-item label {
    display: flex;
    align-items: center;
    font-weight: bold;
    margin-bottom: 5px;
    color: #e0e0e0 !important;
}

.setting-item input[type="checkbox"] {
    margin-right: 8px;
}

.setting-description {
    font-size: 12px;
    color: #aaa !important;
    margin-left: 24px;
}

/* 无结果提示 */
.no-results {
    padding: 10px;
    text-align: center;
    color: #888 !important;
    font-style: italic;
}

/* 关键词高亮 */
.keyword-highlight {
    background-color: rgba(255, 255, 0, 0.3) !important;
    color: #fff !important;
    padding: 0 2px;
    border-radius: 2px;
}

/* 消息闪烁高亮效果 */
@keyframes flash-highlight {
    0% { background-color: rgba(255, 255, 0, 0.2); }
    50% { background-color: rgba(255, 255, 0, 0.5); }
    100% { background-color: transparent; }
}

.flash-highlight {
    animation: flash-highlight 2s ease;
}

/* 消息内容左对齐样式 */
.left-aligned {
    text-align: left !important;
    white-space: pre-wrap;
    max-height: 60vh;
    overflow-y: auto;
    padding: 15px;
    background-color: #2d2d2d !important;
    color: #e0e0e0 !important;
    border-radius: 5px;
    margin: 10px 0;
    line-height: 1.5;
}

/* 确保消息弹窗有合适的大小和样式 */
.message-popup-container {
    max-width: 90vw;
    width: 600px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
}

.message-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
    padding-bottom: 5px;
    border-bottom: 1px solid #444;
}

.message-author {
    font-weight: bold;
    color: #4285f4 !important;
}

.message-id {
    font-size: 0.9em;
    color: #888 !important;
}

.message-actions {
    display: flex;
    justify-content: center; /* 居中对齐按钮 */
    gap: 10px;
    margin-top: 15px;
}

.message-action-button {
    padding: 8px 15px;
    background-color: #1a73e8 !important;
    color: white !important;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s;
}

.message-action-button:hover {
    background-color: #1558b3 !important;
}

/* 全局样式重置 - 确保插件样式不受SillyTaven影响 */
#message-navigator,
#message-navigator * {
    box-sizing: border-box;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
}

/* 主面板样式 - 更现代化的设计 */
#message-navigator {
    position: fixed;
    left: 10px;
    top: 120px;
    width: 300px;
    background-color: #292932 !important; /* 深灰蓝色背景 */
    color: #e8e8e8 !important;
    border-radius: 12px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.4);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    max-height: 80vh;
    overflow: hidden;
    border: 1px solid #3d3d47 !important;
}

/* 面板标题栏 */
.navigator-header {
    background: linear-gradient(90deg, #2b2b38 0%, #323245 100%) !important;
    color: #ffffff !important;
    padding: 12px 15px;
    font-weight: bold;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #3d3d47 !important;
}

/* 搜索框容器 */
.search-container {
    display: flex;
    padding: 12px;
    gap: 8px;
    align-items: center;
    background-color: #2d2d3a !important;
    border-bottom: 1px solid #3d3d47 !important;
}

/* 搜索输入框 */
#search-input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #3d3d47 !important;
    border-radius: 6px;
    background-color: #383845 !important;
    color: #e8e8e8 !important;
    font-size: 14px;
    max-width: 60%;
    transition: all 0.2s;
}

#search-input:focus {
    outline: none;
    border-color: #5165d7 !important;
    box-shadow: 0 0 0 2px rgba(81, 101, 215, 0.2);
}

/* 搜索按钮 */
.search-button {
    padding: 8px 12px;
    background-color: #5165d7 !important;
    color: white !important;
    border: none !important;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.2s;
    white-space: nowrap;
}

.search-button:hover {
    background-color: #4255c7 !important;
    transform: translateY(-1px);
}

.search-button:active {
    transform: translateY(1px);
}

/* 突出显示当前消息 */
.navigator-highlight {
    animation: highlightAnimation 2s;
}

@keyframes highlightAnimation {
    0% { background-color: rgba(81, 101, 215, 0.3) !important; }
    100% { background-color: transparent !important; }
}
