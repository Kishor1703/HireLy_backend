const nodemailer = require("nodemailer");

const buildTransport = () => {
    if (process.env.SMTP_HOST) {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
            auth: process.env.SMTP_USER
                ? {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
                : undefined
        });
    }

    if (process.env.SMTP_SERVICE) {
        return nodemailer.createTransport({
            service: process.env.SMTP_SERVICE,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }

    return null;
};

const sendEmail = async ({ to, subject, text, html }) => {
    const transporter = buildTransport();
    if (!transporter) {
        throw new Error("Email transport not configured. Set SMTP_* environment variables.");
    }

    await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@hirely.local",
        to,
        subject,
        text,
        html
    });
};

module.exports = sendEmail;
