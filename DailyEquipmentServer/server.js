const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

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

// สมัครสมาชิก
app.post('/api/auth/register', (req, res) => {
    const { username, password, fullName, role } = req.body;
    const allowedRoles = ['inspector', 'approver', 'admin'];
    const safeRole = allowedRoles.includes(role) ? role : 'inspector';

    if (!username || !password || !fullName) {
        return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    db.query('SELECT id FROM users WHERE username = ?', [username.trim()], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (rows.length > 0) {
            return res.status(409).json({ success: false, message: 'ชื่อผู้ใช้งานนี้ถูกใช้ไปแล้ว' });
        }

        const sql = 'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)';
        db.query(sql, [username.trim(), password, fullName.trim(), safeRole], (insertErr, result) => {
            if (insertErr) return res.status(500).json({ success: false, message: insertErr.message });
            res.json({
                success: true,
                user: { id: result.insertId, username: username.trim(), fullName: fullName.trim(), role: safeRole }
            });
        });
    });
});

// เข้าสู่ระบบ
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    }

    const sql = 'SELECT id, username, full_name, role FROM users WHERE username = ? AND password = ? LIMIT 1';
    db.query(sql, [username.trim(), password], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' });
        }

        const u = rows[0];
        res.json({
            success: true,
            user: { id: u.id, username: u.username, fullName: u.full_name, role: u.role }
        });
    });
});

// เครื่องจักร
app.get('/api/machines', (req, res) => {
    db.query('SELECT * FROM machines ORDER BY code ASC', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => ({ id: r.id, code: r.code, building: r.building, name: r.name })));
    });
});

app.post('/api/machines', (req, res) => {
    const { code, building, name } = req.body;
    if (!code || !building || !name) {
        return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลเครื่องจักรให้ครบ' });
    }
    db.query('SELECT id FROM machines WHERE code = ?', [code.trim()], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (rows.length > 0) {
            return res.status(409).json({ success: false, message: 'รหัสเครื่องจักรนี้มีอยู่แล้ว' });
        }
        db.query('INSERT INTO machines (code, building, name) VALUES (?, ?, ?)', [code.trim(), building.trim(), name.trim()], (insertErr, result) => {
            if (insertErr) return res.status(500).json({ success: false, message: insertErr.message });
            res.json({ success: true, id: result.insertId });
        });
    });
});

app.delete('/api/machines/:id', (req, res) => {
    db.query('DELETE FROM machines WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true });
    });
});

// คำถาม
app.get('/api/questions', (req, res) => {
    db.query('SELECT * FROM questions ORDER BY cat_code ASC, seq ASC, id ASC', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => ({
            id: r.id,
            catCode: r.cat_code,
            catClass: r.cat_class,
            catName: r.cat_name,
            seq: r.seq,
            title: r.title,
            hasMeasurement: Boolean(r.has_measurement),
            unit: r.unit || '',
            placeholder: r.placeholder || ''
        })));
    });
});

app.post('/api/questions', (req, res) => {
    const { catCode, catName, seq, title, hasMeasurement, unit, placeholder } = req.body;
    if (!catCode || !catName || !title) {
        return res.status(400).json({ success: false, message: 'กรุณากรอกหมวดและหัวข้อคำถาม' });
    }
    const validCatCodes = ['01', '02', '03', '04'];
    const safeCatCode = validCatCodes.includes(catCode) ? catCode : '04';
    const catClass = `cat-${safeCatCode}`;

    const sql = 'INSERT INTO questions (cat_code, cat_class, cat_name, seq, title, has_measurement, unit, placeholder) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    db.query(sql, [safeCatCode, catClass, catName.trim(), Number(seq) || 1, title.trim(), hasMeasurement ? 1 : 0, (unit || '').trim(), (placeholder || '').trim()], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, id: result.insertId });
    });
});

app.put('/api/questions/:id', (req, res) => {
    const { catCode, catName, seq, title, hasMeasurement, unit, placeholder } = req.body;
    if (!title) {
        return res.status(400).json({ success: false, message: 'กรุณากรอกหัวข้อคำถาม' });
    }
    const validCatCodes = ['01', '02', '03', '04'];
    const safeCatCode = validCatCodes.includes(catCode) ? catCode : '04';
    const catClass = `cat-${safeCatCode}`;

    const sql = 'UPDATE questions SET cat_code = ?, cat_class = ?, cat_name = ?, seq = ?, title = ?, has_measurement = ?, unit = ?, placeholder = ? WHERE id = ?';
    db.query(sql, [safeCatCode, catClass, (catName || '').trim(), Number(seq) || 1, title.trim(), hasMeasurement ? 1 : 0, (unit || '').trim(), (placeholder || '').trim(), req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true });
    });
});

app.delete('/api/questions/:id', (req, res) => {
    db.query('DELETE FROM questions WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true });
    });
});

// การตรวจเช็ก
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
