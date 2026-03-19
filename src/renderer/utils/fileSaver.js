// 文件保存工具 - Android 使用 Filesystem API，Web 使用传统下载方式
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

/**
 * 保存文件到设备（Android 使用 Filesystem，Web 使用下载）
 * @param {Blob} blob - 文件数据
 * @param {string} fileName - 文件名
 * @returns {Promise<{success: boolean, error?: string, fileName?: string, method?: string}>}
 */
export const saveFile = async (blob, fileName) => {
  try {
    if (Capacitor.getPlatform() === 'android') {
      // Android 使用 Filesystem API，尝试多个目录
      const base64Data = await blobToBase64(blob)

      // 尝试的目录顺序：优先用户可访问目录
      const directories = [
        { dir: Directory.Documents, name: 'Documents', userVisible: true },
        { dir: Directory.External, name: 'External', userVisible: true },
        { dir: Directory.Cache, name: 'Cache', userVisible: false },
        { dir: Directory.Data, name: 'Data', userVisible: false }
      ]

      let lastError = null

      for (const { dir, name, userVisible } of directories) {
        try {
          console.log(`尝试保存到 ${name} 目录...`)
          console.log(`文件名: ${fileName}`)
          console.log(`数据大小: ${base64Data.length} 字符`)

          const result = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: dir,
            recursive: true  // 允许创建目录
          })

          console.log(`成功保存到 ${name} 目录:`, result.uri)

          // 如果是用户不可见的目录，给出特殊提示
          if (!userVisible) {
            console.log(`${name} 目录是应用私有存储，用户无法直接访问`)
          }

          return {
            success: true,
            fileName: result.uri,
            method: 'filesystem',
            directory: name,
            userVisible: userVisible,
            fullPath: result.uri  // 保存完整URI路径
          }
        } catch (error) {
          console.warn(`${name} 目录保存失败:`, error)
          console.warn(`错误详情:`, {
            message: error.message,
            code: error.code,
            name: error.name
          })
          lastError = error

          // 如果是权限错误，跳过其他目录
          if (error.message && error.message.includes('PERMISSION_DENIED')) {
            break
          }
        }
      }

      // 如果所有目录都失败了，使用分享功能
      console.log('所有目录都失败，尝试分享功能...')
      try {
        await shareFile(blob, fileName)
        return {
          success: true,
          method: 'share',
          message: '文件已通过分享功能导出'
        }
      } catch (shareError) {
        console.error('分享功能也失败:', shareError)
        throw lastError || shareError
      }
    } else {
      // Web 平台使用传统下载
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      link.style.display = 'none'

      document.body.appendChild(link)
      link.click()

      // 延迟清理
      setTimeout(() => {
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }, 100)

      return { success: true, method: 'download' }
    }
  } catch (error) {
    console.error('Save file failed:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 使用文件选择器保存文件（主要用于 Web 平台）
 * @param {Blob} blob - 文件数据
 * @param {string} fileName - 文件名
 * @returns {Promise<{success: boolean, error?: string, fileName?: string, method?: string}>}
 */
export const saveFileWithPicker = async (blob, fileName) => {
  try {
    // 方法 1: 使用 File System Access API (如果支持)
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: 'Excel 文件',
              accept: {
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
              }
            }
          ]
        })

        const writable = await handle.createWritable()
        await writable.write(blob)
        await writable.close()

        return { success: true, method: 'picker' }
      } catch (err) {
        // 用户取消或其他错误，继续尝试其他方法
        if (err.name !== 'AbortError') {
          console.log('File System Access API failed:', err)
        }
      }
    }

    // 方法 2: 使用传统下载
    return await downloadFile(blob, fileName)
  } catch (error) {
    console.error('Save file with picker failed:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 下载文件（传统方式）
 * @param {Blob} blob - 文件数据
 * @param {string} fileName - 文件名
 * @returns {Promise<{success: boolean, error?: string, method?: string}>}
 */
export const downloadFile = async (blob, fileName) => {
  try {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.style.display = 'none'

    document.body.appendChild(link)
    link.click()

    // 延迟清理
    setTimeout(() => {
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }, 100)

    return { success: true, method: 'download' }
  } catch (error) {
    console.error('Download file failed:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 分享文件（使用系统分享功能）
 * @param {Blob} blob - 文件数据
 * @param {string} fileName - 文件名
 * @returns {Promise<{success: boolean, error?: string, method?: string}>}
 */
export const shareFile = async (blob, fileName) => {
  try {
    if (Capacitor.getPlatform() === 'android') {
      // 尝试多种分享方式

      // 方法1: 使用Cache目录保存临时文件
      try {
        const base64Data = await blobToBase64(blob)
        const tempFileName = `temp_${Date.now()}_${fileName}`

        const writeResult = await Filesystem.writeFile({
          path: tempFileName,
          data: base64Data,
          directory: Directory.Cache,
          recursive: true
        })

        await Share.share({
          title: '原神抽卡记录',
          text: '分享 Excel 文件',
          url: writeResult.uri,
          dialogTitle: '分享抽卡记录'
        })

        // 清理临时文件
        try {
          await Filesystem.deleteFile({
            path: tempFileName,
            directory: Directory.Cache
          })
        } catch (cleanupError) {
          console.warn('Failed to cleanup temp file:', cleanupError)
        }

        return { success: true, method: 'share' }
      } catch (cacheError) {
        console.warn('Cache directory share failed, trying alternative method:', cacheError)
      }

      // 方法2: 如果Cache目录失败，使用data URL（可能有大小限制）
      try {
        const dataUrl = await blobToDataUrl(blob)
        await Share.share({
          title: '原神抽卡记录',
          text: `分享 Excel 文件: ${fileName}`,
          url: dataUrl,
          dialogTitle: '分享抽卡记录'
        })
        return { success: true, method: 'share-dataurl' }
      } catch (dataUrlError) {
        console.warn('Data URL share failed:', dataUrlError)
        throw dataUrlError
      }
    } else {
      // Web 平台降级到下载
      return await downloadFile(blob, fileName)
    }
  } catch (error) {
    console.error('Share file failed:', error)
    return { success: false, error: error.message }
  }
}

// 辅助函数：将 Blob 转换为 Base64
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result.split(',')[1] // 移除 data:xxx;base64,前缀
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// 辅助函数：将 Blob 转换为 Data URL
const blobToDataUrl = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(reader.result)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export default {
  saveFile,
  saveFileWithPicker,
  downloadFile,
  shareFile
}
