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

## Android数据存储逻辑

### 1. 数据存储架构

该应用采用**两层存储架构**：

#### 第一层：应用内部数据存储（Preferences）
使用 `@capacitor/preferences` 插件进行键值对存储：

**核心存储键：** `gachaData`
- 存储位置：应用私有目录（SharedPreferences）
- 数据结构：
  ```javascript
  {
    data: {
      result: [[祈愿类型, 记录数组]],  // Map转换为数组存储
      typeMap: [[祈愿类型, 类型名称]],
      uid: 用户UID,
      lang: 语言,
      time: 时间戳
    },
    time: 保存时间戳
  }
  ```

**关键代码位置：**
- `src/renderer/utils/storage.js:9-70` - Preferences存储实现
- `src/renderer/App-android.vue:424-428` - 数据保存
- `src/renderer/App-android.vue:1295-1312` - 数据加载

#### 第二层：文件存储（FileSystem）
使用 `@capacitor/filesystem` 插件进行文件操作，主要用于导出Excel文件：

**目录优先级策略：**
1. **Documents（文档文件夹）** - 首选目录，用户可直接访问
2. **External（外部存储）** - 第二备选
3. **Cache（临时存储）** - 第三备选
4. **Data（应用私有存储）** - 最后备选

**关键代码位置：**
- `src/renderer/utils/storage.js:78-150` - saveFile实现
- `src/renderer/App-android.vue:1156` - Excel导出保存

### 2. 数据流程

#### 数据获取与保存流程：
```
1. 用户输入URL或选择JSON文件
   ↓
2. 解析数据（UIGF v3.0 / UIGF v4.1 / 本地格式）
   ↓
3. 与本地已存数据合并（如有）
   ↓
4. 保存到Preferences（gachaData）
   ↓
5. 数据展示
```

#### Excel导出流程：
```
1. 生成Excel工作簿数据
   ↓
2. 转换为Blob格式
   ↓
3. 按优先级尝试保存到各目录
   ↓
4. 保存成功后显示完整路径
```

### 3. Android权限配置

**AndroidManifest.xml 中的关键权限：**
```xml
<!-- 网络请求权限 -->
<uses-permission android:name="android.permission.INTERNET" />

<!-- 外部存储读写权限 -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />

<!-- FileProvider用于文件分享 -->
<provider
    android:name="androidx.core.content.FileProvider"
    android:authorities="${applicationId}.fileprovider"
    android:exported="false"
    android:grantUriPermissions="true">
</provider>
```

### 4. 数据序列化机制

由于Preferences只能存储基本数据类型，应用实现了Map与数组的转换：

**序列化（保存时）：** `src/renderer/App-android.vue:575-584`
```javascript
const serializeCurrentData = (data) => {
  return {
    result: Array.from(data.result.entries()),  // Map → 二维数组
    typeMap: Array.from(data.typeMap.entries()),
    uid: data.uid,
    lang: data.lang,
    time: data.time
  }
}
```

**反序列化（加载时）：** `src/renderer/App-android.vue:586-595`
```javascript
const deserializeCurrentData = (data) => {
  return {
    result: new Map(data.result),  // 二维数组 → Map
    typeMap: new Map(data.typeMap),
    uid: data.uid,
    lang: data.lang,
    time: data.time
  }
}
```

### 5. 设计亮点

1. **容错机制**：文件保存采用多目录回退策略，确保至少能保存成功
2. **数据兼容性**：支持UIGF v3.0、UIGF v4.1和本地格式的数据导入
3. **数据合并**：新数据与本地数据智能合并，避免重复记录
4. **用户体验**：保存成功后显示完整路径，使用URL解码正确显示中文文件名

## 数据合并逻辑详解

### 1. 合并的两个主要场景

应用中有**两个场景**会触发数据合并：

#### 场景一：JSON文件导入时的合并
**代码位置：** `src/renderer/App-android.vue:402-407`
```javascript
// 获取本地数据并合并（如果存在）
const localData = await Storage.get('gachaData', null)
if (localData && localData.data && localData.data.result) {
  state.log = '正在合并数据...'
  parsedData = mergeDesktopData(deserializeCurrentData(localData.data), parsedData)
}
```

#### 场景二：URL获取数据时的合并
**代码位置：** `src/renderer/App-android.vue:803-837`
```javascript
// 获取本地数据并合并
const localSaved = await Storage.get('gachaData', null)
if (localSaved && localSaved.data) {
  // 恢复本地数据为 Map
  const localData = deserializeCurrentData(localSaved.data)
  
  // 按类型合并数据
  for (const [key, newLogs] of resultMap) {
    const localLogs = localData.result.get(key) || []
    const merged = mergeArrays(localLogs, newLogs)
    resultMap.set(key, merged)
  }
  
  // 添加本地有但新数据中没有的类型
  for (const [key, localLogs] of localData.result) {
    if (!resultMap.has(key)) {
      resultMap.set(key, localLogs)
    }
  }
}
```

### 2. 核心合并函数详解

#### 函数一：`mergeArrays(a, b)` - 合并单个祈愿类型的记录

**代码位置：** `src/renderer/App-android.vue:285-313`

这是最核心的合并函数，处理单个祈愿类型的两条记录数组的合并。

**参数说明：**
- `a`: 新导入的记录数组（按时间升序，最早的在前）
- `b`: 本地已存的记录数组（按时间升序，最早的在前）

**合并策略：**

**第一步：快速判断（边界情况）**
```javascript
if (!a || !a.length) return b || []   // 新数据为空，返回本地数据
if (!b || !b.length) return a         // 本地数据为空，返回新数据
```

**第二步：ID精准匹配**
```javascript
const minA = new Date(a[0][0]).getTime()  // 新数据最早记录的时间
const idA = a[0][5]                        // 新数据第一条记录的ID

// 从本地数据末尾向前查找相同ID的记录
for (let i = b.length - 1; i >= 0; i--) {
  let idB = b[i][5]
  if (idB && idB === idA) {
    pos = i
    idFounded = true
    break
  }
}
```

**第三步：如果ID匹配失败，使用列表匹配**
```javascript
if (!idFounded) {
  let width = Math.min(11, a.length, b.length)  // 最多比较11条记录
  for (let i = 0; i < b.length; i++) {
    const time = new Date(b[i][0]).getTime()
    if (time >= minA) {  // 只比较时间相近的记录
      // 比较两条子列表是否匹配
      if (compareList(b.slice(i, width + i), a.slice(0, width))) {
        pos = i
        break
      }
    }
  }
}
```

**第四步：执行合并**
```javascript
return b.slice(0, pos).concat(a)
```
- 保留本地数据中 `pos` 位置之前的所有记录
- 追加新数据的全部记录
- 这样可以避免重复记录，同时保留历史数据

---

#### 函数二：`compareList(b, a)` - 比较两条记录列表是否匹配

**代码位置：** `src/renderer/App-android.vue:316-324`

用于在ID匹配失败时，通过记录内容判断是否匹配。

**比较逻辑：**
```javascript
const compareList = (b, a) => {
  if (!b.length) return false
  if (b.length < a.length) {
    a = a.slice(0, b.length)
  }
  // 只比较前4个字段：时间、名称、类型、星级
  const strA = a.map(item => item.slice(0, 4).join('-')).join(',')
  const strB = b.map(item => item.slice(0, 4).join('-')).join(',')
  return strA === strB
}
```

**为什么只比较前4个字段？**
- 时间、名称、类型、星级这4个字段已经足够唯一标识一条抽卡记录
- 避免因ID不同但内容相同的记录被误判为不匹配

---

#### 函数三：`mergeDesktopData(localData, newData)` - 合并完整数据对象

**代码位置：** `src/renderer/App-android.vue:542-573`

用于JSON文件导入时，合并整个数据对象（包含所有祈愿类型）。

**合并步骤：**

1. **获取所有祈愿类型的Key**
```javascript
const allKeys = new Set([
  ...localData.result.keys(),
  ...newData.result.keys()
])
```

2. **逐个合并每个祈愿类型**
```javascript
for (const key of allKeys) {
  const localLogs = localData.result.get(key) || []
  const newLogs = newData.result.get(key) || []
  
  if (localLogs.length === 0) {
    mergedResult.set(key, newLogs)      // 本地没有，使用新数据
  } else if (newLogs.length === 0) {
    mergedResult.set(key, localLogs)    // 新数据没有，使用本地数据
  } else {
    const merged = mergeArrays(localLogs, newLogs)  // 两者都有，使用mergeArrays合并
    mergedResult.set(key, merged)
  }
}
```

3. **合并其他元数据**
```javascript
return {
  result: mergedResult,
  typeMap: localData.typeMap || newData.typeMap,  // 优先使用本地类型映射
  uid: newData.uid || localData.uid,               // 优先使用新数据的UID
  lang: localData.lang || newData.lang,             // 优先使用本地语言
  time: Date.now()
}
```

### 3. 数据合并的设计亮点

1. **双重匹配机制**
   - 第一层：ID精准匹配（快速、可靠）
   - 第二层：列表内容匹配（作为后备方案）

2. **按祈愿类型独立合并**
   - 每个祈愿类型（角色池、武器池等）独立处理
   - 互不影响，避免跨类型数据混淆

3. **保留历史记录**
   - 总是保留本地数据的历史部分
   - 只追加新数据，不删除已有记录

4. **容错性强**
   - 处理边界情况（其中一方为空）
   - 即使ID丢失，也能通过内容匹配

5. **URL获取时的优化**
   - 在获取数据过程中就检查是否已有本地数据（`getGachaLogs`函数中）
   - 如果发现已有相同记录，提前停止获取，减少网络请求

### 4. 记录数据结构

每条抽卡记录是一个数组，格式为：
```javascript
[
  time,        // 索引0: 时间戳
  name,        // 索引1: 物品名称
  item_type,   // 索引2: 物品类型（角色/武器）
  rank_type,   // 索引3: 星级（3/4/5）
  gacha_type,  // 索引4: 祈愿类型
  id           // 索引5: 记录ID（用于匹配）
]
```

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
