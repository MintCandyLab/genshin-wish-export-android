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
        :disabled="!hasData"
        @click="exportExcel"
        class="action-btn"
      >
        导出 Excel
      </el-button>

      <el-button
        type="warning"
        icon="Share"
        :disabled="!hasData"
        @click="shareExcel"
        class="action-btn"
      >
        分享 Excel
      </el-button>

      <el-button
        type="info"
        icon="Delete"
        :disabled="!hasData"
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
    </div>

    <!-- 统计信息展示 -->
    <div v-if="hasData" class="stats-container">
      <div v-for="(item, index) in detailData" :key="index" class="stats-card">
        <div class="stats-header">
          <div class="stats-title-wrap">
            <h4 class="stats-type">{{ gachaTypeMap.get(item[0]) || item[0] }}</h4>
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
import gachaDetail from './utils/gachaDetail.js'

const state = reactive({
  status: 'init', // init, loading, loaded, failed
  log: '',
  urlInput: '',
  showUrlDlg: false,
  importMode: 'url', // 'url' or 'file'
  selectedFileName: '',
  saveDirectoryInfo: '', // 保存目录信息
  currentData: null // 祈愿数据存储 - 与桌面版一致的数据结构
})

// 祈愿数据存储 - 与桌面版一致的数据结构
// currentData = { result: Map<key, logs>, typeMap: Map<key, name>, uid, lang, time }

// 祈愿类型映射 - 与桌面版一致
const gachaTypeMap = new Map([
  ['301', '角色活动祈愿'],
  ['302', '武器活动祈愿'],
  ['200', '常驻祈愿'],
  ['500', '集录祈愿'],
  ['100', '新手祈愿']
])

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

// 判断是否有数据的辅助函数
const hasData = computed(() => {
  if (!state.currentData || !state.currentData.result) return false
  for (const logs of state.currentData.result.values()) {
    if (logs.length > 0) return true
  }
  return false
})

// 表格显示数据（仅显示最近10条）
const displayData = computed(() => {
  if (!state.currentData || !state.currentData.result) return []

  // 将所有数据展平并按时间排序
  const allData = []
  for (const [key, logs] of state.currentData.result) {
    for (const log of logs) {
      allData.push({
        time: log[0],
        name: log[1],
        item_type: log[2],
        rank_type: log[3],
        gacha_type: log[4],
        uigf_gacha_type: key
      })
    }
  }

  return allData.slice(-10).map(item => ({
    ...item,
    gacha_type_name: gachaTypeMap.get(item.uigf_gacha_type) || item.uigf_gacha_type
  })).reverse()
})

// 按祈愿类型分组的详细统计数据
const detailData = computed(() => {
  if (!state.currentData || !state.currentData.result) return []

  // 使用 gachaDetail 函数计算详细统计
  // gachaDetail 返回 Map<key, detail>，需要转换为 [[key, detail], ...]
  const detailMap = gachaDetail(state.currentData.result)
  const result = []
  const sheetOrder = ['301', '302', '500', '200', '100']

  for (const key of sheetOrder) {
    const detail = detailMap.get(key)
    if (detail && detail.total > 0) {
      result.push([key, detail])
    }
  }

  return result
})

// 桌面版 mergeList 逻辑
const mergeArrays = (a, b) => {
  if (!a || !a.length) return b || []
  if (!b || !b.length) return a
  const minA = new Date(a[0][0]).getTime()
  const idA = a[0][5]
  let pos = b.length
  let idFounded = false
  for (let i = b.length - 1; i >= 0; i--) {
    let idB = b[i][5]
    if (idB && idB === idA) {
      pos = i
      idFounded = true
      break
    }
  }
  if (!idFounded) {
    let width = Math.min(11, a.length, b.length)
    for (let i = 0; i < b.length; i++) {
      const time = new Date(b[i][0]).getTime()
      if (time >= minA) {
        if (compareList(b.slice(i, width + i), a.slice(0, width))) {
          pos = i
          break
        }
      }
    }
  }
  return b.slice(0, pos).concat(a)
}

// 比较列表是否匹配（桌面版 compareList 逻辑）
const compareList = (b, a) => {
  if (!b.length) return false
  if (b.length < a.length) {
    a = a.slice(0, b.length)
  }
  const strA = a.map(item => item.slice(0, 4).join('-')).join(',')
  const strB = b.map(item => item.slice(0, 4).join('-')).join(',')
  return strA === strB
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

    let parsedData = null
    let uid = null

    // 检测 JSON 格式
    if (importData.list && importData.info) {
      // UIGF v3.0 格式
      state.log = '检测到 UIGF v3.0 格式'
      const result = parseUigf30Data(importData)
      uid = result[0]?.uid
      parsedData = convertToDesktopFormat(result, uid)
    } else if (importData.hk4e && importData.info?.version) {
      // UIGF v4.1 格式
      state.log = '检测到 UIGF v4.1 格式'
      const result = parseUigf41Data(importData)
      uid = result[0]?.uid
      parsedData = convertToDesktopFormat(result, uid)
    } else if (importData.result && importData.uid) {
      // 本地数据格式（桌面版格式）
      state.log = '检测到本地数据格式'
      parsedData = parseLocalData(importData)
      uid = parsedData.uid
    } else {
      throw new Error('不支持的 JSON 格式')
    }

    // 获取本地数据并合并（如果存在）
    const localData = await Storage.get('gachaData', null)
    if (localData && localData.data && localData.data.result) {
      state.log = '正在合并数据...'
      parsedData = mergeDesktopData(deserializeCurrentData(localData.data), parsedData)
    }

    state.currentData = parsedData
    state.status = 'loaded'

    // 计算总记录数
    let totalRecords = 0
    for (const logs of state.currentData.result.values()) {
      totalRecords += logs.length
    }

    state.log = `成功导入 ${totalRecords} 条记录`
    state.showUrlDlg = false
    state.selectedFileName = ''

    ElMessage.success(`成功导入 ${totalRecords} 条记录`)

    // 保存到本地存储（序列化 Map 为数组）
    await Storage.set('gachaData', {
      data: serializeCurrentData(state.currentData),
      time: Date.now()
    })

  } catch (error) {
    console.error('解析 JSON 数据失败:', error)
    state.status = 'failed'
    state.log = error.message || '解析数据失败'
    ElMessage.error(error.message || '解析数据失败')
  }
}

// 解析 UIGF v3.0 格式 - 与桌面版一致，按 id 排序
const parseUigf30Data = (data) => {
  const result = []
  // 按 id 大小排序，与桌面版一致
  data.list.sort((a, b) => parseInt(BigInt(a.id) - BigInt(b.id)))
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

// 解析 UIGF v4.1 格式 - 与桌面版一致，按 id 排序
const parseUigf41Data = (data) => {
  const result = []
  for (const account of data.hk4e) {
    // 按 id 大小排序，与桌面版一致
    account.list.sort((a, b) => parseInt(BigInt(a.id) - BigInt(b.id)))
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

// 解析本地数据格式（新格式：桌面版 Map 结构）
const parseLocalData = (data) => {
  // 返回当前数据格式，与桌面版一致
  return {
    result: new Map(data.result),
    typeMap: data.typeMap ? new Map(data.typeMap) : new Map([
      ['301', '角色活动祈愿'],
      ['302', '武器活动祈愿'],
      ['200', '常驻祈愿'],
      ['500', '集录祈愿'],
      ['100', '新手祈愿']
    ]),
    uid: data.uid,
    lang: data.lang || 'zh-cn',
    time: data.time
  }
}

// 将 UIGF 格式的数据转换为桌面版格式
const convertToDesktopFormat = (items, uid) => {
  const result = new Map()
  const typeMap = new Map([
    ['301', '角色活动祈愿'],
    ['302', '武器活动祈愿'],
    ['200', '常驻祈愿'],
    ['500', '集录祈愿'],
    ['100', '新手祈愿']
  ])

  // 初始化所有类型的空数组
  for (const key of typeMap.keys()) {
    result.set(key, [])
  }

  // 按类型分组
  for (const item of items) {
    const key = item.uigf_gacha_type || item.gacha_type
    if (!result.has(key)) {
      result.set(key, [])
    }
    const logs = result.get(key)
    logs.push([
      item.time,
      item.name,
      item.item_type,
      parseInt(item.rank_type),
      item.gacha_type,
      item.id
    ])
  }

  // 数据已经在 parseUigf30Data/parseUigf41Data 中按 id 排序了
  // 不需要再次排序，保持顺序与桌面版一致

  return {
    result,
    typeMap,
    uid: uid || items[0]?.uid,
    lang: 'zh-cn',
    time: Date.now()
  }
}

// 合并桌面版格式的数据
const mergeDesktopData = (localData, newData) => {
  const mergedResult = new Map()

  // 获取所有可能的 key
  const allKeys = new Set([
    ...localData.result.keys(),
    ...newData.result.keys()
  ])

  for (const key of allKeys) {
    const localLogs = localData.result.get(key) || []
    const newLogs = newData.result.get(key) || []

    if (localLogs.length === 0) {
      mergedResult.set(key, newLogs)
    } else if (newLogs.length === 0) {
      mergedResult.set(key, localLogs)
    } else {
      // 使用桌面版的 mergeArrays 逻辑
      const merged = mergeArrays(localLogs, newLogs)
      mergedResult.set(key, merged)
    }
  }

  return {
    result: mergedResult,
    typeMap: localData.typeMap || newData.typeMap,
    uid: newData.uid || localData.uid,
    lang: localData.lang || newData.lang,
    time: Date.now()
  }
}

// 序列化当前数据（将 Map 转换为可存储的格式）
const serializeCurrentData = (data) => {
  return {
    result: Array.from(data.result.entries()),
    typeMap: Array.from(data.typeMap.entries()),
    uid: data.uid,
    lang: data.lang,
    time: data.time
  }
}

// 反序列化数据（从存储恢复 Map 格式）
const deserializeCurrentData = (data) => {
  return {
    result: new Map(data.result),
    typeMap: new Map(data.typeMap),
    uid: data.uid,
    lang: data.lang,
    time: data.time
  }
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
    state.log = `获取 ${gachaTypeMap.get(gachaTypeKey)} 第 ${page} 页...`

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
      const localResult = new Map(localData.data.result)
      const localItems = localResult.get(gachaTypeKey) || []
      if (localItems.length > 0) {
        const localLatestId = localItems[localItems.length - 1]?.[5]
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
  for (const key of gachaTypeMap.keys()) {
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

    // 获取所有祈愿类型的数据 - 直接创建桌面版格式
    const resultMap = new Map()
    const typeMap = new Map()

    for (const [key, name] of gachaTypeMap) {
      const { list } = await getGachaLogs(key, queryString, apiDomain)

      if (list.length > 0) {
        // 转换为桌面版格式 [time, name, item_type, rank_type, gacha_type, id]
        const logs = list.map(item => [
          item.time,
          item.name,
          item.item_type,
          parseInt(item.rank_type),
          item.gacha_type,
          item.id
        ])

        // 使用 reverse() 与桌面版一致
        // API 返回的数据是最新的在前，reverse() 后变成最早的在前
        logs.reverse()

        resultMap.set(key, logs)
        typeMap.set(key, name)
      }
    }

    if (resultMap.size === 0) {
      throw new Error('未获取到任何数据')
    }

    // 构建新的数据对象
    const newData = {
      result: resultMap,
      typeMap,
      uid,
      lang: 'zh-cn',
      time: Date.now()
    }

    // 获取本地数据并合并
    const localSaved = await Storage.get('gachaData', null)

    if (localSaved && localSaved.data) {
      state.log = '正在合并数据...'

      // 恢复本地数据为 Map
      const localData = deserializeCurrentData(localSaved.data)

      // 按类型合并数据
      for (const [key, newLogs] of resultMap) {
        const localLogs = localData.result.get(key) || []

        // 使用桌面版合并逻辑
        const merged = mergeArrays(localLogs, newLogs)
        resultMap.set(key, merged)
      }

      // 添加本地有但新数据中没有的类型
      for (const [key, localLogs] of localData.result) {
        if (!resultMap.has(key)) {
          resultMap.set(key, localLogs)
          typeMap.set(key, gachaTypeMap.get(key) || key)
        }
      }

      const totalCount = Array.from(resultMap.values()).reduce((sum, logs) => sum + logs.length, 0)
      const localCount = Array.from(localData.result.values()).reduce((sum, logs) => sum + logs.length, 0)
      const newCount = totalCount - localCount

      if (newCount > 0) {
        state.log = `新增 ${newCount} 条记录`
      } else {
        state.log = '数据已是最新'
      }
    }

    // 更新当前数据
    state.currentData = {
      result: resultMap,
      typeMap,
      uid,
      lang: 'zh-cn',
      time: Date.now()
    }

    state.status = 'loaded'
    state.log = `成功获取数据 (UID: ${uid})`
    state.showUrlDlg = false

    ElMessage.success(`成功获取数据 (UID: ${uid})`)

    // 保存到本地存储 - 转换为可序列化的格式
    await Storage.set('gachaData', {
      data: serializeCurrentData(state.currentData),
      time: Date.now()
    })

  } catch (error) {
    console.error('获取数据失败:', error)
    state.status = 'failed'
    state.log = error.message || '获取数据失败'
    ElMessage.error(error.message || '获取数据失败')
  }
}

// 生成 Excel 数据的通用函数
const generateExcelData = () => {
  if (!state.currentData || !state.currentData.result) {
    throw new Error('没有数据可导出')
  }

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
  const sheetOrder = ['301', '302', '500', '200', '100']  // 角色、武器、集录、常驻、新手

  // 数据分组（从 state.currentData.result 获取，已经是按类型分组的 Map）
  // state.currentData.result = Map<key, logs[]> where logs = [time, name, type, rank, wishType, id]
  const groupedData = {}
  for (const [key, logs] of state.currentData.result) {
    if (logs && logs.length > 0) {
      groupedData[key] = logs
    }
  }

  // 处理每个分组的数据，计算total和pity
  const processedData = {}
  const allRows = []

  // 确保为所有祈愿类型创建数据，即使没有记录
  for (const key of sheetOrder) {
    const name = gachaTypeMap.get(key)
    if (!name) continue
    const items = groupedData[key] || []
    const logs = []
    let total = 0
    let pity = 0

    for (const item of items) {
      total += 1
      pity += 1

      const log = [
        item[0],  // time
        item[1],  // name
        item[2],  // item_type
        item[3],  // rank_type
        total,
        pity,
        '' // remark
      ]

      if (item[3] === 5) {
        pity = 0
      }

      logs.push(log)

      // 收集总表行
      allRows.push({
        row: log,
        sheetName: name,
        rank: item[3],
        time: new Date(item[0])
      })
    }

    processedData[key] = {
      name,
      logs
    }
  }

  // 按时间升序排序所有行，与桌面版一致
  allRows.sort((a, b) => a.time - b.time)

  return { processedData, allRows, sheetColors, totalHeaderColor, rankColor, sheetOrder }
}

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
const applySheetStyles = (sheet, sheetData, sheetColors, rankColor, headerColor, isTotalSheet, sheetName, XLSX) => {
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

// 导出 Excel
const exportExcel = async () => {
  try {
    state.log = '正在生成 Excel...'

    // 动态导入 xlsx-js-style 以支持样式
    const XLSX = await import('xlsx-js-style')

    const { processedData, allRows, sheetColors, totalHeaderColor, rankColor, sheetOrder } = generateExcelData()

    // 表头
    const headers = ['时间', '名称', '类型', '星级', '总次数', '保底内', '备注']
    const wishTypeHeader = '祈愿类型'

    // 创建工作簿
    const wb = XLSX.utils.book_new()

    // 创建总表（不含3星）
    const filteredRows = allRows.filter(item => item.rank !== 3)
    const totalSheetData = [headers.concat([wishTypeHeader])]

    for (const item of filteredRows) {
      totalSheetData.push(item.row.concat([item.sheetName]))
    }

    // 添加统计行
    addStatisticsRowsXlsx(totalSheetData, allRows, sheetColors)

    const totalSheet = XLSX.utils.aoa_to_sheet(totalSheetData)
    applySheetStyles(totalSheet, totalSheetData, sheetColors, rankColor, totalHeaderColor, true, null, XLSX)
    XLSX.utils.book_append_sheet(wb, totalSheet, '总表')

    // 创建总表（含3星）
    const totalSheetWith3StarData = [headers.concat([wishTypeHeader])]

    for (const item of allRows) {
      totalSheetWith3StarData.push(item.row.concat([item.sheetName]))
    }

    // 添加统计行
    addStatisticsRowsXlsx(totalSheetWith3StarData, allRows, sheetColors)

    const totalSheetWith3Star = XLSX.utils.aoa_to_sheet(totalSheetWith3StarData)
    applySheetStyles(totalSheetWith3Star, totalSheetWith3StarData, sheetColors, rankColor, totalHeaderColor, true, null, XLSX)
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
      applySheetStyles(sheet, sheetData, sheetColors, rankColor, null, false, data.name, XLSX)
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
  try {
    state.log = '正在生成 Excel...'

    // 动态导入 xlsx-js-style 以支持样式
    const XLSX = await import('xlsx-js-style')

    const { processedData, allRows, sheetColors, totalHeaderColor, rankColor, sheetOrder } = generateExcelData()

    // 表头
    const headers = ['时间', '名称', '类型', '星级', '总次数', '保底内', '备注']
    const wishTypeHeader = '祈愿类型'

    // 创建工作簿
    const wb = XLSX.utils.book_new()

    // 创建总表（不含3星）
    const filteredRows = allRows.filter(item => item.rank !== 3)
    const totalSheetData = [headers.concat([wishTypeHeader])]

    for (const item of filteredRows) {
      totalSheetData.push(item.row.concat([item.sheetName]))
    }

    // 添加统计行
    addStatisticsRowsXlsx(totalSheetData, allRows, sheetColors)

    const totalSheet = XLSX.utils.aoa_to_sheet(totalSheetData)
    applySheetStyles(totalSheet, totalSheetData, sheetColors, rankColor, totalHeaderColor, true, null, XLSX)
    XLSX.utils.book_append_sheet(wb, totalSheet, '总表')

    // 创建总表（含3星）
    const totalSheetWith3StarData = [headers.concat([wishTypeHeader])]

    for (const item of allRows) {
      totalSheetWith3StarData.push(item.row.concat([item.sheetName]))
    }

    // 添加统计行
    addStatisticsRowsXlsx(totalSheetWith3StarData, allRows, sheetColors)

    const totalSheetWith3Star = XLSX.utils.aoa_to_sheet(totalSheetWith3StarData)
    applySheetStyles(totalSheetWith3Star, totalSheetWith3StarData, sheetColors, rankColor, totalHeaderColor, true, null, XLSX)
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
      applySheetStyles(sheet, sheetData, sheetColors, rankColor, null, false, data.name, XLSX)
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

    state.currentData = null
    state.status = 'init'
    state.log = ''
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
    if (saved && saved.data && saved.data.result) {
      // 恢复为 Map 结构
      state.currentData = deserializeCurrentData(saved.data)

      // 计算总记录数
      const totalCount = Array.from(state.currentData.result.values()).reduce((sum, logs) => sum + logs.length, 0)

      state.status = 'loaded'
      state.log = `已加载 ${totalCount} 条记录 (UID: ${saved.data.uid})`
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

.help-text ol,
.help-text ul {
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
</style>
