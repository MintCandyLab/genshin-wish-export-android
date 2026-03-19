const XLSX = require('xlsx');
const desktop = XLSX.readFile('./build/桌面端.xlsx');
const android = XLSX.readFile('./build/android端.xlsx');

function findRows(workbook, sheetName, name) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const header = data[0] || [];
  const nameIdx = header.indexOf('名称');
  const totalIdx = header.indexOf('总次数');
  const typeIdx = header.indexOf('类型') !== -1 ? header.indexOf('类型') : header.indexOf('类别');
  return data.slice(1).map((row, idx) => ({
    rowNum: idx + 2,
    name: row[nameIdx],
    total: row[totalIdx],
    type: typeIdx >= 0 ? row[typeIdx] : undefined,
    full: row
  })).filter(r => r.name === name);
}

console.log('桌面端 角色活动祈愿 中 卡齐娜 行:');
console.log(findRows(desktop, '角色活动祈愿', '卡齐娜'));
console.log('Android 角色活动祈愿 中 卡齐娜 行:');
console.log(findRows(android, '角色活动祈愿', '卡齐娜'));
