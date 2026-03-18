<template>
  <div class="chart-container">
    <div ref="chart" class="chart-inner"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUpdated, onUnmounted } from 'vue'
import { use, init } from 'echarts/core'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
} from 'echarts/components'
import { PieChart as PieChartType } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'

use([
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  PieChartType,
  CanvasRenderer,
])

const props = defineProps({
  data: Object,
  i18n: Object
})

const chart = ref(null)
let pieChart = null

const colors = ['#fac858', '#ee6666', '#5470c6', '#91cc75', '#73c0de']

const parseData = (detail) => {
  const text = props.i18n?.ui?.data || {}
  const keys = [
    [text.chara5 || '五星角色', 'count5c'],
    [text.weapon5 || '五星武器', 'count5w'],
    [text.chara4 || '四星角色', 'count4c'],
    [text.weapon4 || '四星武器', 'count4w'],
    [text.weapon3 || '三星武器', 'count3w'],
  ]
  const result = []
  const color = []
  const selected = {
    [text.weapon3 || '三星武器']: false,
  }
  keys.forEach((key, index) => {
    if (!detail[key[1]]) return
    result.push({
      value: detail[key[1]],
      name: key[0],
    })
    color.push(colors[index])
  })
  return [result, color, selected]
}

const updateChart = () => {
  if (!chart.value) return
  if (!pieChart) {
    pieChart = init(chart.value)
  }

  const detail = props.data?.[1]
  if (!detail) return

  const result = parseData(detail)

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
      textStyle: {
        fontSize: 12,
      },
    },
    legend: {
      top: '5%',
      left: 'center',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: {
        fontSize: 11,
      },
    },
    color: result[1],
    series: [
      {
        name: '祈愿统计',
        type: 'pie',
        top: 40,
        radius: ['0%', '75%'],
        labelLine: {
          length: 5,
          length2: 8,
        },
        label: {
          fontSize: 10,
        },
        data: result[0],
      },
    ],
  }

  pieChart.setOption(option)
}

onMounted(() => {
  updateChart()
  window.addEventListener('resize', updateChart)
})

onUpdated(() => {
  updateChart()
})

onUnmounted(() => {
  window.removeEventListener('resize', updateChart)
  if (pieChart) {
    pieChart.dispose()
  }
})
</script>

<style scoped>
.chart-container {
  width: 100%;
  height: 220px;
  position: relative;
}

.chart-inner {
  position: absolute;
  inset: 0;
}
</style>
