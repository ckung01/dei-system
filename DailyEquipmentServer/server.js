const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(express.json());
app.use(cors());

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

const USERNAME_REGEX = /^[A-Za-z0-9._-]+$/;

const BASE_15_QUESTIONS = [
    { seq: 1, title: 'ตรวจสอบแรงดันด้านขาดูด (Suction Pressure)', has_measurement: 1, unit: 'bar', placeholder: '4-8' },
    { seq: 2, title: 'ตรวจสอบแรงดันด้านจ่าย (Discharge Pressure)', has_measurement: 1, unit: 'bar', placeholder: '12-18' },
    { seq: 3, title: 'ตรวจสอบการรั่วซึมของสารทำความเย็น / น้ำมัน', has_measurement: 0, unit: '', placeholder: '' },
    { seq: 4, title: 'ตรวจสอบสภาพวาล์วและท่อทางเดิน', has_measurement: 0, unit: '', placeholder: '' },
    { seq: 5, title: 'ตรวจสอบอุณหภูมิน้ำเข้า (Inlet Water Temp)', has_measurement: 1, unit: '°C', placeholder: '10-15' },
    { seq: 6, title: 'ตรวจสอบอุณหภูมิน้ำออก (Outlet Water Temp)', has_measurement: 1, unit: '°C', placeholder: '5-9' },
    { seq: 7, title: 'ตรวจสอบระดับน้ำและสภาพคอยล์เย็น/คอยล์ร้อน', has_measurement: 0, unit: '', placeholder: '' },
    { seq: 8, title: 'ตรวจสอบการทำงานของพัดลมระบายความร้อน', has_measurement: 0, unit: '', placeholder: '' },
    { seq: 9, title: 'ตรวจสอบแรงดันไฟฟ้า (Voltage)', has_measurement: 1, unit: 'V', placeholder: '360-400' },
    { seq: 10, title: 'ตรวจสอบกระแสไฟฟ้า (Current)', has_measurement: 1, unit: 'A', placeholder: '35-55' },
    { seq: 11, title: 'ตรวจสอบสายไฟ ขั้วต่อ และตู้ควบคุมไฟฟ้า', has_measurement: 0, unit: '', placeholder: '' },
    { seq: 12, title: 'ตรวจสอบสัญญาณแจ้งเตือนและไฟแสดงสถานะหน้าตู้', has_measurement: 0, unit: '', placeholder: '' },
    { seq: 13, title: 'ตรวจสอบความผิดปกติของเสียงและการสั่นสะเทือน', has_measurement: 0, unit: '', placeholder: '' },
    { seq: 14, title: 'ตรวจสอบความสะอาดและพื้นที่รอบเครื่องจักร', has_measurement: 0, unit: '', placeholder: '' },
    { seq: 15, title: 'ตรวจสอบอุปกรณ์ความปลอดภัยและปุ่มหยุดฉุกเฉิน (Emergency Stop)', has_measurement: 0, unit: '', placeholder: '' }
];

// เข้าหน้าแรกสุดของเว็บ ให้เปิด login.html ก่อนเสมอ
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

async function sendVerificationEmail(toEmail, code, fullName) {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        try {
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT || 587),
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });
            await transporter.sendMail({
                from: process.env.SMTP_FROM || process.env.SMTP_USER,
                to: toEmail,
                subject: 'รหัสยืนยันการรีเซ็ตรหัสผ่าน - ระบบตรวจเช็กเครื่องจักรประจำวัน',
                text: `สวัสดีคุณ ${fullName || ''}\nรหัสยืนยันสำหรับรีเซ็ตรหัสผ่านของคุณคือ: ${code}\nรหัสนี้มีอายุ 15 นาที`
            });
            return { sentViaEmail: true };
        } catch (e) {
            console.error('Send email error:', e.message);
        }
    }
    return { sentViaEmail: false };
}

function seedBase15QuestionsForMachine(machineCode, callback) {
    db.query('SELECT COUNT(*) AS cnt FROM machine_questions WHERE machine_code = ?', [machineCode], (cntErr, cntRows) => {
        if (cntErr) return callback(cntErr);
        if (cntRows[0] && cntRows[0].cnt > 0) return callback(null);

        const values = BASE_15_QUESTIONS.map(item => [
            machineCode,
            '01',
            'cat-01',
            'รายการตรวจสอบเครื่องจักรประจำวัน',
            item.seq,
            item.title,
            item.has_measurement,
            item.unit,
            item.placeholder
        ]);

        const insertSql = `
            INSERT INTO machine_questions
            (machine_code, cat_code, cat_class, cat_name, seq, title, has_measurement, unit, placeholder)
            VALUES ?
        `;
        db.query(insertSql, [values], callback);
    });
}

function resequenceMachineQuestions(machineCode, callback) {
    db.query('SELECT id FROM machine_questions WHERE machine_code = ? ORDER BY seq ASC, id ASC', [machineCode], (err, rows) => {
        if (err) return callback ? callback(err) : null;
        if (!rows || rows.length === 0) return callback ? callback(null) : null;

        let done = 0;
        let hasError = false;
        rows.forEach((row, index) => {
            const newSeq = index + 1;
            db.query('UPDATE machine_questions SET seq = ? WHERE id = ?', [newSeq, row.id], (upErr) => {
                if (hasError) return;
                if (upErr) {
                    hasError = true;
                    return callback ? callback(upErr) : null;
                }
                done++;
                if (done === rows.length && callback) callback(null);
            });
        });
    });
}

// สมัครสมาชิก
app.post('/api/auth/register', (req, res) => {
    const { username, email, password, fullName, role } = req.body;
    const allowedRoles = ['inspector', 'approver', 'admin'];
    const safeRole = allowedRoles.includes(role) ? role : 'inspector';

    if (!username || !email || !password || !fullName) {
        return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!USERNAME_REGEX.test(cleanUsername)) {
        return res.status(400).json({
            success: false,
            message: 'ชื่อผู้ใช้งานใส่ได้เฉพาะภาษาอังกฤษ ตัวเลข และอักขระพิเศษ ห้ามใส่ภาษาไทยหรือเว้นวรรค'
        });
    }

    db.query('SELECT id, username, email FROM users WHERE username = ? OR email = ?', [cleanUsername, cleanEmail], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: err.message });

        if (rows.length > 0) {
            const dupUsername = rows.some(r => r.username === cleanUsername);
            const dupEmail = rows.some(r => String(r.email || '').toLowerCase() === cleanEmail);
            if (dupUsername) {
                return res.status(409).json({ success: false, message: 'ชื่อผู้ใช้งาน (Username) นี้ถูกใช้ไปแล้ว กรุณาตั้งใหม่' });
            }
            if (dupEmail) {
                return res.status(409).json({ success: false, message: 'อีเมลนี้ถูกใช้งานกับบัญชีอื่นแล้ว (1 อีเมลใช้ได้ 1 ยูสเซอร์)' });
            }
        }

        const sql = `
            INSERT INTO users (username, email, password, full_name, role, approval_status)
            VALUES (?, ?, ?, ?, ?, 'pending')
        `;
        db.query(sql, [cleanUsername, cleanEmail, password, fullName.trim(), safeRole], (insertErr, result) => {
            if (insertErr) {
                if (insertErr.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ success: false, message: 'ยูสเซอร์หรืออีเมลนี้มีอยู่ในระบบแล้ว' });
                }
                return res.status(500).json({ success: false, message: insertErr.message });
            }
            res.json({
                success: true,
                user: {
                    id: result.insertId,
                    username: cleanUsername,
                    email: cleanEmail,
                    fullName: fullName.trim(),
                    role: safeRole,
                    approvalStatus: 'pending'
                }
            });
        });
    });
});

app.get('/api/auth/approval-status', (req, res) => {
    const username = String(req.query.username || '').trim();
    const email = String(req.query.email || '').trim().toLowerCase();

    if (!username && !email) {
        return res.status(400).json({ success: false, message: 'กรุณาระบุ username หรือ email' });
    }

    const sql = `
        SELECT id, username, email, full_name, role, approval_status
        FROM users
        WHERE username = ? OR LOWER(email) = ?
        LIMIT 1
    `;
    db.query(sql, [username, email], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลผู้ใช้งาน' });
        }

        const u = rows[0];
        res.json({
            success: true,
            approvalStatus: u.approval_status || 'pending',
            user: {
                id: u.id,
                username: u.username,
                email: u.email,
                fullName: u.full_name,
                role: u.role,
                approvalStatus: u.approval_status || 'pending'
            }
        });
    });
});

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    }

    const sql = 'SELECT id, username, email, full_name, role, approval_status FROM users WHERE username = ? AND password = ? LIMIT 1';
    db.query(sql, [username.trim(), password], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' });
        }

        const u = rows[0];
        if ((u.approval_status || 'pending') !== 'approved') {
            return res.status(403).json({
                success: false,
                approvalStatus: u.approval_status || 'pending',
                message: 'บัญชีนี้ยังรออนุมัติจากผู้ดูแลระบบ กรุณารอสักครู่จนกว่าจะได้รับการอนุมัติ'
            });
        }

        res.json({
            success: true,
            user: {
                id: u.id,
                username: u.username,
                email: u.email,
                fullName: u.full_name,
                role: u.role,
                approvalStatus: u.approval_status
            }
        });
    });
});

app.get('/api/admin/users', (req, res) => {
    const sql = 'SELECT id, username, email, full_name, role, approval_status, created_at FROM users ORDER BY id DESC';
    db.query(sql, (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json(rows.map(r => ({
            id: r.id,
            username: r.username,
            email: r.email,
            fullName: r.full_name,
            role: r.role,
            approvalStatus: r.approval_status || 'pending',
            createdAt: r.created_at
        })));
    });
});

app.put('/api/admin/users/:id/approve', (req, res) => {
    const sql = "UPDATE users SET approval_status = 'approved' WHERE id = ?";
    db.query(sql, [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้งานที่ต้องการอนุมัติ' });
        }
        res.json({ success: true });
    });
});

app.post('/api/auth/forgot-password', (req, res) => {
    const { email } = req.body;
    if (!email || !email.trim()) {
        return res.status(400).json({ success: false, message: 'กรุณากรอกอีเมลที่ใช้สมัครสมาชิก' });
    }

    const cleanEmail = email.trim().toLowerCase();
    db.query('SELECT id, username, email, full_name FROM users WHERE LOWER(email) = ? LIMIT 1', [cleanEmail], async (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้งานที่ใช้อีเมลนี้ในระบบ' });
        }

        const user = rows[0];
        const code = String(Math.floor(100000 + Math.random() * 900000));
        const updateSql = 'UPDATE users SET reset_code = ?, reset_expires = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id = ?';

        db.query(updateSql, [code, user.id], async (upErr) => {
            if (upErr) return res.status(500).json({ success: false, message: upErr.message });

            const mailResult = await sendVerificationEmail(user.email, code, user.full_name);
            res.json({
                success: true,
                message: mailResult.sentViaEmail
                    ? `ส่งรหัสยืนยัน 6 หลักไปยังอีเมล ${user.email} เรียบร้อยแล้ว`
                    : `สร้างรหัสยืนยันสำหรับอีเมล ${user.email} เรียบร้อยแล้ว`,
                previewCode: mailResult.sentViaEmail ? undefined : code
            });
        });
    });
});

app.post('/api/auth/reset-password', (req, res) => {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
        return res.status(400).json({ success: false, message: 'กรุณากรอกอีเมล รหัสยืนยัน และรหัสผ่านใหม่ให้ครบ' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    const sql = `
        SELECT id, username FROM users
        WHERE LOWER(email) = ? AND reset_code = ? AND (reset_expires IS NULL OR reset_expires >= NOW())
        LIMIT 1
    `;
    db.query(sql, [cleanEmail, cleanCode], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (rows.length === 0) {
            return res.status(400).json({ success: false, message: 'รหัสยืนยันไม่ถูกต้องหรือหมดอายุแล้ว' });
        }

        const user = rows[0];
        db.query('UPDATE users SET password = ?, reset_code = NULL, reset_expires = NULL WHERE id = ?', [newPassword, user.id], (upErr) => {
            if (upErr) return res.status(500).json({ success: false, message: upErr.message });
            res.json({
                success: true,
                username: user.username,
                password: newPassword
            });
        });
    });
});

// เครื่องจักร (ไม่ให้ซ้ำตาม code)
app.get('/api/machines', (req, res) => {
    db.query('SELECT * FROM machines ORDER BY code ASC', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const seen = new Set();
        const unique = [];
        for (const r of rows) {
            if (!seen.has(r.code)) {
                seen.add(r.code);
                unique.push({ id: r.id, code: r.code, building: r.building, name: r.name });
            }
        }
        res.json(unique);
    });
});

app.post('/api/machines', (req, res) => {
    const { code, building, name } = req.body;
    if (!code || !building || !name) {
        return res.status(400).json({ success: false, message: 'กรุณาเลือกอาคารและกรอกข้อมูลเครื่องจักรให้ครบ' });
    }

    const cleanCode = code.trim();
    const cleanBuilding = building.trim();
    const cleanName = name.trim();

    db.query('SELECT id FROM machines WHERE code = ?', [cleanCode], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (rows.length > 0) {
            return res.status(409).json({ success: false, message: 'รหัสเครื่องจักรนี้มีอยู่แล้ว' });
        }
        db.query('INSERT INTO machines (code, building, name) VALUES (?, ?, ?)', [cleanCode, cleanBuilding, cleanName], (insertErr, result) => {
            if (insertErr) return res.status(500).json({ success: false, message: insertErr.message });

            seedBase15QuestionsForMachine(cleanCode, (qErr) => {
                if (qErr) return res.status(500).json({ success: false, message: qErr.message });
                res.json({ success: true, id: result.insertId });
            });
        });
    });
});

app.delete('/api/machines/:id', (req, res) => {
    db.query('SELECT code FROM machines WHERE id = ?', [req.params.id], (selErr, rows) => {
        if (selErr) return res.status(500).json({ success: false, message: selErr.message });
        const machineCode = rows[0] ? rows[0].code : null;

        db.query('DELETE FROM machines WHERE id = ?', [req.params.id], (err) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            if (machineCode) {
                db.query('DELETE FROM machine_questions WHERE machine_code = ?', [machineCode], () => {});
            }
            res.json({ success: true });
        });
    });
});

// คำถามแยกตามเครื่องจักร
app.get('/api/questions', (req, res) => {
    const machineCode = String(req.query.machineCode || '').trim();

    const mapRows = (rows) => rows.map((r, idx) => ({
        id: r.id,
        machineCode: r.machine_code || machineCode,
        catCode: r.cat_code || '01',
        catClass: r.cat_class || 'cat-01',
        catName: r.cat_name || 'รายการตรวจสอบเครื่องจักรประจำวัน',
        seq: idx + 1,
        title: r.title,
        hasMeasurement: Boolean(r.has_measurement),
        unit: r.unit || '',
        placeholder: r.placeholder || ''
    }));

    if (!machineCode) {
        return res.json(BASE_15_QUESTIONS.map(q => ({
            id: q.seq,
            machineCode: '',
            catCode: '01',
            catClass: 'cat-01',
            catName: 'รายการตรวจสอบเครื่องจักรประจำวัน',
            seq: q.seq,
            title: q.title,
            hasMeasurement: Boolean(q.has_measurement),
            unit: q.unit,
            placeholder: q.placeholder
        })));
    }

    db.query('SELECT * FROM machine_questions WHERE machine_code = ? ORDER BY seq ASC, id ASC', [machineCode], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows.length > 0) {
            return res.json(mapRows(rows));
        }

        seedBase15QuestionsForMachine(machineCode, (seedErr) => {
            if (seedErr) return res.status(500).json({ error: seedErr.message });
            db.query('SELECT * FROM machine_questions WHERE machine_code = ? ORDER BY seq ASC, id ASC', [machineCode], (afterErr, afterRows) => {
                if (afterErr) return res.status(500).json({ error: afterErr.message });
                res.json(mapRows(afterRows));
            });
        });
    });
});

app.post('/api/questions', (req, res) => {
    const { machineCode, title, hasMeasurement, unit, placeholder } = req.body;
    const cleanMachineCode = String(machineCode || '').trim();
    if (!cleanMachineCode || !title) {
        return res.status(400).json({ success: false, message: 'กรุณาเลือกเครื่องจักรและกรอกหัวข้อคำถาม' });
    }

    seedBase15QuestionsForMachine(cleanMachineCode, (seedErr) => {
        if (seedErr) return res.status(500).json({ success: false, message: seedErr.message });

        db.query('SELECT COUNT(*) AS totalCount FROM machine_questions WHERE machine_code = ?', [cleanMachineCode], (cntErr, cntRows) => {
            if (cntErr) return res.status(500).json({ success: false, message: cntErr.message });

            const nextSeq = Number(cntRows[0]?.totalCount || 0) + 1;
            const sql = `
                INSERT INTO machine_questions
                (machine_code, cat_code, cat_class, cat_name, seq, title, has_measurement, unit, placeholder)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            db.query(sql, [
                cleanMachineCode,
                '01',
                'cat-01',
                'รายการตรวจสอบเครื่องจักรประจำวัน',
                nextSeq,
                title.trim(),
                hasMeasurement ? 1 : 0,
                (unit || '').trim(),
                (placeholder || '').trim()
            ], (err, result) => {
                if (err) return res.status(500).json({ success: false, message: err.message });
                res.json({ success: true, id: result.insertId, seq: nextSeq });
            });
        });
    });
});

app.put('/api/questions/:id', (req, res) => {
    const { title, hasMeasurement, unit, placeholder } = req.body;
    if (!title) {
        return res.status(400).json({ success: false, message: 'กรุณากรอกหัวข้อคำถาม' });
    }

    const sql = 'UPDATE machine_questions SET title = ?, has_measurement = ?, unit = ?, placeholder = ? WHERE id = ?';
    db.query(sql, [
        title.trim(),
        hasMeasurement ? 1 : 0,
        (unit || '').trim(),
        (placeholder || '').trim(),
        req.params.id
    ], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true });
    });
});

app.delete('/api/questions/:id', (req, res) => {
    db.query('SELECT machine_code FROM machine_questions WHERE id = ?', [req.params.id], (selErr, selRows) => {
        if (selErr) return res.status(500).json({ success: false, message: selErr.message });
        const machineCode = selRows[0]?.machine_code || '';

        db.query('DELETE FROM machine_questions WHERE id = ?', [req.params.id], (err) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            if (!machineCode) return res.json({ success: true });

            resequenceMachineQuestions(machineCode, (reErr) => {
                if (reErr) return res.status(500).json({ success: false, message: reErr.message });
                res.json({ success: true });
            });
        });
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
            rejectReason: row.reject_reason || '',
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

    const checkQuery = 'SELECT id, approval_status FROM inspections WHERE machine_code = ? AND inspection_date = ?';
    db.query(checkQuery, [data.machineCode, data.inspectionDate], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        if (results.length > 0) {
            const existingRow = results[0];
            if (existingRow.approval_status !== 'ไม่อนุมัติ') {
                return res.status(403).json({
                    success: false,
                    message: 'รายการนี้ถูกส่ง/อนุมัติแล้ว ไม่สามารถแก้ไขได้จนกว่าผู้อนุมัติจะกดไม่อนุมัติ'
                });
            }

            const updateQuery = `
                UPDATE inspections
                SET inspection_time = ?, inspector_name = ?, items_json = ?,
                    summary_normal = ?, summary_warning = ?, summary_abnormal = ?,
                    approval_status = 'รออนุมัติ', approver_name = NULL, reject_reason = NULL
                WHERE machine_code = ? AND inspection_date = ?
            `;
            db.query(updateQuery, [
                data.inspectionTime, data.inspectorName, itemsJson,
                data.summary.normal, data.summary.warning, data.summary.abnormal,
                data.machineCode, data.inspectionDate
            ], (updateErr) => {
                if (updateErr) return res.status(500).json({ error: updateErr.message });
                res.json({ success: true, mode: 'updated' });
            });
        } else {
            const insertQuery = `
                INSERT INTO inspections
                (id, inspection_date, inspection_time, building, machine_code, machine_name, inspector_name, items_json, summary_normal, summary_warning, summary_abnormal, approval_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'รออนุมัติ')
            `;
            db.query(insertQuery, [
                data.id, data.inspectionDate, data.inspectionTime, data.building,
                data.machineCode, data.machineName, data.inspectorName, itemsJson,
                data.summary.normal, data.summary.warning, data.summary.abnormal
            ], (insertErr) => {
                if (insertErr) return res.status(500).json({ error: insertErr.message });
                res.json({ success: true, mode: 'created' });
            });
        }
    });
});

app.put('/api/inspections/:id/approve', (req, res) => {
    const { id } = req.params;
    const { approverName, approvedDate, approvedTime } = req.body;

    db.query('SELECT machine_code, inspection_date FROM inspections WHERE id = ? LIMIT 1', [id], (selErr, rows) => {
        if (selErr) return res.status(500).json({ success: false, error: selErr.message });

        const target = rows[0];
        const query = target
            ? `UPDATE inspections SET approval_status = 'อนุมัติแล้ว', approver_name = ?, approved_date = ?, approved_time = ?, reject_reason = NULL WHERE machine_code = ? AND inspection_date = ?`
            : `UPDATE inspections SET approval_status = 'อนุมัติแล้ว', approver_name = ?, approved_date = ?, approved_time = ?, reject_reason = NULL WHERE id = ?`;

        const params = target
            ? [approverName, approvedDate, approvedTime, target.machine_code, target.inspection_date]
            : [approverName, approvedDate, approvedTime, id];

        db.query(query, params, (err, result) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, message: 'ไม่พบรายการตรวจเช็กนี้' });
            }
            res.json({ success: true });
        });
    });
});

app.put('/api/inspections/:id/reject', (req, res) => {
    const { id } = req.params;
    const { approverName, rejectReason } = req.body;

    db.query('SELECT machine_code, inspection_date FROM inspections WHERE id = ? LIMIT 1', [id], (selErr, rows) => {
        if (selErr) return res.status(500).json({ success: false, error: selErr.message });

        const target = rows[0];
        const query = target
            ? `UPDATE inspections SET approval_status = 'ไม่อนุมัติ', approver_name = ?, reject_reason = ? WHERE machine_code = ? AND inspection_date = ?`
            : `UPDATE inspections SET approval_status = 'ไม่อนุมัติ', approver_name = ?, reject_reason = ? WHERE id = ?`;

        const params = target
            ? [approverName || 'ผู้อนุมัติ', rejectReason || 'ไม่ผ่านการอนุมัติ', target.machine_code, target.inspection_date]
            : [approverName || 'ผู้อนุมัติ', rejectReason || 'ไม่ผ่านการอนุมัติ', id];

        db.query(query, params, (err, result) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, message: 'ไม่พบรายการตรวจเช็กนี้' });
            }
            res.json({ success: true });
        });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
