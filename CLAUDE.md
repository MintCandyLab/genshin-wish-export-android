# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Electron-based desktop application for exporting Genshin Impact wish (gacha) history data. It fetches data from the game's API and exports to Excel format with custom formatting.

## Technology Stack

- **Framework**: Electron 16.x with Vue 3
- **Build Tool**: Vite 2.7 + Rollup (for main process)
- **UI Library**: Element Plus
- **Styling**: Tailwind CSS
- **Package Manager**: Yarn

## Project Structure

```
src/
├── main/           # Electron main process (Node.js)
│   ├── main.js     # Entry point
│   ├── getData.js  # Data fetching logic
│   ├── excel.js    # Excel export with custom formatting
│   ├── config.js   # Configuration management
│   └── utils.js    # Utilities
├── renderer/       # Vue 3 frontend
│   ├── App.vue     # Main UI
│   └── components/ # Vue components
├── i18n/           # Localization files (JSON)
└── schema/         # JSON schemas for data validation
```

## Common Commands

```bash
# Development (with hot reload)
yarn dev

# Build for current platform
yarn build

# Build for specific platforms
yarn build:win32     # Windows 32-bit
yarn build:win64     # Windows 64-bit
yarn build:linux     # Linux
yarn build:mac       # macOS

# Web-only build (without Electron)
yarn build:web
yarn dev:web
```

## Key Architecture Details

### Data Flow

1. **Fetch Data**: `getData.js` reads game logs or uses proxy to get API URL, then fetches gacha history from miHoYo/HoYoverse API
2. **Store Data**: Data is saved as JSON in `userData/gacha-list-{uid}.json`
3. **Export**: `excel.js` creates formatted Excel with:
   - Individual sheets per banner type
   - Two summary sheets (with/without 3-star items)
   - Color-coded cells by banner type and item rank
   - Statistics rows showing pity count

### IPC Communication

Main process exposes these handlers (defined in `getData.js` and `excel.js`):
- `FETCH_DATA` - Fetch new gacha data
- `READ_DATA` / `FORCE_READ_DATA` - Read local data
- `SAVE_EXCEL` - Export to Excel
- `GET_CONFIG` / `SAVE_CONFIG` - Configuration
- `EXPORT_UIGF_JSON` / `IMPORT_UIGF_JSON` - UIGF format exchange

### Configuration

Stored in `config.json` with fields:
- `lang` - Language/locale
- `logType` - Game log detection mode
- `proxyPort` - Proxy server port
- `fetchFullHistory` - Whether to fetch all history or incremental
- `hideNovice` - Hide beginner banner
- `uigfVersion` - UIGF export version (4.1 or 3.0)

### Excel Export Customization

The `excel.js` file contains extensive customization for the Excel output:
- Sheet colors defined in `sheetColors` object (yellow for character banner, blue for weapon, etc.)
- Rank colors (3-star gray, 4-star purple, 5-star orange/gold)
- Two summary sheets: "总表" (without 3-star) and "总表（含3星）"
- Statistics rows at bottom showing current pity count per banner

## Android 版本

项目已适配 Android 平台，使用 Capacitor 打包：

```bash
# 构建 Android 版本
yarn android

# 或分步执行
yarn build:android     # 构建前端
yarn android:sync      # 同步到 Android 项目
```

### Android 与桌面版差异

| 功能 | Electron 版 | Android 版 |
|------|------------|-----------|
| 数据获取 | 自动读取游戏日志 + 代理 | 仅手动输入 URL |
| 数据存储 | JSON 文件 | Capacitor Preferences |
| Excel 导出 | exceljs | xlsx.js (浏览器版) |

### Android 特有文件

- `src/renderer/App-android.vue` - Android 版主组件
- `src/renderer/main-android.js` - Android 入口文件
- `src/renderer/utils/storage.js` - 存储适配层
- `src/renderer/utils/gachaDetail.js` - 祈愿统计计算（与桌面版逻辑一致）
- `src/renderer/components/PieChart.vue` - 饼图组件
- `src/renderer/components/GachaDetail.vue` - 统计数据展示组件
- `capacitor.config.json` - Capacitor 配置
- `README-ANDROID.md` - Android 构建详细指南

### Android 饼图统计功能

Android 版本支持与桌面版相同的饼图分析和统计界面：

**统计内容**：
- 日期范围（最早/最晚祈愿时间）
- 总抽数、未出5星抽数（新手祈愿不显示）
- 星级分布：5星/4星/3星数量和百分比
- 5星历史：角色名+抽取次数（彩色区分）
- 平均出5星抽数

**组件结构**：
```
App-android.vue
├── PieChart.vue          # 饼图（5/4/3星分布）
└── GachaDetail.vue       # 统计详情
    ├── 日期范围
    ├── 总抽数/未出5星
    ├── 星级分布
    └── 5星历史 + 平均抽数
```

**计算逻辑**（`gachaDetail.js`）：
- 同时支持 Android 格式（对象数组）和桌面版格式（Map）
- 遍历祈愿记录，统计各星级数量
- 记录5星位置和抽数，计算平均抽数
- 计算"未出5星抽数"（从上次出5星到现在的抽数）

## Development Notes

- Uses `contextIsolation: false` and `nodeIntegration: true` in Electron (legacy pattern)
- Main process uses CommonJS (`require`), renderer uses ES modules with Vue SFC
- Data files stored in `userData` folder (platform-specific location)
- Supports both Chinese (miHoYo) and Global (HoYoverse) servers
- UIGF format allows data exchange with other gacha tools
- Android version uses Capacitor for native bridge, replacing Electron's IPC
