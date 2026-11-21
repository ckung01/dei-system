/**
 * Daily Equipment Inspection System - หน้าที่สอง: รายการรออนุมัติ (approval.html)
 * ฉบับปรับปรุงรองรับ Server API (Async/Await) 100% + ปุ่มไม่อนุมัติพร้อมช่องกรอกเหตุผล + กรอกชื่อผู้อนุมัติ
 */

document.addEventListener('DOMContentLoaded', async () => {
    await DEIStorage.init();
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
    let currentModalMode = 'approve'; // 'approve' | 'reject'

    function getSavedApprover() {
        if (typeof DEIStorage.getSettings === 'function') {
            return DEIStorage.getSettings().lastSelectedApprover || '';
        }
        return localStorage.getItem('dei_last_approver') || '';
    }

    function saveSelectedApprover(name) {
        if (typeof DEIStorage.updateSettings === 'function') {
            DEIStorage.updateSettings({ lastSelectedApprover: name });
        } else {
            localStorage.setItem('dei_last_approver', name);
        }
    }

    async function renderLists() {
        const all = await DEIStorage.getInspections();
        const todayISO = DEIStorage.getTodayISO();

        const pending = all.filter(i => i.approvalStatus === 'รออนุมัติ' && String(i.inspectionDate || '').split('T')[0] === todayISO);
        const approved = all.filter(i => (i.approvalStatus === 'อนุมัติแล้ว' || i.approvalStatus === 'ไม่อนุมัติ') && String(i.inspectionDate || '').split('T')[0] === todayISO);

        if (pendingCountBadge) pendingCountBadge.textContent = pending.length;
        if (approvedCountBadge) approvedCountBadge.textContent = approved.length;

        // 1. Render รายการรออนุมัติ
        if (pending.length === 0) {
            pendingListContainer.innerHTML = `<div class="empty-data-card">ไม่มีรายการรออนุมัติในขณะนี้</div>`;
        } else {
            pendingListContainer.innerHTML = pending.map(r => createPendingCardHTML(r)).join('');
        }

        // 2. Render รายการที่ดำเนินการแล้ว (อนุมัติแล้ว / ไม่อนุมัติ)
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

                const itemsRows = listOnDate.map((rec, idx) => {
                    const isRejected = rec.approvalStatus === 'ไม่อนุมัติ';
                    const statusPillHTML = isRejected
                        ? `<span class="compact-pill" style="background:#fee2e2;color:#dc2626;">ไม่อนุมัติ</span>`
                        : `<span class="compact-pill approved">อนุมัติแล้ว</span>`;

                    return `
                        <div class="compact-history-row ${isRejected ? '' : 'is-approved'}">
                            <div class="compact-col-no">${idx + 1}</div>
                            <div class="compact-col-machine">
                                <span class="text-blue font-weight-600">อาคาร ${rec.building} | ${rec.machineCode}</span>
                                <span class="compact-machine-name">${rec.machineName}</span>
                            </div>
                            <div class="compact-col-info">
                                <span>เวลา: ${rec.inspectionTime} น. | ช่าง: ${rec.inspectorName}</span>
                                <span>ผู้อนุมัติ: <strong class="${isRejected ? 'text-red' : 'text-green'}">${rec.approverName || '-'}</strong></span>
                                ${rec.rejectReason ? `<span style="color:#dc2626;">เหตุผล: ${rec.rejectReason}</span>` : ''}
                            </div>
                            <div class="compact-col-stats">
                                <span class="mini-stat normal">ปกติ: ${rec.summary.normal}</span>
                                <span class="mini-stat warning">เฝ้าระวัง: ${rec.summary.warning}</span>
                                <span class="mini-stat abnormal">ผิดปกติ: ${rec.summary.abnormal}</span>
                            </div>
                            <div class="compact-col-status">
                                ${statusPillHTML}
                            </div>
                            <div class="compact-col-action">
                                <button type="button" class="btn btn-outline btn-sm btn-view-detail" data-id="${rec.id}">ดูรายละเอียด (15 ข้อ)</button>
                            </div>
                        </div>
                    `;
                }).join('');

                approvedHTML += `
                    <div class="history-date-card-wrapper">
                        <div class="history-date-card-header">
                            <span>📅 วันที่ ${DEIStorage.formatThaiDateOnly(dateISO)}</span>
                            <span class="badge-count-machine">ดำเนินการแล้ว ${listOnDate.length} เครื่อง</span>
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
                    <div class="action-buttons-right" style="margin-left:0;display:flex;gap:8px;flex-wrap:wrap;">
                        <button type="button" class="btn btn-outline btn-sm btn-view-detail" data-id="${record.id}">ดูรายละเอียด (15 ข้อ)</button>
                        <button type="button" class="btn btn-success btn-sm btn-open-approve" data-id="${record.id}">อนุมัติ</button>
                        <button type="button" class="btn btn-danger btn-sm btn-open-reject" data-id="${record.id}" style="background:#dc2626;color:#fff;border-color:#dc2626;">ไม่อนุมัติ</button>
                    </div>
                </div>
            </article>
        `;
    }

    async function bindButtons() {
        const allInspections = await DEIStorage.getInspections();

        document.querySelectorAll('.btn-view-detail').forEach(btn => {
            btn.addEventListener('click', () => {
                const rec = allInspections.find(r => String(r.id) === String(btn.dataset.id));
                if (!rec) return;
                detailModalBody.innerHTML = buildInspectionDetailHTML(rec);
                inspectionDetailModal.classList.remove('hidden');
            });
        });

        document.querySelectorAll('.btn-open-approve').forEach(btn => {
            btn.addEventListener('click', () => {
                const rec = allInspections.find(r => String(r.id) === String(btn.dataset.id));
                if (!rec) return;
                currentTargetId = rec.id;
                openModal(rec, 'approve');
            });
        });

        document.querySelectorAll('.btn-open-reject').forEach(btn => {
            btn.addEventListener('click', () => {
                const rec = allInspections.find(r => String(r.id) === String(btn.dataset.id));
                if (!rec) return;
                currentTargetId = rec.id;
                openModal(rec, 'reject');
            });
        });
    }

    function openModal(record, mode = 'approve') {
        currentModalMode = mode;
        const savedApprover = getSavedApprover();
        const isReject = mode === 'reject';

        const modalTitleEl = approvalConfirmModal.querySelector('.modal-header h3');
        if (modalTitleEl) {
            modalTitleEl.textContent = isReject ? 'ไม่อนุมัติผลการตรวจสอบ' : 'การอนุมัติผลการตรวจสอบ';
        }

        confirmApprovalBtn.textContent = isReject ? 'ยืนยันไม่อนุมัติ' : 'ยืนยันอนุมัติ';
        confirmApprovalBtn.className = isReject ? 'btn btn-danger' : 'btn btn-success';
        confirmApprovalBtn.style.background = isReject ? '#dc2626' : '';
        confirmApprovalBtn.style.color = isReject ? '#ffffff' : '';

        approvalModalBody.innerHTML = `
            <div class="form-group" style="margin-bottom:14px;">
                <label for="modalApproverInput">ชื่อผู้อนุมัติรายการตรวจสอบ <span class="required">*</span></label>
                <input type="text" id="modalApproverInput" class="form-control" placeholder="ระบุชื่อ-นามสกุล ผู้อนุมัติ" value="${savedApprover}">
            </div>
            ${isReject ? `
                <div class="form-group" style="margin-bottom:14px;">
                    <label for="modalRejectReasonInput">เหตุผลที่ไม่อนุมัติ <span class="required">*</span></label>
                    <textarea id="modalRejectReasonInput" class="form-control" rows="3" placeholder="ระบุเหตุผลที่ไม่อนุมัติ เช่น ค่าตรวจวัดไม่สอดคล้อง / ต้องตรวจสอบซ้ำ"></textarea>
                </div>
            ` : ''}
            <table class="confirm-summary-table">
                <tr><td>รหัสเครื่องจักร</td><td class="text-blue">${record.machineCode}</td></tr>
                <tr><td>ชื่อเครื่องจักร</td><td>${record.machineName}</td></tr>
                <tr><td>ช่างผู้ตรวจสอบ</td><td>${record.inspectorName}</td></tr>
            </table>
        `;
        approvalConfirmModal.classList.remove('hidden');

        setTimeout(() => {
            if (isReject) {
                document.getElementById('modalRejectReasonInput')?.focus();
            } else {
                document.getElementById('modalApproverInput')?.focus();
            }
        }, 50);
    }

    confirmApprovalBtn.addEventListener('click', async () => {
        const inputEl = document.getElementById('modalApproverInput');
        const approverName = inputEl ? inputEl.value.trim() : '';

        if (!approverName) {
            showToast('กรุณากรอกชื่อผู้อนุมัติก่อนยืนยัน', 'error');
            if (inputEl) inputEl.focus();
            return;
        }

        saveSelectedApprover(approverName);

        if (currentModalMode === 'reject') {
            const reasonEl = document.getElementById('modalRejectReasonInput');
            const rejectReason = reasonEl ? reasonEl.value.trim() : '';

            if (!rejectReason) {
                showToast('กรุณากรอกเหตุผลที่ไม่อนุมัติก่อนยืนยัน', 'error');
                if (reasonEl) reasonEl.focus();
                return;
            }

            const res = await DEIStorage.rejectInspection(currentTargetId, approverName, rejectReason);
            approvalConfirmModal.classList.add('hidden');

            if (res && res.success) {
                showToast('บันทึกรายการ "ไม่อนุมัติ" เรียบร้อยแล้ว', 'success');
                await DEIStorage.renderSharedHeaderAndDashboard();
                await renderLists();
            } else {
                showToast((res && res.message) ? res.message : 'เกิดข้อผิดพลาดในการบันทึกไม่อนุมัติ', 'error');
            }
            return;
        }

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
