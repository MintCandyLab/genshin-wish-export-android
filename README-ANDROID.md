# Android 版本构建指南

本文档说明如何将原神抽卡导出工具移植到 Android 平台。

## 技术方案

使用 Capacitor 将 Vue 3 前端应用打包为 Android 应用：

- **框架**: Capacitor 5.x + Vue 3
- **HTTP**: CapacitorHttp (替代 electron-fetch)
- **存储**: Capacitor Preferences + Filesystem
- **Excel**: xlsx.js (浏览器版替代 exceljs)

## 环境要求

1. Node.js 16+
2. Android Studio (最新稳定版)
3. Android SDK (API 33+)
4. Java JDK 11+

## 项目结构

```
android/                    # Capacitor Android 项目
src/renderer/
├── App-android.vue         # Android 版主组件
├── main-android.js         # Android 版入口
├── index-android.css       # Android 特定样式
└── utils/
    └── storage.js          # 存储适配层
```

## 构建步骤

### 1. 安装依赖

```bash
yarn install
```

### 2. 构建 Android 版本（推荐命令行方式）

```bash
# 一键构建（构建前端 + 重命名入口文件 + 同步到 Android 项目）
npm run build:android && mv dist/android/android.html dist/android/index.html && npx cap sync android
```

或分步执行：

```bash
# 1. 构建前端
npm run build:android

# 2. 重命名入口文件（Capacitor 需要 index.html）
mv dist/android/android.html dist/android/index.html

# 3. 同步到 Android 项目
npx cap sync android

# 4. 在 Android Studio 中打开（可选）
npx cap open android
```

### 3. 使用 Android Studio 构建 APK

**方式一：图形化操作（推荐新手）**

1. 打开 Android Studio
2. 选择 **Open** → 选择项目中的 `android` 文件夹
3. 等待 Gradle 同步完成
4. 点击菜单 **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
5. 构建完成后，右下角会弹出通知，点击 **locate** 即可找到 APK

**方式二：命令行构建**

```bash
# 进入 Android 目录
cd android

# 构建调试版 APK
./gradlew assembleDebug

# 或构建发布版 APK（未签名）
./gradlew assembleRelease
```

APK 输出位置：
- 调试版：`android/app/build/outputs/apk/debug/app-debug.apk`
- 发布版：`android/app/build/outputs/apk/release/app-release-unsigned.apk`

### 3. 在 Android Studio 中构建

1. 使用 Android Studio 打开 `android/` 目录
2. 等待 Gradle 同步完成
3. 点击 "Build > Build Bundle(s) / APK(s) > Build APK(s)"
4. 或使用 "Run" 按钮在模拟器/真机上运行

## 发布构建

```bash
# 构建 Release 版本
cd android
./gradlew assembleRelease
```

APK 文件位置：`android/app/build/outputs/apk/release/app-release.apk`

## 功能差异

与原 Electron 版本相比，Android 版本有以下差异：

| 功能 | Electron 版 | Android 版 |
|------|------------|-----------|
| 数据获取 | 自动读取游戏日志 + 代理 | 仅手动输入 URL |
| 数据存储 | JSON 文件 | Preferences + 文件系统 |
| Excel 导出 | exceljs (Node) | xlsx.js (浏览器) |
| 系统代理 | 支持 | 不支持 |
| 自动更新 | 支持 | 不支持 |

## 手动输入 URL 说明

Android 版本需要用户手动输入祈愿记录 URL，获取方式：

1. 在手机上安装米游社 APP
2. 登录账号，进入"我的-祈愿记录"
3. 点击右上角分享，复制链接
4. 在本 APP 中粘贴 URL 并获取数据

## 常见问题

**Q: 为什么 Android 版不能自动获取游戏数据？**
A: Android 系统限制应用访问其他应用的私有数据，无法像 PC 版那样读取游戏日志文件。

**Q: 导出的 Excel 文件保存在哪里？**
A: 保存在设备的"文档"目录中，可以通过文件管理器找到。

**Q: 支持 iOS 吗？**
A: 当前配置主要是 Android，但 Capacitor 也支持 iOS，需要额外的配置和 Apple 开发者账号。

## 参考文档

- [Capacitor 官方文档](https://capacitorjs.com/docs)
- [Vue 3 官方文档](https://vuejs.org/)
- [SheetJS/xlsx 文档](https://docs.sheetjs.com/)
