// ===== Google Sheets Real-time Sync =====
const SHEET_ID = '1X_4W5XL8MfjgjxPUvAKo5zCAU2FqvKdkOHXcPDcBtDI';
const SHEET_GIDS = {
    orders: '248639016',
    inventory: '534453945',
    reconciliation: '2082103423',
    buyers: '90797572',
    finance: '2033073996',
    monthly: '277030301',
    templates: '444617508'
};

const SHEET_BASE_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=`;
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzmpNHiaLUNLdq_44OQkvn_nl0LZgZpvUHw_EkNCURkOeFTXvuaWQ-aLg2k5Ja-Y0l0/exec';

// ===== Write to Google Sheets =====
async function writeToSheet(action, sheet, payload, rowIndex) {
    try {
        const body = { action, sheet, payload };
        if (rowIndex !== undefined) body.rowIndex = rowIndex;

        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(body)
        });
        const result = await response.json();
        if (!result.success) {
            console.error('Write to sheet failed:', result.error);
        }
        return result;
    } catch (err) {
        console.error('Write to sheet error:', err);
        return { success: false, error: err.message };
    }
}

// Parse CSV string into array of arrays
function parseCSV(csv) {
    const rows = [];
    let current = '';
    let inQuotes = false;
    let row = [];

    for (let i = 0; i < csv.length; i++) {
        const char = csv[i];
        if (char === '"') {
            if (inQuotes && csv[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            row.push(current.trim());
            current = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && csv[i + 1] === '\n') i++;
            row.push(current.trim());
            if (row.some(cell => cell !== '')) rows.push(row);
            row = [];
            current = '';
        } else {
            current += char;
        }
    }
    if (current || row.length > 0) {
        row.push(current.trim());
        if (row.some(cell => cell !== '')) rows.push(row);
    }
    return rows;
}

// Remove commas from numbers like "69,935" -> 69935
function parseNum(str) {
    if (!str || str === '#N/A' || str === '#N/A"') return 0;
    // Remove surrounding quotes if any
    str = str.replace(/^"|"$/g, '');
    return parseFloat(str.replace(/,/g, '')) || 0;
}

// Fetch a single sheet as CSV (using Google Sheets publish workaround for CORS)
async function fetchSheet(gid) {
    // Use the gviz endpoint which supports CORS
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            // Fallback to export URL
            const fallbackUrl = SHEET_BASE_URL + gid;
            const fallbackResponse = await fetch(fallbackUrl);
            if (!fallbackResponse.ok) throw new Error(`Failed to fetch sheet gid=${gid}`);
            const text = await fallbackResponse.text();
            return parseCSV(text);
        }
        const text = await response.text();
        return parseCSV(text);
    } catch (err) {
        console.error(`Error fetching sheet gid=${gid}:`, err);
        throw err;
    }
}

// Transform orders sheet rows into app data format
function transformOrders(rows) {
    return rows.slice(1).filter(r => r[0] && r[0] !== '').map(r => ({
        groupId: r[0] || '',
        orderId: r[1] || '',
        platform: r[2] || '',
        buyer: r[3] || '',
        product: r[4] || '',
        qty: parseNum(r[5]) || 1,
        packaging: r[6] === 'TRUE',
        cost: parseNum(r[7]),
        fee: parseNum(r[8]),
        deposit: parseNum(r[9]),
        balance: parseNum(r[10]),
        total: parseNum(r[11]),
        payment: r[12] || '',
        payStatus: r[13] || '',
        shipStatus: r[14] || '',
        date: r[15] || '',
        note: r[16] || ''
    })).filter(o => o.orderId && o.cost !== '#N/A');
}

// Transform inventory sheet
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

// Transform reconciliation sheet
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
        date: r[11] || '',
        status: (r[12] || '').trim(),
        note: r[13] || ''
    }));
}

// Transform buyers sheet
function transformBuyers(rows) {
    return rows.slice(1).filter(r => r[0] && r[0] !== '').map(r => ({
        name: r[0] || '',
        convName: r[1] || '',
        platform: r[2] || '',
        level: r[3] || '一般',
        orders: parseNum(r[4]),
        totalSpent: parseNum(r[5]),
        lastBuy: r[6] || '',
        note: r[7] || ''
    }));
}

// Transform finance sheet
function transformFinance(rows) {
    return rows.slice(1).filter(r => r[0] && r[1] && r[0] !== '').map(r => ({
        date: r[0] || '',
        item: r[1] || '',
        expense: parseNum(r[2]),
        income: parseNum(r[3]),
        type: r[4] || '支出',
        handler: r[5] || '',
        verified: r[6] === 'TRUE',
        note: r[7] || ''
    }));
}

// Transform monthly sheet
function transformMonthly(rows) {
    return rows.slice(1).filter(r => r[0] && r[0] !== '').map(r => ({
        year: parseNum(r[0]),
        month: r[1] || '',
        income: parseNum(r[2]),
        expense: parseNum(r[3]),
        status: r[4] || '',
        approver: r[5] || '',
        note: r[6] || '',
        profit: parseNum(r[9] || r[7] || '0')
    }));
}

// Transform templates sheet
function transformTemplates(rows) {
    return rows.slice(1).filter(r => r[0] && r[0] !== '').map(r => ({
        title: r[0] || '',
        content: (r[1] || '').replace(/\\n/g, '\n')
    }));
}

// Main sync function - fetch all sheets and update app data
async function syncFromGoogleSheets() {
    const statusEl = document.getElementById('sync-status');
    if (statusEl) {
        statusEl.textContent = '同步中...';
        statusEl.className = 'sync-status syncing';
    }

    try {
        const [orders, inventory, reconciliation, buyers, finance, monthly, templates] = await Promise.all([
            fetchSheet(SHEET_GIDS.orders),
            fetchSheet(SHEET_GIDS.inventory),
            fetchSheet(SHEET_GIDS.reconciliation),
            fetchSheet(SHEET_GIDS.buyers),
            fetchSheet(SHEET_GIDS.finance),
            fetchSheet(SHEET_GIDS.monthly),
            fetchSheet(SHEET_GIDS.templates),
        ]);

        appData.orders = transformOrders(orders);
        appData.inventory = transformInventory(inventory);
        appData.reconciliation = transformReconciliation(reconciliation);
        appData.buyers = transformBuyers(buyers);
        appData.finance = transformFinance(finance);
        appData.monthly = transformMonthly(monthly);
        appData.templates = transformTemplates(templates);

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
        showToast('同步失敗，請檢查網路連線');
    }
}

// Auto sync on page load and every 5 minutes
document.addEventListener('DOMContentLoaded', () => {
    // Sync after a short delay to let app initialize
    setTimeout(() => {
        syncFromGoogleSheets().catch(err => {
            console.error('Initial sync failed:', err);
        });
    }, 1500);
    // Auto refresh every 5 minutes
    setInterval(() => {
        syncFromGoogleSheets().catch(err => {
            console.error('Auto sync failed:', err);
        });
    }, 5 * 60 * 1000);
});
