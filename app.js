// ===== State Management =====
let appData = {};
let currentModal = null;
let editIndex = -1;

function loadData() {
    const saved = localStorage.getItem('pokopia_data');
    if (saved) {
        appData = JSON.parse(saved);
    } else {
        appData = JSON.parse(JSON.stringify(DEFAULT_DATA));
        saveData();
    }
}

function saveData() {
    localStorage.setItem('pokopia_data', JSON.stringify(appData));
}

function resetData() {
    if (confirm('確定要重置所有資料為初始狀態嗎？')) {
        appData = JSON.parse(JSON.stringify(DEFAULT_DATA));
        saveData();
        renderAll();
        showToast('資料已重置');
    }
}

// ===== Navigation =====
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        item.classList.add('active');
        const tab = item.dataset.tab;
        document.getElementById(tab).classList.add('active');
    });
});

// ===== Toast =====
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

// ===== Modal =====
function openModal(title) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
    currentModal = null;
    editIndex = -1;
}

function saveModal() {
    if (currentModal === 'order') saveOrder();
    else if (currentModal === 'inventory') saveInventory();
    else if (currentModal === 'reconciliation') saveReconciliation();
    else if (currentModal === 'buyer') saveBuyer();
    else if (currentModal === 'finance') saveFinance();
    else if (currentModal === 'template') saveTemplate();
    else if (currentModal === 'monthly') saveMonthly();
}

// ===== Dashboard =====
function renderDashboard() {
    const orders = appData.orders;
    const recon = appData.reconciliation;

    // Calculate totals
    const paid = recon.reduce((sum, r) => r.status === '已收清' ? sum + r.totalPaid : sum, 0);
    const unpaid = orders.filter(o => o.payStatus === '尚未收款').reduce((sum, o) => sum + o.total, 0);
    const totalCost = recon.reduce((sum, r) => sum + r.totalCost, 0);
    const totalProfit = recon.reduce((sum, r) => sum + r.profit, 0);
    const totalRevenue = paid;
    const pendingShip = orders.filter(o => o.shipStatus === '已出貨' || o.shipStatus === '未出貨').length;

    document.getElementById('dash-unpaid').textContent = `$${unpaid.toLocaleString()}`;
    document.getElementById('dash-paid').textContent = `$${paid.toLocaleString()}`;
    document.getElementById('dash-cost').textContent = `$${totalCost.toLocaleString()}`;
    document.getElementById('dash-profit').textContent = `$${totalProfit.toLocaleString()}`;
    document.getElementById('dash-revenue').textContent = `$${totalRevenue.toLocaleString()}`;
    document.getElementById('dash-pending').textContent = pendingShip;

    // This month
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const monthOrders = orders.filter(o => {
        const d = new Date(o.date);
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });
    const monthRevenue = monthOrders.filter(o => o.payStatus === '已收尾款' || o.payStatus === '已收訂金').reduce((s, o) => s + o.total, 0);
    const monthProfit = monthOrders.filter(o => o.payStatus === '已收尾款' || o.payStatus === '已收訂金').reduce((s, o) => s + o.fee, 0);
    const completed = orders.filter(o => o.shipStatus === '已完成').length;

    document.getElementById('dash-month-revenue').textContent = `$${monthRevenue.toLocaleString()}`;
    document.getElementById('dash-month-profit').textContent = `$${monthProfit.toLocaleString()}`;
    document.getElementById('dash-completed').textContent = completed;

    // Top 5 products
    const productCount = {};
    orders.forEach(o => {
        productCount[o.product] = (productCount[o.product] || 0) + o.qty;
    });
    const sorted = Object.entries(productCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const top5El = document.getElementById('dash-top5');
    top5El.innerHTML = sorted.map((item, i) => `
        <div class="top5-item">
            <span class="top5-rank">${i + 1}</span>
            <span>${item[0]} (${item[1]})</span>
        </div>
    `).join('');
}

// ===== Orders =====
function renderOrders(data) {
    const orders = data || appData.orders;
    const tbody = document.querySelector('#orders-table tbody');
    tbody.innerHTML = orders.map((o, i) => {
        const idx = data ? appData.orders.indexOf(o) : i;
        return `<tr>
            <td>${o.groupId}</td>
            <td>${o.orderId}</td>
            <td>${o.platform}</td>
            <td>${o.buyer}</td>
            <td>${o.product}</td>
            <td>${o.qty}</td>
            <td>${o.packaging ? '是' : '否'}</td>
            <td>$${o.cost}</td>
            <td>$${o.fee}</td>
            <td>$${o.deposit}</td>
            <td>$${o.balance}</td>
            <td>$${o.total}</td>
            <td>${o.payment}</td>
            <td><span class="badge ${getPayBadge(o.payStatus)}">${o.payStatus}</span></td>
            <td><span class="badge ${getShipBadge(o.shipStatus)}">${o.shipStatus}</span></td>
            <td>${o.date}</td>
            <td>${o.note || ''}</td>
            <td class="action-btns">
                <button class="btn btn-sm btn-edit" onclick="editOrder(${idx})">編輯</button>
                <button class="btn btn-sm btn-danger" onclick="deleteOrder(${idx})">刪除</button>
            </td>
        </tr>`;
    }).join('');
}

function getPayBadge(status) {
    if (status === '已收尾款') return 'badge-success';
    if (status === '已收訂金') return 'badge-info';
    if (status === '尚未收款') return 'badge-danger';
    if (status === '已退訂金') return 'badge-secondary';
    return '';
}

function getShipBadge(status) {
    if (status === '已完成') return 'badge-success';
    if (status === '已出貨') return 'badge-info';
    if (status === '未出貨') return 'badge-warning';
    if (status === '缺貨') return 'badge-danger';
    return '';
}

function filterOrders() {
    const search = document.getElementById('order-search').value.toLowerCase();
    const payFilter = document.getElementById('order-status-filter').value;
    const shipFilter = document.getElementById('order-ship-filter').value;
    let filtered = appData.orders.filter(o => {
        const matchSearch = !search || o.orderId.toLowerCase().includes(search) ||
            o.buyer.toLowerCase().includes(search) || o.product.toLowerCase().includes(search);
        const matchPay = !payFilter || o.payStatus === payFilter;
        const matchShip = !shipFilter || o.shipStatus === shipFilter;
        return matchSearch && matchPay && matchShip;
    });
    renderOrders(filtered);
}

function showOrderModal(idx) {
    currentModal = 'order';
    editIndex = idx !== undefined ? idx : -1;
    const o = editIndex >= 0 ? appData.orders[editIndex] : {};
    document.getElementById('modal-body').innerHTML = `
        <div class="form-row">
            <div class="form-group"><label>團號</label><input id="f-groupId" value="${o.groupId || ''}"></div>
            <div class="form-group"><label>單號</label><input id="f-orderId" value="${o.orderId || ''}"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>平台</label>
                <select id="f-platform">
                    <option value="LINE" ${o.platform==='LINE'?'selected':''}>LINE</option>
                    <option value="FB" ${o.platform==='FB'?'selected':''}>FB</option>
                    <option value="脆" ${o.platform==='脆'?'selected':''}>脆</option>
                </select>
            </div>
            <div class="form-group"><label>買家</label><input id="f-buyer" value="${o.buyer || ''}"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>商品</label><input id="f-product" value="${o.product || ''}"></div>
            <div class="form-group"><label>數量</label><input type="number" id="f-qty" value="${o.qty || 1}"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>包材</label>
                <select id="f-packaging">
                    <option value="true" ${o.packaging?'selected':''}>是</option>
                    <option value="false" ${!o.packaging?'selected':''}>否</option>
                </select>
            </div>
            <div class="form-group"><label>成本</label><input type="number" id="f-cost" value="${o.cost || 0}"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>代購費</label><input type="number" id="f-fee" value="${o.fee || 0}"></div>
            <div class="form-group"><label>訂金</label><input type="number" id="f-deposit" value="${o.deposit || 0}"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>尾款</label><input type="number" id="f-balance" value="${o.balance || 0}"></div>
            <div class="form-group"><label>應收</label><input type="number" id="f-total" value="${o.total || 0}"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>付款方式</label>
                <select id="f-payment">
                    <option value="匯款" ${o.payment==='匯款'?'selected':''}>匯款</option>
                    <option value="賣貨便" ${o.payment==='賣貨便'?'selected':''}>賣貨便</option>
                    <option value="面交" ${o.payment==='面交'?'selected':''}>面交</option>
                </select>
            </div>
            <div class="form-group"><label>收款狀態</label>
                <select id="f-payStatus">
                    <option value="尚未收款" ${o.payStatus==='尚未收款'?'selected':''}>尚未收款</option>
                    <option value="已收訂金" ${o.payStatus==='已收訂金'?'selected':''}>已收訂金</option>
                    <option value="已收尾款" ${o.payStatus==='已收尾款'?'selected':''}>已收尾款</option>
                    <option value="已退訂金" ${o.payStatus==='已退訂金'?'selected':''}>已退訂金</option>
                </select>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>出貨狀態</label>
                <select id="f-shipStatus">
                    <option value="未出貨" ${o.shipStatus==='未出貨'?'selected':''}>未出貨</option>
                    <option value="已出貨" ${o.shipStatus==='已出貨'?'selected':''}>已出貨</option>
                    <option value="已完成" ${o.shipStatus==='已完成'?'selected':''}>已完成</option>
                    <option value="缺貨" ${o.shipStatus==='缺貨'?'selected':''}>缺貨</option>
                </select>
            </div>
            <div class="form-group"><label>登記日期</label><input type="date" id="f-date" value="${o.date || new Date().toISOString().slice(0,10)}"></div>
        </div>
        <div class="form-group"><label>備註</label><input id="f-note" value="${o.note || ''}"></div>
    `;
    openModal(editIndex >= 0 ? '編輯訂單' : '新增訂單');
}

function saveOrder() {
    const order = {
        groupId: document.getElementById('f-groupId').value,
        orderId: document.getElementById('f-orderId').value,
        platform: document.getElementById('f-platform').value,
        buyer: document.getElementById('f-buyer').value,
        product: document.getElementById('f-product').value,
        qty: parseInt(document.getElementById('f-qty').value) || 1,
        packaging: document.getElementById('f-packaging').value === 'true',
        cost: parseInt(document.getElementById('f-cost').value) || 0,
        fee: parseInt(document.getElementById('f-fee').value) || 0,
        deposit: parseInt(document.getElementById('f-deposit').value) || 0,
        balance: parseInt(document.getElementById('f-balance').value) || 0,
        total: parseInt(document.getElementById('f-total').value) || 0,
        payment: document.getElementById('f-payment').value,
        payStatus: document.getElementById('f-payStatus').value,
        shipStatus: document.getElementById('f-shipStatus').value,
        date: document.getElementById('f-date').value,
        note: document.getElementById('f-note').value,
    };
    if (editIndex >= 0) {
        appData.orders[editIndex] = order;
    } else {
        appData.orders.push(order);
    }
    saveData();
    renderOrders();
    renderDashboard();
    closeModal();
    showToast(editIndex >= 0 ? '訂單已更新' : '訂單已新增');
}

function editOrder(idx) { showOrderModal(idx); }

function deleteOrder(idx) {
    if (confirm('確定刪除此訂單？')) {
        appData.orders.splice(idx, 1);
        saveData();
        renderOrders();
        renderDashboard();
        showToast('訂單已刪除');
    }
}

// ===== Inventory =====
function renderInventory(data) {
    const items = data || appData.inventory;
    const tbody = document.querySelector('#inventory-table tbody');
    tbody.innerHTML = items.map((item, i) => {
        const idx = data ? appData.inventory.indexOf(item) : i;
        return `<tr>
            <td>${item.id}</td>
            <td>${item.name}</td>
            <td>$${item.cost}</td>
            <td>${item.demand}</td>
            <td>${item.purchased}</td>
            <td>${item.returned}</td>
            <td>${item.pending}</td>
            <td>${item.remaining}</td>
            <td>${item.note || ''}</td>
            <td class="action-btns">
                <button class="btn btn-sm btn-edit" onclick="editInventory(${idx})">編輯</button>
                <button class="btn btn-sm btn-danger" onclick="deleteInventory(${idx})">刪除</button>
            </td>
        </tr>`;
    }).join('');
}

function filterInventory() {
    const search = document.getElementById('inventory-search').value.toLowerCase();
    const filtered = appData.inventory.filter(item =>
        item.name.toLowerCase().includes(search) || item.id.toLowerCase().includes(search)
    );
    renderInventory(filtered);
}

function showInventoryModal(idx) {
    currentModal = 'inventory';
    editIndex = idx !== undefined ? idx : -1;
    const item = editIndex >= 0 ? appData.inventory[editIndex] : {};
    document.getElementById('modal-body').innerHTML = `
        <div class="form-row">
            <div class="form-group"><label>商品ID</label><input id="f-inv-id" value="${item.id || generateProductId()}"></div>
            <div class="form-group"><label>商品名稱</label><input id="f-inv-name" value="${item.name || ''}"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>成本</label><input type="number" id="f-inv-cost" value="${item.cost || 0}"></div>
            <div class="form-group"><label>需求量</label><input type="number" id="f-inv-demand" value="${item.demand || 0}"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>已購入</label><input type="number" id="f-inv-purchased" value="${item.purchased || 0}"></div>
            <div class="form-group"><label>已退貨</label><input type="number" id="f-inv-returned" value="${item.returned || 0}"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>待採購</label><input type="number" id="f-inv-pending" value="${item.pending || 0}"></div>
            <div class="form-group"><label>餘量</label><input type="number" id="f-inv-remaining" value="${item.remaining || 0}"></div>
        </div>
        <div class="form-group"><label>備註</label><input id="f-inv-note" value="${item.note || ''}"></div>
    `;
    openModal(editIndex >= 0 ? '編輯商品' : '新增商品');
}

function generateProductId() {
    const ids = appData.inventory.map(i => parseInt(i.id.replace('PD', '')));
    const max = ids.length > 0 ? Math.max(...ids) : 0;
    return 'PD' + String(max + 1).padStart(5, '0');
}

function saveInventory() {
    const item = {
        id: document.getElementById('f-inv-id').value,
        name: document.getElementById('f-inv-name').value,
        cost: parseFloat(document.getElementById('f-inv-cost').value) || 0,
        demand: parseInt(document.getElementById('f-inv-demand').value) || 0,
        purchased: parseInt(document.getElementById('f-inv-purchased').value) || 0,
        returned: parseInt(document.getElementById('f-inv-returned').value) || 0,
        pending: parseInt(document.getElementById('f-inv-pending').value) || 0,
        remaining: parseInt(document.getElementById('f-inv-remaining').value) || 0,
        note: document.getElementById('f-inv-note').value,
    };
    if (editIndex >= 0) {
        appData.inventory[editIndex] = item;
    } else {
        appData.inventory.push(item);
    }
    saveData();
    renderInventory();
    renderDashboard();
    closeModal();
    showToast(editIndex >= 0 ? '商品已更新' : '商品已新增');
}

function editInventory(idx) { showInventoryModal(idx); }

function deleteInventory(idx) {
    if (confirm('確定刪除此商品？')) {
        appData.inventory.splice(idx, 1);
        saveData();
        renderInventory();
        showToast('商品已刪除');
    }
}

// ===== Reconciliation =====
function renderReconciliation(data) {
    const items = data || appData.reconciliation;
    const tbody = document.querySelector('#reconciliation-table tbody');
    tbody.innerHTML = items.map((r, i) => {
        const idx = data ? appData.reconciliation.indexOf(r) : i;
        return `<tr>
            <td>${r.orderId}</td>
            <td>${r.name}</td>
            <td>${r.account || ''}</td>
            <td>$${r.firstPay}</td>
            <td>$${r.secondPay}</td>
            <td>$${r.shouldPay}</td>
            <td>$${r.convenience}</td>
            <td>$${r.totalPaid}</td>
            <td>$${r.totalCost}</td>
            <td>$${r.refund}</td>
            <td>$${r.profit}</td>
            <td>${r.date}</td>
            <td><span class="badge ${r.status==='已收清'?'badge-success':'badge-warning'}">${r.status}</span></td>
            <td>${r.note || ''}</td>
            <td class="action-btns">
                <button class="btn btn-sm btn-edit" onclick="editReconciliation(${idx})">編輯</button>
                <button class="btn btn-sm btn-danger" onclick="deleteReconciliation(${idx})">刪除</button>
            </td>
        </tr>`;
    }).join('');
}

function filterReconciliation() {
    const search = document.getElementById('recon-search').value.toLowerCase();
    const statusFilter = document.getElementById('recon-status-filter').value;
    const filtered = appData.reconciliation.filter(r => {
        const matchSearch = !search || r.orderId.toLowerCase().includes(search) || r.name.toLowerCase().includes(search);
        const matchStatus = !statusFilter || r.status === statusFilter;
        return matchSearch && matchStatus;
    });
    renderReconciliation(filtered);
}

function showReconciliationModal(idx) {
    currentModal = 'reconciliation';
    editIndex = idx !== undefined ? idx : -1;
    const r = editIndex >= 0 ? appData.reconciliation[editIndex] : {};
    document.getElementById('modal-body').innerHTML = `
        <div class="form-row">
            <div class="form-group"><label>對應單號</label><input id="f-rec-orderId" value="${r.orderId || ''}"></div>
            <div class="form-group"><label>姓名</label><input id="f-rec-name" value="${r.name || ''}"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>帳戶末五碼</label><input id="f-rec-account" value="${r.account || ''}"></div>
            <div class="form-group"><label>首匯金額</label><input type="number" id="f-rec-firstPay" value="${r.firstPay || 0}"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>二補金額</label><input type="number" id="f-rec-secondPay" value="${r.secondPay || 0}"></div>
            <div class="form-group"><label>客戶應匯款</label><input type="number" id="f-rec-shouldPay" value="${r.shouldPay || 0}"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>留賣貨便</label><input type="number" id="f-rec-convenience" value="${r.convenience || 0}"></div>
            <div class="form-group"><label>客戶總付款</label><input type="number" id="f-rec-totalPaid" value="${r.totalPaid || 0}"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>總成本</label><input type="number" id="f-rec-totalCost" value="${r.totalCost || 0}"></div>
            <div class="form-group"><label>退款</label><input type="number" id="f-rec-refund" value="${r.refund || 0}"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>總利潤</label><input type="number" id="f-rec-profit" value="${r.profit || 0}"></div>
            <div class="form-group"><label>對帳日期</label><input type="date" id="f-rec-date" value="${r.date || new Date().toISOString().slice(0,10)}"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>收支狀態</label>
                <select id="f-rec-status">
                    <option value="已收清" ${r.status==='已收清'?'selected':''}>已收清</option>
                    <option value="未收清" ${r.status==='未收清'?'selected':''}>未收清</option>
                </select>
            </div>
            <div class="form-group"><label>備註</label><input id="f-rec-note" value="${r.note || ''}"></div>
        </div>
    `;
    openModal(editIndex >= 0 ? '編輯對帳' : '新增對帳');
}

function saveReconciliation() {
    const r = {
        orderId: document.getElementById('f-rec-orderId').value,
        name: document.getElementById('f-rec-name').value,
        account: document.getElementById('f-rec-account').value,
        firstPay: parseFloat(document.getElementById('f-rec-firstPay').value) || 0,
        secondPay: parseFloat(document.getElementById('f-rec-secondPay').value) || 0,
        shouldPay: parseFloat(document.getElementById('f-rec-shouldPay').value) || 0,
        convenience: parseFloat(document.getElementById('f-rec-convenience').value) || 0,
        totalPaid: parseFloat(document.getElementById('f-rec-totalPaid').value) || 0,
        totalCost: parseFloat(document.getElementById('f-rec-totalCost').value) || 0,
        refund: parseFloat(document.getElementById('f-rec-refund').value) || 0,
        profit: parseFloat(document.getElementById('f-rec-profit').value) || 0,
        date: document.getElementById('f-rec-date').value,
        status: document.getElementById('f-rec-status').value,
        note: document.getElementById('f-rec-note').value,
    };
    if (editIndex >= 0) {
        appData.reconciliation[editIndex] = r;
    } else {
        appData.reconciliation.push(r);
    }
    saveData();
    renderReconciliation();
    renderDashboard();
    closeModal();
    showToast(editIndex >= 0 ? '對帳已更新' : '對帳已新增');
    renderMonthly();
}

function editReconciliation(idx) { showReconciliationModal(idx); }

function deleteReconciliation(idx) {
    if (confirm('確定刪除此對帳紀錄？')) {
        appData.reconciliation.splice(idx, 1);
        saveData();
        renderReconciliation();
        renderDashboard();
        showToast('對帳紀錄已刪除');
    }
}

// ===== Buyers =====
function renderBuyers(data) {
    const items = data || appData.buyers;
    const tbody = document.querySelector('#buyers-table tbody');
    tbody.innerHTML = items.map((b, i) => {
        const idx = data ? appData.buyers.indexOf(b) : i;
        return `<tr>
            <td>${b.name}</td>
            <td>${b.convName || ''}</td>
            <td>${b.platform}</td>
            <td><span class="badge ${b.level==='常客'?'badge-success':'badge-info'}">${b.level}</span></td>
            <td>${b.orders}</td>
            <td>$${b.totalSpent.toLocaleString()}</td>
            <td>${b.lastBuy}</td>
            <td>${b.note || ''}</td>
            <td class="action-btns">
                <button class="btn btn-sm btn-edit" onclick="editBuyer(${idx})">編輯</button>
                <button class="btn btn-sm btn-danger" onclick="deleteBuyer(${idx})">刪除</button>
            </td>
        </tr>`;
    }).join('');
}

function filterBuyers() {
    const search = document.getElementById('buyer-search').value.toLowerCase();
    const levelFilter = document.getElementById('buyer-level-filter').value;
    const platformFilter = document.getElementById('buyer-platform-filter').value;
    const filtered = appData.buyers.filter(b => {
        const matchSearch = !search || b.name.toLowerCase().includes(search);
        const matchLevel = !levelFilter || b.level === levelFilter;
        const matchPlatform = !platformFilter || b.platform === platformFilter;
        return matchSearch && matchLevel && matchPlatform;
    });
    renderBuyers(filtered);
}

function showBuyerModal(idx) {
    currentModal = 'buyer';
    editIndex = idx !== undefined ? idx : -1;
    const b = editIndex >= 0 ? appData.buyers[editIndex] : {};
    document.getElementById('modal-body').innerHTML = `
        <div class="form-row">
            <div class="form-group"><label>名稱</label><input id="f-buy-name" value="${b.name || ''}"></div>
            <div class="form-group"><label>賣貨便姓名</label><input id="f-buy-convName" value="${b.convName || ''}"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>平台</label>
                <select id="f-buy-platform">
                    <option value="LINE" ${b.platform==='LINE'?'selected':''}>LINE</option>
                    <option value="FB" ${b.platform==='FB'?'selected':''}>FB</option>
                    <option value="脆" ${b.platform==='脆'?'selected':''}>脆</option>
                </select>
            </div>
            <div class="form-group"><label>等級</label>
                <select id="f-buy-level">
                    <option value="一般" ${b.level==='一般'?'selected':''}>一般</option>
                    <option value="常客" ${b.level==='常客'?'selected':''}>常客</option>
                </select>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>訂單數</label><input type="number" id="f-buy-orders" value="${b.orders || 0}"></div>
            <div class="form-group"><label>累積消費</label><input type="number" id="f-buy-totalSpent" value="${b.totalSpent || 0}"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>最後購買日期</label><input type="date" id="f-buy-lastBuy" value="${b.lastBuy || ''}"></div>
            <div class="form-group"><label>備註</label><input id="f-buy-note" value="${b.note || ''}"></div>
        </div>
    `;
    openModal(editIndex >= 0 ? '編輯買家' : '新增買家');
}

function saveBuyer() {
    const b = {
        name: document.getElementById('f-buy-name').value,
        convName: document.getElementById('f-buy-convName').value,
        platform: document.getElementById('f-buy-platform').value,
        level: document.getElementById('f-buy-level').value,
        orders: parseInt(document.getElementById('f-buy-orders').value) || 0,
        totalSpent: parseFloat(document.getElementById('f-buy-totalSpent').value) || 0,
        lastBuy: document.getElementById('f-buy-lastBuy').value,
        note: document.getElementById('f-buy-note').value,
    };
    if (editIndex >= 0) {
        appData.buyers[editIndex] = b;
    } else {
        appData.buyers.push(b);
    }
    saveData();
    renderBuyers();
    closeModal();
    showToast(editIndex >= 0 ? '買家已更新' : '買家已新增');
}

function editBuyer(idx) { showBuyerModal(idx); }

function deleteBuyer(idx) {
    if (confirm('確定刪除此買家？')) {
        appData.buyers.splice(idx, 1);
        saveData();
        renderBuyers();
        showToast('買家已刪除');
    }
}

// ===== Finance =====
function renderFinance(data) {
    const items = data || appData.finance;
    const tbody = document.querySelector('#finance-table tbody');
    tbody.innerHTML = items.map((f, i) => {
        const idx = data ? appData.finance.indexOf(f) : i;
        return `<tr>
            <td>${f.date}</td>
            <td>${f.item}</td>
            <td class="text-danger">$${f.expense.toLocaleString()}</td>
            <td class="text-success">$${f.income.toLocaleString()}</td>
            <td>${f.type}</td>
            <td>${f.handler}</td>
            <td class="checkbox-cell"><input type="checkbox" ${f.verified?'checked':''} onchange="toggleFinanceVerify(${idx}, this.checked)"></td>
            <td>${f.note || ''}</td>
            <td class="action-btns">
                <button class="btn btn-sm btn-edit" onclick="editFinance(${idx})">編輯</button>
                <button class="btn btn-sm btn-danger" onclick="deleteFinance(${idx})">刪除</button>
            </td>
        </tr>`;
    }).join('');

    // Update totals
    const totalExpense = appData.finance.reduce((s, f) => s + f.expense, 0);
    const totalIncome = appData.finance.reduce((s, f) => s + f.income, 0);
    document.getElementById('finance-total-expense').textContent = `$${totalExpense.toLocaleString()}`;
    document.getElementById('finance-total-income').textContent = `$${totalIncome.toLocaleString()}`;
}

function toggleFinanceVerify(idx, checked) {
    appData.finance[idx].verified = checked;
    saveData();
}

function filterFinance() {
    const search = document.getElementById('finance-search').value.toLowerCase();
    const filtered = appData.finance.filter(f =>
        f.item.toLowerCase().includes(search) || f.handler.toLowerCase().includes(search)
    );
    renderFinance(filtered);
}

function showFinanceModal(idx) {
    currentModal = 'finance';
    editIndex = idx !== undefined ? idx : -1;
    const f = editIndex >= 0 ? appData.finance[editIndex] : {};
    document.getElementById('modal-body').innerHTML = `
        <div class="form-row">
            <div class="form-group"><label>日期</label><input type="date" id="f-fin-date" value="${f.date || new Date().toISOString().slice(0,10)}"></div>
            <div class="form-group"><label>項目</label><input id="f-fin-item" value="${f.item || ''}"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>支出</label><input type="number" id="f-fin-expense" value="${f.expense || 0}"></div>
            <div class="form-group"><label>收入</label><input type="number" id="f-fin-income" value="${f.income || 0}"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>收支</label>
                <select id="f-fin-type">
                    <option value="支出" ${f.type==='支出'?'selected':''}>支出</option>
                    <option value="收入" ${f.type==='收入'?'selected':''}>收入</option>
                </select>
            </div>
            <div class="form-group"><label>處理人</label><input id="f-fin-handler" value="${f.handler || ''}"></div>
        </div>
        <div class="form-group"><label>備註</label><input id="f-fin-note" value="${f.note || ''}"></div>
    `;
    openModal(editIndex >= 0 ? '編輯收支' : '新增收支');
}

function saveFinance() {
    const f = {
        date: document.getElementById('f-fin-date').value,
        item: document.getElementById('f-fin-item').value,
        expense: parseFloat(document.getElementById('f-fin-expense').value) || 0,
        income: parseFloat(document.getElementById('f-fin-income').value) || 0,
        type: document.getElementById('f-fin-type').value,
        handler: document.getElementById('f-fin-handler').value,
        verified: false,
        note: document.getElementById('f-fin-note').value,
    };
    if (editIndex >= 0) {
        f.verified = appData.finance[editIndex].verified;
        appData.finance[editIndex] = f;
    } else {
        appData.finance.push(f);
    }
    saveData();
    renderFinance();
    closeModal();
    showToast(editIndex >= 0 ? '收支已更新' : '收支已新增');
    renderMonthly();
}

function editFinance(idx) { showFinanceModal(idx); }

function deleteFinance(idx) {
    if (confirm('確定刪除此收支紀錄？')) {
        appData.finance.splice(idx, 1);
        saveData();
        renderFinance();
        showToast('收支紀錄已刪除');
    }
}

// ===== Monthly Reports (Auto-Calculate) =====
function getMonthlyStats() {
    // Build monthly data from reconciliation (income/profit) and finance (expense)
    const monthMap = {};

    // Aggregate from reconciliation (profit per month based on date)
    appData.reconciliation.forEach(r => {
        if (!r.date) return;
        const d = new Date(r.date);
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
        if (!monthMap[key]) monthMap[key] = { year: d.getFullYear(), month: d.getMonth() + 1, income: 0, expense: 0, profit: 0, orders: 0 };
        monthMap[key].income += (r.totalPaid || 0);
        monthMap[key].profit += (r.profit || 0);
        monthMap[key].orders += 1;
    });

    // Aggregate from finance (expenses per month based on date)
    appData.finance.forEach(f => {
        if (!f.date) return;
        const d = new Date(f.date);
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
        if (!monthMap[key]) monthMap[key] = { year: d.getFullYear(), month: d.getMonth() + 1, income: 0, expense: 0, profit: 0, orders: 0 };
        monthMap[key].expense += (f.expense || 0);
    });

    // Convert to sorted array
    return Object.values(monthMap).sort((a, b) => a.year === b.year ? a.month - b.month : a.year - b.year);
}

function renderMonthly() {
    const stats = getMonthlyStats();
    const tbody = document.querySelector('#monthly-table tbody');

    // Also check manual overrides stored in appData.monthly for approver/status/note
    const overrideMap = {};
    (appData.monthly || []).forEach(m => {
        const monthNum = parseInt(m.month);
        if (m.year && monthNum) {
            overrideMap[`${m.year}-${monthNum}`] = m;
        }
    });

    let totalIncome = 0, totalExpense = 0, totalProfit = 0;

    tbody.innerHTML = stats.map((s) => {
        const key = `${s.year}-${s.month}`;
        const override = overrideMap[key] || {};
        const approver = override.approver || '';
        const status = override.status || '';
        const note = override.note || '';
        const netProfit = s.profit;

        totalIncome += s.income;
        totalExpense += s.expense;
        totalProfit += netProfit;

        const monthLabel = `${s.month} 月`;
        const profitClass = netProfit > 0 ? 'text-success' : netProfit < 0 ? 'text-danger' : '';

        return `<tr>
            <td>${s.year}</td>
            <td>${monthLabel}</td>
            <td>$${s.income.toLocaleString()}</td>
            <td>$${s.expense.toLocaleString()}</td>
            <td class="${profitClass}">$${netProfit.toLocaleString()}</td>
            <td>${s.orders}</td>
            <td><span class="badge ${status==='符合'?'badge-success':status?'badge-warning':''}">${status || '-'}</span></td>
            <td>${approver || '-'}</td>
            <td>${note}</td>
            <td>
                <button class="btn btn-sm btn-edit" onclick="editMonthly('${key}')">編輯</button>
            </td>
        </tr>`;
    }).join('');

    // Add summary row
    tbody.innerHTML += `<tr style="font-weight:700; background:#f0f0f0;">
        <td colspan="2">合計</td>
        <td>$${totalIncome.toLocaleString()}</td>
        <td>$${totalExpense.toLocaleString()}</td>
        <td class="${totalProfit>0?'text-success':'text-danger'}">$${totalProfit.toLocaleString()}</td>
        <td></td><td></td><td></td><td></td><td></td>
    </tr>`;
}

function editMonthly(key) {
    const [year, month] = key.split('-').map(Number);
    // Find existing override or create one
    let existing = appData.monthly.find(m => m.year === year && parseInt(m.month) === month);
    if (!existing) {
        existing = { year, month: `${month} 月`, status: '', approver: '', note: '' };
    }

    currentModal = 'monthly';
    editIndex = key;
    document.getElementById('modal-body').innerHTML = `
        <p style="margin-bottom:16px; color:var(--text-light);">
            ${year} 年 ${month} 月的收入/支出/淨利由系統自動計算，<br>以下欄位供您手動填寫：
        </p>
        <div class="form-row">
            <div class="form-group"><label>狀態</label>
                <select id="f-monthly-status">
                    <option value="" ${!existing.status?'selected':''}>未設定</option>
                    <option value="符合" ${existing.status==='符合'?'selected':''}>符合</option>
                    <option value="不符合" ${existing.status==='不符合'?'selected':''}>不符合</option>
                </select>
            </div>
            <div class="form-group"><label>核准人</label><input id="f-monthly-approver" value="${existing.approver || ''}"></div>
        </div>
        <div class="form-group"><label>附註</label><textarea id="f-monthly-note" rows="3">${existing.note || ''}</textarea></div>
    `;
    openModal(`編輯 ${year} 年 ${month} 月報表`);
}

function saveMonthly() {
    const [year, month] = editIndex.split('-').map(Number);
    const status = document.getElementById('f-monthly-status').value;
    const approver = document.getElementById('f-monthly-approver').value;
    const note = document.getElementById('f-monthly-note').value;

    // Find or create entry in appData.monthly
    let idx = appData.monthly.findIndex(m => m.year === year && parseInt(m.month) === month);
    const entry = { year, month: `${month} 月`, income: 0, expense: 0, status, approver, note, profit: 0 };

    if (idx >= 0) {
        appData.monthly[idx] = { ...appData.monthly[idx], status, approver, note };
    } else {
        appData.monthly.push(entry);
    }

    saveData();
    renderMonthly();
    closeModal();
    showToast('月報表已更新');
}

// ===== Customer Service Templates =====
function renderTemplates() {
    const container = document.getElementById('templates-list');
    container.innerHTML = appData.templates.map((t, i) => `
        <div class="template-card">
            <div class="template-actions">
                <button class="copy-btn" onclick="copyTemplate(${i})">複製</button>
                <button class="btn btn-sm btn-edit" onclick="editTemplate(${i})">編輯</button>
                <button class="btn btn-sm btn-danger" onclick="deleteTemplate(${i})">刪除</button>
            </div>
            <h3>${t.title}</h3>
            <pre>${t.content}</pre>
        </div>
    `).join('');
}

function copyTemplate(idx) {
    const text = appData.templates[idx].content;
    navigator.clipboard.writeText(text).then(() => {
        showToast('已複製到剪貼簿');
    }).catch(() => {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('已複製到剪貼簿');
    });
}

function showTemplateModal(idx) {
    currentModal = 'template';
    editIndex = idx !== undefined ? idx : -1;
    const t = editIndex >= 0 ? appData.templates[editIndex] : {};
    document.getElementById('modal-body').innerHTML = `
        <div class="form-group"><label>項目標題</label><input id="f-tpl-title" value="${t.title || ''}"></div>
        <div class="form-group"><label>內容</label><textarea id="f-tpl-content" rows="8">${t.content || ''}</textarea></div>
    `;
    openModal(editIndex >= 0 ? '編輯客服用語' : '新增客服用語');
}

function saveTemplate() {
    const t = {
        title: document.getElementById('f-tpl-title').value,
        content: document.getElementById('f-tpl-content').value,
    };
    if (editIndex >= 0) {
        appData.templates[editIndex] = t;
    } else {
        appData.templates.push(t);
    }
    saveData();
    renderTemplates();
    closeModal();
    showToast(editIndex >= 0 ? '用語已更新' : '用語已新增');
}

function editTemplate(idx) { showTemplateModal(idx); }

function deleteTemplate(idx) {
    if (confirm('確定刪除此客服用語？')) {
        appData.templates.splice(idx, 1);
        saveData();
        renderTemplates();
        showToast('用語已刪除');
    }
}

// ===== Render All =====
function renderAll() {
    renderDashboard();
    renderOrders();
    renderInventory();
    renderReconciliation();
    renderBuyers();
    renderFinance();
    renderMonthly();
    renderTemplates();
}

// ===== Initialize =====
loadData();
renderAll();
