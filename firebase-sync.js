// ===== Firebase (backup sync only) =====
// Google Sheets is now the primary data source
// Firebase is kept as backup for multi-device real-time between app users

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

firebase.initializeApp(firebaseConfig);

// Save data locally only (Google Sheets sync handles the cloud)
function saveDataWithSync() {
    localStorage.setItem('pokopia_data', JSON.stringify(appData));
}
