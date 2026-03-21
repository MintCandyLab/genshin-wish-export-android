<template>
  <div class="gacha-detail">
    <!-- 日期范围 -->
    <p class="date-range" v-if="detail.date && detail.date[0] && detail.date[1]">
      <span>{{ formatDate(detail.date[0]) }}</span>
      <span class="mx-2">-</span>
      <span>{{ formatDate(detail.date[1]) }}</span>
    </p>

    <!-- 统计摘要 -->
    <div class="stats-summary">
      <div class="stat-item">
        <span class="stat-label">总抽数</span>
        <span class="stat-value blue">{{ detail.total || 0 }}</span>
      </div>
      <div class="stat-item" v-if="showCountMio">
        <span class="stat-label">已垫抽数</span>
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
        <span
          v-for="(item, index) in detail.ssrPos"
          :key="index"
          class="history-item"
          :style="{ color: getColor(index) }"
        >
          {{ item[0] }}[{{ item[1] }}]
        </span>
      </p>
      <p class="average-text">
        平均出5星抽数:
        <span class="average-value">{{ avg5(detail.ssrPos) }}</span>
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: {
    type: Array,
    required: true
  },
  i18n: {
    type: Object,
    default: () => ({})
  }
})

// 提取祈愿类型和数据
const gachaType = computed(() => props.data?.[0] || '')
const detail = computed(() => props.data?.[1] || {})

// 是否显示未出5星（新手祈愿不显示）
const showCountMio = computed(() => {
  return gachaType.value !== '100' && detail.value.countMio !== undefined
})

// 格式化日期
const formatDate = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`
}

// 计算百分比
const percent = (num, total) => {
  if (!total || total === 0) return '0%'
  return `${Math.round(num / total * 10000) / 100}%`
}

// 计算平均5星抽数
const avg5 = (list) => {
  if (!list || list.length === 0) return 0
  let n = 0
  list.forEach(item => {
    n += item[1]
  })
  return parseInt((n / list.length) * 100) / 100
}

// 颜色列表
const colors = [
  '#5470c6', '#fac858', '#ee6666', '#73c0de', '#3ba272',
  '#fc8452', '#9a60b4', '#ea7ccc', '#2ab7ca', '#005b96',
  '#ff8b94', '#72a007', '#b60d1b', '#16570d'
]

// 获取颜色
const getColor = (index) => {
  return colors[index % colors.length]
}
</script>

<style scoped>
.gacha-detail {
  padding: 12px;
  font-size: 12px;
}

.date-range {
  text-align: center;
  color: #666;
  margin-bottom: 12px;
  font-size: 11px;
}

.mx-2 {
  margin: 0 8px;
}

.stats-summary {
  display: flex;
  justify-content: space-around;
  margin-bottom: 16px;
  padding: 12px;
  background: #f8f8f8;
  border-radius: 8px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-label {
  font-size: 11px;
  color: #999;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 18px;
  font-weight: bold;
}

.stat-value.blue {
  color: #409eff;
}

.stat-value.green {
  color: #67c23a;
}

.rarity-stats {
  margin-bottom: 16px;
  padding: 12px;
  background: #fafafa;
  border-radius: 8px;
}

.rarity-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.rarity-item:last-child {
  margin-bottom: 0;
}

.rarity-label {
  font-weight: 500;
}

.rarity-label.yellow {
  color: #e6a23c;
}

.rarity-label.purple {
  color: #9c27b0;
}

.rarity-label.blue {
  color: #409eff;
}

.rarity-percent {
  color: #999;
  font-size: 11px;
}

.ssr-history {
  padding: 12px;
  background: #f8f8f8;
  border-radius: 8px;
  margin-top: 12px;
}

.history-title {
  font-size: 11px;
  color: #666;
  line-height: 1.8;
  margin-bottom: 8px;
}

.history-item {
  margin-right: 8px;
  font-weight: 500;
}

.average-text {
  font-size: 12px;
  color: #666;
  margin-top: 8px;
}

.average-value {
  color: #67c23a;
  font-weight: bold;
  font-size: 14px;
}
</style>