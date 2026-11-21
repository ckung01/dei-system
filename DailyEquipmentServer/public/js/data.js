let CACHED_MACHINES = [];
let CACHED_QUESTIONS = [];

function groupQuestionsIntoCategories(questionsList) {
    if (!Array.isArray(questionsList) || questionsList.length === 0) return [];
    return [{
        catCode: 'ALL',
        catClass: 'cat-01',
        catName: 'รายการตรวจสอบเครื่องจักรทั้งหมด',
        items: questionsList.map((q, idx) => ({
            id: q.id,
            seq: idx + 1,
            title: q.title,
            hasMeasurement: Boolean(q.hasMeasurement),
            unit: q.unit || '',
            placeholder: q.placeholder || '8-12'
        }))
    }];
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

    async loadQuestions(machineCode = '') {
        try {
            const url = machineCode
                ? `/api/questions?machineCode=${encodeURIComponent(machineCode)}`
                : '/api/questions';
            const res = await fetch(url);
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
        if (res.ok && data.success) await this.loadQuestions(payload.machineCode || '');
        return data;
    },

    async updateQuestion(id, payload) {
        const res = await fetch(`/api/questions/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.success) await this.loadQuestions(payload.machineCode || '');
        return data;
    },

    async deleteQuestion(id, machineCode = '') {
        const res = await fetch(`/api/questions/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.success) await this.loadQuestions(machineCode);
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

    async rejectInspection(id, approver, rejectReason = '') {
        try {
            const res = await fetch(`/api/inspections/${id}/reject`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    approverName: (approver || 'ผู้อนุมัติ').trim(),
                    rejectReason: (rejectReason || 'ไม่ผ่านการอนุมัติ').trim()
                })
            });
            return await res.json();
        } catch (e) {
            console.error('Error rejecting inspection:', e);
            return { success: false };
        }
    },

    async getTodayDashboardStats() {
        await this.loadMachines();
        const totalMachines = CACHED_MACHINES.length || 24;
        const todayISO = this.getTodayISO();
        const inspections = await this.getInspections();
        const todayInspections = inspections.filter(i => String(i.inspectionDate || '').split('T')[0] === todayISO);

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
        : record.approvalStatus === 'ไม่อนุมัติ'
            ? '<span class="status-pill" style="background:#fee2e2;color:#dc2626;">ไม่อนุมัติ</span>'
            : '<span class="status-pill pending">รออนุมัติ</span>';

    let rows = '';
    (record.items || []).forEach((item, idx) => {
        rows += `
            <tr>
                <td style="text-align:center;">${idx + 1}</td>
                <td><strong>${item.title}</strong></td>
                <td>${item.hasMeasurement ? `${item.measurementValue || '-'} ${item.unit || ''}` : '-'}</td>
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
