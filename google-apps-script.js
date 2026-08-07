// ====== Google Apps Script v2 ======
// 貼到 Google 試算表的 Apps Script 編輯器中
// 擴充功能 → Apps Script → 貼上 → 部署 → 管理部署作業 → 編輯 → 版本選「新版本」→ 部署

const SHEET_NAMES = {
  orders: '訂單資料',
  inventory: '商品庫存',
  reconciliation: '對帳表',
  buyers: '買家資料',
  finance: '整體收支表',
  monthly: '每月報表',
  templates: '客服用語'
};

// === GET: 讀取所有資料 ===
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const result = {};

    for (const [key, name] of Object.entries(SHEET_NAMES)) {
      const ws = ss.getSheetByName(name);
      if (ws) {
        const data = ws.getDataRange().getValues();
        result[key] = data;
      }
    }

    return ContentService.createTextOutput(JSON.stringify({success: true, data: result}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({success: false, error: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// === POST: 新增/編輯/刪除 ===
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const sheet = data.sheet;
    const payload = data.payload;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ws = ss.getSheetByName(SHEET_NAMES[sheet]);

    if (!ws) {
      return ContentService.createTextOutput(JSON.stringify({success: false, error: 'Sheet not found'}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    let result = {};

    if (action === 'add') {
      result = addRow(ws, sheet, payload);
    } else if (action === 'update') {
      result = updateRow(ws, sheet, payload, data.rowIndex);
    } else if (action === 'delete') {
      result = deleteRow(ws, data.rowIndex);
    }

    return ContentService.createTextOutput(JSON.stringify({success: true, result}))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({success: false, error: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function addRow(ws, sheet, payload) {
  const row = buildRow(sheet, payload);
  ws.appendRow(row);
  return {added: true, row: ws.getLastRow()};
}

function updateRow(ws, sheet, payload, rowIndex) {
  const row = buildRow(sheet, payload);
  const actualRow = rowIndex + 2;
  for (let i = 0; i < row.length; i++) {
    ws.getRange(actualRow, i + 1).setValue(row[i]);
  }
  return {updated: true, row: actualRow};
}

function deleteRow(ws, rowIndex) {
  const actualRow = rowIndex + 2;
  ws.deleteRow(actualRow);
  return {deleted: true};
}

function buildRow(sheet, p) {
  switch(sheet) {
    case 'orders':
      return [p.groupId, p.orderId, p.platform, p.buyer, p.product, p.qty, p.packaging, p.cost, p.fee, p.deposit, p.balance, p.total, p.payment, p.payStatus, p.shipStatus, p.date, p.note];
    case 'inventory':
      return [p.id, p.name, p.cost, p.demand, p.purchased, p.returned, p.pending, p.remaining, p.note];
    case 'reconciliation':
      return [p.orderId, p.name, p.account, p.firstPay, p.secondPay, p.shouldPay, p.convenience, p.totalPaid, p.totalCost, p.refund, p.profit, p.date, p.status, p.note];
    case 'buyers':
      return [p.name, p.convName, p.platform, p.level, p.orders, p.totalSpent, p.lastBuy, p.note];
    case 'finance':
      return [p.date, p.item, p.expense, p.income, p.type, p.handler, p.verified, p.note];
    case 'monthly':
      return [p.year, p.month, p.income, p.expense, p.status, p.approver, p.note, '', '', p.profit];
    case 'templates':
      return [p.title, p.content];
    default:
      return [];
  }
}
