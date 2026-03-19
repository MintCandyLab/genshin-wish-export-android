# 项目记忆 - Genshin Wish Export

## ⚠️ 关键规则（必须首先阅读）

**每次对话开始前，必须阅读：**
- [CRITICAL-WORKFLOW-RULES.md](./CRITICAL-WORKFLOW-RULES.md) - **关键工作流程规则，防止代码丢失事故**

## 项目概述

这是一个 Electron 桌面应用 + Android 应用，用于导出原神抽卡记录。

## 技术栈

- **桌面端**：Electron + Vue 3 + Vite
- **Android 端**：Capacitor + Vue 3
- **UI 库**：Element Plus

## 关键文件位置

### Android 相关
- `src/renderer/App-android.vue` - Android 主界面
- `src/renderer/components/PieChart.vue` - 饼图组件
- `src/renderer/components/GachaDetail.vue` - 统计详情组件
- `src/renderer/utils/gachaDetail.js` - 数据统计逻辑
- `capacitor.config.json` - Capacitor 配置

### 桌面端相关
- `src/renderer/App.vue` - 桌面端主界面
- `src/main/getData.js` - 数据获取逻辑
- `src/main/excel.js` - Excel 导出逻辑

## 重要注意事项

### 数据格式差异

**桌面版格式**：`Map<key, Array<[time, name, type, rank, wishType]>>`
- 按祈愿类型分组存储
- 每组是数组，包含 [时间, 名称, 类型, 星级, 祈愿类型, ID]

**Android 格式**：`Array<{time, name, item_type, rank_type, gacha_type, uigf_gacha_type}>`
- 扁平数组
- 每个元素是对象，包含完整字段

### 统计计算差异

关键区别：**ssrPos (5星历史记录)** 的计算
- 桌面版：按祈愿类型分组，每组独立计算
- Android 旧版：全局计算（错误）
- Android 新版：按 `uigf_gacha_type` 分组计算（正确）

## 工作流程

### 修改代码前必须执行：
1. `git status` - 检查是否有未提交的修改
2. 如果有未提交的修改，提醒用户先提交
3. 基于本地文件修改，不是 git HEAD

### 修改后必须执行：
1. 验证修改正确性
2. 提醒用户提交修改

## 历史记录

### 2025-03-19 严重事故
- **事故**：覆盖用户本地未提交的代码
- **原因**：未检查 `git status`，基于 git HEAD 而不是本地文件修改
- **后果**：用户丢失已完成的饼图、统计、分享功能
- **解决方案**：建立 [CRITICAL-WORKFLOW-RULES.md](./CRITICAL-WORKFLOW-RULES.md) 防止再次发生

## 相关链接

- [关键工作流程规则](./CRITICAL-WORKFLOW-RULES.md) - **必须首先阅读**
- [Android 饼图实现](./ANDROID-PIE-CHART.md) - Android 饼图实现细节
