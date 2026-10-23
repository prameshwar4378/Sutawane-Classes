import nodemailer from 'nodemailer'

export const AUTHORIZED_DEVELOPER_EMAIL = 'prameshwar4378@gmail.com'
const SMTP_USER = 'prameshwar4378@gmail.com'
// Clean app password (spaces removed)
const SMTP_PASS = 'pkppqklbhjjtbont'

export const mailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
})

/**
 * Send 6-digit OTP email to authorized developer
 */
export async function sendDeveloperOtpEmail(targetEmail: string, otpCode: string): Promise<boolean> {
  const cleanEmail = String(targetEmail).trim().toLowerCase()

  if (cleanEmail !== AUTHORIZED_DEVELOPER_EMAIL) {
    throw new Error('Unauthorized email address. Developer access is restricted to the authorized developer account only.')
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #1e3a8a; margin: 0; font-size: 22px;">Sutawane Classes Software</h2>
        <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Developer Management Portal Authentication</p>
      </div>

      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
        <span style="font-size: 13px; color: #166534; display: block; margin-bottom: 8px; font-weight: 600;">Your One-Time Password (OTP):</span>
        <div style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #15803d; font-family: 'Courier New', monospace;">
          ${otpCode}
        </div>
        <span style="font-size: 11px; color: #4ade80; display: block; margin-top: 8px; font-weight: 500;">Valid for 10 minutes &bull; Single Use Only</span>
      </div>

      <p style="font-size: 12px; color: #64748b; line-height: 1.6;">
        This One-Time Password was requested to authenticate your <strong>Developer Session</strong> in the Sutawane Classes Management System.
        If you did not request this OTP, you can safely ignore this email.
      </p>

      <div style="border-top: 1px solid #e2e8f0; margin-top: 24px; padding-top: 12px; font-size: 11px; color: #94a3b8; text-align: center;">
        Sutawane Classes Desktop Management System &bull; Secure Authentication
      </div>
    </div>
  `

  await mailTransporter.sendMail({
    from: `"Sutawane Software Support" <${SMTP_USER}>`,
    to: cleanEmail,
    subject: `🔐 Developer Login OTP: ${otpCode} (Sutawane Classes)`,
    text: `Your One-Time Password (OTP) for Developer Login is: ${otpCode}. It is valid for 10 minutes.`,
    html,
  })

  return true
}
