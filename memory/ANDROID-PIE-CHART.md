# Android 版饼图统计功能实现记录

## 概述
为 Android 版本添加与桌面版相同的饼图分析和统计界面，包括：
- 每个祈愿类型的饼图（5星/4星/3星分布）
- 日期范围、总抽数、未出5星统计
- 5星历史记录（角色名+抽数）
- 平均出5星抽数

## 实现步骤

### 1. 更新 gachaDetail.js 计算逻辑
**文件**: `src/renderer/utils/gachaDetail.js`

参考桌面版逻辑，同时支持两种数据格式：
- Android格式：对象数组 `[{time, name, item_type, rank_type, ...}]`
- 桌面版格式：Map `<key, Array<[time, name, type, rank, wishType]>>`

**关键计算逻辑**：
```javascript
// 遍历每个祈愿记录
items.forEach((item, index) => {
  const { time, name, item_type, rank_type, uigf_gacha_type } = item

  // 统计3/4/5星数量
  if (rank === 3) { detail.count3++; detail.countMio++; }
  if (rank === 4) { detail.count4++; detail.countMio++; }
  if (rank === 5) {
    detail.count5++;
    detail.countMio = 0; // 重置未出5星计数
    // 记录5星位置和抽数
    detail.ssrPos.push([name, index + 1 - lastSSR, time, wishType]);
    lastSSR = index + 1;
  }
})
```

### 2. 更新 GachaDetail.vue 组件
**文件**: `src/renderer/components/GachaDetail.vue`

**Props定义**：
```javascript
const props = defineProps({
  data: { type: Array, required: true },  // [key, detail]
  i18n: { type: Object, default: () => ({}) }
})
```

**数据结构**：
```javascript
const gachaType = computed(() => props.data?.[0] || '')  // '301', '302', etc.
const detail = computed(() => props.data?.[1] || {})       // 统计详情
```

**detail对象结构**：
```javascript
detail = {
  total: 100,          // 总抽数
  count3: 80,          // 3星数量
  count4: 15,          // 4星数量
  count5: 5,           // 5星数量
  count3w: 80,         // 3星武器
  count4w: 10,         // 4星武器
  count4c: 5,          // 4星角色
  count5w: 2,          // 5星武器
  count5c: 3,          // 5星角色
  countMio: 45,        // 未出5星抽数（新手祈愿不显示）
  ssrPos: [            // 5星历史
    ['角色A', 75, '2024-01-01 12:00:00', '301'],
    ['角色B', 42, '2024-02-01 12:00:00', '301'],
  ],
  date: [timestamp1, timestamp2]  // 日期范围
}
```

**模板结构**：
```vue
<template>
  <div class="gacha-detail">
    <!-- 日期范围 -->
    <p class="date-range" v-if="detail.date && detail.date[0] && detail.date[1]">
      {{ formatDate(detail.date[0]) }} - {{ formatDate(detail.date[1]) }}
    </p>

    <!-- 统计摘要：总抽数、未出5星 -->
    <div class="stats-summary">
      <div class="stat-item">
        <span class="stat-label">总抽数</span>
        <span class="stat-value blue">{{ detail.total || 0 }}</span>
      </div>
      <div class="stat-item" v-if="showCountMio">
        <span class="stat-label">未出5星</span>
        <span class="stat-value green">{{ detail.countMio || 0 }}</span>
      </div>
    </div>

    <!-- 星级统计 -->
    <div class="rarity-stats">
      <div class="rarity-item">
        <span class="rarity-label yellow">五星: {{ detail.count5 || 0 }}</span>
        <span class="rarity-percent">[{{ percent(detail.count5, detail.total) }}]</span>
      </div>
      <div class="rarity-item">
        <span class="rarity-label purple">四星: {{ detail.count4 || 0 }}</span>
        <span class="rarity-percent">[{{ percent(detail.count4, detail.total) }}]</span>
      </div>
      <div class="rarity-item">
        <span class="rarity-label blue">三星: {{ detail.count3 || 0 }}</span>
        <span class="rarity-percent">[{{ percent(detail.count3, detail.total) }}]</span>
      </div>
    </div>

    <!-- 五星历史记录 -->
    <div class="ssr-history" v-if="detail.ssrPos && detail.ssrPos.length > 0">
      <p class="history-title">
        历史:
        <span v-for="(item, index) in detail.ssrPos" :key="index"
              class="history-item" :style="{ color: getColor(index) }">
          {{ item[0] }}[{{ item[1] }}]
        </span>
      </p>
      <p class="average-text">
        平均出5星抽数: <span class="average-value">{{ avg5(detail.ssrPos) }}</span>
      </p>
    </div>
  </div>
</template>
```

### 3. 更新 App-android.vue
**文件**: `src/renderer/App-android.vue`

**导入组件**：
```javascript
import { gachaDetail } from './utils/gachaDetail.js'
import PieChart from './components/PieChart.vue'
import GachaDetail from './components/GachaDetail.vue'
```

**detailData 计算属性**：
```javascript
const detailData = computed(() => {
  if (!gachaData || gachaData.length === 0) return []

  // 按祈愿类型分组
  const grouped = {}
  for (const item of gachaData) {
    const key = item.uigf_gacha_type
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(item)
  }

  // 为每个祈愿类型计算详细统计
  const result = []
  const sheetOrder = ['301', '302', '200', '500', '100']

  for (const key of sheetOrder) {
    const items = grouped[key]
    if (!items || items.length === 0) continue

    // 使用新的 gachaDetail 函数计算详细统计
    const detail = gachaDetail(items)
    if (detail) {
      result.push([key, detail])
    }
  }

  return result
})
```

**模板中使用**：
```vue
<div v-if="gachaData && gachaData.length > 0" class="stats-container">
  <div v-for="(item, index) in detailData" :key="index" class="stats-card">
    <div class="stats-header">
      <h3>{{ gachaTypeMap[item[0]]?.name || item[0] }}</h3>
      <span class="total-count">共 {{ item[1].total }} 抽</span>
    </div>

    <div class="chart-container">
      <PieChart :data="item" :i18n="i18nData" />
    </div>

    <GachaDetail :data="item" :i18n="i18nData" />
  </div>
</div>
```

## 数据流向

```
1. 用户导入/获取数据 → gachaData (对象数组)

2. detailData 计算属性：
   gachaData
   → 按 uigf_gacha_type 分组
   → 对每个类型调用 gachaDetail(items)
   → 返回 [key, detail] 数组

3. gachaDetail 函数：
   items (对象数组)
   → 遍历计算统计
   → 返回 detail 对象

4. GachaDetail 组件：
   props.data = [key, detail]
   → 提取 detail
   → 渲染统计信息
```

## 关键算法说明

### 计算"未出5星抽数" (countMio)
```javascript
let countMio = 0
let lastSSR = 0  // 上次出5星的索引

items.forEach((item, index) => {
  if (rank === 5) {
    countMio = 0
    lastSSR = index + 1
  } else {
    countMio++
  }
})
```

### 计算5星历史 (ssrPos)
```javascript
let lastSSR = 0

items.forEach((item, index) => {
  if (rank === 5) {
    // [角色名, 抽数, 时间, 祈愿类型]
    ssrPos.push([name, index + 1 - lastSSR, time, wishType])
    lastSSR = index + 1
  }
})
```

### 计算平均5星抽数
```javascript
const avg5 = (ssrPos) => {
  if (!ssrPos || ssrPos.length === 0) return 0
  let total = 0
  ssrPos.forEach(item => {
    total += item[1]  // item[1] 是抽数
  })
  return parseInt((total / ssrPos.length) * 100) / 100
}
```

## 文件变更列表

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/renderer/utils/gachaDetail.js` | 修改 | 添加Android格式支持 |
| `src/renderer/components/GachaDetail.vue` | 修改 | 使用动态数据 |
| `src/renderer/App-android.vue` | 修改 | 更新detailData计算属性 |

## 测试验证

1. 导入/获取祈愿数据
2. 检查每个祈愿类型是否显示：
   - 日期范围
   - 总抽数
   - 未出5星（新手祈愿除外）
   - 星级分布（带百分比）
   - 5星历史列表
   - 平均出5星抽数
