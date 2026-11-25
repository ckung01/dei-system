async function sendEmailWithNodemailer(toEmail, subject, textBody) {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        try {
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT || 587),
                secure: Number(process.env.SMTP_PORT || 587) === 465,
                connectionTimeout: 10000,
                greetingTimeout: 10000,
                socketTimeout: 15000,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });
            await transporter.sendMail({
                from: process.env.SMTP_FROM || process.env.SMTP_USER,
                to: toEmail,
                subject,
                text: textBody
            });
            return { sentViaEmail: true };
        } catch (e) {
            console.error('Send email error:', e.message);
            return { sentViaEmail: false, error: e.message };
        }
    }
    return { sentViaEmail: false };
}
