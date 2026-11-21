document.addEventListener('DOMContentLoaded', async () => {
    const currentUser = DEIAuth.getUser();
    const isReadOnlyApprover = currentUser && currentUser.role === 'approver';

    await DEIStorage.init();
    await DEIStorage.renderSharedHeaderAndDashboard();

    const buildingSelect = document.getElementById('buildingSelect');
    const machineSelect = document.getElementById('machineSelect');
    const searchMachineBtn = document.getElementById('searchMachineBtn');
    const emptyStateGuide = document.getElementById('emptyStateGuide');
    const inspectionFormContainer = document.getElementById('inspectionFormContainer');
    const checklistCategoriesContainer = document.getElementById('checklistCategoriesContainer');
    const inspectorNameInput = document.getElementById('inspectorNameInput');
    const resetFormBtn = document.getElementById('resetFormBtn');
    const submitFormBtn = inspectionFormContainer.querySelector('button[type="submit"]');

    // ลบกล่องปุ่มซ้ำด้านล่างออกถ้าเคยสร้างไว้
    const oldExtraBox = document.getElementById('machineColorStatusBox');
    if (oldExtraBox) oldExtraBox.remove();

    if (isReadOnlyApprover) {
        inspectorNameInput.disabled = true;
        inspectorNameInput.placeholder = 'โหมดดูข้อมูลสำหรับผู้อนุมัติ (ไม่สามารถกรอกหรือบันทึกได้)';
        if (resetFormBtn) resetFormBtn.style.display = 'none';
        if (submitFormBtn) submitFormBtn.style.display = 'none';
    }

    let currentMachine = null;
    let checklistState = {};

    const MEASUREMENT_RANGES = {
        1: { min: 4.0, max: 8.0, name: 'แรงดันด้านขาดูด' },
        2: { min: 12.0, max: 18.0, name: 'แรงดันด้านจ่าย' },
        5: { min: 10.0, max: 15.0, name: 'อุณหภูมิน้ำเข้า' },
        6: { min: 5.0, max: 9.0, name: 'อุณหภูมิน้ำออก' },
        9: { min: 360.0, max: 400.0, name: 'แรงดันไฟฟ้า' },
        10: { min: 35.0, max: 55.0, name: 'กระแสไฟฟ้า' }
    };

    function getFlatQuestions() {
        const cats = DEIStorage.getChecklistCategories();
        return cats.flatMap((cat) =>
            cat.items.map((item, idx) => ({
                ...item,
                seq: idx + 1,
                categoryCode: cat.catCode || '01',
                categoryName: cat.catName || 'รายการตรวจสอบเครื่องจักรประจำวัน'
            }))
        );
    }

    // อนุมัติแล้ว = ตัวอักษรสีเขียว, รออนุมัติ = ต่อท้าย [รออนุมัติ] (ตัวอักษรสีดำ), ยังไม่ตรวจ/ไม่อนุมัติ = ตัวอักษรสีดำ
    function getOptionDisplay(m, todayInspections) {
        const rec = todayInspections.find(i => i.machineCode === m.code);
        if (!rec) {
            return { text: `${m.code} - ${m.name}`, color: '#0f172a' };
        }
        if (rec.approvalStatus === 'อนุมัติแล้ว') {
            return { text: `${m.code} - ${m.name}`, color: '#16a34a' };
        }
        if (rec.approvalStatus === 'รออนุมัติ') {
            return { text: `${m.code} - ${m.name} [รออนุมัติ]`, color: '#0f172a' };
        }
        return { text: `${m.code} - ${m.name}`, color: '#0f172a' };
    }

    function applySelectedOptionColor() {
        const selectedOpt = machineSelect.options[machineSelect.selectedIndex];
        machineSelect.style.color = (selectedOpt && selectedOpt.style.color) ? selectedOpt.style.color : '#0f172a';
    }

    machineSelect.addEventListener('change', applySelectedOptionColor);

    buildingSelect.addEventListener('change', async () => {
        const b = buildingSelect.value;
        machineSelect.innerHTML = '';
        machineSelect.style.color = '#0f172a';

        if (!b) {
            machineSelect.disabled = true;
            machineSelect.innerHTML = '<option value="">-- กรุณาเลือกอาคารก่อน --</option>';
            return;
        }

        const machines = DEIStorage.getMachinesByBuilding(b);
        const todayISO = DEIStorage.getTodayISO();

        machineSelect.disabled = false;
        machineSelect.innerHTML = `<option value="">-- เลือกเครื่องจักรในอาคาร ${b} (${machines.length} เครื่อง) --</option>`;

        let todayInspections = [];
        try {
            const allInspections = await DEIStorage.getInspections();
            todayInspections = allInspections.filter(i => String(i.inspectionDate || '').split('T')[0] === todayISO);
        } catch (e) {
            console.error('Error checking inspection status:', e);
        }

        machines.forEach(m => {
            const disp = getOptionDisplay(m, todayInspections);
            const opt = document.createElement('option');
            opt.value = m.code;
            opt.textContent = disp.text;
            opt.style.color = disp.color;
            machineSelect.appendChild(opt);
        });
    });

    searchMachineBtn.addEventListener('click', async () => {
        const b = buildingSelect.value;
        const code = machineSelect.value;
        if (!b) { showToast('กรุณาเลือกอาคาร', 'warning'); return; }
        if (!code) { showToast('กรุณาเลือกเครื่องจักร', 'warning'); return; }

        const machine = DEIStorage.getMachineByCode(code);
        if (!machine) return;

        currentMachine = machine;
        await openForm(machine);
    });

    async function openForm(machine) {
        await DEIStorage.loadQuestions(machine.code);
        const itemsList = getFlatQuestions();
        const totalQuestions = itemsList.length;
        const todayISO = DEIStorage.getTodayISO();

        const headerTitleEl = document.querySelector('.checklist-header-bar h3');
        if (headerTitleEl) {
            headerTitleEl.textContent = `รายการตรวจเช็กเครื่องจักรประจำวัน (${totalQuestions} รายการ)`;
        }

        let existing = null;
        try {
            const allInspections = await DEIStorage.getInspections();
            existing = allInspections.find(i => {
                const dbDate = i.inspectionDate ? String(i.inspectionDate).split('T')[0] : '';
                return i.machineCode === machine.code && dbDate === todayISO;
            }) || null;
        } catch (e) {
            console.error('Error finding existing inspection:', e);
        }

        checklistState = {};
        itemsList.forEach(i => {
            checklistState[i.id] = { status: '', measurementValue: '', remark: '' };
        });

        document.getElementById('detailBuilding').textContent = `อาคาร ${machine.building}`;
        document.getElementById('detailMachineCode').textContent = machine.code;
        document.getElementById('detailMachineName').textContent = machine.name;
        document.getElementById('detailInspectDate').textContent = DEIStorage.formatThaiFullDate(todayISO);

        const banner = document.getElementById('duplicateWarningBanner');
        const badge = document.getElementById('machineTodayStatusBadge');

        if (existing) {
            banner.classList.remove('hidden');
            badge.textContent = existing.approvalStatus === 'รออนุมัติ'
                ? 'รออนุมัติ'
                : existing.approvalStatus === 'ไม่อนุมัติ'
                    ? 'ไม่อนุมัติ'
                    : 'ตรวจแล้ววันนี้';
            badge.classList.add('checked');
            inspectorNameInput.value = existing.inspectorName || '';

            if (Array.isArray(existing.items)) {
                existing.items.forEach((oldItem, idx) => {
                    const target = itemsList.find(q => q.seq === oldItem.seq) || itemsList[idx];
                    if (target) {
                        checklistState[target.id] = {
                            status: oldItem.status || '',
                            measurementValue: oldItem.measurementValue || '',
                            remark: oldItem.remark || ''
                        };
                    }
                });
            }
            showToast('โหลดข้อมูลของวันนี้แล้ว', 'info');
        } else {
            banner.classList.add('hidden');
            badge.textContent = 'ยังไม่ตรวจวันนี้';
            badge.classList.remove('checked');
            inspectorNameInput.value = '';
        }

        renderChecklist();
        updateProgress();
        emptyStateGuide.classList.add('hidden');
        inspectionFormContainer.classList.remove('hidden');
    }

    function renderChecklist() {
        const itemsList = getFlatQuestions();
        checklistCategoriesContainer.innerHTML = '';

        const card = document.createElement('div');
        card.className = 'category-card cat-01';
        card.innerHTML = `
            <div class="category-header">
                <div class="category-title-wrap">
                    <span class="category-name">รายการตรวจสอบเครื่องจักรประจำวัน</span>
                </div>
                <span class="category-count-badge">${itemsList.length} รายการ</span>
            </div>
        `;

        itemsList.forEach((item, index) => {
            const displaySeq = index + 1;
            const st = checklistState[item.id] || { status: '', measurementValue: '', remark: '' };
            const needRemark = st.status === 'warning' || st.status === 'abnormal';

            let placeholderText = item.placeholder || 'กรอกค่าตรวจวัด';
            if (MEASUREMENT_RANGES[displaySeq] && !item.placeholder) {
                const r = MEASUREMENT_RANGES[displaySeq];
                placeholderText = `ปกติ ${r.min}-${r.max} ${item.unit}`;
            }

            const row = document.createElement('div');
            row.className = 'checklist-item-row';
            row.innerHTML = `
                <div class="item-main-line">
                    <div class="item-left-info">
                        <span class="item-seq">${displaySeq}</span>
                        <span class="item-title">${item.title}</span>
                    </div>
                    <div class="item-right-controls">
                        ${item.hasMeasurement ? `
                            <div class="measurement-box" title="ตัวอย่างค่า: ${placeholderText}">
                                <input type="number" step="any" class="measurement-input" data-item-id="${item.id}" data-seq="${displaySeq}" placeholder="${placeholderText}" value="${st.measurementValue}" ${isReadOnlyApprover ? 'disabled' : ''}>
                                <span class="measurement-unit">${item.unit}</span>
                            </div>
                        ` : ''}
                        <div class="status-btn-group">
                            <button type="button" class="status-btn ${st.status === 'normal' ? 'selected' : ''}" data-item-id="${item.id}" data-status="normal" ${isReadOnlyApprover ? 'disabled' : ''}>ปกติ</button>
                            <button type="button" class="status-btn ${st.status === 'warning' ? 'selected' : ''}" data-item-id="${item.id}" data-status="warning" ${isReadOnlyApprover ? 'disabled' : ''}>เฝ้าระวัง</button>
                            <button type="button" class="status-btn ${st.status === 'abnormal' ? 'selected' : ''}" data-item-id="${item.id}" data-status="abnormal" ${isReadOnlyApprover ? 'disabled' : ''}>ผิดปกติ</button>
                        </div>
                    </div>
                </div>
                <div class="item-remark-box ${needRemark ? '' : 'hidden'}" id="remarkBox_${item.id}">
                    <input type="text" class="remark-input ${st.status === 'abnormal' ? 'is-abnormal' : ''}" id="remarkInput_${item.id}" data-item-id="${item.id}" placeholder="ระบุหมายเหตุ / อาการ *" value="${st.remark}" ${isReadOnlyApprover ? 'disabled' : ''}>
                </div>
            `;
            card.appendChild(row);
        });

        checklistCategoriesContainer.appendChild(card);

        if (!isReadOnlyApprover) {
            bindEvents();
        }
    }

    function bindEvents() {
        checklistCategoriesContainer.querySelectorAll('.status-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = Number(btn.dataset.itemId);
                const stat = btn.dataset.status;
                if (!checklistState[id]) checklistState[id] = {};
                checklistState[id].status = stat;

                btn.parentElement.querySelectorAll('.status-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');

                const box = document.getElementById(`remarkBox_${id}`);
                const input = document.getElementById(`remarkInput_${id}`);
                if (stat === 'warning' || stat === 'abnormal') {
                    box.classList.remove('hidden');
                    if (stat === 'abnormal') input.classList.add('is-abnormal');
                    else input.classList.remove('is-abnormal');
                } else {
                    box.classList.add('hidden');
                    checklistState[id].remark = '';
                    if (input) input.value = '';
                }
                updateProgress();
            });
        });

        checklistCategoriesContainer.querySelectorAll('.measurement-input').forEach(input => {
            input.addEventListener('input', () => {
                const id = Number(input.dataset.itemId);
                const seq = Number(input.dataset.seq);
                const val = input.value;
                if (!checklistState[id]) checklistState[id] = {};
                checklistState[id].measurementValue = val;

                if (val !== '' && MEASUREMENT_RANGES[seq]) {
                    const num = parseFloat(val);
                    const range = MEASUREMENT_RANGES[seq];

                    if (!isNaN(num)) {
                        const row = input.closest('.checklist-item-row');
                        const normalBtn = row.querySelector('.status-btn[data-status="normal"]');
                        const abnormalBtn = row.querySelector('.status-btn[data-status="abnormal"]');
                        const box = document.getElementById(`remarkBox_${id}`);
                        const remarkInput = document.getElementById(`remarkInput_${id}`);

                        if (num < range.min || num > range.max) {
                            checklistState[id].status = 'abnormal';
                            row.querySelectorAll('.status-btn').forEach(b => b.classList.remove('selected'));
                            if (abnormalBtn) abnormalBtn.classList.add('selected');

                            box.classList.remove('hidden');
                            remarkInput.classList.add('is-abnormal');
                            if (!checklistState[id].remark) {
                                checklistState[id].remark = `ค่าเกินเกณฑ์มาตรฐาน (${range.min}-${range.max})`;
                                remarkInput.value = checklistState[id].remark;
                            }
                        } else {
                            if (checklistState[id].status === '' || checklistState[id].status === 'abnormal') {
                                checklistState[id].status = 'normal';
                                row.querySelectorAll('.status-btn').forEach(b => b.classList.remove('selected'));
                                if (normalBtn) normalBtn.classList.add('selected');

                                box.classList.add('hidden');
                                checklistState[id].remark = '';
                                if (remarkInput) remarkInput.value = '';
                            }
                        }
                        updateProgress();
                    }
                }
            });
        });

        checklistCategoriesContainer.querySelectorAll('.remark-input').forEach(input => {
            input.addEventListener('input', () => {
                const id = Number(input.dataset.itemId);
                if (!checklistState[id]) checklistState[id] = {};
                checklistState[id].remark = input.value;
            });
        });
    }

    function updateProgress() {
        let c = 0;
        Object.values(checklistState).forEach(s => { if (s && s.status) c++; });
        const total = getFlatQuestions().length;
        const progressPill = document.querySelector('.checklist-progress-pill');
        if (progressPill) {
            progressPill.innerHTML = `เลือกสถานะแล้ว: <strong id="checkedCountText">${c}</strong> / ${total} ข้อ`;
        }
    }

    if (resetFormBtn) {
        resetFormBtn.addEventListener('click', () => {
            if (!currentMachine || isReadOnlyApprover) return;
            Object.keys(checklistState).forEach(id => {
                checklistState[id] = { status: '', measurementValue: '', remark: '' };
            });
            renderChecklist();
            updateProgress();
            showToast('ล้างค่าเรียบร้อย', 'info');
        });
    }

    inspectionFormContainer.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentMachine || isReadOnlyApprover) return;
        const inspector = inspectorNameInput.value.trim();
        if (!inspector) { showToast('กรุณากรอกชื่อช่างผู้ตรวจสอบ', 'error'); inspectorNameInput.focus(); return; }

        const itemsList = getFlatQuestions();
        const items = [];
        let normalCount = 0, warningCount = 0, abnormalCount = 0;

        for (let idx = 0; idx < itemsList.length; idx++) {
            const item = itemsList[idx];
            const seqNum = idx + 1;
            const st = checklistState[item.id];
            if (!st || !st.status) { showToast(`กรุณาเลือกสถานะข้อ ${seqNum}`, 'error'); return; }
            if (item.hasMeasurement && !String(st.measurementValue || '').trim()) { showToast(`กรุณากรอกค่าตรวจวัดข้อ ${seqNum}`, 'error'); return; }
            if ((st.status === 'warning' || st.status === 'abnormal') && !String(st.remark || '').trim()) { showToast(`กรุณากรอกหมายเหตุข้อ ${seqNum}`, 'error'); return; }

            if (st.status === 'normal') normalCount++;
            else if (st.status === 'warning') warningCount++;
            else if (st.status === 'abnormal') abnormalCount++;

            items.push({
                id: item.id,
                categoryCode: item.categoryCode,
                categoryName: item.categoryName,
                seq: seqNum,
                title: item.title,
                hasMeasurement: item.hasMeasurement,
                unit: item.unit,
                measurementValue: st.measurementValue,
                status: st.status,
                remark: st.remark
            });
        }

        const todayISO = DEIStorage.getTodayISO();
        const record = {
            id: `INSP-${todayISO.replace(/-/g, '')}-${currentMachine.code}`,
            inspectionDate: todayISO,
            inspectionTime: DEIStorage.getCurrentTimeStr(),
            building: currentMachine.building,
            machineCode: currentMachine.code,
            machineName: currentMachine.name,
            inspectorName: inspector,
            items: items,
            summary: { normal: normalCount, warning: warningCount, abnormal: abnormalCount }
        };

        await DEIStorage.upsertInspection(record);
        await DEIStorage.renderSharedHeaderAndDashboard();
        buildingSelect.dispatchEvent(new Event('change'));

        showToast('บันทึกผลการตรวจสอบสำเร็จ!', 'success');
    });
});
