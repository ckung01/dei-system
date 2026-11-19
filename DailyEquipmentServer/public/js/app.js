/**
 * Daily Equipment Inspection System - หน้าที่สำคัญ: ตรวจเช็กประจำวัน (index.html)
 * พร้อมระบบตรวจสอบเกณฑ์ตัวเลขมาตรฐานอัตโนมัติ (ฉบับแก้ไขสมบูรณ์)
 */

document.addEventListener('DOMContentLoaded', async () => {
    DEIStorage.init();
    await DEIStorage.renderSharedHeaderAndDashboard();

    const buildingSelect = document.getElementById('buildingSelect');
    const machineSelect = document.getElementById('machineSelect');
    const searchMachineBtn = document.getElementById('searchMachineBtn');
    const emptyStateGuide = document.getElementById('emptyStateGuide');
    const inspectionFormContainer = document.getElementById('inspectionFormContainer');
    const checklistCategoriesContainer = document.getElementById('checklistCategoriesContainer');
    const inspectorNameInput = document.getElementById('inspectorNameInput');
    const resetFormBtn = document.getElementById('resetFormBtn');

    let currentMachine = null;
    let checklistState = {};

    // กำหนดช่วงเกณฑ์มาตรฐานตัวเลขที่สมเหตุสมผลสำหรับแต่ละข้อ (Normal Range)
    const MEASUREMENT_RANGES = {
        1: { min: 4.0, max: 8.0, name: 'แรงดันด้านขาดูด' },
        2: { min: 12.0, max: 18.0, name: 'แรงดันด้านจ่าย' },
        5: { min: 10.0, max: 15.0, name: 'อุณหภูมิน้ำเข้า' },
        6: { min: 5.0, max: 9.0, name: 'อุณหภูมิน้ำออก' },
        9: { min: 360.0, max: 400.0, name: 'แรงดันไฟฟ้า' },
        10: { min: 35.0, max: 55.0, name: 'กระแสไฟฟ้า' }
    };

    buildingSelect.addEventListener('change', async () => {
        const b = buildingSelect.value;
        machineSelect.innerHTML = '';
        if (!b) {
            machineSelect.disabled = true;
            machineSelect.innerHTML = '<option value="">-- กรุณาเลือกอาคารก่อน --</option>';
            return;
        }

        const machines = DEIStorage.getMachinesByBuilding(b);
        const todayISO = DEIStorage.getTodayISO();

        machineSelect.disabled = false;
        machineSelect.innerHTML = `<option value="">-- เลือกเครื่องจักรในอาคาร ${b} (${machines.length} เครื่อง) --</option>`;

        // ดึงรายการตรวจสอบทั้งหมดของวันนี้ครั้งเดียว เพื่อประสิทธิภาพและความถูกต้อง
        let todayInspections = [];
        try {
            const allInspections = await DEIStorage.getInspections();
            todayInspections = allInspections.filter(i => {
                if (!i.inspectionDate) return false;
                // ตัดสตริงเอาเฉพาะ YYYY-MM-DD เพื่อป้องกันปัญหารูปแบบเวลาเหลื่อมกัน
                const dbDate = String(i.inspectionDate).split('T')[0];
                return dbDate === todayISO;
            });
        } catch (e) {
            console.error('Error checking inspection status:', e);
        }

        machines.forEach(m => {
            // เช็คจากรหัสเครื่องจักรว่ามีอยู่ในรายการที่ตรวจของวันนี้แล้วหรือยัง
            const isChecked = todayInspections.some(i => i.machineCode === m.code);
            const opt = document.createElement('option');
            opt.value = m.code;
            opt.textContent = `${m.code} - ${m.name}${isChecked ? ' [ตรวจแล้ววันนี้]' : ''}`;
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
        const todayISO = DEIStorage.getTodayISO();

        // ค้นหาข้อมูลเดิมของวันนี้ด้วยการเทียบรหัสเครื่องและวันที่แบบปลอดภัย
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

        document.getElementById('detailBuilding').textContent = `อาคาร ${machine.building}`;
        document.getElementById('detailMachineCode').textContent = machine.code;
        document.getElementById('detailMachineName').textContent = machine.name;
        document.getElementById('detailInspectDate').textContent = DEIStorage.formatThaiFullDate(todayISO);

        const banner = document.getElementById('duplicateWarningBanner');
        const badge = document.getElementById('machineTodayStatusBadge');

        if (existing) {
            banner.classList.remove('hidden');
            badge.textContent = 'ตรวจแล้ววันนี้';
            badge.classList.add('checked');
            inspectorNameInput.value = existing.inspectorName || '';

            if (Array.isArray(existing.items)) {
                existing.items.forEach(i => {
                    checklistState[i.id] = {
                        status: i.status || '',
                        measurementValue: i.measurementValue || '',
                        remark: i.remark || ''
                    };
                });
            }
            showToast('โหลดข้อมูลเดิมของวันนี้แล้ว', 'info');
        } else {
            banner.classList.add('hidden');
            badge.textContent = 'ยังไม่ตรวจวันนี้';
            badge.classList.remove('checked');
            inspectorNameInput.value = '';

            CHECKLIST_CATEGORIES.forEach(cat => {
                cat.items.forEach(i => {
                    checklistState[i.id] = { status: '', measurementValue: '', remark: '' };
                });
            });
        }

        renderChecklist();
        updateProgress();
        emptyStateGuide.classList.add('hidden');
        inspectionFormContainer.classList.remove('hidden');
    }

    function renderChecklist() {
        checklistCategoriesContainer.innerHTML = '';
        CHECKLIST_CATEGORIES.forEach(cat => {
            const card = document.createElement('div');
            card.className = `category-card ${cat.catClass}`;

            card.innerHTML = `
                <div class="category-header">
                    <div class="category-title-wrap">
                        <span class="category-num-badge">${cat.catCode}</span>
                        <span class="category-name">${cat.catName}</span>
                    </div>
                    <span class="category-count-badge">${cat.items.length} รายการ</span>
                </div>
            `;

            cat.items.forEach(item => {
                const st = checklistState[item.id] || { status: '', measurementValue: '', remark: '' };
                const needRemark = st.status === 'warning' || st.status === 'abnormal';

                let placeholderText = item.placeholder;
                if (MEASUREMENT_RANGES[item.id]) {
                    const r = MEASUREMENT_RANGES[item.id];
                    placeholderText = `ปกติ ${r.min}-${r.max} ${item.unit}`;
                }

                const row = document.createElement('div');
                row.className = 'checklist-item-row';
                row.innerHTML = `
                    <div class="item-main-line">
                        <div class="item-left-info">
                            <span class="item-seq">${item.seq}</span>
                            <span class="item-title">${item.title}</span>
                        </div>
                        <div class="item-right-controls">
                            ${item.hasMeasurement ? `
                                <div class="measurement-box" title="ช่วงปกติ: ${placeholderText}">
                                    <input type="number" step="any" class="measurement-input" data-item-id="${item.id}" placeholder="${placeholderText}" value="${st.measurementValue}">
                                    <span class="measurement-unit">${item.unit}</span>
                                </div>
                            ` : ''}
                            <div class="status-btn-group">
                                <button type="button" class="status-btn ${st.status === 'normal' ? 'selected' : ''}" data-item-id="${item.id}" data-status="normal">ปกติ</button>
                                <button type="button" class="status-btn ${st.status === 'warning' ? 'selected' : ''}" data-item-id="${item.id}" data-status="warning">เฝ้าระวัง</button>
                                <button type="button" class="status-btn ${st.status === 'abnormal' ? 'selected' : ''}" data-item-id="${item.id}" data-status="abnormal">ผิดปกติ</button>
                            </div>
                        </div>
                    </div>
                    <div class="item-remark-box ${needRemark ? '' : 'hidden'}" id="remarkBox_${item.id}">
                        <input type="text" class="remark-input ${st.status === 'abnormal' ? 'is-abnormal' : ''}" id="remarkInput_${item.id}" data-item-id="${item.id}" placeholder="ระบุหมายเหตุ / อาการ *" value="${st.remark}">
                    </div>
                `;
                card.appendChild(row);
            });
            checklistCategoriesContainer.appendChild(card);
        });

        bindEvents();
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
                const val = input.value;
                if (!checklistState[id]) checklistState[id] = {};
                checklistState[id].measurementValue = val;

                if (val !== '' && MEASUREMENT_RANGES[id]) {
                    const num = parseFloat(val);
                    const range = MEASUREMENT_RANGES[id];

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
                            showToast(`⚠️ ค่า ${range.name} (${num}) อยู่นอกช่วงปกติ ระบบปรับเป็น "ผิดปกติ" อัตโนมัติ`, 'warning');
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
        const counterEl = document.getElementById('checkedCountText');
        if (counterEl) counterEl.textContent = c;
    }

    resetFormBtn.addEventListener('click', () => {
        if (!currentMachine) return;
        Object.keys(checklistState).forEach(id => {
            checklistState[id] = { status: '', measurementValue: '', remark: '' };
        });
        renderChecklist();
        updateProgress();
        showToast('ล้างค่าเรียบร้อย', 'info');
    });

    inspectionFormContainer.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentMachine) return;
        const inspector = inspectorNameInput.value.trim();
        if (!inspector) { showToast('กรุณากรอกชื่อช่างผู้ตรวจสอบ', 'error'); inspectorNameInput.focus(); return; }

        const items = [];
        let normalCount = 0, warningCount = 0, abnormalCount = 0;

        for (const cat of CHECKLIST_CATEGORIES) {
            for (const item of cat.items) {
                const st = checklistState[item.id];
                if (!st || !st.status) { showToast(`กรุณาเลือกสถานะข้อ ${cat.catCode}-${item.seq}`, 'error'); return; }
                if (item.hasMeasurement && !st.measurementValue.trim()) { showToast(`กรุณากรอกค่าตรวจวัดข้อ ${cat.catCode}-${item.seq}`, 'error'); return; }
                if ((st.status === 'warning' || st.status === 'abnormal') && !st.remark.trim()) { showToast(`กรุณากรอกหมายเหตุข้อ ${cat.catCode}-${item.seq}`, 'error'); return; }

                if (st.status === 'normal') normalCount++;
                else if (st.status === 'warning') warningCount++;
                else if (st.status === 'abnormal') abnormalCount++;

                items.push({
                    id: item.id, categoryCode: cat.catCode, categoryName: cat.catName,
                    seq: item.seq, title: item.title, hasMeasurement: item.hasMeasurement,
                    unit: item.unit, measurementValue: st.measurementValue,
                    status: st.status, remark: st.remark
                });
            }
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

        // รีเฟรชตัวเลือกอาคารเพื่ออัปเดตป้ายกำกับ [ตรวจแล้ววันนี้] ทันทีหลังบันทึก
        buildingSelect.dispatchEvent(new Event('change'));

        showToast('บันทึกผลการตรวจสอบสำเร็จ!', 'success');
    });
});
