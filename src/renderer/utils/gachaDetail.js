// 计算祈愿详细统计数据 - 与桌面版逻辑完全一致
// 数据格式：Array<{time, name, item_type, rank_type, gacha_type, uigf_gacha_type}>

const itemCount = (map, name) => {
  if (!map.has(name)) {
    map.set(name, 1)
  } else {
    map.set(name, map.get(name) + 1)
  }
}

const isWeapon = (type) => type === '武器'
const isCharacter = (type) => type === '角色'

// 将Android格式数据转换为与桌面版一致的结构，然后计算统计
// 支持两种输入格式：Object { '301': [...] } 或 Map<key, logs[]>
export function gachaDetail(groupedData) {
  const detailMap = new Map()

  // 统一处理两种输入格式
  const entries = groupedData instanceof Map ? [...groupedData.entries()] : Object.entries(groupedData)

  for (const [key, items] of entries) {
    if (!items || items.length === 0) continue

    // 将Android格式转换为桌面版格式 [time, name, type, rank, wishType, id]
    // 然后计算统计
    const detail = calculateDetail(items, key)
    if (detail && detail.total > 0) {
      detailMap.set(key, detail)
    }
  }

  return detailMap
}

// 计算单个祈愿类型的详细统计 - 与桌面版 gachaDetail 函数逻辑一致
function calculateDetail(items, key) {
  const detail = {
    count3: 0, count4: 0, count5: 0,
    count3w: 0, count4w: 0, count5w: 0, count4c: 0, count5c: 0,
    weapon3: new Map(), weapon4: new Map(), weapon5: new Map(),
    char4: new Map(), char5: new Map(),
    date: [null, null],
    ssrPos: [], countMio: 0, total: items.length
  }

  let lastSSR = 0
  let dateMin = null
  let dateMax = null

  // 确保数据按时间顺序排序（从旧到新）
  const sortedItems = [...items].sort((a, b) => new Date(a.time) - new Date(b.time))

  sortedItems.forEach((item, index) => {
    const time = item.time
    const name = item.name
    const type = item.item_type
    const rank = parseInt(item.rank_type)
    const wishType = item.uigf_gacha_type || item.gacha_type

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
  return detail
}

export default gachaDetail
