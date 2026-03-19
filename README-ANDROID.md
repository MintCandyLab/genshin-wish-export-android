# Android 版本构建指南

本文档说明如何构建和运行原神抽卡导出工具的 Android 版本。

## 功能特性

- **数据导入**: 支持从 URL 或 JSON 文件导入祈愿数据
- **数据获取**: 支持 HoYoGet APP 获取祈愿记录链接
- **Excel 导出**: 导出格式化的 Excel 文件，包含：
  - 各祈愿类型独立工作表
  - 总表（含/不含3星）
  - 按星级和祈愿类型颜色标记
  - 保底统计行
- **饼图分析**: 每个祈愿类型的可视化饼图统计（5星/4星/3星分布）
- **祈愿统计**: 详细的祈愿数据分析
  - 日期范围、总抽数、未出5星抽数
  - 5星/4星/3星分布及百分比
  - 5星历史记录（角色名+抽数）
  - 平均出5星抽数

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
├── components/
│   ├── PieChart.vue        # 饼图组件
│   └── GachaDetail.vue     # 统计详情组件
└── utils/
    ├── storage.js          # 存储适配层
    └── gachaDetail.js      # 祈愿统计计算
capacitor.config.json       # Capacitor 配置
```

## 快速开始

### 1. 安装依赖

```bash
yarn install
```

### 2. 构建 Android 版本

```bash
# 一键构建（推荐）
yarn android

# 或分步执行
yarn build:android     # 构建前端
yarn android:sync      # 同步到 Android 项目
yarn android:open      # 在 Android Studio 中打开
```

### 3. 运行应用

**方式一：Android Studio**
1. 使用 Android Studio 打开 `android/` 目录
2. 等待 Gradle 同步完成
3. 点击 **Run** 按钮在模拟器或真机上运行

**方式二：命令行**
```bash
cd android
./gradlew installDebug  # 安装到连接的设备
```

## 构建 APK

### 调试版 APK

```bash
# 命令行方式
cd android
./gradlew assembleDebug

# 或在 Android Studio 中：Build > Build Bundle(s) / APK(s) > Build APK(s)
```

输出位置：`android/app/build/outputs/apk/debug/app-debug.apk`

### 发布版 APK

```bash
# 命令行方式
cd android
./gradlew assembleRelease

# 或在 Android Studio 中构建
```

输出位置：`android/app/build/outputs/apk/release/app-release-unsigned.apk`

**注意**：发布版需要签名才能安装到设备上。可以使用 `jarsigner` 工具签名，或在 Android Studio 中配置签名密钥。

## 与 PC 版的功能差异

| 功能 | PC 版 | Android 版 |
|------|-------|-----------|
| 数据获取 | 自动读取游戏日志 + 系统代理 | 手动输入 URL |
| 数据存储 | JSON 文件 | Preferences + 文件系统 |
| Excel 导出 | exceljs (Node) | xlsx.js (浏览器) |
| 饼图统计 | 支持 | 支持 |
| 祈愿统计 | 支持 | 支持 |
| 系统代理 | 支持 | 不支持 |
| 自动更新 | 支持 | 不支持 |

### 为什么 Android 版不能自动获取数据？

PC 版通过以下方式自动获取数据：
1. **读取游戏日志** - 直接读取游戏产生的日志文件中的 URL
2. **系统代理** - 使用 mitmproxy 拦截游戏产生的 HTTPS 流量

Android 系统限制了这些方式：
- 每个应用的数据相互隔离，无法读取其他应用的文件
- 普通应用无法设置系统级代理或拦截其他应用的流量
- 没有 root 权限无法实现这些功能

因此 Android 版采用手动输入 URL 的方式，通过 HoYoGet APP 来获取祈愿链接。

## 数据获取方式

Android 版本需要用户手动输入祈愿记录 URL，获取方式：

1. 下载并安装 **HoYoGet APP**
2. 打开 HoYoGet，登录米哈游账号
3. 获取祈愿记录链接
4. 在本 APP 中粘贴 URL 并获取数据

HoYoGet 下载地址：https://www.wyylkjs.com/HoYoGet/

## 常见问题

**Q: 为什么 Android 版不能自动获取游戏数据？**
A: Android 系统限制应用访问其他应用的私有数据，无法像 PC 版那样读取游戏日志文件。详细说明见上方"为什么 Android 版不能自动获取数据"部分。

**Q: 导出的 Excel 文件保存在哪里？**
A: 保存在设备的"文档"目录中，可以通过文件管理器找到。

**Q: 饼图统计显示的数据准确吗？**
A: 饼图统计使用与 PC 版相同的计算逻辑，数据准确可靠。统计包括：星级分布、5星历史、平均抽数等。

**Q: 构建失败怎么办？**
A: 请检查：
1. Node.js 版本是否为 16+
2. Android SDK 是否安装完整（API 33+）
3. Java JDK 是否为 11+
4. 是否运行了 `yarn install` 安装依赖

**Q: 支持 iOS 吗？**
A: 当前配置主要是 Android，但 Capacitor 也支持 iOS，需要额外的配置和 Apple 开发者账号。

## 参考文档

- [Capacitor 官方文档](https://capacitorjs.com/docs)
- [Vue 3 官方文档](https://vuejs.org/)
- [SheetJS/xlsx 文档](https://docs.sheetjs.com/)
- [ECharts 官方文档](https://echarts.apache.org/)

## 许可证

MIT License
