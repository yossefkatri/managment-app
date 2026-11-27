// Text shown for each useCloudSync status.

export const SYNC_LABELS = {
  connecting: 'מתחבר ל-Drive…',
  synced: '✓ נשמר ב-Google Drive',
  saving: 'שומר…',
  offline: 'אין חיבור לרשת – השינויים יישמרו כשהחיבור יחזור',
  'needs-login': 'פג תוקף ההתחברות – השינויים שמורים במכשיר',
  error: 'שגיאה בשמירה ל-Drive',
}

/** Statuses shown as a warning (red). */
export const isSyncWarning = (status) => ['offline', 'needs-login', 'error'].includes(status)
