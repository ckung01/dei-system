/**
 * Daily Equipment Inspection System - หน้าที่สาม: ประวัติการตรวจสอบ (history.html)
 * ฉบับปรับปรุงรองรับ Server API (Async/Await) 100%
 */

document.addEventListener('DOMContentLoaded', async () => {
    DEIStorage.init();
    await DEIStorage.renderSharedHeaderAndDashboard();

    const specificDateFilter = document.getElementById('specificDateFilter');
    const rangeDaysFilter = document.getElementById('rangeDaysFilter');
    const clearHistoryFilterBtn = document.getElementById('clearHistoryFilterBtn');
    const historyFilterSummary = document.getElementById('historyFilterSummary');
    const historyGroupsContainer = document.getElementById('historyGroupsContainer');

    const historyDetailModal = document.getElementById('historyDetailModal');
    const historyModalBody = document.getElementById('historyModalBody');
    const closeHistoryModalBtn = document.getElementById('closeHistoryModalBtn');
    const okHistoryModalBtn = document.getElementById('okHistoryModalBtn');

    specificDateFilter.addEventListener('change', () => {
        if (specificDateFilter.value) rangeDaysFilter.value = 'all';
        renderHistory();
    });

    rangeDaysFilter.addEventListener('change', () => {
        if (rangeDaysFilter.value !== 'all') specificDateFilter.value = '';
        renderHistory();
    });

    clearHistoryFilterBtn.addEventListener('click', () => {
        specificDateFilter.value = '';
        rangeDaysFilter.value = 'all';
        renderHistory();
    });

    async function renderHistory() {
        // ดึงข้อมูลผ่าน Server API แบบ async/await
        const all = await DEIStorage.getInspections();
        const specificDate = specificDateFilter.value;
        const range = rangeDaysFilter.value;
        let filtered = [...all];

        if (specificDate) {
            filtered = filtered.filter(i => {
                const dateKey = i.inspectionDate ? String(i.inspectionDate).split('T')[0] : '';
                return dateKey === specificDate;
            });
            historyFilterSummary.textContent = `แสดงประวัติเฉพาะวันที่: ${DEIStorage.formatThaiDateOnly(specificDate)}`;
        } else if (range !== 'all') {
            const days = Number(range);
            const today = DEIStorage.parseLocalDate(DEIStorage.getTodayISO());
            const start = DEIStorage.parseLocalDate(DEIStorage.getTodayISO());
            start.setDate(start.getDate() - (days - 1));

            filtered = filtered.filter(i => {
                const dateKey = i.inspectionDate ? String(i.inspectionDate).split('T')[0] : '';
                const d = DEIStorage.parseLocalDate(dateKey);
                return d >= start && d <= today;
            });
            historyFilterSummary.textContent = `แสดงประวัติย้อนหลัง ${days} วัน`;
        } else {
            historyFilterSummary.textContent = `แสดงประวัติการตรวจสอบทั้งหมด`;
        }

        if (filtered.length === 0) {
            historyGroupsContainer.innerHTML = `<div class="empty-data-card">ไม่พบประวัติการตรวจสอบ</div>`;
            return;
        }

        const grouped = {};
        filtered.forEach(i => {
            const dateKey = i.inspectionDate ? String(i.inspectionDate).split('T')[0] : '';
            if (!grouped[dateKey]) grouped[dateKey] = [];
            grouped[dateKey].push(i);
        });

        const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
        let html = '';

        dates.forEach(dateISO => {
            const list = grouped[dateISO];
            list.sort((a, b) => a.machineCode.localeCompare(b.machineCode));

            // สร้างแถวข้อมูลแบบกระชับ (Compact Row) สำหรับแต่ละเครื่องในวันนั้น
            const rowsHTML = list.map((rec, idx) => {
                const approved = rec.approvalStatus === 'อนุมัติแล้ว';
                const statusBadge = approved
                    ? '<span class="compact-pill approved">อนุมัติแล้ว</span>'
                    : '<span class="compact-pill pending">รออนุมัติ</span>';

                return `
                    <div class="compact-history-row">
                        <div class="compact-col-no">${idx + 1}</div>
                        <div class="compact-col-machine">
                            <span class="text-blue font-weight-600">${rec.machineCode}</span>
                            <span class="compact-machine-name">${rec.machineName}</span>
                        </div>
                        <div class="compact-col-info">
                            <span>เวลา: ${rec.inspectionTime}</span>
                            <span>ช่าง: ${rec.inspectorName}</span>
                            <span>ผู้อนุมัติ: ${approved ? (rec.approverName || '-') : '-'}</span>
                        </div>
                        <div class="compact-col-stats">
                            <span class="mini-stat normal">ปกติ: ${rec.summary.normal}</span>
                            <span class="mini-stat warning">เฝ้าระวัง: ${rec.summary.warning}</span>
                            <span class="mini-stat abnormal">ผิดปกติ: ${rec.summary.abnormal}</span>
                        </div>
                        <div class="compact-col-status">
                            ${statusBadge}
                        </div>
                        <div class="compact-col-action">
                            <button type="button" class="btn btn-primary btn-sm btn-history-detail" data-id="${rec.id}">ดูรายละเอียด</button>
                        </div>
                    </div>
                `;
            }).join('');

            // บล็อกการ์ดใหญ่ประจำวันแบบรวมเป็นก้อนเดียว กระชับ ไม่รก
            html += `
                <div class="history-date-card-wrapper">
                    <div class="history-date-card-header">
                        <span>📅 วันที่ ${DEIStorage.formatThaiDateOnly(dateISO)}</span>
                        <span class="badge-count-machine">รวมทั้งหมด ${list.length} เครื่อง</span>
                    </div>
                    <div class="history-card-body-compact">
                        ${rowsHTML}
                    </div>
                </div>
            `;
        });

        historyGroupsContainer.innerHTML = html;

        // ผูก Event ปุ่มดูรายละเอียดแบบ async
        document.querySelectorAll('.btn-history-detail').forEach(btn => {
            btn.addEventListener('click', async () => {
                const allInspections = await DEIStorage.getInspections();
                const rec = allInspections.find(r => r.id === btn.dataset.id);
                if (!rec) return;
                historyModalBody.innerHTML = buildInspectionDetailHTML(rec);
                historyDetailModal.classList.remove('hidden');
            });
        });
    }

    closeHistoryModalBtn.addEventListener('click', () => historyDetailModal.classList.add('hidden'));
    okHistoryModalBtn.addEventListener('click', () => historyDetailModal.classList.add('hidden'));

    await renderHistory();
});
