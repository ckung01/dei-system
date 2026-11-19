/**
 * Daily Equipment Inspection System - หน้าที่สอง: รายการรออนุมัติ (approval.html)
 * ฉบับปรับปรุงรองรับ Server API (Async/Await) 100%
 */

document.addEventListener('DOMContentLoaded', async () => {
    DEIStorage.init();
    await DEIStorage.renderSharedHeaderAndDashboard();

    const pendingListContainer = document.getElementById('pendingListContainer');
    const approvedListContainer = document.getElementById('approvedListContainer');
    const pendingCountBadge = document.getElementById('pendingCountBadge');
    const approvedCountBadge = document.getElementById('approvedCountBadge');

    const approvalConfirmModal = document.getElementById('approvalConfirmModal');
    const approvalModalBody = document.getElementById('approvalModalBody');
    const closeApprovalModalBtn = document.getElementById('closeApprovalModalBtn');
    const cancelApprovalBtn = document.getElementById('cancelApprovalBtn');
    const confirmApprovalBtn = document.getElementById('confirmApprovalBtn');

    const inspectionDetailModal = document.getElementById('inspectionDetailModal');
    const detailModalBody = document.getElementById('detailModalBody');
    const closeDetailModalBtn = document.getElementById('closeDetailModalBtn');
    const okDetailModalBtn = document.getElementById('okDetailModalBtn');

    let currentTargetId = null;

    async function renderLists() {
        // ดึงข้อมูลผ่าน Server API แบบ async/await
        const all = await DEIStorage.getInspections();
  const todayISO = DEIStorage.getTodayISO(); // ดึงวันที่ปัจจุบัน (เช่น '2026-11-18')

  // กรองเฉพาะรายการที่เป็นของ "วันนี้" และรออนุมัติ
  const pending = all.filter(i => i.approvalStatus === 'รออนุมัติ' && i.inspectionDate === todayISO);
  const approved = all.filter(i => i.approvalStatus === 'อนุมัติแล้ว' && i.inspectionDate === todayISO);
        pendingCountBadge.textContent = pending.length;
        approvedCountBadge.textContent = approved.length;

        // 1. Render รายการรออนุมัติ
        if (pending.length === 0) {
            pendingListContainer.innerHTML = `<div class="empty-data-card">ไม่มีรายการรออนุมัติในขณะนี้</div>`;
        } else {
            pendingListContainer.innerHTML = pending.map(r => createPendingCardHTML(r)).join('');
        }

        // 2. Render รายการที่อนุมัติแล้ว
        if (approved.length === 0) {
            approvedListContainer.innerHTML = `<div class="empty-data-card">ยังไม่มีรายการที่อนุมัติแล้ว</div>`;
        } else {
            const groupedApproved = {};
            approved.forEach(item => {
                const dateKey = item.inspectionDate ? String(item.inspectionDate).split('T')[0] : '';
                if (!groupedApproved[dateKey]) {
                    groupedApproved[dateKey] = [];
                }
                groupedApproved[dateKey].push(item);
            });

            const sortedDates = Object.keys(groupedApproved).sort((a, b) => b.localeCompare(a));
            let approvedHTML = '';

            sortedDates.forEach(dateISO => {
                const listOnDate = groupedApproved[dateISO];
                listOnDate.sort((a, b) => a.machineCode.localeCompare(b.machineCode));

                const itemsRows = listOnDate.map((rec, idx) => `
                    <div class="compact-history-row is-approved">
                        <div class="compact-col-no">${idx + 1}</div>
                        <div class="compact-col-machine">
                            <span class="text-blue font-weight-600">อาคาร ${rec.building} | ${rec.machineCode}</span>
                            <span class="compact-machine-name">${rec.machineName}</span>
                        </div>
                        <div class="compact-col-info">
                            <span>เวลา: ${rec.inspectionTime} น. | ช่าง: ${rec.inspectorName}</span>
                            <span>ผู้อนุมัติ: <strong class="text-green">${rec.approverName || '-'}</strong></span>
                        </div>
                        <div class="compact-col-stats">
                            <span class="mini-stat normal">ปกติ: ${rec.summary.normal}</span>
                            <span class="mini-stat warning">เฝ้าระวัง: ${rec.summary.warning}</span>
                            <span class="mini-stat abnormal">ผิดปกติ: ${rec.summary.abnormal}</span>
                        </div>
                        <div class="compact-col-status">
                            <span class="compact-pill approved">อนุมัติแล้ว</span>
                        </div>
                        <div class="compact-col-action">
                            <button type="button" class="btn btn-outline btn-sm btn-view-detail" data-id="${rec.id}">ดูรายละเอียด (15 ข้อ)</button>
                        </div>
                    </div>
                `).join('');

                approvedHTML += `
                    <div class="history-date-card-wrapper">
                        <div class="history-date-card-header">
                            <span>📅 วันที่ ${DEIStorage.formatThaiDateOnly(dateISO)}</span>
                            <span class="badge-count-machine">อนุมัติแล้ว ${listOnDate.length} เครื่อง</span>
                        </div>
                        <div class="history-card-body-compact">
                            ${itemsRows}
                        </div>
                    </div>
                `;
            });

            approvedListContainer.innerHTML = approvedHTML;
        }

        await bindButtons();
    }

    function createPendingCardHTML(record) {
        return `
            <article class="record-card">
                <div class="record-card-top">
                    <div>
                        <div class="record-machine-title">อาคาร ${record.building} | <span class="text-blue">${record.machineCode}</span> - ${record.machineName}</div>
                        <div class="record-meta-line">
                            <span>วันที่: ${DEIStorage.formatThaiDateOnly(record.inspectionDate)} (${record.inspectionTime} น.)</span>
                            <span>ช่าง: ${record.inspectorName}</span>
                        </div>
                    </div>
                    <span class="status-pill pending">รออนุมัติ</span>
                </div>
                <div class="record-summary-strip">
                    <span class="mini-stat normal">ปกติ: ${record.summary.normal}</span>
                    <span class="mini-stat warning">เฝ้าระวัง: ${record.summary.warning}</span>
                    <span class="mini-stat abnormal">ผิดปกติ: ${record.summary.abnormal}</span>
                </div>
                <div class="record-card-actions">
                    <div class="action-buttons-right" style="margin-left:0;">
                        <button type="button" class="btn btn-outline btn-sm btn-view-detail" data-id="${record.id}">ดูรายละเอียด (15 ข้อ)</button>
                        <button type="button" class="btn btn-success btn-sm btn-open-approve" data-id="${record.id}">อนุมัติ</button>
                    </div>
                </div>
            </article>
        `;
    }

    async function bindButtons() {
        const allInspections = await DEIStorage.getInspections();

        document.querySelectorAll('.btn-view-detail').forEach(btn => {
            btn.addEventListener('click', () => {
                const rec = allInspections.find(r => r.id === btn.dataset.id);
                if (!rec) return;
                detailModalBody.innerHTML = buildInspectionDetailHTML(rec);
                inspectionDetailModal.classList.remove('hidden');
            });
        });

        document.querySelectorAll('.btn-open-approve').forEach(btn => {
            btn.addEventListener('click', () => {
                const rec = allInspections.find(r => r.id === btn.dataset.id);
                if (!rec) return;
                currentTargetId = rec.id;
                openModal(rec);
            });
        });
    }

    function openModal(record) {
        const settings = DEIStorage.getSettings();
        const savedApprover = settings.lastSelectedApprover || '';

        approvalModalBody.innerHTML = `
            <div class="form-group" style="margin-bottom:16px;">
                <label for="modalApproverSelect">เลือกชื่อผู้อนุมัติรายการตรวจสอบ <span class="required">*</span></label>
                <select id="modalApproverSelect" class="form-control">
                    <option value="">-- กรุณาเลือกชื่อผู้อนุมัติ --</option>
                    <option value="นายสมชาย ใจดี" ${savedApprover === 'นายสมชาย ใจดี' ? 'selected' : ''}>นายสมชาย ใจดี</option>
                    <option value="นายวิชัย พัฒนกิจ" ${savedApprover === 'นายวิชัย พัฒนกิจ' ? 'selected' : ''}>นายวิชัย พัฒนกิจ</option>
                    <option value="นางสาวสุภาวดี ศรีสุข" ${savedApprover === 'นางสาวสุภาวดี ศรีสุข' ? 'selected' : ''}>นางสาวสุภาวดี ศรีสุข</option>
                </select>
            </div>
            <table class="confirm-summary-table">
                <tr><td>รหัสเครื่องจักร</td><td class="text-blue">${record.machineCode}</td></tr>
                <tr><td>ชื่อเครื่องจักร</td><td>${record.machineName}</td></tr>
                <tr><td>ช่างผู้ตรวจสอบ</td><td>${record.inspectorName}</td></tr>
            </table>
        `;
        approvalConfirmModal.classList.remove('hidden');
    }

    confirmApprovalBtn.addEventListener('click', async () => {
        const select = document.getElementById('modalApproverSelect');
        const approverName = select ? select.value : '';

        if (!approverName) {
            showToast('กรุณาเลือกชื่อผู้อนุมัติก่อนยืนยัน', 'error');
            if (select) select.focus();
            return;
        }

        DEIStorage.updateSettings({ lastSelectedApprover: approverName });

        // รอรับค่าจากการเรียก API อนุมัติแบบ async
        const res = await DEIStorage.approveInspection(currentTargetId, approverName);
        approvalConfirmModal.classList.add('hidden');

        if (res && res.success) {
            showToast('อนุมัติผลการตรวจสอบสำเร็จ', 'success');
            await DEIStorage.renderSharedHeaderAndDashboard();
            await renderLists();
        } else {
            showToast((res && res.message) ? res.message : 'เกิดข้อผิดพลาดในการอนุมัติ', 'error');
        }
    });

    closeApprovalModalBtn.addEventListener('click', () => approvalConfirmModal.classList.add('hidden'));
    cancelApprovalBtn.addEventListener('click', () => approvalConfirmModal.classList.add('hidden'));
    closeDetailModalBtn.addEventListener('click', () => inspectionDetailModal.classList.add('hidden'));
    okDetailModalBtn.addEventListener('click', () => inspectionDetailModal.classList.add('hidden'));

    await renderLists();
});
