// ===== Google Sheets Sync via Apps Script =====
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzmpNHiaLUNLdq_44OQkvn_nl0LZgZpvUHw_EkNCURkOeFTXvuaWQ-aLg2k5Ja-Y0l0/exec';

// ===== Write to Google Sheets (using GET to avoid CORS) =====
async function writeToSheet(action, sheet, payload, rowIndex) {
    try {
        const params = new URLSearchParams({
            action: action,
            sheet: sheet,
            payload: JSON.stringify(payload || {}),
        });
        if (rowIndex !== undefined) params.append('rowIndex', rowIndex);

        const url = APPS_SCRIPT_URL + '?' + params.toString();
        const response = await fetch(url, { redirect: 'follow' });
        const text = await response.text();
        
        let result;
        try {
            result = JSON.parse(text);
        } catch(e) {
            return { success: true };
        }
        
        if (!result.success) {
            console.error('Write to sheet failed:', result.error);
        }
        return result;
    } catch (err) {
        console.error('Write to sheet error:', err);
        return { success: false, error: err.message };
    }
}

// ===== Upload ALL local data to Google Sheets =====
async function uploadToGoogleSheets() {
    const statusEl = document.getElementById('sync-status');
    if (statusEl) {
        statusEl.textContent = '上傳中...';
        statusEl.className = 'sync-status syncing';
    }

    try {
        // Use a form submission approach to avoid CORS issues with POST
        const payload = {
            action: 'uploadAll',
            payload: JSON.stringify(appData)
        };

        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            redirect: 'follow',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'text/plain'
            }
        });
        
        const text = await response.text();
        let result;
        try {
            result = JSON.parse(text);
        } catch(e) {
            result = { success: true };
        }

        if (statusEl) {
            statusEl.textContent = '已上傳';
            statusEl.className = 'sync-status online';
        }
        showToast('已上傳至 Google 試算表');
    } catch (err) {
        console.error('Upload error:', err);
        if (statusEl) {
            statusEl.textContent = '上傳失敗';
            statusEl.className = 'sync-status offline';
        }
        showToast('上傳失敗: ' + err.message);
    }
}

// ===== Read from Google Sheets via Apps Script =====
async function syncFromGoogleSheets() {
    const statusEl = document.getElementById('sync-status');
    if (statusEl) {
        statusEl.textContent = '同步中...';
        statusEl.className = 'sync-status syncing';
    }

    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'GET',
            redirect: 'follow'
        });
        
        const text = await response.text();
        let result;
        try {
            result = JSON.parse(text);
        } catch (parseErr) {
            throw new Error('回應不是 JSON 格式，可能是 Apps Script 部署問題');
        }

        if (!result.success || !result.data) {
            throw new Error(result.error || 'No data returned');
        }

        const data = result.data;

        // Transform each sheet
        if (data.orders) appData.orders = transformOrders(data.orders);
        if (data.inventory) appData.inventory = transformInventory(data.inventory);
        if (data.reconciliation) appData.reconciliation = transformReconciliation(data.reconciliation);
        if (data.buyers) appData.buyers = transformBuyers(data.buyers);
        if (data.finance) appData.finance = transformFinance(data.finance);
        if (data.monthly) appData.monthly = transformMonthly(data.monthly);
        if (data.templates) appData.templates = transformTemplates(data.templates);

        saveData();
        renderAll();

        if (statusEl) {
            statusEl.textContent = '已同步';
            statusEl.className = 'sync-status online';
        }
        showToast('已從 Google 試算表同步最新資料');
    } catch (err) {
        console.error('Google Sheets sync error:', err);
        if (statusEl) {
            statusEl.textContent = '同步失敗';
            statusEl.className = 'sync-status offline';
        }
        showToast('同步失敗: ' + err.message);
    }
}

// ===== Transform functions (from 2D arrays) =====
function parseNum(val) {
    if (val === null || val === undefined || val === '' || val === '#N/A') return 0;
    if (typeof val === 'number') return val;
    return parseFloat(String(val).replace(/,/g, '')) || 0;
}

function transformOrders(rows) {
    return rows.slice(1).filter(r => r[0] && r[0] !== '').map(r => ({
        groupId: r[0] || '',
        orderId: r[1] || '',
        platform: r[2] || '',
        buyer: r[3] || '',
        product: r[4] || '',
        qty: parseNum(r[5]) || 1,
        packaging: r[6] === true || r[6] === 'TRUE',
        cost: parseNum(r[7]),
        fee: parseNum(r[8]),
        deposit: parseNum(r[9]),
        balance: parseNum(r[10]),
        total: parseNum(r[11]),
        payment: r[12] || '',
        payStatus: r[13] || '',
        shipStatus: r[14] || '',
        date: formatDate(r[15]),
        note: r[16] || ''
    })).filter(o => o.orderId);
}

function transformInventory(rows) {
    return rows.slice(1).filter(r => r[0] && r[0] !== '').map(r => ({
        id: r[0] || '',
        name: r[1] || '',
        cost: parseNum(r[2]),
        demand: parseNum(r[3]),
        purchased: parseNum(r[4]),
        returned: parseNum(r[5]),
        pending: parseNum(r[6]),
        remaining: parseNum(r[7]),
        note: r[8] || ''
    }));
}

function transformReconciliation(rows) {
    return rows.slice(1).filter(r => r[0] && r[0] !== '').map(r => ({
        orderId: r[0] || '',
        name: r[1] || '',
        account: r[2] || '',
        firstPay: parseNum(r[3]),
        secondPay: parseNum(r[4]),
        shouldPay: parseNum(r[5]),
        convenience: parseNum(r[6]),
        totalPaid: parseNum(r[7]),
        totalCost: parseNum(r[8]),
        refund: parseNum(r[9]),
        profit: parseNum(r[10]),
        date: formatDate(r[11]),
        status: (r[12] || '').toString().trim(),
        note: r[13] || ''
    }));
}

function transformBuyers(rows) {
    return rows.slice(1).filter(r => r[0] && r[0] !== '').map(r => ({
        name: r[0] || '',
        convName: r[1] || '',
        platform: r[2] || '',
        level: r[3] || '一般',
        orders: parseNum(r[4]),
        totalSpent: parseNum(r[5]),
        lastBuy: formatDate(r[6]),
        note: r[7] || ''
    }));
}

function transformFinance(rows) {
    return rows.slice(1).filter(r => r[0] && r[1] && r[0] !== '').map(r => ({
        date: formatDate(r[0]),
        item: r[1] || '',
        expense: parseNum(r[2]),
        income: parseNum(r[3]),
        type: r[4] || '支出',
        handler: r[5] || '',
        verified: r[6] === true || r[6] === 'TRUE',
        note: r[7] || ''
    }));
}

function transformMonthly(rows) {
    return rows.slice(1).filter(r => r[0] && r[0] !== '').map(r => ({
        year: parseNum(r[0]),
        month: r[1] || '',
        income: parseNum(r[2]),
        expense: parseNum(r[3]),
        status: r[4] || '',
        approver: r[5] || '',
        note: r[6] || '',
        profit: parseNum(r[9] || r[7] || 0)
    }));
}

function transformTemplates(rows) {
    return rows.slice(1).filter(r => r[0] && r[0] !== '').map(r => ({
        title: r[0] || '',
        content: (r[1] || '').toString().replace(/\\n/g, '\n')
    }));
}

// Format date values from Google Sheets
function formatDate(val) {
    if (!val) return '';
    if (typeof val === 'string') {
        // Convert ISO format to YYYY/M/D
        if (val.includes('T')) {
            const d = new Date(val);
            if (!isNaN(d.getTime())) {
                return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
            }
        }
        return val;
    }
    try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return String(val);
        return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    } catch {
        return String(val);
    }
}

// Auto sync on page load and every 5 minutes
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        syncFromGoogleSheets().catch(err => {
            console.error('Initial sync failed:', err);
        });
    }, 1500);
    setInterval(() => {
        syncFromGoogleSheets().catch(err => {
            console.error('Auto sync failed:', err);
        });
    }, 5 * 60 * 1000);
});
