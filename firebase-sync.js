// ===== Firebase Configuration & Sync =====
const firebaseConfig = {
    apiKey: "AIzaSyCosFIQ4VKHLrN4r2A94POY4354-g8Bx7w",
    authDomain: "pokopia-center.firebaseapp.com",
    databaseURL: "https://pokopia-center-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "pokopia-center",
    storageBucket: "pokopia-center.firebasestorage.app",
    messagingSenderId: "127364324930",
    appId: "1:127364324930:web:23eddd38722ef610fd57db",
    measurementId: "G-MTNL9KFWNY"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const dataRef = db.ref('pokopia_data');

let firebaseReady = false;
let isSyncing = false;

// Upload local data to Firebase (first time or manual push)
function pushToFirebase() {
    isSyncing = true;
    dataRef.set(appData).then(() => {
        isSyncing = false;
        showToast('資料已同步到雲端');
    }).catch(err => {
        isSyncing = false;
        console.error('Firebase push error:', err);
        showToast('同步失敗，請檢查網路');
    });
}

// Save data locally AND to Firebase
function saveDataWithSync() {
    localStorage.setItem('pokopia_data', JSON.stringify(appData));
    if (firebaseReady) {
        isSyncing = true;
        dataRef.set(appData).then(() => {
            isSyncing = false;
        }).catch(err => {
            isSyncing = false;
            console.error('Firebase sync error:', err);
        });
    }
}

// Listen for real-time changes from Firebase
dataRef.on('value', (snapshot) => {
    const cloudData = snapshot.val();
    if (!cloudData) {
        // No data in cloud yet, push local data up
        firebaseReady = true;
        pushToFirebase();
        return;
    }
    if (isSyncing) return; // Ignore our own writes

    // Update local data from cloud
    appData = cloudData;
    localStorage.setItem('pokopia_data', JSON.stringify(appData));
    firebaseReady = true;

    // Re-render all views
    if (typeof renderAll === 'function') {
        renderAll();
    }
});

// Connection status indicator
const connRef = firebase.database().ref('.info/connected');
connRef.on('value', (snap) => {
    const statusEl = document.getElementById('sync-status');
    if (statusEl) {
        if (snap.val() === true) {
            statusEl.textContent = '已連線';
            statusEl.className = 'sync-status online';
        } else {
            statusEl.textContent = '離線中';
            statusEl.className = 'sync-status offline';
        }
    }
});
