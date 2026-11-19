const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// เชื่อมต่อฐานข้อมูล MySQL (รองรับทั้ง localhost และโฮสจริง)
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'dei_system',
    dateStrings: true
});

db.connect(err => {
    if (err) throw err;
    console.log('Connected to MySQL Database successfully!');
});

// 1. API ดึงข้อมูลทั้งหมด (แปลงชื่อฟิลด์ให้ตรงกับฝั่ง Frontend)
app.get('/api/inspections', (req, res) => {
    db.query('SELECT * FROM inspections ORDER BY inspection_date DESC, inspection_time DESC', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        const formatted = results.map(row => ({
            id: row.id,
            inspectionDate: row.inspection_date,
            inspectionTime: row.inspection_time,
            building: row.building,
            machineCode: row.machine_code,
            machineName: row.machine_name,
            inspectorName: row.inspector_name,
            approvalStatus: row.approval_status,
            approverName: row.approver_name,
            approvedDate: row.approved_date,
            approvedTime: row.approved_time,
            items: JSON.parse(row.items_json || '[]'),
            summary: {
                normal: row.summary_normal || 0,
                warning: row.summary_warning || 0,
                abnormal: row.summary_abnormal || 0
            }
        }));
        res.json(formatted);
    });
});

// 2. API บันทึกหรืออัปเดตผลตรวจ
app.post('/api/inspections', (req, res) => {
    const data = req.body;
    const itemsJson = JSON.stringify(data.items);

    const checkQuery = 'SELECT id FROM inspections WHERE machine_code = ? AND inspection_date = ?';
    db.query(checkQuery, [data.machineCode, data.inspectionDate], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        if (results.length > 0) {
            const updateQuery = `UPDATE inspections SET inspection_time = ?, inspector_name = ?, items_json = ?, summary_normal = ?, summary_warning = ?, summary_abnormal = ?, approval_status = 'รออนุมัติ', approver_name = NULL WHERE machine_code = ? AND inspection_date = ?`;
            db.query(updateQuery, [data.inspectionTime, data.inspectorName, itemsJson, data.summary.normal, data.summary.warning, data.summary.abnormal, data.machineCode, data.inspectionDate], (updateErr) => {
                if (updateErr) return res.status(500).json({ error: updateErr.message });
                res.json({ success: true, mode: 'updated' });
            });
        } else {
            const insertQuery = `INSERT INTO inspections (id, inspection_date, inspection_time, building, machine_code, machine_name, inspector_name, items_json, summary_normal, summary_warning, summary_abnormal, approval_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'รออนุมัติ')`;
            db.query(insertQuery, [data.id, data.inspectionDate, data.inspectionTime, data.building, data.machineCode, data.machineName, data.inspectorName, itemsJson, data.summary.normal, data.summary.warning, data.summary.abnormal], (insertErr) => {
                if (insertErr) return res.status(500).json({ error: insertErr.message });
                res.json({ success: true, mode: 'created' });
            });
        }
    });

});

// 3. API อนุมัติรายการ
app.put('/api/inspections/:id/approve', (req, res) => {
    const { id } = req.params;
    const { approverName, approvedDate, approvedTime } = req.body;
    const query = `UPDATE inspections SET approval_status = 'อนุมัติแล้ว', approver_name = ?, approved_date = ?, approved_time = ? WHERE id = ?`;
    db.query(query, [approverName, approvedDate, approvedTime, id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
