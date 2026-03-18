const ExcelJS = require('./module/exceljs.min.js')
const getData = require('./getData').getData
const { app, ipcMain, dialog } = require('electron')
const fs = require('fs-extra')
const path = require('path')
const i18n = require('./i18n')
const cloneDeep  = require('lodash-es/cloneDeep').default

function pad(num) {
  return `${num}`.padStart(2, "0");
}

function getTimeString() {
  const d = new Date();
  const YYYY = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const DD = pad(d.getDate());
  const HH = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${YYYY}${MM}${DD}_${HH}${mm}${ss}`;
}

const start = async () => {
  const { header, customFont, filePrefix, fileType, wish2 } = i18n.excel
  const { dataMap, current } = await getData()
  const data = dataMap.get(current)

  // 颜色配置
  const sheetColors = {
    '角色活动祈愿': 'ffffff00',   // 黄色
    '武器活动祈愿': 'ff8ab8e6',   // 浅蓝色（原ff6c9bdc调浅）
    '常驻祈愿': 'ffffa500',       // 橙色
    '集录祈愿': 'ffadd8e6',       // 浅蓝
    '新手祈愿': 'ff90ee90'        // 浅绿
  };
  const totalHeaderColor = 'ffe6e6fa';
  const rankColor = {
    3: "ff8e8e8e",
    4: "ffa256e1",
    5: "ffbd6932",
  };

  // 收集所有行数据用于总表
  const allRows = [];
  // 保存原始工作表的数据，稍后创建
  const originalSheetsData = [];

  // 定义列宽
  let width = [24, 14, 8, 8, 8, 8, 8];
  if (!data.lang.includes('zh-')) {
    width = [24, 32, 16, 12, 12, 12, 8];
  }

  const excelKeys = ['time', 'name', 'type', 'rank', 'total', 'pity', 'remark'];

  // 第一步：遍历所有祈愿池，处理数据并收集 allRows 和原始工作表数据
  for (let [key, value] of data.result) {
    const name = data.typeMap.get(key);
    const logs = cloneDeep(value);
    let total = 0;
    let pity = 0;

    for (let log of logs) {
      total += 1;
      pity += 1;
      let gachaType = log[4];
      log[4] = total;
      log[5] = pity;
      if (log[3] === 5) {
        pity = 0;
      }
      if (key === '301' && gachaType === '400') {
        log.push(wish2);
      }

      // 收集总表行（确保7个字段）
      const rowForTotal = [];
      for (let idx = 0; idx < excelKeys.length; idx++) {
        rowForTotal.push(log[idx] !== undefined ? log[idx] : '');
      }
      allRows.push({
        row: rowForTotal,
        sheetName: name,
        rank: log[3],
        time: new Date(log[0])
      });
    }

    // 保存原始工作表所需数据
    originalSheetsData.push({
      name,
      logs,
      key
    });
  }

  // 第二步：创建工作簿并添加两个总表
  const workbook = new ExcelJS.Workbook();

  // 按时间排序所有行
  allRows.sort((a, b) => a.time - b.time);

  // 准备总表共用的表头和列宽
  const headerValues = Object.values(header);
  const wishTypeHeader = data.lang.includes('zh-') ? '祈愿类型' : 'Wish Type';
  const totalHeaders = [...headerValues, wishTypeHeader];
  const totalWidth = [...width, 12];
  const colLetters = Array.from({ length: totalHeaders.length }, (_, i) => String.fromCharCode(65 + i));

  // 创建第一个总表（不含三星）
  const filteredRows = allRows.filter(item => Number(item.rank) !== 3);
  const totalSheet = workbook.addWorksheet('总表', { views: [{ state: 'frozen', ySplit: 1 }] });
  totalSheet.columns = totalHeaders.map((text, index) => ({
    header: text,
    key: `col${index}`,
    width: totalWidth[index]
  }));

  // 表头样式
  colLetters.forEach(colLetter => {
    const cell = totalSheet.getCell(`${colLetter}1`);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: totalHeaderColor }
    };
    cell.font = {
      name: customFont,
      color: { argb: 'ff757575' },
      bold: true
    };
  });

  // 写入数据行（不含三星）
  filteredRows.forEach(item => {
    const rowData = [...item.row, item.sheetName];
    const row = totalSheet.addRow(rowData);
    const rankNum = Number(item.rank);
    const rankColorCode = rankColor[rankNum] || 'ff000000';
    const bgColor = sheetColors[item.sheetName] || 'ffebebeb';

    for (let i = 1; i <= row.cellCount; i++) {
      const cell = row.getCell(i);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgColor }
      };
      cell.font = {
        name: customFont,
        color: { argb: rankColorCode },
        bold: rankNum !== 3
      };
    }
  });

  // 添加统计行（不含三星总表底部）
  addStatisticsRows(totalSheet, allRows, sheetColors, customFont, totalHeaders.length);

  // 创建第二个总表（含三星）
  const totalSheetWith3Star = workbook.addWorksheet('总表（含3星）', { views: [{ state: 'frozen', ySplit: 1 }] });
  totalSheetWith3Star.columns = totalHeaders.map((text, index) => ({
    header: text,
    key: `col${index}`,
    width: totalWidth[index]
  }));

  // 表头样式
  colLetters.forEach(colLetter => {
    const cell = totalSheetWith3Star.getCell(`${colLetter}1`);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: totalHeaderColor }
    };
    cell.font = {
      name: customFont,
      color: { argb: 'ff757575' },
      bold: true
    };
  });

  // 写入数据行（含三星）
  allRows.forEach(item => {
    const rowData = [...item.row, item.sheetName];
    const row = totalSheetWith3Star.addRow(rowData);
    const rankNum = Number(item.rank);
    const rankColorCode = rankColor[rankNum] || 'ff000000';
    const bgColor = sheetColors[item.sheetName] || 'ffebebeb';

    for (let i = 1; i <= row.cellCount; i++) {
      const cell = row.getCell(i);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgColor }
      };
      cell.font = {
        name: customFont,
        color: { argb: rankColorCode },
        bold: rankNum !== 3
      };
    }
  });

  // 添加统计行（含三星总表底部）
  addStatisticsRows(totalSheetWith3Star, allRows, sheetColors, customFont, totalHeaders.length);

  // 第三步：添加原始工作表（依次排在两个总表之后）
  for (let sheetData of originalSheetsData) {
    const { name, logs, key } = sheetData;
    const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });

    sheet.columns = excelKeys.map((key, index) => ({
      header: header[key],
      key,
      width: width[index]
    }));

    sheet.addRows(logs);

    // 设置表头样式
    ;(["A", "B", "C", "D","E","F", "G"]).forEach((v) => {
      sheet.getCell(`${v}1`).border = {
        top: {style:'thin', color: {argb:'ffc4c2bf'}},
        left: {style:'thin', color: {argb:'ffc4c2bf'}},
        bottom: {style:'thin', color: {argb:'ffc4c2bf'}},
        right: {style:'thin', color: {argb:'ffc4c2bf'}}
      };
      sheet.getCell(`${v}1`).fill = {
        type: 'pattern',
        pattern:'solid',
        fgColor:{argb:'ffdbd7d3'},
      };
      sheet.getCell(`${v}1`).font ={
        name: customFont,
        color: { argb: "ff757575" },
        bold : true
      };
    });

    // 设置数据行样式
    logs.forEach((v, i) => {
      ;(["A", "B", "C", "D","E","F", "G"]).forEach((c) => {
        sheet.getCell(`${c}${i + 2}`).border = {
          top: {style:'thin', color: {argb:'ffc4c2bf'}},
          left: {style:'thin', color: {argb:'ffc4c2bf'}},
          bottom: {style:'thin', color: {argb:'ffc4c2bf'}},
          right: {style:'thin', color: {argb:'ffc4c2bf'}}
        };
        sheet.getCell(`${c}${i + 2}`).fill = {
          type: 'pattern',
          pattern:'solid',
          fgColor:{argb: sheetColors[name] || 'ffebebeb'}
        };
        sheet.getCell(`${c}${i + 2}`).font = {
          name: customFont,
          color: { argb: rankColor[v[3]] },
          bold : v[3]!="3"
        };
      });
    });
  }

  // 保存文件
  const buffer = await workbook.xlsx.writeBuffer()
  const filePath = dialog.showSaveDialogSync({
    defaultPath: path.join(app.getPath('downloads'), `${filePrefix}_${getTimeString()}`),
    filters: [
      { name: fileType, extensions: ['xlsx'] }
    ]
  })
  if (filePath) {
    await fs.ensureFile(filePath)
    await fs.writeFile(filePath, buffer)
  }
}

/**
 * 向总表底部添加各祈愿池的保底统计行（合并单元格）
 * 按时间降序、总次数降序取每个祈愿池的最新记录
 */
function addStatisticsRows(sheet, allRows, sheetColors, customFont, totalColumns) {
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
      // 按时间降序，时间相同则按 total 降序（total 越大表示越晚）
      group.sort((a, b) => {
        if (a.time > b.time) return -1;
        if (a.time < b.time) return 1;
        // 时间相同，比较 total
        const totalA = parseInt(a.row[4], 10) || 0;
        const totalB = parseInt(b.row[4], 10) || 0;
        return totalB - totalA; // 降序
      });
      const latest = group[0];
      latestBySheet[sheetName] = {
        pity: latest.row[5], // 保底内
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
      
      // 创建行，所有列先填充空白
      const rowData = new Array(totalColumns).fill('');
      rowData[0] = text; // 第一列放文本
      const row = sheet.addRow(rowData);
      
      // 合并整行所有列
      const startCol = 1;
      const endCol = totalColumns;
      const startCell = sheet.getCell(row.number, startCol);
      const endCell = sheet.getCell(row.number, endCol);
      sheet.mergeCells(startCell.address, endCell.address);
      
      // 设置合并后区域的样式（通过左上角单元格）
      const mergedCell = sheet.getCell(row.number, startCol);
      const bgColor = sheetColors[sheetName] || 'ffebebeb';
      mergedCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgColor }
      };
      mergedCell.font = {
        name: customFont,
        color: { argb: 'ff000000' },
        bold: true
      };
      mergedCell.alignment = { horizontal: 'left', vertical: 'middle' };
    }
  });
}

ipcMain.handle('SAVE_EXCEL', async () => {
  await start()
});