# Android 移植完成报告

## 已完成的工作

### 1. 项目配置

已添加以下文件：

| 文件 | 说明 |
|------|------|
| `capacitor.config.json` | Capacitor 配置文件，定义应用 ID、名称、Android 设置 |
| `.electron-vite/vite.config.android.js` | Android 构建的 Vite 配置 |
| `.electron-vite/build-android.js` | Android 构建脚本 |
| `package.json` 更新 | 添加 xlsx 依赖、Capacitor 脚本 |

### 2. 前端适配文件

| 文件 | 说明 |
|------|------|
| `src/renderer/android.html` | Android 入口 HTML |
| `src/renderer/main-android.js` | Android 入口 JS，加载移动端样式 |
| `src/renderer/App-android.vue` | Android 主组件，简化版 UI |
| `src/renderer/index-android.css` | Android 特定样式（触摸优化、滚动条等） |
| `src/renderer/utils/storage.js` | 存储适配层，封装 Capacitor Preferences 和 Filesystem |

### 3. 核心功能实现

#### 数据获取
- 使用 `CapacitorHttp` 替代 `electron-fetch`
- 仅支持手动输入 URL（移除了游戏日志读取和代理功能）
- 支持米哈游和 HoYoverse 双服务器

#### 数据存储
- 使用 `Preferences` 存储祈愿数据（JSON 格式）
- 使用 `Filesystem` 保存 Excel 文件到设备文档目录

#### Excel 导出
- 使用 `xlsx.js`（浏览器版）替代 `exceljs`（Node 版）
- 生成标准 .xlsx 文件

### 4. UI 设计

Android 版采用了简化的移动端 UI：

```
┌──────────────────────────────────┐
│        原神抽卡导出              │
│            v1.0.1                │
├──────────────────────────────────┤
│ [获取数据] [导出Excel] [清除]    │
├──────────────────────────────────┤
│ 状态: 数据已加载 (123条记录)     │
├──────────────────────────────────┤
│ 数据预览（共 123 条）            │
│ ┌──────┬──────┬────┬────┬──────┐ │
│ │ 时间 │ 名称 │类型│星级│祈愿  │ │
│ └──────┴──────┴────┴────┴──────┘ │
└──────────────────────────────────┘
```

## 构建步骤

### 环境准备

1. 安装 Node.js 16+
2. 安装 Android Studio（最新稳定版）
3. 配置 Android SDK（API 33+）
4. 配置 JAVA_HOME（JDK 11+）

### 构建命令

```bash
# 1. 安装依赖
yarn install

# 2. 构建 Android 版本
yarn build:android

# 3. 同步到 Android 项目
npx cap sync android

# 4. 在 Android Studio 中打开
npx cap open android

# 或者一步到位
yarn android
```

### 在 Android Studio 中构建 APK

1. 打开 `android/` 目录
2. 等待 Gradle 同步完成
3. Build → Build Bundle(s) / APK(s) → Build APK(s)
4. APK 位置：`android/app/build/outputs/apk/debug/app-debug.apk`

## 与桌面版的功能差异

| 功能 | Electron 桌面版 | Android 版 |
|------|----------------|-----------|
| 数据获取 | 自动读取游戏日志 + 代理 | 仅手动输入 URL |
| 数据存储 | JSON 文件 | Preferences |
| Excel 导出 | exceljs | xlsx.js |
| 系统代理 | 支持 | 不支持 |
| 自动更新 | 支持 | 不支持 |
| UIGF 导入/导出 | 支持 | 暂不支持 |
| 多账号切换 | 支持 | 暂不支持 |

## 后续可改进项

1. **增加 UIGF 导入/导出功能** - 方便与桌面版数据互通
2. **支持多账号管理** - 切换不同 UID 的数据
3. **增加图表统计** - 展示五星/四星出货率、保底统计等
4. **支持增量更新** - 只获取新增的数据
5. **增加数据备份到云端** - 使用 Google Drive 或其他云存储
6. **支持暗黑模式** - 适配系统主题

## 已知问题

1. 需要在 AndroidManifest.xml 中添加 `INTERNET` 权限
2. 首次打开时需要授权存储权限（用于保存 Excel 文件）
3. Android 13+ 需要额外申请通知权限（如需添加下载完成通知）

## 参考文档

- [Capacitor 官方文档](https://capacitorjs.com/docs)
- [Vue 3 官方文档](https://vuejs.org/)
- [SheetJS/xlsx 文档](https://docs.sheetjs.com/)
- [Element Plus 官方文档](https://element-plus.org/)
