document.addEventListener('DOMContentLoaded', async () => {
    await DEIStorage.init();
    await DEIStorage.renderSharedHeaderAndDashboard();

    const pendingContainer = document.getElementById('pendingListContainer');
    const approvedContainer = document.getElementById('approvedListContainer');
    const pendingBadge = document.getElementById('pendingCountBadge');
    const approvedBadge = document.getElementById('approvedCountBadge');

    const confirmModal = document.getElementById('approvalConfirmModal');
    const approvalModalBody = document.getElementById('approvalModalBody');
    const confirmApprovalBtn = document.getElementById('confirmApprovalBtn');
    const cancelApprovalBtn = document.getElementById('cancelApprovalBtn');
    const closeApprovalModalBtn = document.getElementById('closeApprovalModalBtn');

    const detailModal = document.getElementById('inspectionDetailModal');
    const detailModalBody = document.getElementById('detailModalBody');
    const closeDetailModalBtn = document.getElementById('closeDetailModalBtn');
    const okDetailModalBtn = document.getElementById('okDetailModalBtn');

    let selectedRecordId = null;

    async function renderLists() {
        const all = await DEIStorage.getInspections();
        const pending = all.filter(r => r.approvalStatus === 'รออนุมัติ');
        const approved = all.filter(r => r.approvalStatus === 'อนุมัติแล้ว' || r.approvalStatus === 'ไม่อนุมัติ');

        if (pendingBadge) pendingBadge.textContent = pending.length;
        if (approvedBadge) approvedBadge.textContent = approved.length;

        pendingContainer.innerHTML = pending.length
            ? pending.map(r => buildCardHTML(r, true)).join('')
            : '<div class="empty-box">ไม่มีรายการรออนุมัติ</div>';

        approvedContainer.innerHTML = approved.length
            ? approved.map(r => buildCardHTML(r, false)).join('')
            : '<div class="empty-box">ยังไม่มีรายการที่ดำเนินการแล้ว</div>';

        bindCardActions(all);
    }

    function buildCardHTML(rec, isPending) {
        const statusBadge = rec.approvalStatus === 'อนุมัติแล้ว'
            ? '<span class="status-pill approved">อนุมัติแล้ว</span>'
            : rec.approvalStatus === 'ไม่อนุมัติ'
                ? '<span class="status-pill" style="background:#fee2e2;color:#dc2626;">ไม่อนุมัติ</span>'
                : '<span class="status-pill pending">รออนุมัติ</span>';

        return `
            <div class="approval-card">
                <div class="approval-card-main">
                    <div class="approval-card-top">
                        <strong>${rec.machineCode} - ${rec.machineName}</strong>
                        ${statusBadge}
                    </div>
                    <div class="approval-card-meta">
                        <span>อาคาร ${rec.building}</span>
                        <span>วันที่: ${DEIStorage.formatThaiDateOnly(rec.inspectionDate)} (${rec.inspectionTime || ''})</span>
                        <span>ผู้ตรวจ: ${rec.inspectorName || '-'}</span>
                        ${rec.approverName ? `<span>ผู้อนุมัติ: ${rec.approverName}</span>` : ''}
                        ${rec.rejectReason ? `<span style="color:#dc2626;">เหตุผล: ${rec.rejectReason}</span>` : ''}
                    </div>
                    <div class="approval-summary-line">
                        <span>ปกติ: <strong>${rec.summary?.normal ?? 0}</strong></span>
                        <span>เฝ้าระวัง: <strong>${rec.summary?.warning ?? 0}</strong></span>
                        <span>ผิดปกติ: <strong>${rec.summary?.abnormal ?? 0}</strong></span>
                    </div>
                </div>
                <div class="approval-card-actions">
                    <button type="button" class="btn btn-secondary btn-detail-view" data-id="${rec.id}">ดูรายละเอียด</button>
                    ${isPending ? `
                        <button type="button" class="btn btn-success btn-open-approve" data-id="${rec.id}">อนุมัติ</button>
                        <button type="button" class="btn btn-danger btn-open-reject" data-id="${rec.id}" style="background:#dc2626;color:#fff;">ไม่อนุมัติ</button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    function bindCardActions(allRecords) {
        document.querySelectorAll('.btn-detail-view').forEach(btn => {
            btn.addEventListener('click', () => {
                const rec = allRecords.find(r => String(r.id) === String(btn.dataset.id));
                if (!rec) return;
                detailModalBody.innerHTML = buildInspectionDetailHTML(rec);
                detailModal.classList.remove('hidden');
            });
        });

        document.querySelectorAll('.btn-open-approve').forEach(btn => {
            btn.addEventListener('click', () => {
                const rec = allRecords.find(r => String(r.id) === String(btn.dataset.id));
                if (!rec) return;
                selectedRecordId = rec.id;
                const currentUser = DEIAuth.getUser();
                const defaultName = currentUser?.fullName || 'นภาพร สุขสวัสดิ์';

                approvalModalBody.innerHTML = `
                    <p style="margin-bottom:10px;">ยืนยันการอนุมัติรายการตรวจเช็กของเครื่อง <strong>${rec.machineCode} - ${rec.machineName}</strong></p>
                    <div class="form-group">
                        <label for="approverNameInput">ชื่อผู้อนุมัติ</label>
                        <input type="text" id="approverNameInput" class="form-control" value="${defaultName}">
                    </div>
                `;
                confirmApprovalBtn.textContent = 'ยืนยันอนุมัติ';
                confirmApprovalBtn.className = 'btn btn-success';
                confirmApprovalBtn.dataset.mode = 'approve';
                confirmModal.classList.remove('hidden');
            });
        });

        document.querySelectorAll('.btn-open-reject').forEach(btn => {
            btn.addEventListener('click', () => {
                const rec = allRecords.find(r => String(r.id) === String(btn.dataset.id));
                if (!rec) return;
                selectedRecordId = rec.id;
                const currentUser = DEIAuth.getUser();
                const defaultName = currentUser?.fullName || 'นภาพร สุขสวัสดิ์';

                approvalModalBody.innerHTML = `
                    <p style="margin-bottom:10px;">ระบุเหตุผลที่ไม่ผ่านการอนุมัติสำหรับเครื่อง <strong>${rec.machineCode} - ${rec.machineName}</strong></p>
                    <div class="form-group" style="margin-bottom:10px;">
                        <label for="approverNameInput">ชื่อผู้อนุมัติ</label>
                        <input type="text" id="approverNameInput" class="form-control" value="${defaultName}">
                    </div>
                    <div class="form-group">
                        <label for="rejectReasonInput">เหตุผลที่ไม่อนุมัติ</label>
                        <input type="text" id="rejectReasonInput" class="form-control" placeholder="เช่น ข้อมูลไม่ครบถ้วน / ต้องตรวจซ้ำ">
                    </div>
                `;
                confirmApprovalBtn.textContent = 'ยืนยันไม่อนุมัติ';
                confirmApprovalBtn.className = 'btn btn-danger';
                confirmApprovalBtn.style.background = '#dc2626';
                confirmApprovalBtn.style.color = '#fff';
                confirmApprovalBtn.dataset.mode = 'reject';
                confirmModal.classList.remove('hidden');
            });
        });
    }

    confirmApprovalBtn.addEventListener('click', async () => {
        if (!selectedRecordId) return;
        const mode = confirmApprovalBtn.dataset.mode || 'approve';
        const approverName = document.getElementById('approverNameInput')?.value.trim() || 'ผู้อนุมัติ';

        if (mode === 'reject') {
            const reason = document.getElementById('rejectReasonInput')?.value.trim() || 'ไม่ผ่านการอนุมัติ';
            const res = await DEIStorage.rejectInspection(selectedRecordId, approverName, reason);
            if (res && res.success) {
                showToast('บันทึกรายการ "ไม่อนุมัติ" เรียบร้อยแล้ว', 'warning');
                confirmModal.classList.add('hidden');
                selectedRecordId = null;
                await renderLists();
                await DEIStorage.renderSharedHeaderAndDashboard();
            } else {
                showToast(res?.message || 'ดำเนินการไม่อนุมัติไม่สำเร็จ', 'error');
            }
            return;
        }

        const res = await DEIStorage.approveInspection(selectedRecordId, approverName);
        if (res && res.success) {
            showToast('อนุมัติผลการตรวจสอบเรียบร้อยแล้ว', 'success');
            confirmModal.classList.add('hidden');
            selectedRecordId = null;
            await renderLists();
            await DEIStorage.renderSharedHeaderAndDashboard();
        } else {
            showToast(res?.message || 'อนุมัติไม่สำเร็จ', 'error');
        }
    });

    function closeConfirmModal() {
        confirmModal.classList.add('hidden');
        selectedRecordId = null;
    }

    cancelApprovalBtn.addEventListener('click', closeConfirmModal);
    closeApprovalModalBtn.addEventListener('click', closeConfirmModal);
    closeDetailModalBtn.addEventListener('click', () => detailModal.classList.add('hidden'));
    okDetailModalBtn.addEventListener('click', () => detailModal.classList.add('hidden'));

    await renderLists();
});
