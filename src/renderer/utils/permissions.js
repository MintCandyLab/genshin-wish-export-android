// Android 权限管理
import { Capacitor } from '@capacitor/core'
import { Dialog } from '@capacitor/dialog'
import { Filesystem } from '@capacitor/filesystem'

// 检查是否需要请求存储权限
export const needStoragePermission = () => {
  return Capacitor.getPlatform() === 'android'
}

// 测试文件系统访问权限（Android 10+ 兼容性处理）
export const testFileSystemAccess = async () => {
  try {
    // 在不同目录尝试测试
    const testDirs = ['DOCUMENTS', 'DATA', 'CACHE']
    let lastError = null

    for (const dir of testDirs) {
      try {
        const testFileName = `test_permission_${Date.now()}.txt`
        await Filesystem.writeFile({
          path: testFileName,
          data: 'test',
          directory: dir,
          recursive: true
        })
        // 删除测试文件
        await Filesystem.deleteFile({
          path: testFileName,
          directory: dir
        })
        return { granted: true, testedDir: dir }
      } catch (error) {
        console.warn(`File system access test failed for ${dir}:`, error)
        lastError = error
      }
    }

    // 如果所有目录都失败，可能是权限问题
    console.error('All file system access tests failed:', lastError)
    return { granted: false, error: lastError?.message }
  } catch (error) {
    console.error('File system access test failed:', error)
    return { granted: false, error: error.message }
  }
}

// 请求存储权限
export const requestStoragePermission = async () => {
  if (Capacitor.getPlatform() !== 'android') {
    return { granted: true }
  }

  try {
    // 首先测试文件系统访问
    const testResult = await testFileSystemAccess()
    if (testResult.granted) {
      return { granted: true }
    }

    // 如果测试失败，说明需要权限
    // 在 Android 13+ (API 33+)，使用新的媒体权限
    // 在 Android 11-12 (API 30-32)，使用 MANAGE_EXTERNAL_STORAGE 或分区存储
    // 在 Android 10 及以下，使用传统存储权限

    // 由于 Capacitor 的 Filesystem 插件会自动处理权限
    // 我们只需要提示用户授予权限
    return {
      granted: false,
      needPermission: true,
      message: '需要存储权限才能导出 Excel 文件'
    }
  } catch (error) {
    console.error('Permission request error:', error)
    return { granted: false, error: error.message }
  }
}

// 显示权限说明对话框
export const showPermissionExplanation = async () => {
  const { value } = await Dialog.confirm({
    title: '需要存储权限',
    message: '导出 Excel 文件需要访问设备存储空间。请在系统设置中授予存储权限，或者使用"分享"功能导出数据。',
    okButtonTitle: '我知道了',
    cancelButtonTitle: '取消'
  })
  return value
}

// 显示权限被拒绝的提示
export const showPermissionDenied = async () => {
  await Dialog.alert({
    title: '权限不足',
    message: '无法直接保存文件到存储。您可以：\n\n1. 前往系统设置授予存储权限\n2. 使用"分享"功能导出数据\n\n建议方法：点击导出后选择"分享"，然后通过邮件、QQ、微信等方式发送给自己。',
    buttonTitle: '确定'
  })
}

// 检查并请求权限的完整流程（Android 10+ 兼容性处理）
export const checkAndRequestPermission = async () => {
  // 非 Android 平台直接通过
  if (Capacitor.getPlatform() !== 'android') {
    return { granted: true }
  }

  // 获取Android版本
  const androidVersion = getAndroidVersion()
  console.log('Android version detected:', androidVersion)

  // 首先测试文件系统访问
  const testResult = await testFileSystemAccess()
  if (testResult.granted) {
    console.log('File system access granted, tested directory:', testResult.testedDir)
    return { granted: true }
  }

  // Android 10+ 有分区存储限制，但我们仍然允许尝试导出
  // 因为我们的保存逻辑会自动尝试多个目录和分享功能
  if (androidVersion >= 10) {
    console.log('Android 10+ detected, allowing export attempt despite permission test failure')
    return { granted: true, android10Plus: true }
  }

  // 对于Android 9及以下，仍然显示权限说明
  const userConfirmed = await showPermissionExplanation()
  if (!userConfirmed) {
    return { granted: false, cancelled: true }
  }

  // 再次测试（用户可能去设置了权限）
  const secondTest = await testFileSystemAccess()
  if (!secondTest.granted) {
    await showPermissionDenied()
  }

  return { granted: secondTest.granted }
}

// 获取Android版本
const getAndroidVersion = () => {
  try {
    const userAgent = navigator.userAgent
    const androidMatch = userAgent.match(/Android (\d+)/)
    return androidMatch ? parseInt(androidMatch[1], 10) : 0
  } catch (error) {
    console.warn('Failed to detect Android version:', error)
    return 0
  }
}

export default {
  needStoragePermission,
  requestStoragePermission,
  testFileSystemAccess,
  showPermissionExplanation,
  showPermissionDenied,
  checkAndRequestPermission
}
