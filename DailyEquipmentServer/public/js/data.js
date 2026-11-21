/**
 * Daily Equipment Inspection System - Data Management (Database API Version)
 */

let CACHED_MACHINES = [];
let CACHED_QUESTIONS = [];

function groupQuestionsIntoCategories(questionsList) {
    const map = new Map();
    questionsList.forEach(q => {
        const key = `${q.catCode || '04'}|${q.catName || 'หมวดทั่วไป'}`;
        if (!map.has(key)) {
            map.set(key, {
                catCode: q.catCode || '04',
                catClass: q.catClass || `cat-${q.catCode || '04'}`,
                catName: q.catName || 'หมวดทั่วไป',
                items: []
            });
        }
        map.get(key).items.push({
            id: q.id,
            seq: q.seq,
            title: q.title,
            hasMeasurement: Boolean(q.hasMeasurement),
            unit: q.unit || '',
            placeholder: q.placeholder || ''
        });
    });
    return Array.from(map.values());
}

const DEIStorage = {
    async init() {
        await Promise.all([
            this.loadMachines(),
            this.loadQuestions()
        ]);
    },

    async loadMachines() {
        try {
            const res = await fetch('/api/machines');
            const data = await res.json();
            if (Array.isArray(data)) {
                CACHED_MACHINES = data;
            }
        } catch (e) {
            console.error('Error loading machines:', e);
        }
        return CACHED_MACHINES;
    },

    async loadQuestions() {
        try {
            const res = await fetch('/api/questions');
            const data = await res.json();
            if (Array.isArray(data)) {
                CACHED_QUESTIONS = data;
            }
        } catch (e) {
            console.error('Error loading questions:', e);
        }
        return CACHED_QUESTIONS;
    },

    getMachines() {
        return CACHED_MACHINES;
    },

    getMachinesByBuilding(b) {
        return CACHED_MACHINES.filter(m => m.building === b);
    },

    getMachineByCode(c) {
        return CACHED_MACHINES.find(m => m.code === c) || null;
    },

    getQuestions() {
        return CACHED_QUESTIONS;
    },

    getChecklistCategories() {
        return groupQuestionsIntoCategories(CACHED_QUESTIONS);
    },

    async addMachine(payload) {
        const res = await fetch('/api/machines', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.success) await this.loadMachines();
        return data;
    },

    async deleteMachine(id) {
        const res = await fetch(`/api/machines/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.success) await this.loadMachines();
        return data;
    },

    async addQuestion(payload) {
        const res = await fetch('/api/questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.success) await this.loadQuestions();
        return data;
    },

    async updateQuestion(id, payload) {
        const res = await fetch(`/api/questions/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.success) await this.loadQuestions();
        return data;
    },

    async deleteQuestion(id) {
        const res = await fetch(`/api/questions/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.success) await this.loadQuestions();
        return data;
    },

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
        await this.loadMachines();
        const totalMachines = CACHED_MACHINES.length || 24;
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
