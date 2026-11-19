/**
 * Daily Equipment Inspection System - Data Management (Server API Version)
 */

const DEI_STORAGE_KEYS = {
    MACHINES: 'dei_machines',
    INSPECTIONS: 'dei_inspections',
    SETTINGS: 'dei_settings'
};

const DEFAULT_MACHINES = [
    { code: 'A-M001', building: 'A', name: 'เครื่องปั๊มลมสกรูหลักชุดที่ 1 (Main Screw Air Compressor #1)' },
    { code: 'A-M002', building: 'A', name: 'เครื่องปั๊มลมสกรูหลักชุดที่ 2 (Main Screw Air Compressor #2)' },
    { code: 'A-M003', building: 'A', name: 'เครื่องทำน้ำเย็นชิลเลอร์สายการผลิต A1 (Industrial Water Chiller A1)' },
    { code: 'A-M004', building: 'A', name: 'เครื่องทำน้ำเย็นชิลเลอร์สายการผลิต A2 (Industrial Water Chiller A2)' },
    { code: 'A-M005', building: 'A', name: 'ปั๊มส่งน้ำหล่อเย็นแรงดันสูง A1 (Cooling Water Booster Pump A1)' },
    { code: 'A-M006', building: 'A', name: 'ปั๊มส่งน้ำหล่อเย็นแรงดันสูง A2 (Cooling Water Booster Pump A2)' },
    { code: 'A-M007', building: 'A', name: 'เครื่องทำลมแห้งแบบใช้น้ำยา A1 (Refrigerated Air Dryer A1)' },
    { code: 'A-M008', building: 'A', name: 'หอผึ่งน้ำหล่อเย็นอาคาร A (Cooling Tower Unit A)' },
    { code: 'A-M009', building: 'A', name: 'เครื่องอัดไฮดรอลิกขึ้นรูปโลหะ A1 (Hydraulic Forming Press A1)' },
    { code: 'A-M010', building: 'A', name: 'เครื่องอัดไฮดรอลิกขึ้นรูปโลหะ A2 (Hydraulic Forming Press A2)' },
    { code: 'A-M011', building: 'A', name: 'ระบบสายพานลำเลียงอัตโนมัติสายหลัก A (Automated Conveyor Line A)' },
    { code: 'A-M012', building: 'A', name: 'ตู้ควบคุมไฟฟ้าหลักและหม้อแปลงอาคาร A (Main MDB & Transformer A)' },

    { code: 'B-M001', building: 'B', name: 'เครื่องปั๊มลมแรงดันสูงอาคาร B1 (High-Pressure Air Compressor B1)' },
    { code: 'B-M002', building: 'B', name: 'เครื่องปั๊มลมแรงดันสูงอาคาร B2 (High-Pressure Air Compressor B2)' },
    { code: 'B-M003', building: 'B', name: 'เครื่องทำน้ำเย็นชิลเลอร์อาคาร B1 (Process Chiller Unit B1)' },
    { code: 'B-M004', building: 'B', name: 'เครื่องทำน้ำเย็นชิลเลอร์อาคาร B2 (Process Chiller Unit B2)' },
    { code: 'B-M005', building: 'B', name: 'ปั๊มหมุนเวียนน้ำเย็นระบบปิด B1 (Chilled Water Circulating Pump B1)' },
    { code: 'B-M006', building: 'B', name: 'ปั๊มหมุนเวียนน้ำเย็นระบบปิด B2 (Chilled Water Circulating Pump B2)' },
    { code: 'B-M007', building: 'B', name: 'เครื่องทำลมแห้งดูดความชื้น B1 (Desiccant Air Dryer B1)' },
    { code: 'B-M008', building: 'B', name: 'หอผึ่งน้ำหล่อเย็นอาคาร B (Cooling Tower Unit B)' },
    { code: 'B-M009', building: 'B', name: 'เครื่องฉีดพลาสติกอัตโนมัติ B1 (Injection Molding Machine B1)' },
    { code: 'B-M010', building: 'B', name: 'เครื่องฉีดพลาสติกอัตโนมัติ B2 (Injection Molding Machine B2)' },
    { code: 'B-M011', building: 'B', name: 'เครื่องบรรจุและซีลสุญญากาศอัตโนมัติ B (Auto Vacuum Packaging Unit B)' },
    { code: 'B-M012', building: 'B', name: 'เครื่องกำเนิดไฟฟ้าสำรองและตู้ควบคุม B (Backup Generator & ATS B)' }
];

const CHECKLIST_CATEGORIES = [
    {
        catCode: '01', catClass: 'cat-01', catName: 'ระบบแรงดันและระบบท่อ',
        items: [
            { id: 1, seq: 1, title: 'ตรวจสอบแรงดันด้านขาดูด (4-8 bar)', hasMeasurement: true, unit: 'bar', placeholder: 'เช่น 6.5' },
            { id: 2, seq: 2, title: 'ตรวจสอบแรงดันด้านจ่าย (12-18 bar)', hasMeasurement: true, unit: 'bar', placeholder: 'เช่น 15.0' },
            { id: 3, seq: 3, title: 'ตรวจสอบการรั่วซึมของท่อและข้อต่อ', hasMeasurement: false, unit: '' },
            { id: 4, seq: 4, title: 'ตรวจสอบการทำงานของวาล์วควบคุม', hasMeasurement: false, unit: '' }
        ]
    },
    {
        catCode: '02', catClass: 'cat-02', catName: 'ระบบทำความเย็นและอุณหภูมิ',
        items: [
            { id: 5, seq: 1, title: 'ตรวจสอบอุณหภูมิน้ำเข้า (10-15 °C)', hasMeasurement: true, unit: '°C', placeholder: 'เช่น 12' },
            { id: 6, seq: 2, title: 'ตรวจสอบอุณหภูมิน้ำออก (5-9 °C)', hasMeasurement: true, unit: '°C', placeholder: 'เช่น 7' },
            { id: 7, seq: 3, title: 'ตรวจสอบเสียงและแรงสั่นสะเทือนของเครื่อง', hasMeasurement: false, unit: '' },
            { id: 8, seq: 4, title: 'ตรวจสอบระดับน้ำยาและการรั่วซึม', hasMeasurement: false, unit: '' }
        ]
    },
    {
        catCode: '03', catClass: 'cat-03', catName: 'ระบบไฟฟ้าและการควบคุม',
        items: [
            { id: 9, seq: 1, title: 'ตรวจสอบแรงดันไฟฟ้า (360-400 V)', hasMeasurement: true, unit: 'V', placeholder: 'เช่น 380' },
            { id: 10, seq: 2, title: 'ตรวจสอบกระแสไฟฟ้า (35-55 A)', hasMeasurement: true, unit: 'A', placeholder: 'เช่น 45.2' },
            { id: 11, seq: 3, title: 'ตรวจสอบการทำงานของตู้ควบคุมไฟฟ้า', hasMeasurement: false, unit: '' },
            { id: 12, seq: 4, title: 'ตรวจสอบปุ่มหยุดฉุกเฉินและระบบป้องกัน', hasMeasurement: false, unit: '' }
        ]
    },
    {
        catCode: '04', catClass: 'cat-04', catName: 'ระบบทั่วไปและความปลอดภัย',
        items: [
            { id: 13, seq: 1, title: 'ตรวจสอบสภาพภายนอกของเครื่องจักร', hasMeasurement: false, unit: '' },
            { id: 14, seq: 2, title: 'ตรวจสอบระดับน้ำมันและระบบหล่อลื่น', hasMeasurement: false, unit: '' },
            { id: 15, seq: 3, title: 'ตรวจสอบความสะอาดและการทำงานโดยรวม', hasMeasurement: false, unit: '' }
        ]
    }
];

const DEIStorage = {
    init() {
        // คงฟังก์ชันไว้เพื่อไม่ให้โค้ดอื่น error แต่ไม่ต้องใช้ localStorage แล้ว
    },

    getMachines() {
        return DEFAULT_MACHINES;
    },
    getMachinesByBuilding(b) {
        return this.getMachines().filter(m => m.building === b);
    },
    getMachineByCode(c) {
        return this.getMachines().find(m => m.code === c) || null;
    },

    // เปลี่ยนมาดึงข้อมูลผ่าน Server API (ใช้ async/await)
    async getInspections() {
        try {
            const res = await fetch('/api/inspections');
            return await res.json();
        } catch (e) {
            console.error('Error fetching inspections:', e);
            return [];
        }
    },

    getSettings() { return { lastSelectedApprover: '' }; },
    updateSettings() {},

    getTodayISO() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    },
    getCurrentTimeStr() {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    },
    formatThaiFullDate(dt) {
        const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
        const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
        const d = dt ? this.parseLocalDate(dt) : new Date();
        return `วัน${days[d.getDay()]}ที่ ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
    },
    formatThaiDateOnly(iso) {
        const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
        const d = this.parseLocalDate(iso);
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
    },
    parseLocalDate(iso) {
        if (iso instanceof Date) return iso;
        const [y, m, day] = String(iso).split('-').map(Number);
        return new Date(y, (m || 1) - 1, day || 1);
    },

    async findInspectionByMachineAndDate(code, dateISO) {
        const list = await this.getInspections();
        return list.find(i => i.machineCode === code && i.inspectionDate === dateISO) || null;
    },

    // เปลี่ยนมาบันทึกข้อมูลผ่าน Server API (POST)
    async upsertInspection(record) {
        try {
            const res = await fetch('/api/inspections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(record)
            });
            return await res.json();
        } catch (e) {
            console.error('Error saving inspection:', e);
            return { success: false };
        }
    },

    // เปลี่ยนมาอัปเดตสถานะอนุมัติผ่าน Server API (PUT)
    async approveInspection(id, approver) {
        if (!approver || !approver.trim()) return { success: false, message: 'กรุณาเลือกชื่อผู้อนุมัติ' };
        try {
            const res = await fetch(`/api/inspections/${id}/approve`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    approverName: approver.trim(),
                    approvedDate: this.getTodayISO(),
                    approvedTime: this.getCurrentTimeStr()
                })
            });
            return await res.json();
        } catch (e) {
            console.error('Error approving inspection:', e);
            return { success: false };
        }
    },

    async getTodayDashboardStats() {
        const totalMachines = 24;
        const todayISO = this.getTodayISO();
        const inspections = await this.getInspections();
        const todayInspections = inspections.filter(i => i.inspectionDate === todayISO);

        const inspectedSet = new Set(todayInspections.map(i => i.machineCode));
        const totalInspectedCount = inspectedSet.size;
        const uninspectedCount = Math.max(0, totalMachines - totalInspectedCount);

        let normalMachines = 0;
        let warningMachines = 0;
        let abnormalMachines = 0;

        todayInspections.forEach(rec => {
            let hasAbnormal = false;
            let hasWarning = false;

            if (Array.isArray(rec.items)) {
                rec.items.forEach(item => {
                    if (item.status === 'abnormal') hasAbnormal = true;
                    if (item.status === 'warning') hasWarning = true;
                });
            }

            if (hasAbnormal) abnormalMachines++;
            else if (hasWarning) warningMachines++;
            else normalMachines++;
        });

        return {
            totalMachines,
            totalInspectedCount,
            uninspectedCount,
            normalMachines,
            warningMachines,
            abnormalMachines
        };
    },

    async renderSharedHeaderAndDashboard() {
        const todayISO = this.getTodayISO();
        const headerDate = document.getElementById('headerCurrentDate');
        if (headerDate) headerDate.textContent = this.formatThaiFullDate(todayISO);

        const stats = await this.getTodayDashboardStats();

        const inspectedEl = document.getElementById('dashInspectedCount');
        if (inspectedEl) inspectedEl.innerHTML = `${stats.totalInspectedCount} / ${stats.totalMachines} <small>เครื่อง</small>`;

        const uninspectedEl = document.getElementById('dashUninspectedCount');
        if (uninspectedEl) uninspectedEl.innerHTML = `${stats.uninspectedCount} / ${stats.totalMachines} <small>เครื่อง</small>`;

        const normalEl = document.getElementById('dashNormalCount');
        if (normalEl) normalEl.textContent = stats.normalMachines;

        const warningEl = document.getElementById('dashWarningCount');
        if (warningEl) warningEl.textContent = stats.warningMachines;

        const abnormalEl = document.getElementById('dashAbnormalCount');
        if (abnormalEl) abnormalEl.textContent = stats.abnormalMachines;
    }
};

function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const t = document.createElement('div');
    t.className = `toast-item ${type}`;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 250);
    }, 3500);
}

function buildInspectionDetailHTML(record) {
    const statusMap = {
        normal: '<span class="status-pill" style="background:#dcfce7;color:#16a34a;">ปกติ</span>',
        warning: '<span class="status-pill" style="background:#ffedd5;color:#ea580c;">เฝ้าระวัง</span>',
        abnormal: '<span class="status-pill" style="background:#fee2e2;color:#dc2626;">ผิดปกติ</span>'
    };
    const approvalBadge = record.approvalStatus === 'อนุมัติแล้ว'
        ? '<span class="status-pill approved">อนุมัติแล้ว</span>'
        : '<span class="status-pill pending">รออนุมัติ</span>';

    let rows = '';
    record.items.forEach((item, idx) => {
        rows += `
            <tr>
                <td style="text-align:center;">${idx + 1}</td>
                <td><small class="text-muted">${item.categoryName}</small><br><strong>${item.title}</strong></td>
                <td>${item.hasMeasurement ? `${item.measurementValue || '-'} ${item.unit}` : '-'}</td>
                <td>${statusMap[item.status] || '-'}</td>
                <td>${item.remark || '-'}</td>
            </tr>
        `;
    });

    return `
        <div class="machine-info-grid" style="margin-bottom:14px;">
            <div class="info-item"><span class="info-label">รหัสเครื่องจักร</span><span class="info-value text-blue">${record.machineCode}</span></div>
            <div class="info-item"><span class="info-label">ชื่อเครื่องจักร</span><span class="info-value">${record.machineName}</span></div>
            <div class="info-item"><span class="info-label">ช่างผู้ตรวจสอบ</span><span class="info-value">${record.inspectorName}</span></div>
            <div class="info-item"><span class="info-label">สถานะอนุมัติ</span><span class="info-value">${approvalBadge}</span></div>
        </div>
        <div class="detail-table-wrap">
            <table class="detail-items-table">
                <thead>
                    <tr>
                        <th style="width:50px;text-align:center;">ข้อ</th>
                        <th>รายการตรวจสอบ</th>
                        <th style="width:110px;">ค่าตรวจวัด</th>
                        <th style="width:110px;">สถานะ</th>
                        <th>หมายเหตุ</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}
