// ====== Google Apps Script v3 ======
// 全部用 doPost 處理，doGet 讀取
// 部署：擴充功能 → Apps Script → 貼上 → 部署 → 管理部署作業 → 編輯 → 版本選新版本 → 部署

const SHEET_NAMES = {
  orders: '訂單資料',
  inventory: '商品庫存',
  reconciliation: '對帳表',
  buyers: '買家資料',
  finance: '整體收支表',
  monthly: '每月報表',
  templates: '客服用語'
};

function doGet(e) {
  try {
    // Check if this is a write action via GET (to avoid CORS POST issues)
    const action = e.parameter.action;
    
    if (action) {
      // Handle write operations via GET
      const sheet = e.parameter.sheet;
      const payload = JSON.parse(e.parameter.payload || '{}');
      const rowIndex = parseInt(e.parameter.rowIndex);
      
      // Handle uploadAll - replaces entire sheets with app data
      if (action === 'uploadAll') {
        const allData = payload;
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        
        const sheetConfigs = {
          orders: {headers: ['團號','單號','平台','買家','商品','數量','包材','成本','代購費','訂金','尾款','應收','付款方式','收款狀態','出貨狀態','登記日期','備註'], buildFn: function(p){return [p.groupId,p.orderId,p.platform,p.buyer,p.product,p.qty,p.packaging,p.cost,p.fee,p.deposit,p.balance,p.total,p.payment,p.payStatus,p.shipStatus,p.date,p.note];}},
          inventory: {headers: ['商品ID','商品名稱','成本','需求量','已購入','已退貨','待採購','餘量','備註'], buildFn: function(p){return [p.id,p.name,p.cost,p.demand,p.purchased,p.returned,p.pending,p.remaining,p.note];}},
          reconciliation: {headers: ['對應單號','姓名','帳戶末五碼','首匯金額','二補金額','客戶應匯款','留賣貨便','客戶總付款','總成本','退款','總利潤','對帳日期','收支','備註'], buildFn: function(p){return [p.orderId,p.name,p.account,p.firstPay,p.secondPay,p.shouldPay,p.convenience,p.totalPaid,p.totalCost,p.refund,p.profit,p.date,p.status,p.note];}},
          buyers: {headers: ['名稱','賣貨便姓名','平台','等級','訂單數','累積消費','最後購買','備註'], buildFn: function(p){return [p.name,p.convName,p.platform,p.level,p.orders,p.totalSpent,p.lastBuy,p.note];}},
          finance: {headers: ['日期','項目','支出','收入','收支','處理人','核對','備註'], buildFn: function(p){return [p.date,p.item,p.expense,p.income,p.type,p.handler,p.verified,p.note];}},
          templates: {headers: ['項目','內容'], buildFn: function(p){return [p.title,p.content];}}
        };
        
        for (const [key, config] of Object.entries(sheetConfigs)) {
          if (allData[key] && allData[key].length > 0) {
            const ws = ss.getSheetByName(SHEET_NAMES[key]);
            if (ws) {
              // Clear existing data (keep header)
              const lastRow = ws.getLastRow();
              if (lastRow > 1) {
                ws.deleteRows(2, lastRow - 1);
              }
              // Write all rows
              const rows = allData[key].map(config.buildFn);
              if (rows.length > 0) {
                ws.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
              }
            }
          }
        }
        
        return ContentService.createTextOutput(JSON.stringify({success: true, result: {uploaded: true}}))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const ws = ss.getSheetByName(SHEET_NAMES[sheet]);
      
      if (!ws) {
        return ContentService.createTextOutput(JSON.stringify({success: false, error: 'Sheet not found'}))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      let result = {};
      if (action === 'add') {
        const row = buildRow(sheet, payload);
        ws.appendRow(row);
        result = {added: true};
      } else if (action === 'update') {
        const row = buildRow(sheet, payload);
        const actualRow = rowIndex + 2;
        for (let i = 0; i < row.length; i++) {
          ws.getRange(actualRow, i + 1).setValue(row[i]);
        }
        result = {updated: true};
      } else if (action === 'delete') {
        ws.deleteRow(rowIndex + 2);
        result = {deleted: true};
      }
      
      return ContentService.createTextOutput(JSON.stringify({success: true, result}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Default: read all data
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const result = {};
    for (const [key, name] of Object.entries(SHEET_NAMES)) {
      const ws = ss.getSheetByName(name);
      if (ws) {
        result[key] = ws.getDataRange().getValues();
      }
    }
    return ContentService.createTextOutput(JSON.stringify({success: true, data: result}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({success: false, error: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    // Convert POST body to parameter format for doGet
    const fakeEvent = { parameter: {} };
    fakeEvent.parameter.action = body.action;
    if (body.sheet) fakeEvent.parameter.sheet = body.sheet;
    if (body.payload) fakeEvent.parameter.payload = typeof body.payload === 'string' ? body.payload : JSON.stringify(body.payload);
    if (body.rowIndex !== undefined) fakeEvent.parameter.rowIndex = String(body.rowIndex);
    return doGet(fakeEvent);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({success: false, error: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
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
