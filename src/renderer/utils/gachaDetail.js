// 计算祈愿详细统计数据 - 参考桌面版逻辑
// 支持两种数据格式：
// 1. 桌面版格式：Map<key, Array<[time, name, type, rank, wishType]>>
// 2. Android格式：Array<{time, name, item_type, rank_type, gacha_type, uigf_gacha_type}>
export function gachaDetail(data) {
  // 判断数据格式
  if (Array.isArray(data)) {
    // Android格式：对象数组
    return processAndroidFormat(data)
  } else if (data instanceof Map) {
    // 桌面版格式：Map
    return processDesktopFormat(data)
  } else {
    console.error('Unknown data format:', data)
    return null
  }
}

// 处理Android格式的数据
// 按 uigf_gacha_type 分组后分别计算，与桌面版逻辑保持一致
function processAndroidFormat(items) {
  // 首先按 uigf_gacha_type 分组
  const grouped = {}
  items.forEach(item => {
    const key = item.uigf_gacha_type || item.gacha_type
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(item)
  })

  // 合并所有分组的统计结果
  const detail = {
    count3: 0, count4: 0, count5: 0,
    count3w: 0, count4w: 0, count5w: 0, count4c: 0, count5c: 0,
    weapon3: new Map(), weapon4: new Map(), weapon5: new Map(),
    char4: new Map(), char5: new Map(),
    date: [null, null],
    ssrPos: [], countMio: 0, total: items.length
  }

  let dateMin = null
  let dateMax = null

  // 为计算 countMio（未出5星抽数），需要跨所有组计算
  // 先收集所有记录并排序
  const allRecords = []
  Object.keys(grouped).forEach(key => {
    const group = grouped[key]
    group.forEach((item, idx) => {
      allRecords.push({
        item,
        groupIndex: idx,
        key
      })
    })
  })

  // 按时间排序（用于计算日期范围）
  allRecords.sort((a, b) => new Date(a.item.time) - new Date(b.item.time))

  // 计算日期范围
  allRecords.forEach(({ item }) => {
    const timestamp = new Date(item.time).getTime()
    if (!dateMin || timestamp < dateMin) dateMin = timestamp
    if (!dateMax || timestamp > dateMax) dateMax = timestamp
  })

  // 分别处理每个组（每个祈愿类型独立计算 ssrPos 和 pity）
  let globalSsrIndex = 0
  Object.keys(grouped).forEach(key => {
    const group = grouped[key]
    let lastSSR = 0
    let groupMio = 0

    group.forEach((item, index) => {
      const name = item.name
      const type = item.item_type
      const rank = parseInt(item.rank_type)
      const wishType = item.uigf_gacha_type || item.gacha_type

      if (rank === 3) {
        detail.count3++
        groupMio++
        if (isWeapon(type)) {
          detail.count3w++
          itemCount(detail.weapon3, name)
        }
      } else if (rank === 4) {
        detail.count4++
        groupMio++
        if (isWeapon(type)) {
          detail.count4w++
          itemCount(detail.weapon4, name)
        } else if (isCharacter(type)) {
          detail.count4c++
          itemCount(detail.char4, name)
        }
      } else if (rank === 5) {
        globalSsrIndex++
        detail.ssrPos.push([name, index + 1 - lastSSR, item.time, wishType])
        lastSSR = index + 1
        detail.count5++
        groupMio = 0
        if (isWeapon(type)) {
          detail.count5w++
          itemCount(detail.weapon5, name)
        } else if (isCharacter(type)) {
          detail.count5c++
          itemCount(detail.char5, name)
        }
      }
    })
  })

  // 计算未出5星抽数（取当前各组中距离上次5星的最远距离）
  let maxMio = 0
  Object.keys(grouped).forEach(key => {
    const group = grouped[key]
    let lastSSRIndex = -1
    // 找到最后一个5星位置
    for (let i = group.length - 1; i >= 0; i--) {
      if (parseInt(group[i].rank_type) === 5) {
        lastSSRIndex = i
        break
      }
    }
    // 从最后一个5星到现在（或从开头）的抽数
    const mio = lastSSRIndex === -1 ? group.length : group.length - 1 - lastSSRIndex
    if (mio > maxMio) maxMio = mio
  })
  detail.countMio = maxMio

  detail.date = [dateMin, dateMax]
  return detail
}

// 处理桌面版格式的数据
function processDesktopFormat(data) {
  const detailMap = new Map()

  for (let [key, value] of data) {
    const detail = {
      count3: 0, count4: 0, count5: 0,
      count3w: 0, count4w: 0, count5w: 0, count4c: 0, count5c: 0,
      weapon3: new Map(), weapon4: new Map(), weapon5: new Map(),
      char4: new Map(), char5: new Map(),
      date: [null, null],
      ssrPos: [], countMio: 0, total: value.length
    }

    let lastSSR = 0
    let dateMin = null
    let dateMax = null

    value.forEach((item, index) => {
      const [time, name, type, rank, wishType] = item
      const timestamp = new Date(time).getTime()

      if (!dateMin || timestamp < dateMin) dateMin = timestamp
      if (!dateMax || timestamp > dateMax) dateMax = timestamp

      if (rank === 3) {
        detail.count3++
        detail.countMio++
        if (isWeapon(type)) {
          detail.count3w++
          itemCount(detail.weapon3, name)
        }
      } else if (rank === 4) {
        detail.count4++
        detail.countMio++
        if (isWeapon(type)) {
          detail.count4w++
          itemCount(detail.weapon4, name)
        } else if (isCharacter(type)) {
          detail.count4c++
          itemCount(detail.char4, name)
        }
      } else if (rank === 5) {
        detail.ssrPos.push([name, index + 1 - lastSSR, time, wishType])
        lastSSR = index + 1
        detail.count5++
        detail.countMio = 0
        if (isWeapon(type)) {
          detail.count5w++
          itemCount(detail.weapon5, name)
        } else if (isCharacter(type)) {
          detail.count5c++
          itemCount(detail.char5, name)
        }
      }
    })

    detail.date = [dateMin, dateMax]
    if (detail.total) {
      detailMap.set(key, detail)
    }
  }

  return detailMap
}

function isWeapon(type) {
  return type === '武器'
}

function isCharacter(type) {
  return type === '角色'
}

function itemCount(map, name) {
  if (!map.has(name)) {
    map.set(name, 1)
  } else {
    map.set(name, map.get(name) + 1)
  }
}

export default gachaDetail
