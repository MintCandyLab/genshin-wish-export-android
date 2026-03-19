// 文件分享工具 - 使用 Web Share API

/**
 * 分享文件 - 使用浏览器原生 Web Share API
 * @param {string} fileName - 文件名
 * @param {Blob} blob - 文件数据
 * @returns {Promise<{success: boolean, cancelled?: boolean, error?: string}>}
 */
export const shareFile = async (fileName, blob) => {
  try {
    // 检查浏览器是否支持 Web Share API 和文件分享
    if (!navigator.share) {
      return {
        success: false,
        error: '您的浏览器不支持文件分享功能。请使用 Chrome 或 Safari 浏览器。'
      }
    }

    // 创建 File 对象
    const file = new File([blob], fileName, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })

    // 检查是否可以分享文件
    if (navigator.canShare && !navigator.canShare({ files: [file] })) {
      return {
        success: false,
        error: '您的设备不支持分享此类型的文件。请尝试截图保存。'
      }
    }

    // 调用系统分享
    await navigator.share({
      files: [file],
      title: '原神抽卡记录',
      text: '这是我的原神抽卡记录导出文件'
    })

    return { success: true }
  } catch (error) {
    console.error('Share failed:', error)

    // 用户取消分享
    if (error.name === 'AbortError') {
      return { success: true, cancelled: true }
    }

    return {
      success: false,
      error: error.message || '分享失败'
    }
  }
}

/**
 * 显示分享失败的提示
 * @param {string} fileName - 文件名
 */
export const showShareFallback = (fileName) => {
  const { ElMessageBox } = require('element-plus')

  ElMessageBox.alert(
    '文件已生成，但无法直接分享。\n\n' +
    '请使用以下方法保存：\n\n' +
    '方法 1：截图保存\n' +
    '在抽卡记录页面直接截图保存\n\n' +
    '方法 2：导出 JSON 数据\n' +
    '在电脑上使用原版的「原神抽卡导出」工具\n\n' +
    '提示：\n' +
    '安卓系统对 Excel 文件分享限制较多，' +
    '建议使用截图方式保存。',
    '分享功能受限',
    {
      confirmButtonText: '知道了',
      type: 'warning'
    }
  )
}

export default {
  shareFile,
  showShareFallback
}
