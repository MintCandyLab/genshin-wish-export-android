// 计算祈愿详细统计数据
export function gachaDetail(result) {
  const detail = {
    total: 0,
    count5: 0,
    count5c: 0,
    count5w: 0,
    count4: 0,
    count4c: 0,
    count4w: 0,
    count3: 0,
    count3w: 0,
    countMio: 0,
    ssrPos: [],
    date: [null, null]
  }

  let last5Index = -1
  const list = result || []

  list.forEach((item, index) => {
    const rank = parseInt(item.rank_type)
    const time = item.time
    const name = item.name
    const gachaType = item.uigf_gacha_type || item.gacha_type

    // 更新日期范围
    if (!detail.date[0] || time < detail.date[0]) {
      detail.date[0] = time
    }
    if (!detail.date[1] || time > detail.date[1]) {
      detail.date[1] = time
    }

    detail.total++

    if (rank === 5) {
      detail.count5++
      if (gachaType === '301' || gachaType === '302') {
        detail.countMio = 0
      }
      if (item.item_type === '角色') {
        detail.count5c++
      } else {
        detail.count5w++
      }
      const pity = last5Index === -1 ? index + 1 : index - last5Index
      detail.ssrPos.push([name, pity, time, gachaType])
      last5Index = index
    } else if (rank === 4) {
      detail.count4++
      if (item.item_type === '角色') {
        detail.count4c++
      } else {
        detail.count4w++
      }
    } else if (rank === 3) {
      detail.count3++
      detail.count3w++
    }
  })

  // 计算未出5星的抽数
  if (last5Index === -1) {
    detail.countMio = detail.total
  } else {
    detail.countMio = detail.total - last5Index - 1
  }

  return detail
}

export default gachaDetail
