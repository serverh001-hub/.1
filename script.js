let ws;
let helmetsData = {};
let reconnectDelay = 1000;

function connect() {
    ws = new WebSocket('wss://smart-helmet-server.onrender.com');

    ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'register', role: 'boss' }));
        document.getElementById('sysDot').className = 'sdot live';
        document.getElementById('sysTxt').innerText = 'ออนไลน์';
        reconnectDelay = 1000;
    };

    ws.onclose = () => {
        document.getElementById('sysDot').className = 'sdot';
        document.getElementById('sysTxt').innerText = 'ขาดการเชื่อมต่อ กำลังลองใหม่...';
        setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 15000);
    };

    ws.onerror = () => ws.close();

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'sensor_data') {
            // อัปเดตข้อมูลทุกอย่างที่ส่งมาจาก ESP32 (รวมถึงชื่อและตำแหน่ง)
            helmetsData[data.deviceId] = {
                workerName: data.workerName,
                workerPos: data.workerPos,
                workerID: data.workerID,
                sos: data.sos,
                obstacle: data.obstacle,
                dist1: data.dist1,
                dist2: data.dist2,
                lastUpdate: Date.now()
            };
            renderDashboard();
        }
    };
}

function ackSOS(deviceId) {
    ws.send(JSON.stringify({ type: 'ack_sos', targetId: deviceId }));
    if (helmetsData[deviceId]) helmetsData[deviceId].sos = false;
    renderDashboard();
}

function renderDashboard() {
    const grid = document.getElementById('helmetsGrid');
    let onlineCount = 0, sosCount = 0, obsCount = 0;
    const now = Date.now();
    let html = '';

    for (const [id, h] of Object.entries(helmetsData)) {
        if (now - h.lastUpdate > 10000) continue;

        onlineCount++;
        if (h.sos) sosCount++;
        if (h.obstacle) obsCount++;

        let badgeStr = h.sos ? '<span class="badge sos">🚨 SOS</span>' :
                       (h.obstacle ? '<span class="badge obs">⚠️ ระวัง</span>' : '<span class="badge ok">🟢 ปกติ</span>');

        html += `
        <div class="h-card ${h.sos ? 'sos' : (h.obstacle ? 'obs' : '')}">
            <div class="h-head">
                <div>
                    <div class="h-name">${h.workerName}</div>
                    <div class="h-id">${h.workerPos} | ID: ${h.workerID} • ${id}</div>
                </div>
                ${badgeStr}
            </div>
            <div class="h-body">
                <div class="m-box"><span>หน้า (cm)</span><strong>${h.dist1 < 999 ? h.dist1.toFixed(1) : '-'}</strong></div>
                <div class="m-box"><span>ข้าง (cm)</span><strong>${h.dist2 < 999 ? h.dist2.toFixed(1) : '-'}</strong></div>
            </div>
            <div class="h-foot"><button class="btn-ack" ${!h.sos ? 'disabled' : ''} onclick="ackSOS('${id}')">${h.sos ? '✅ ตอบรับเหตุฉุกเฉิน' : 'ไม่มีเหตุฉุกเฉิน'}</button></div>
        </div>`;
    }

    if (html === '') {
        html = `
        <div class="empty-state">
            <div class="empty-icon">⛑️</div>
            <div class="empty-title">ไม่มีหมวกที่ออนไลน์อยู่ในขณะนี้</div>
            <div class="empty-sub">หมวกที่ออนไลน์จะปรากฏที่นี่โดยอัตโนมัติ</div>
        </div>`;
    }

    grid.innerHTML = html;
    document.getElementById('sumOnline').innerText = onlineCount;
    document.getElementById('sumSOS').innerText = sosCount;
    document.getElementById('sumObs').innerText = obsCount;
}

connect();
setInterval(renderDashboard, 2000);
