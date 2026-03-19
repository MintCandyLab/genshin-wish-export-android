/**
 * Capacitor 存储适配层
 * 用于替代原 Electron 版本的 fs 操作
 */

import { Preferences } from '@capacitor/preferences'
import { Filesystem, Directory } from '@capacitor/filesystem'

const Storage = {
  /**
   * 保存数据到 Preferences（键值对）
   * @param {string} key - 键名
   * @param {any} value - 值（会被 JSON.stringify）
   */
  async set(key, value) {
    try {
      await Preferences.set({
        key,
        value: JSON.stringify(value)
      })
      return true
    } catch (error) {
      console.error('Storage.set error:', error)
      return false
    }
  },

  /**
   * 从 Preferences 获取数据
   * @param {string} key - 键名
   * @param {any} defaultValue - 默认值
   * @returns {any} 解析后的值
   */
  async get(key, defaultValue = null) {
    try {
      const { value } = await Preferences.get({ key })
      if (value === null) return defaultValue
      return JSON.parse(value)
    } catch (error) {
      console.error('Storage.get error:', error)
      return defaultValue
    }
  },

  /**
   * 从 Preferences 删除数据
   * @param {string} key - 键名
   */
  async remove(key) {
    try {
      await Preferences.remove({ key })
      return true
    } catch (error) {
      console.error('Storage.remove error:', error)
      return false
    }
  },

  /**
   * 清空所有 Preferences 数据
   */
  async clear() {
    try {
      await Preferences.clear()
      return true
    } catch (error) {
      console.error('Storage.clear error:', error)
      return false
    }
  },

  /**
   * 保存文件到设备（如 Excel 文件），按目录优先级尝试保存
   * @param {string} fileName - 文件名
   * @param {Blob|ArrayBuffer} data - 文件数据
   * @param {string} preferredDirectory - 首选目录类型（将被忽略，使用优先级逻辑）
   */
  async saveFile(fileName, data, preferredDirectory = 'Documents') {
    try {
      const dirMap = {
        'Documents': Directory.Documents,
        'External': Directory.External,
        'Cache': Directory.Cache,
        'Data': Directory.Data
      }

      // 目录优先级：Documents > External > Cache > Data
      const directoryPriority = ['Documents', 'External', 'Cache', 'Data']

      let base64Data
      if (data instanceof Blob) {
        base64Data = await this.blobToBase64(data)
      } else if (data instanceof ArrayBuffer) {
        base64Data = this.arrayBufferToBase64(data)
      } else {
        base64Data = data
      }

      // 按优先级尝试保存
      for (const dirName of directoryPriority) {
        try {
          const result = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: dirMap[dirName],
            recursive: true
          })

          // 获取目录路径信息
          let directoryPath = ''
          switch (dirName) {
            case 'Documents':
              directoryPath = 'Documents（文档文件夹）'
              break
            case 'External':
              directoryPath = 'External（外部存储）'
              break
            case 'Cache':
              directoryPath = 'Cache（临时存储）'
              break
            case 'Data':
              directoryPath = 'Data（应用私有存储）'
              break
          }

          return {
            success: true,
            uri: result.uri,
            path: fileName,
            directory: dirName,
            directoryPath: directoryPath
          }
        } catch (error) {
          console.warn(`保存到 ${dirName} 目录失败:`, error.message)
          // 继续尝试下一个目录
          continue
        }
      }

      // 如果所有目录都失败了
      throw new Error('所有目录都无法保存文件')

    } catch (error) {
      console.error('Storage.saveFile error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  /**
   * 读取文件
   * @param {string} fileName - 文件名
   * @param {string} directory - 目录类型
   */
  async readFile(fileName, directory = 'Documents') {
    try {
      const dirMap = {
        'Documents': Directory.Documents,
        'Downloads': Directory.Downloads,
        'Data': Directory.Data,
        'Cache': Directory.Cache
      }

      const result = await Filesystem.readFile({
        path: fileName,
        directory: dirMap[directory] || Directory.Documents
      })

      return {
        success: true,
        data: result.data
      }
    } catch (error) {
      console.error('Storage.readFile error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  /**
   * 检查文件是否存在
   * @param {string} fileName - 文件名
   * @param {string} directory - 目录类型
   */
  async fileExists(fileName, directory = 'Documents') {
    try {
      await this.readFile(fileName, directory)
      return true
    } catch {
      return false
    }
  },

  // 辅助方法：Blob 转 Base64
  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  },

  // 辅助方法：ArrayBuffer 转 Base64
  arrayBufferToBase64(buffer) {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const len = bytes.byteLength
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }
}

export default Storage
