import { sendEmail } from '../email.js'

/**
 * Security Email Notifications
 * Send alerts for critical security events
 */

/**
 * Send MFA enabled notification
 */
export async function sendMFAEnabledEmail(userEmail, userName) {
  const subject = '🔐 Two-Factor Authentication Enabled'
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Two-Factor Authentication Enabled</h2>
      <p>Hello ${userName || 'User'},</p>
      <p>Two-factor authentication has been successfully enabled for your QHire account.</p>
      <p><strong>What this means:</strong></p>
      <ul>
        <li>Your account is now more secure</li>
        <li>You'll need to enter a code from your authenticator app when signing in</li>
        <li>Make sure to save your backup codes in a safe place</li>
      </ul>
      <p>If you didn't enable this, please contact support immediately.</p>
      <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
        This is an automated security notification from QHire.
      </p>
    </div>
  `
  
  return sendEmail({
    to: userEmail,
    subject,
    html
  })
}

/**
 * Send critical security event alert
 */
export async function sendSecurityAlertEmail(userEmail, userName, eventDetails) {
  const subject = '🚨 Security Alert: Suspicious Activity Detected'
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Security Alert</h2>
      <p>Hello ${userName || 'User'},</p>
      <p>We detected a critical security event on your QHire account:</p>
      <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
        <p><strong>Event:</strong> ${eventDetails.action}</p>
        <p><strong>Time:</strong> ${new Date(eventDetails.timestamp).toLocaleString()}</p>
        <p><strong>IP Address:</strong> ${eventDetails.ipAddress || 'Unknown'}</p>
        <p><strong>Risk Score:</strong> ${eventDetails.riskScore || 'N/A'}</p>
      </div>
      <p><strong>What you should do:</strong></p>
      <ul>
        <li>If this was you, no action is needed</li>
        <li>If this wasn't you, change your password immediately</li>
        <li>Review your active sessions and revoke any suspicious ones</li>
        <li>Contact support if you have concerns</li>
      </ul>
      <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
        This is an automated security notification from QHire.
      </p>
    </div>
  `
  
  return sendEmail({
    to: userEmail,
    subject,
    html
  })
}

/**
 * Send new device login notification
 */
export async function sendNewDeviceLoginEmail(userEmail, userName, deviceInfo) {
  const subject = '📱 New Device Login Detected'
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">New Device Login</h2>
      <p>Hello ${userName || 'User'},</p>
      <p>We detected a login from a new device:</p>
      <div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0;">
        <p><strong>Device:</strong> ${deviceInfo.name || 'Unknown Device'}</p>
        <p><strong>OS:</strong> ${deviceInfo.os || 'Unknown'}</p>
        <p><strong>Browser:</strong> ${deviceInfo.browser || 'Unknown'}</p>
        <p><strong>IP Address:</strong> ${deviceInfo.ipAddress || 'Unknown'}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      </div>
      <p>If this was you, you can trust this device from your Security Settings.</p>
      <p>If this wasn't you, please:</p>
      <ul>
        <li>Change your password immediately</li>
        <li>Revoke this device from Security Settings</li>
        <li>Contact support</li>
      </ul>
      <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
        This is an automated security notification from QHire.
      </p>
    </div>
  `
  
  return sendEmail({
    to: userEmail,
    subject,
    html
  })
}

/**
 * Send session revoked notification
 */
export async function sendSessionRevokedEmail(userEmail, userName, sessionInfo) {
  const subject = '🔒 Session Revoked'
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Session Revoked</h2>
      <p>Hello ${userName || 'User'},</p>
      <p>A login session has been revoked for your QHire account:</p>
      <div style="background: #f3f4f6; border-left: 4px solid #6b7280; padding: 15px; margin: 20px 0;">
        <p><strong>Device:</strong> ${sessionInfo.deviceName || 'Unknown Device'}</p>
        <p><strong>IP Address:</strong> ${sessionInfo.ipAddress || 'Unknown'}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      </div>
      <p>If you revoked this session, no action is needed.</p>
      <p>If you didn't revoke this session, please review your account security settings.</p>
      <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
        This is an automated security notification from QHire.
      </p>
    </div>
  `
  
  return sendEmail({
    to: userEmail,
    subject,
    html
  })
}

