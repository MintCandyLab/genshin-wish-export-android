<template>
  <div class="app-container">
    <div class="header">
      <h1>原神抽卡导出</h1>
      <p class="version">v{{ version }}</p>
    </div>

    <div class="actions">
      <el-button
        type="primary"
        :icon="state.status === 'init' ? 'Plus' : 'Refresh'"
        :loading="state.status === 'loading'"
        @click="handleLoadClick"
        class="action-btn"
      >
        {{ state.status === 'init' ? '获取数据' : '更新数据' }}
      </el-button>

      <el-button
        type="success"
        icon="Download"
        :disabled="!gachaData || gachaData.length === 0"
        @click="exportExcel"
        class="action-btn"
      >
        导出 Excel
      </el-button>

      <el-button
        type="warning"
        icon="Share"
        :disabled="!gachaData || gachaData.length === 0"
        @click="shareGachaExcel"
        class="action-btn"
      >
        分享 Excel
      </el-button>

      <el-button
        type="info"
        icon="Delete"
        :disabled="!gachaData || gachaData.length === 0"
        @click="clearData"
        class="action-btn"
      >
        清除数据
      </el-button>
    </div>

    <div class="status-bar">
      <el-tag :type="statusType" size="large" class="status-tag">
        {{ statusText }}
      </el-tag>
      <p v-if="state.log" class="log-text">{{ state.log }}</p>
      <p v-if="state.saveDirectoryInfo && state.status === 'loaded'" class="directory-info">{{ state.saveDirectoryInfo }}</p>
    </div>

    <!-- 统计信息展示 -->
    <div v-if="gachaData && gachaData.length > 0" class="stats-container">
      <div v-for="(item, index) in detailData" :key="index" class="stats-card">
        <div class="stats-header">
          <div class="stats-title-wrap">
            <h4 class="stats-type">{{ gachaTypeMap[item[0]]?.name || item[0] }}</h4>
            <span class="total-count">共 {{ item[1].total }} 抽</span>
          </div>
        </div>

        <div class="chart-container">
          <PieChart :data="item" :i18n="i18nData" />
        </div>

        <GachaDetail :data="item" :i18n="i18nData" />
      </div>
    </div>

    <!-- URL/JSON 导入选择对话框 -->
    <el-dialog
      v-model="state.showUrlDlg"
      title="获取数据"
      width="90%"
      class="url-dialog"
    >
      <div class="import-options">
        <!-- 从 URL 获取 -->
        <div class="import-option" @click="state.importMode = 'url'">
          <div class="option-icon">
            <el-icon :size="32"><Link /></el-icon>
          </div>
          <div class="option-content">
            <h4>从 URL 获取</h4>
            <p>从HoYoGet 获取祈愿记录链接</p>
          </div>
          <el-icon v-if="state.importMode === 'url'" :size="20" class="check-icon"><Check /></el-icon>
        </div>

        <!-- 从 JSON 文件导入 -->
        <div class="import-option" @click="state.importMode = 'file'">
          <div class="option-icon">
            <el-icon :size="32"><Document /></el-icon>
          </div>
          <div class="option-content">
            <h4>从 JSON 文件导入</h4>
            <p>导入 UIGF 或本地 JSON 文件</p>
          </div>
          <el-icon v-if="state.importMode === 'file'" :size="20" class="check-icon"><Check /></el-icon>
        </div>
      </div>

      <!-- URL 输入区域 -->
      <div v-if="state.importMode === 'url'" class="url-input-section">
        <p class="input-hint">请从HoYoGet APP 复制祈愿记录的 URL</p>
        <el-input
          v-model="state.urlInput"
          type="textarea"
          :rows="4"
          placeholder="https://webstatic.mihoyo.com/..."
          class="url-input"
        />
        <div class="help-text">
          <h4>如何获取 URL：</h4>
          <ol>
            <li>下载 HoYoGet APP</li>
            <li>下载地址 https://www.wyylkjs.com/HoYoGet/</li>

          </ol>
        </div>
      </div>

      <!-- JSON 文件导入区域 -->
      <div v-if="state.importMode === 'file'" class="file-input-section">
        <p class="input-hint">选择 JSON 文件导入祈愿数据</p>
        <el-button
          type="primary"
          icon="FolderOpened"
          @click="pickJsonFile"
          :loading="state.status === 'loading'"
          class="file-picker-btn"
        >
          选择 JSON 文件
        </el-button>
        <p v-if="state.selectedFileName" class="selected-file">
          已选择: {{ state.selectedFileName }}
        </p>
        <div class="help-text">
          <h4>如何获取json文件：</h4>
          <ul>
            <li><strong>下载 小黑盒 app</strong></li>
            <li><strong>在小黑盒 app里绑定原神账号</strong></li>
            <li><strong>在小黑盒 app里点击 “祈愿分析” 最下面的 “数据管理”，选择“导出”</strong></li>
          </ul>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="state.showUrlDlg = false">取消</el-button>
          <el-button v-if="state.importMode === 'url'" type="primary" @click="confirmFetchData" :loading="state.status === 'loading'">
            获取数据
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CapacitorHttp } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import Storage from './utils/storage.js'
import i18nData from '../i18n/简体中文.json'
import { version } from '../../package.json'
import PieChart from './components/PieChart.vue'
import GachaDetail from './components/GachaDetail.vue'
import { gachaDetail } from './utils/gachaDetail.js'

const state = reactive({
  status: 'init', // init, loading, loaded, failed
  log: '',
  urlInput: '',
  showUrlDlg: false,
  importMode: 'url', // 'url' or 'file'
  selectedFileName: '',
  saveDirectoryInfo: '' // 保存目录信息
})

// 祈愿数据存储
let gachaData = []

// 祈愿类型映射
const gachaTypeMap = {
  '301': { name: '角色活动祈愿', key: '301' },
  '302': { name: '武器活动祈愿', key: '302' },
  '200': { name: '常驻祈愿', key: '200' },
  '500': { name: '集录祈愿', key: '500' },
  '100': { name: '新手祈愿', key: '100' }
}

// UI 文本
const ui = computed(() => i18nData.ui)

// 状态文本
const statusText = computed(() => {
  const statusMap = {
    'init': '等待获取数据',
    'loading': '正在获取数据...',
    'loaded': '数据已加载',
    'failed': '获取失败'
  }
  return statusMap[state.status] || '未知状态'
})

// 状态标签类型
const statusType = computed(() => {
  const typeMap = {
    'init': 'info',
    'loading': 'warning',
    'loaded': 'success',
    'failed': 'danger'
  }
  return typeMap[state.status] || 'info'
})

// 表格显示数据（仅显示最近10条）
const displayData = computed(() => {
  if (!gachaData || gachaData.length === 0) return []
  return gachaData.slice(-10).map(item => ({
    ...item,
    gacha_type_name: gachaTypeMap[item.uigf_gacha_type]?.name || item.uigf_gacha_type
  })).reverse()
})

// 按祈愿类型分组的详细统计数据
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

    // 使用 gachaDetail 函数计算详细统计
    const detail = gachaDetail(items)
    if (detail) {
      result.push([key, detail])
    }
  }

  return result
})

// 获取星级标签类型
const getRankType = (rank) => {
  const typeMap = { 3: 'info', 4: 'warning', 5: 'danger' }
  return typeMap[rank] || 'info'
}

// 处理获取数据按钮点击
const handleLoadClick = () => {
  state.showUrlDlg = true
  state.urlInput = ''
  state.importMode = 'url'
  state.selectedFileName = ''
}

// 选择 JSON 文件（使用原生 HTML 文件输入）
const pickJsonFile = () => {
  // 创建文件输入元素
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'

  input.onchange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    state.selectedFileName = file.name
    state.log = '正在读取文件...'

    try {
      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const importData = JSON.parse(event.target.result)
          await processImportData(importData)
        } catch (parseError) {
          ElMessage.error('JSON 解析失败: ' + parseError.message)
        }
      }
      reader.onerror = () => {
        ElMessage.error('读取文件失败')
      }
      reader.readAsText(file)
    } catch (error) {
      console.error('选择文件失败:', error)
      ElMessage.error('读取文件失败: ' + error.message)
    }
  }

  input.click()
}

// 处理导入的 JSON 数据
const processImportData = async (importData) => {
  try {
    state.status = 'loading'
    state.log = '正在解析数据...'

    let result = []

    // 检测 JSON 格式
    if (importData.list && importData.info) {
      // UIGF v3.0 格式
      state.log = '检测到 UIGF v3.0 格式'
      result = parseUigf30Data(importData)
    } else if (importData.hk4e && importData.info?.version) {
      // UIGF v4.1 格式
      state.log = '检测到 UIGF v4.1 格式'
      result = parseUigf41Data(importData)
    } else if (importData.result && importData.uid) {
      // 本地数据格式
      state.log = '检测到本地数据格式'
      result = parseLocalData(importData)
    } else {
      throw new Error('不支持的 JSON 格式')
    }

    // 按 uigf_gacha_type 分组，然后每组内按时间排序（与桌面版逻辑一致）
    const grouped = {}
    for (const item of result) {
      const key = item.uigf_gacha_type
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(item)
    }

    // 每组内按时间排序
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => new Date(a.time) - new Date(b.time))
    })

    // 展平数据，保持按组分组的顺序
    result = []
    const sheetOrder = ['301', '302', '200', '500', '100']
    for (const key of sheetOrder) {
      if (grouped[key]) {
        result.push(...grouped[key])
      }
    }

    gachaData = result
    state.status = 'loaded'
    state.log = `成功导入 ${result.length} 条记录`
    state.saveDirectoryInfo = '导出Excel时将按优先级保存到: Documents → External → Cache → Data'
    state.showUrlDlg = false
    state.selectedFileName = ''

    ElMessage.success(`成功导入 ${result.length} 条记录`)

    // 保存到本地存储
    await Storage.set('gachaData', {
      data: result,
      time: Date.now()
    })

  } catch (error) {
    console.error('解析 JSON 数据失败:', error)
    state.status = 'failed'
    state.log = error.message || '解析数据失败'
    ElMessage.error(error.message || '解析数据失败')
  }
}

// 解析 UIGF v3.0 格式
const parseUigf30Data = (data) => {
  const result = []
  for (const item of data.list) {
    result.push({
      time: item.time,
      name: item.name,
      item_type: item.item_type,
      rank_type: parseInt(item.rank_type),
      gacha_type: item.gacha_type,
      id: item.id,
      uigf_gacha_type: item.uigf_gacha_type || item.gacha_type
    })
  }
  return result
}

// 解析 UIGF v4.1 格式
const parseUigf41Data = (data) => {
  const result = []
  for (const account of data.hk4e) {
    for (const item of account.list) {
      result.push({
        time: item.time,
        name: item.name,
        item_type: item.item_type,
        rank_type: parseInt(item.rank_type),
        gacha_type: item.gacha_type,
        id: item.id,
        uigf_gacha_type: item.uigf_gacha_type || item.gacha_type
      })
    }
  }
  return result
}

// 解析本地数据格式
const parseLocalData = (data) => {
  const result = []
  for (const [gachaType, items] of data.result) {
    for (const item of items) {
      result.push({
        time: item[0],
        name: item[1],
        item_type: item[2],
        rank_type: parseInt(item[3]),
        gacha_type: item[4],
        id: item[5],
        uigf_gacha_type: gachaType
      })
    }
  }
  return result
}

// 确认获取数据
const confirmFetchData = async () => {
  if (!state.urlInput.trim()) {
    ElMessage.warning('请输入 URL')
    return
  }
  await fetchData(state.urlInput.trim())
}

// 修复 authkey（桌面版逻辑）
const fixAuthkey = (url) => {
  const match = url.match(/authkey=([^&]+)/)
  if (match && match[1] && match[1].includes('=') && !match[1].includes('%')) {
    return url.replace(/authkey=([^&]+)/, `authkey=${encodeURIComponent(match[1])}`)
  }
  return url
}

// 获取单个祈愿日志（带重试）
const getGachaLog = async (url, retryCount = 5) => {
  try {
    const response = await CapacitorHttp.get({
      url,
      headers: { 'Accept': 'application/json' }
    })

    if (response.data.retcode !== 0) {
      throw new Error(response.data.message || 'API 返回错误')
    }

    return response.data.data?.list || []
  } catch (error) {
    if (retryCount > 0) {
      state.log = `重试中... (${6 - retryCount})`
      await new Promise(resolve => setTimeout(resolve, 2000))
      return await getGachaLog(url, retryCount - 1)
    }
    throw error
  }
}

// 获取单个祈愿类型的所有数据（分页获取）
const getGachaLogs = async (gachaTypeKey, queryString, apiDomain) => {
  let page = 1
  let allList = []
  let endId = 0
  let uid = 0

  do {
    state.log = `获取 ${gachaTypeMap[gachaTypeKey].name} 第 ${page} 页...`

    const pageUrl = `${apiDomain}/gacha_info/api/getGachaLog?${queryString}&gacha_type=${gachaTypeKey}&page=${page}&size=20${endId ? '&end_id=' + endId : ''}`

    const list = await getGachaLog(pageUrl)

    if (list.length === 0) break

    if (!uid && list[0].uid) {
      uid = list[0].uid
    }

    allList.push(...list)

    // 检查是否需要增量更新
    const localData = await Storage.get('gachaData', null)
    if (localData && localData.data) {
      const localItems = localData.data.filter(item => item.uigf_gacha_type === gachaTypeKey)
      if (localItems.length > 0) {
        const localLatestId = localItems[localItems.length - 1]?.id
        if (localLatestId) {
          const hasLocal = list.some(item => item.id === localLatestId)
          if (hasLocal) {
            break // 已经有本地数据了，停止获取
          }
        }
      }
    }

    page++

    if (list.length > 0) {
      endId = BigInt(list[list.length - 1].id)
    }

    // 避免请求过快
    await new Promise(resolve => setTimeout(resolve, 500))

    // 最多获取 1000 页，防止无限循环
    if (page > 1000) break

  } while (true)

  return { list: allList, uid }
}

// 尝试获取 UID
const tryGetUid = async (queryString, apiDomain) => {
  for (const key of Object.keys(gachaTypeMap)) {
    try {
      const url = `${apiDomain}/gacha_info/api/getGachaLog?${queryString}&gacha_type=${key}&page=1&size=6`
      const response = await CapacitorHttp.get({ url })

      if (response.data.retcode === 0 && response.data.data?.list?.length > 0) {
        return response.data.data.list[0].uid
      }
    } catch (e) {
      // 继续尝试下一个
    }
  }
  return null
}

// 数据合并（桌面版逻辑）
const mergeData = (newData) => {
  // 新的数据结构：按 gachaType 分组
  const newGrouped = {}
  for (const item of newData) {
    const key = item.uigf_gacha_type
    if (!newGrouped[key]) newGrouped[key] = []
    newGrouped[key].push(item)
  }

  return newData // 目前简化处理，直接返回新数据
}

// 获取祈愿数据
const fetchData = async (url) => {
  state.status = 'loading'
  state.log = '正在解析 URL...'

  try {
    // 修复 authkey（桌面版逻辑）
    const fixedUrl = fixAuthkey(url)

    // 解析 URL
    const urlObj = new URL(fixedUrl)
    const searchParams = urlObj.searchParams

    // 检查必要的参数
    const authkey = searchParams.get('authkey')
    if (!authkey) {
      throw new Error('URL 中缺少 authkey 参数')
    }

    // 确定 API 域名（桌面版完整逻辑）
    let apiDomain
    if (urlObj.host.includes('webstatic-sea') ||
        urlObj.host.includes('hk4e-api-os') ||
        urlObj.host.includes('hoyoverse.com')) {
      apiDomain = 'https://public-operation-hk4e-sg.hoyoverse.com'
    } else {
      apiDomain = 'https://public-operation-hk4e.mihoyo.com'
    }

    state.log = '正在连接服务器...'

    // 清理参数（桌面版逻辑）
    const cleanParams = new URLSearchParams(searchParams)
    cleanParams.delete('page')
    cleanParams.delete('size')
    cleanParams.delete('gacha_type')
    cleanParams.delete('end_id')

    const queryString = cleanParams.toString()

    // 先获取 UID
    const uid = await tryGetUid(queryString, apiDomain)
    state.log = uid ? `UID: ${uid}` : '无法获取 UID'

    // 获取所有祈愿类型的数据
    const result = []
    for (const key of Object.keys(gachaTypeMap)) {
      const { list } = await getGachaLogs(key, queryString, apiDomain)

      for (const item of list) {
        result.push({
          time: item.time,
          name: item.name,
          item_type: item.item_type,
          rank_type: parseInt(item.rank_type),
          gacha_type: item.gacha_type,
          id: item.id,
          uigf_gacha_type: key,
          uid: item.uid || uid
        })
      }
    }

    if (result.length === 0) {
      throw new Error('未获取到任何数据')
    }

    // 获取本地数据并合并
    const localData = await Storage.get('gachaData', null)
    let mergedData = result

    if (localData && localData.data && localData.data.length > 0) {
      state.log = '正在合并数据...'

      // 按类型分组数据
      const localGrouped = {}
      const newGrouped = {}

      for (const item of localData.data) {
        const key = item.uigf_gacha_type
        if (!localGrouped[key]) localGrouped[key] = []
        localGrouped[key].push(item)
      }

      for (const item of result) {
        const key = item.uigf_gacha_type
        if (!newGrouped[key]) newGrouped[key] = []
        newGrouped[key].push(item)
      }

      const mergedGrouped = {}

      // 对每个类型分别进行合并
      Object.keys(newGrouped).forEach(key => {
        const newItems = newGrouped[key]
        const localItems = localGrouped[key] || []

        if (localItems.length === 0) {
          // 没有本地数据，直接使用新数据
          mergedGrouped[key] = newItems
        } else {
          // 转换为桌面版格式进行合并
          const newArray = newItems.map(item => [
            item.time, item.name, item.item_type, item.rank_type, item.gacha_type, item.id
          ])
          const localArray = localItems.map(item => [
            item.time, item.name, item.item_type, item.rank_type, item.gacha_type, item.id
          ])

          // 应用桌面版的合并逻辑
          const mergedArray = mergeArrays(localArray, newArray)

          // 转换回对象格式
          mergedGrouped[key] = mergedArray.map(arr => ({
            time: arr[0],
            name: arr[1],
            item_type: arr[2],
            rank_type: arr[3],
            gacha_type: arr[4],
            id: arr[5],
            uigf_gacha_type: key,
            uid: uid
          }))
        }
      })

      // 添加本地数据中存在但新数据中没有的类型
      Object.keys(localGrouped).forEach(key => {
        if (!mergedGrouped[key]) {
          mergedGrouped[key] = localGrouped[key]
        }
      })

      // 展平为数组，但保持每个类型内部的顺序
      mergedData = Object.values(mergedGrouped).flat()

      const newCount = mergedData.length - localData.data.length
      if (newCount > 0) {
        state.log = `新增 ${newCount} 条记录`
      } else {
        state.log = '数据已是最新'
      }
    } else {
      mergedData = result
    }

    // 移除全局排序，让每个类型在导出时单独排序
    // mergedData.sort((a, b) => new Date(a.time) - new Date(b.time))

    gachaData = mergedData
    state.status = 'loaded'
    state.log = `成功获取 ${mergedData.length} 条记录`
    state.saveDirectoryInfo = '导出Excel时将按优先级保存到: Documents → External → Cache → Data'
    state.showUrlDlg = false

    ElMessage.success(`成功获取 ${mergedData.length} 条记录`)

    // 保存到本地存储
    await Storage.set('gachaData', {
      data: mergedData,
      time: Date.now(),
      uid: uid
    })

  } catch (error) {
    console.error('获取数据失败:', error)
    state.status = 'failed'
    state.log = error.message || '获取数据失败'
    ElMessage.error(error.message || '获取数据失败')
  }
}

// 导出 Excel
const exportExcel = async () => {
  if (!gachaData || gachaData.length === 0) {
    ElMessage.warning('没有数据可导出')
    return
  }

  try {
    state.log = '正在生成 Excel...'

    // 动态导入 xlsx-js-style 以支持样式
    const XLSX = await import('xlsx-js-style')

    // 颜色配置
    const sheetColors = {
      '角色活动祈愿': 'FFFF00',   // 黄色
      '武器活动祈愿': '8AB8E6',   // 浅蓝色
      '常驻祈愿': 'FFA500',       // 橙色
      '集录祈愿': 'ADD8E6',       // 浅蓝
      '新手祈愿': '90EE90'        // 浅绿
    }
    const totalHeaderColor = 'DBD7D3'
    const rankColor = {
      3: '8E8E8E',
      4: 'A256E1',
      5: 'BD6932'
    }

    // 祈愿类型顺序（用于控制sheet顺序）
    const sheetOrder = ['301', '302', '200', '500', '100']  // 角色、武器、常驻、集录、新手

    // 数据分组（按祈愿类型）
    const groupedData = {}
    for (const item of gachaData) {
      const key = item.uigf_gacha_type
      if (!groupedData[key]) groupedData[key] = []
      groupedData[key].push(item)
    }

    // 处理每个分组的数据，计算total和pity
    const processedData = {}
    const allRows = []

    // 确保为所有祈愿类型创建数据，即使没有记录
    for (const key of sheetOrder) {
      const typeInfo = gachaTypeMap[key]
      if (!typeInfo) continue
      const name = typeInfo.name
      const items = groupedData[key] || []
      const logs = []
      let total = 0
      let pity = 0


      for (const item of items) {
        total += 1
        pity += 1

        const log = [
          item.time,
          item.name,
          item.item_type,
          item.rank_type,
          total,
          pity,
          '' // remark
        ]

        if (item.rank_type === 5) {
          pity = 0
        }

        logs.push(log)

        // 收集总表行
        allRows.push({
          row: log,
          sheetName: name,
          rank: item.rank_type,
          time: new Date(item.time)
        })
      }

      processedData[key] = {
        name,
        logs
      }
    }

    // 创建工作簿
    const wb = XLSX.utils.book_new()

    // 表头
    const headers = ['时间', '名称', '类型', '星级', '总次数', '保底内', '备注']
    const wishTypeHeader = '祈愿类型'

    // 辅助函数：添加统计行
    const addStatisticsRowsXlsx = (sheetData, allRows, sheetColors) => {
      const sheetOrder = ['角色活动祈愿', '武器活动祈愿', '常驻祈愿', '集录祈愿', '新手祈愿'];

      // 按祈愿池分组
      const groups = {};
      allRows.forEach(item => {
        const sheetName = item.sheetName;
        if (!groups[sheetName]) groups[sheetName] = [];
        groups[sheetName].push(item);
      });

      // 对每个组，按时间降序、total降序排序，取第一个
      const latestBySheet = {};
      Object.keys(groups).forEach(sheetName => {
        const group = groups[sheetName];
        if (group.length > 0) {
          group.sort((a, b) => {
            if (a.time > b.time) return -1;
            if (a.time < b.time) return 1;
            const totalA = parseInt(a.row[4], 10) || 0;
            const totalB = parseInt(b.row[4], 10) || 0;
            return totalB - totalA;
          });
          const latest = group[0];
          latestBySheet[sheetName] = {
            pity: latest.row[5],
            rank: Number(latest.rank)
          };
        }
      });

      // 按固定顺序添加统计行
      sheetOrder.forEach(sheetName => {
        if (latestBySheet[sheetName]) {
          const info = latestBySheet[sheetName];
          const n = info.rank === 5 ? 0 : info.pity;
          const text = `${sheetName} 已累计 ${n} 抽未出5星`;
          sheetData.push([text, '', '', '', '', '', '', '']); // 8列，对应总表的列数
        }
      });
    }

    // 辅助函数：应用样式
    const applySheetStyles = (sheet, sheetData, sheetColors, rankColor, headerColor, isTotalSheet, sheetName) => {
      const range = XLSX.utils.decode_range(sheet['!ref'])

      for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
          const cell = sheet[cellAddress]
          if (!cell) continue

          // 初始化样式
          cell.s = cell.s || {}

          if (row === 0) {
            // 表头样式
            cell.s.fill = {
              fgColor: { rgb: headerColor ? headerColor.replace('#', '') : 'DBD7D3' }
            }
            cell.s.font = {
              name: '微软雅黑',
              color: { rgb: '757575' },
              bold: true
            }
            cell.s.border = {
              top: { style: 'thin', color: { rgb: 'C4C2BF' } },
              left: { style: 'thin', color: { rgb: 'C4C2BF' } },
              bottom: { style: 'thin', color: { rgb: 'C4C2BF' } },
              right: { style: 'thin', color: { rgb: 'C4C2BF' } }
            }
          } else {
            // 数据行样式
            const rowData = sheetData[row]
            if (!rowData) continue

            // 设置边框
            cell.s.border = {
              top: { style: 'thin', color: { rgb: 'C4C2BF' } },
              left: { style: 'thin', color: { rgb: 'C4C2BF' } },
              bottom: { style: 'thin', color: { rgb: 'C4C2BF' } },
              right: { style: 'thin', color: { rgb: 'C4C2BF' } }
            }

            let bgColor = 'EBEBEB'
            let fontColor = '000000'
            let isBold = false

            if (isTotalSheet) {
              // 总表样式
              const wishType = rowData[rowData.length - 1] // 最后一列是祈愿类型
              bgColor = sheetColors[wishType] || 'EBEBEB'

              // 根据星级设置字体颜色
              const rank = rowData[3] // 星级在第4列（索引3）
              fontColor = rankColor[rank] || '000000'
              isBold = rank !== 3
            } else {
              // 单个祈愿类型sheet样式
              bgColor = sheetColors[sheetName] || 'EBEBEB'

              // 根据星级设置字体颜色
              const rank = rowData[3] // 星级在第4列（索引3）
              fontColor = rankColor[rank] || '000000'
              isBold = rank !== 3
            }

            cell.s.fill = {
              fgColor: { rgb: bgColor }
            }
            cell.s.font = {
              name: '微软雅黑',
              color: { rgb: fontColor },
              bold: isBold
            }
          }
        }
      }

      // 设置列宽
      sheet['!cols'] = [
        { wch: 24 }, // 时间
        { wch: 14 }, // 名称
        { wch: 8 },  // 类型
        { wch: 8 },  // 星级
        { wch: 8 },  // 总次数
        { wch: 8 },  // 保底内
        { wch: 8 },  // 备注
        { wch: 12 }  // 祈愿类型（总表）
      ]
    }

    // 创建总表（不含3星）
    const filteredRows = allRows.filter(item => item.rank !== 3)
    const totalSheetData = [headers.concat([wishTypeHeader])]

    for (const item of filteredRows) {
      totalSheetData.push(item.row.concat([item.sheetName]))
    }

    // 添加统计行
    addStatisticsRowsXlsx(totalSheetData, allRows, sheetColors)

    const totalSheet = XLSX.utils.aoa_to_sheet(totalSheetData)
    applySheetStyles(totalSheet, totalSheetData, sheetColors, rankColor, totalHeaderColor, true)
    XLSX.utils.book_append_sheet(wb, totalSheet, '总表')

    // 创建总表（含3星）
    const totalSheetWith3StarData = [headers.concat([wishTypeHeader])]

    for (const item of allRows) {
      totalSheetWith3StarData.push(item.row.concat([item.sheetName]))
    }

    // 添加统计行
    addStatisticsRowsXlsx(totalSheetWith3StarData, allRows, sheetColors)

    const totalSheetWith3Star = XLSX.utils.aoa_to_sheet(totalSheetWith3StarData)
    applySheetStyles(totalSheetWith3Star, totalSheetWith3StarData, sheetColors, rankColor, totalHeaderColor, true)
    XLSX.utils.book_append_sheet(wb, totalSheetWith3Star, '总表（含3星）')

    // 创建各祈愿类型的sheet（按照指定顺序）
    for (const key of sheetOrder) {
      const data = processedData[key]
      if (!data) continue

      const sheetData = [headers]
      for (const log of data.logs) {
        sheetData.push(log)
      }

      const sheet = XLSX.utils.aoa_to_sheet(sheetData)
      applySheetStyles(sheet, sheetData, sheetColors, rankColor, null, false, data.name)
      XLSX.utils.book_append_sheet(wb, sheet, data.name)
    }

    // 生成文件
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array', Props: { Author: 'Genshin Wish Export' } })
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

    // 保存文件
    const fileName = `原神抽卡记录_${new Date().toISOString().slice(0, 10)}.xlsx`
    const result = await Storage.saveFile(fileName, blob, 'Documents')

    if (result.success) {
      state.log = `已保存: ${fileName}`
      ElMessage.success(`导出成功！已保存到 ${result.directoryPath}: ${fileName}`)
    } else {
      throw new Error(result.error || '保存失败')
    }

  } catch (error) {
    console.error('导出 Excel 失败:', error)
    state.log = '导出失败: ' + error.message
    ElMessage.error('导出失败: ' + error.message)
  }
}

// 分享 Excel
const shareExcel = async () => {
  if (!gachaData || gachaData.length === 0) {
    ElMessage.warning('没有数据可分享')
    return
  }

  try {
    state.log = '正在生成 Excel...'

    // 动态导入 xlsx-js-style 以支持样式
    const XLSX = await import('xlsx-js-style')

    // 颜色配置
    const sheetColors = {
      '角色活动祈愿': 'FFFF00',   // 黄色
      '武器活动祈愿': '8AB8E6',   // 浅蓝色
      '常驻祈愿': 'FFA500',       // 橙色
      '集录祈愿': 'ADD8E6',       // 浅蓝
      '新手祈愿': '90EE90'        // 浅绿
    }
    const totalHeaderColor = 'DBD7D3'
    const rankColor = {
      3: '8E8E8E',
      4: 'A256E1',
      5: 'BD6932'
    }

    // 祈愿类型顺序（用于控制sheet顺序）
    const sheetOrder = ['301', '302', '200', '500', '100']  // 角色、武器、常驻、集录、新手

    // 数据分组（按祈愿类型）
    const groupedData = {}
    for (const item of gachaData) {
      const key = item.uigf_gacha_type
      if (!groupedData[key]) groupedData[key] = []
      groupedData[key].push(item)
    }

    // 处理每个分组的数据，计算total和pity
    const processedData = {}
    const allRows = []

    // 确保为所有祈愿类型创建数据，即使没有记录
    for (const key of sheetOrder) {
      const typeInfo = gachaTypeMap[key]
      if (!typeInfo) continue
      const name = typeInfo.name
      const items = groupedData[key] || []
      const logs = []
      let total = 0
      let pity = 0


      for (const item of items) {
        total += 1
        pity += 1

        const log = [
          item.time,
          item.name,
          item.item_type,
          item.rank_type,
          total,
          pity,
          '' // remark
        ]

        if (item.rank_type === 5) {
          pity = 0
        }

        logs.push(log)

        // 收集总表行
        allRows.push({
          row: log,
          sheetName: name,
          rank: item.rank_type,
          time: new Date(item.time)
        })
      }

      processedData[key] = {
        name,
        logs
      }
    }

    // 创建工作簿
    const wb = XLSX.utils.book_new()

    // 表头
    const headers = ['时间', '名称', '类型', '星级', '总次数', '保底内', '备注']
    const wishTypeHeader = '祈愿类型'

    // 辅助函数：添加统计行
    const addStatisticsRowsXlsx = (sheetData, allRows, sheetColors) => {
      const sheetOrder = ['角色活动祈愿', '武器活动祈愿', '常驻祈愿', '集录祈愿', '新手祈愿'];

      // 按祈愿池分组
      const groups = {};
      allRows.forEach(item => {
        const sheetName = item.sheetName;
        if (!groups[sheetName]) groups[sheetName] = [];
        groups[sheetName].push(item);
      });

      // 对每个组，按时间降序、total降序排序，取第一个
      const latestBySheet = {};
      Object.keys(groups).forEach(sheetName => {
        const group = groups[sheetName];
        if (group.length > 0) {
          group.sort((a, b) => {
            if (a.time > b.time) return -1;
            if (a.time < b.time) return 1;
            const totalA = parseInt(a.row[4], 10) || 0;
            const totalB = parseInt(b.row[4], 10) || 0;
            return totalB - totalA;
          });
          const latest = group[0];
          latestBySheet[sheetName] = {
            pity: latest.row[5],
            rank: Number(latest.rank)
          };
        }
      });

      // 按固定顺序添加统计行
      sheetOrder.forEach(sheetName => {
        if (latestBySheet[sheetName]) {
          const info = latestBySheet[sheetName];
          const n = info.rank === 5 ? 0 : info.pity;
          const text = `${sheetName} 已累计 ${n} 抽未出5星`;
          sheetData.push([text, '', '', '', '', '', '', '']); // 8列，对应总表的列数
        }
      });
    }

    // 辅助函数：应用样式
    const applySheetStyles = (sheet, sheetData, sheetColors, rankColor, headerColor, isTotalSheet, sheetName) => {
      const range = XLSX.utils.decode_range(sheet['!ref'])

      for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
          const cell = sheet[cellAddress]
          if (!cell) continue

          // 初始化样式
          cell.s = cell.s || {}

          if (row === 0) {
            // 表头样式
            cell.s.fill = {
              fgColor: { rgb: headerColor ? headerColor.replace('#', '') : 'DBD7D3' }
            }
            cell.s.font = {
              name: '微软雅黑',
              color: { rgb: '757575' },
              bold: true
            }
            cell.s.border = {
              top: { style: 'thin', color: { rgb: 'C4C2BF' } },
              left: { style: 'thin', color: { rgb: 'C4C2BF' } },
              bottom: { style: 'thin', color: { rgb: 'C4C2BF' } },
              right: { style: 'thin', color: { rgb: 'C4C2BF' } }
            }
          } else {
            // 数据行样式
            const rowData = sheetData[row]
            if (!rowData) continue

            // 设置边框
            cell.s.border = {
              top: { style: 'thin', color: { rgb: 'C4C2BF' } },
              left: { style: 'thin', color: { rgb: 'C4C2BF' } },
              bottom: { style: 'thin', color: { rgb: 'C4C2BF' } },
              right: { style: 'thin', color: { rgb: 'C4C2BF' } }
            }

            let bgColor = 'EBEBEB'
            let fontColor = '000000'
            let isBold = false

            if (isTotalSheet) {
              // 总表样式
              const wishType = rowData[rowData.length - 1] // 最后一列是祈愿类型
              bgColor = sheetColors[wishType] || 'EBEBEB'

              // 根据星级设置字体颜色
              const rank = rowData[3] // 星级在第4列（索引3）
              fontColor = rankColor[rank] || '000000'
              isBold = rank !== 3
            } else {
              // 单个祈愿类型sheet样式
              bgColor = sheetColors[sheetName] || 'EBEBEB'

              // 根据星级设置字体颜色
              const rank = rowData[3] // 星级在第4列（索引3）
              fontColor = rankColor[rank] || '000000'
              isBold = rank !== 3
            }

            cell.s.fill = {
              fgColor: { rgb: bgColor }
            }
            cell.s.font = {
              name: '微软雅黑',
              color: { rgb: fontColor },
              bold: isBold
            }
          }
        }
      }

      // 设置列宽
      sheet['!cols'] = [
        { wch: 24 }, // 时间
        { wch: 14 }, // 名称
        { wch: 8 },  // 类型
        { wch: 8 },  // 星级
        { wch: 8 },  // 总次数
        { wch: 8 },  // 保底内
        { wch: 8 },  // 备注
        { wch: 12 }  // 祈愿类型（总表）
      ]
    }

    // 创建总表（不含3星）
    const filteredRows = allRows.filter(item => item.rank !== 3)
    const totalSheetData = [headers.concat([wishTypeHeader])]

    for (const item of filteredRows) {
      totalSheetData.push(item.row.concat([item.sheetName]))
    }

    // 添加统计行
    addStatisticsRowsXlsx(totalSheetData, allRows, sheetColors)

    const totalSheet = XLSX.utils.aoa_to_sheet(totalSheetData)
    applySheetStyles(totalSheet, totalSheetData, sheetColors, rankColor, totalHeaderColor, true)
    XLSX.utils.book_append_sheet(wb, totalSheet, '总表')

    // 创建总表（含3星）
    const totalSheetWith3StarData = [headers.concat([wishTypeHeader])]

    for (const item of allRows) {
      totalSheetWith3StarData.push(item.row.concat([item.sheetName]))
    }

    // 添加统计行
    addStatisticsRowsXlsx(totalSheetWith3StarData, allRows, sheetColors)

    const totalSheetWith3Star = XLSX.utils.aoa_to_sheet(totalSheetWith3StarData)
    applySheetStyles(totalSheetWith3Star, totalSheetWith3StarData, sheetColors, rankColor, totalHeaderColor, true)
    XLSX.utils.book_append_sheet(wb, totalSheetWith3Star, '总表（含3星）')

    // 创建各祈愿类型的sheet（按照指定顺序）
    for (const key of sheetOrder) {
      const data = processedData[key]
      if (!data) continue

      const sheetData = [headers]
      for (const log of data.logs) {
        sheetData.push(log)
      }

      const sheet = XLSX.utils.aoa_to_sheet(sheetData)
      applySheetStyles(sheet, sheetData, sheetColors, rankColor, null, false, data.name)
      XLSX.utils.book_append_sheet(wb, sheet, data.name)
    }

    // 生成文件并保存
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array', Props: { Author: 'Genshin Wish Export' } })
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

    // 保存到文件系统
    const fileName = `原神抽卡记录_${new Date().toISOString().slice(0, 10)}.xlsx`
    const base64Data = await Storage.blobToBase64(blob)

    await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Documents
    })

    state.log = '导出成功'
    ElMessage.success(`导出成功: ${fileName}`)

  } catch (error) {
    console.error('导出 Excel 失败:', error)
    state.log = '导出失败: ' + error.message
    ElMessage.error('导出失败: ' + error.message)
  }
}

// 分享 Excel
const shareGachaExcel = async () => {
  if (!gachaData || gachaData.length === 0) {
    ElMessage.warning('没有数据可分享')
    return
  }

  try {
    state.log = '正在生成 Excel...'

    // 动态导入 xlsx-js-style 以支持样式
    const XLSX = await import('xlsx-js-style')

    // 颜色配置
    const sheetColors = {
      '角色活动祈愿': 'FFFF00',   // 黄色
      '武器活动祈愿': '8AB8E6',   // 浅蓝色
      '常驻祈愿': 'FFA500',       // 橙色
      '集录祈愿': 'ADD8E6',       // 浅蓝
      '新手祈愿': '90EE90'        // 浅绿
    }
    const totalHeaderColor = 'DBD7D3'
    const rankColor = {
      3: '8E8E8E',
      4: 'A256E1',
      5: 'BD6932'
    }

    // 祈愿类型顺序（用于控制sheet顺序）
    const sheetOrder = ['301', '302', '200', '500', '100']  // 角色、武器、常驻、集录、新手

    // 数据分组（按祈愿类型）
    const groupedData = {}
    for (const item of gachaData) {
      const key = item.uigf_gacha_type
      if (!groupedData[key]) groupedData[key] = []
      groupedData[key].push(item)
    }

    // 处理每个分组的数据，计算total和pity
    const processedData = {}
    const allRows = []

    // 确保为所有祈愿类型创建数据，即使没有记录
    for (const key of sheetOrder) {
      const typeInfo = gachaTypeMap[key]
      if (!typeInfo) continue
      const name = typeInfo.name
      const items = groupedData[key] || []
      const logs = []
      let total = 0
      let pity = 0

      for (const item of items) {
        total += 1
        pity += 1

        const log = [
          item.time,
          item.name,
          item.item_type,
          item.rank_type,
          total,
          pity,
          '' // remark
        ]

        if (item.rank_type === 5) {
          pity = 0
        }

        logs.push(log)

        // 收集总表行
        allRows.push({
          row: log,
          sheetName: name,
          rank: item.rank_type,
          time: new Date(item.time)
        })
      }

      processedData[key] = {
        name,
        logs
      }
    }

    // 创建工作簿
    const wb = XLSX.utils.book_new()

    // 表头
    const headers = ['时间', '名称', '类型', '星级', '总次数', '保底内', '备注']
    const wishTypeHeader = '祈愿类型'

    // 辅助函数：添加统计行
    const addStatisticsRowsXlsx = (sheetData, allRows, sheetColors) => {
      const sheetOrder = ['角色活动祈愿', '武器活动祈愿', '常驻祈愿', '集录祈愿', '新手祈愿'];

      // 按祈愿池分组
      const groups = {};
      allRows.forEach(item => {
        const sheetName = item.sheetName;
        if (!groups[sheetName]) groups[sheetName] = [];
        groups[sheetName].push(item);
      });

      // 对每个组，按时间降序、total降序排序，取第一个
      const latestBySheet = {};
      Object.keys(groups).forEach(sheetName => {
        const group = groups[sheetName];
        if (group.length > 0) {
          group.sort((a, b) => {
            if (a.time > b.time) return -1;
            if (a.time < b.time) return 1;
            const totalA = parseInt(a.row[4], 10) || 0;
            const totalB = parseInt(b.row[4], 10) || 0;
            return totalB - totalA;
          });
          const latest = group[0];
          latestBySheet[sheetName] = {
            pity: latest.row[5],
            rank: Number(latest.rank)
          };
        }
      });

      // 按固定顺序添加统计行
      sheetOrder.forEach(sheetName => {
        if (latestBySheet[sheetName]) {
          const info = latestBySheet[sheetName];
          const n = info.rank === 5 ? 0 : info.pity;
          const text = `${sheetName} 已累计 ${n} 抽未出5星`;
          sheetData.push([text, '', '', '', '', '', '', '']); // 8列，对应总表的列数
        }
      });
    }

    // 辅助函数：应用样式
    const applySheetStyles = (sheet, sheetData, sheetColors, rankColor, headerColor, isTotalSheet, sheetName) => {
      const range = XLSX.utils.decode_range(sheet['!ref'])

      for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
          const cell = sheet[cellAddress]
          if (!cell) continue

          // 初始化样式
          cell.s = cell.s || {}

          if (row === 0) {
            // 表头样式
            cell.s.fill = {
              fgColor: { rgb: headerColor ? headerColor.replace('#', '') : 'DBD7D3' }
            }
            cell.s.font = {
              name: '微软雅黑',
              color: { rgb: '757575' },
              bold: true
            }
            cell.s.border = {
              top: { style: 'thin', color: { rgb: 'C4C2BF' } },
              left: { style: 'thin', color: { rgb: 'C4C2BF' } },
              bottom: { style: 'thin', color: { rgb: 'C4C2BF' } },
              right: { style: 'thin', color: { rgb: 'C4C2BF' } }
            }
          } else {
            // 数据行样式
            const rowData = sheetData[row]
            if (!rowData) continue

            // 设置边框
            cell.s.border = {
              top: { style: 'thin', color: { rgb: 'C4C2BF' } },
              left: { style: 'thin', color: { rgb: 'C4C2BF' } },
              bottom: { style: 'thin', color: { rgb: 'C4C2BF' } },
              right: { style: 'thin', color: { rgb: 'C4C2BF' } }
            }

            let bgColor = 'EBEBEB'
            let fontColor = '000000'
            let isBold = false

            if (isTotalSheet) {
              // 总表样式
              const wishType = rowData[rowData.length - 1] // 最后一列是祈愿类型
              bgColor = sheetColors[wishType] || 'EBEBEB'

              // 根据星级设置字体颜色
              const rank = rowData[3] // 星级在第4列（索引3）
              fontColor = rankColor[rank] || '000000'
              isBold = rank !== 3
            } else {
              // 单个祈愿类型sheet样式
              bgColor = sheetColors[sheetName] || 'EBEBEB'

              // 根据星级设置字体颜色
              const rank = rowData[3] // 星级在第4列（索引3）
              fontColor = rankColor[rank] || '000000'
              isBold = rank !== 3
            }

            cell.s.fill = {
              fgColor: { rgb: bgColor }
            }
            cell.s.font = {
              name: '微软雅黑',
              color: { rgb: fontColor },
              bold: isBold
            }
          }
        }
      }

      // 设置列宽
      sheet['!cols'] = [
        { wch: 24 }, // 时间
        { wch: 14 }, // 名称
        { wch: 8 },  // 类型
        { wch: 8 },  // 星级
        { wch: 8 },  // 总次数
        { wch: 8 },  // 保底内
        { wch: 8 },  // 备注
        { wch: 12 }  // 祈愿类型（总表）
      ]
    }

    // 创建总表（不含3星）
    const filteredRows = allRows.filter(item => item.rank !== 3)
    const totalSheetData = [headers.concat([wishTypeHeader])]

    for (const item of filteredRows) {
      totalSheetData.push(item.row.concat([item.sheetName]))
    }

    // 添加统计行
    addStatisticsRowsXlsx(totalSheetData, allRows, sheetColors)

    const totalSheet = XLSX.utils.aoa_to_sheet(totalSheetData)
    applySheetStyles(totalSheet, totalSheetData, sheetColors, rankColor, totalHeaderColor, true)
    XLSX.utils.book_append_sheet(wb, totalSheet, '总表')

    // 创建总表（含3星）
    const totalSheetWith3StarData = [headers.concat([wishTypeHeader])]

    for (const item of allRows) {
      totalSheetWith3StarData.push(item.row.concat([item.sheetName]))
    }

    // 添加统计行
    addStatisticsRowsXlsx(totalSheetWith3StarData, allRows, sheetColors)

    const totalSheetWith3Star = XLSX.utils.aoa_to_sheet(totalSheetWith3StarData)
    applySheetStyles(totalSheetWith3Star, totalSheetWith3StarData, sheetColors, rankColor, totalHeaderColor, true)
    XLSX.utils.book_append_sheet(wb, totalSheetWith3Star, '总表（含3星）')

    // 创建各祈愿类型的sheet（按照指定顺序）
    for (const key of sheetOrder) {
      const data = processedData[key]
      if (!data) continue

      const sheetData = [headers]
      for (const log of data.logs) {
        sheetData.push(log)
      }

      const sheet = XLSX.utils.aoa_to_sheet(sheetData)
      applySheetStyles(sheet, sheetData, sheetColors, rankColor, null, false, data.name)
      XLSX.utils.book_append_sheet(wb, sheet, data.name)
    }

    // 生成文件
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array', Props: { Author: 'Genshin Wish Export' } })
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

    // 分享文件
    const fileName = `原神抽卡记录_${new Date().toISOString().slice(0, 10)}.xlsx`
    const base64Data = await Storage.blobToBase64(blob)

    await Share.share({
      title: '原神抽卡记录',
      text: '分享我的原神抽卡数据',
      files: [`data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64Data}`],
      dialogTitle: '分享抽卡记录'
    })

    state.log = '分享成功'
    ElMessage.success('分享成功')

  } catch (error) {
    console.error('分享 Excel 失败:', error)
    if (error.message !== 'Share canceled') {
      state.log = '分享失败: ' + error.message
      ElMessage.error('分享失败: ' + error.message)
    }
  }
}

// 清除数据
const clearData = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清除所有本地数据吗？此操作不可恢复。',
      '确认清除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    gachaData = []
    state.status = 'init'
    state.log = ''
    state.saveDirectoryInfo = ''
    await Storage.remove('gachaData')

    ElMessage.success('数据已清除')
  } catch (error) {
    if (error !== 'cancel') {
      console.error('清除数据失败:', error)
    }
  }
}

// 加载本地数据
onMounted(async () => {
  try {
    const saved = await Storage.get('gachaData', null)
    if (saved && saved.data && saved.data.length > 0) {
      gachaData = saved.data
      state.status = 'loaded'
      state.log = `已加载 ${gachaData.length} 条记录`
    }
  } catch (error) {
    console.error('加载本地数据失败:', error)
  }
})
</script>

<style scoped>
.app-container {
  padding: 16px;
  max-width: 100%;
  min-height: 100vh;
  background-color: #f5f5f5;
}

.header {
  text-align: center;
  margin-bottom: 20px;
}

.header h1 {
  font-size: 24px;
  font-weight: bold;
  color: #333;
  margin: 0;
}

.version {
  font-size: 12px;
  color: #999;
  margin: 4px 0 0;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.action-btn {
  flex: 1;
  min-width: 100px;
  font-weight: bold;
  color: #ffffff;
}

/* 更新数据按钮 - 使用更深的蓝色 */
:deep(.action-btn.el-button--primary) {
  background-color: #1677ff;
  border-color: #1677ff;
  color: #ffffff;
}

/* 导出Excel按钮 - 使用更深的绿色 */
:deep(.action-btn.el-button--success) {
  background-color: #389e0d;
  border-color: #389e0d;
  color: #ffffff;
}

/* 分享按钮 - 统一为易读的深橙色 */
:deep(.action-btn.el-button--warning) {
  background-color: #d46b08;
  border-color: #d46b08;
  color: #ffffff;
}

/* 清除数据按钮 - 使用更深的灰色 */
:deep(.action-btn.el-button--info) {
  background-color: #595959;
  border-color: #595959;
  color: #ffffff;
}

/* 禁用状态的按钮样式 */
:deep(.action-btn.is-disabled) {
  opacity: 0.5;
}

.status-bar {
  background: white;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
  text-align: center;
}

.status-tag {
  font-size: 14px;
}

.log-text {
  font-size: 12px;
  color: #666;
  margin: 8px 0 0;
}

.directory-info {
  font-size: 11px;
  color: #409eff;
  margin: 6px 0 0;
  font-weight: 500;
}


.data-table {
  width: 100%;
}

.table-hint {
  font-size: 12px;
  color: #999;
  margin: 12px 0 0;
  text-align: center;
}

.url-input-section {
  padding: 8px;
}

.input-hint {
  font-size: 14px;
  color: #666;
  margin-bottom: 12px;
}

.url-input {
  margin-bottom: 16px;
}

.help-text {
  background: #f8f8f8;
  padding: 12px;
  border-radius: 6px;
}

.help-text h4 {
  font-size: 14px;
  margin: 0 0 8px;
  color: #333;
}

.help-text ol {
  margin: 0;
  padding-left: 20px;
}

.help-text li {
  font-size: 13px;
  color: #666;
  line-height: 1.8;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

  /* 统计信息样式 */
  .stats-overview {
    padding: 12px 16px;
    border-radius: 12px;
    background: #ffffff;
    border: 1px solid #e7e7e7;
    margin-bottom: 14px;
  }

  .stats-title {
    font-size: 18px;
    font-weight: 700;
    margin: 0;
    color: #222;
  }

  .stats-summary {
    margin: 6px 0 0;
    font-size: 13px;
    color: #666;
  }

  .stats-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 14px;
  }

  .stats-card {
    background: #ffffff;
    border-radius: 12px;
    padding: 16px;
    border: 1px solid #f0f0f0;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  }

  .stats-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 14px;
  }

  .stats-title-wrap {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stats-type {
    font-size: 16px;
    font-weight: 700;
    margin: 0;
    color: #222;
  }

  .total-count {
    font-size: 13px;
    color: #666;
  }

  .import-option {
    display: flex;
    align-items: center;
    padding: 16px;
    border: 2px solid #e8e8e8;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

.import-option:hover {
  border-color: #409eff;
  background-color: #f5f7fa;
}

.import-option:active {
  background-color: #ecf5ff;
}

.option-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f0f2f5;
  border-radius: 8px;
  margin-right: 12px;
  color: #409eff;
}

.option-content {
  flex: 1;
}

.option-content h4 {
  margin: 0 0 4px;
  font-size: 15px;
  color: #333;
}

.option-content p {
  margin: 0;
  font-size: 13px;
  color: #999;
}

.check-icon {
  color: #67c23a;
}

/* 文件选择器样式 */
.file-input-section {
  padding: 8px;
}

.file-picker-btn {
  width: 100%;
  height: 48px;
  font-size: 16px;
  margin-bottom: 12px;
}

.selected-file {
  font-size: 14px;
  color: #67c23a;
  margin-bottom: 12px;
  text-align: center;
}

.help-text ul {
  margin: 0;
  padding-left: 20px;
}

.help-text li {
  font-size: 13px;
  color: #666;
  line-height: 1.8;
}
</style>
