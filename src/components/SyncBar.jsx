import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Paragraph, SizableText, XStack, YStack } from 'tamagui'

const SYNC_LABELS = {
  connecting: 'מתחבר ל-Drive…',
  synced: '✓ נשמר ב-Google Drive',
  saving: 'שומר…',
  offline: 'אין חיבור לרשת – השינויים יישמרו כשהחיבור יחזור',
  'needs-login': 'פג תוקף ההתחברות – השינויים שמורים במכשיר',
  error: 'שגיאה בשמירה ל-Drive',
}

// Shown when sign-out is blocked because the unsaved changes could not be uploaded
const SIGN_OUT_FAILED = {
  offline: {
    title: 'אין חיבור לאינטרנט',
    message:
      'לא הצלחתי לשמור את השינויים האחרונים ל-Google Drive, ולכן לא התנתקת. השינויים שמורים במכשיר – נסה להתנתק שוב כשהחיבור יחזור.',
  },
  'needs-login': {
    title: 'ההתחברות ל-Google לא הושלמה',
    message: 'השינויים האחרונים לא נשמרו ל-Drive, ולכן לא התנתקת. נסה שוב.',
  },
  error: {
    title: 'שגיאה בשמירה ל-Drive',
    message: 'השינויים האחרונים לא נשמרו, ולכן לא התנתקת. נסה שוב.',
  },
}
const NOTIFICATION_DURATION_MS = 8000

/** A notification that pops up at the top of the screen and hides itself after a few seconds. */
function Notification({ notice, onClose }) {
  useEffect(() => {
    const hideTimer = setTimeout(onClose, NOTIFICATION_DURATION_MS)
    return () => clearTimeout(hideTimer)
  }, [notice, onClose])

  return (
    <Card
      role="alert"
      theme="red"
      position="fixed"
      top="$4"
      left="$4"
      right="$4"
      marginHorizontal="auto"
      maxWidth={480}
      zIndex={1000}
      padding="$4"
      borderWidth={1}
      borderColor="$border-color"
      elevation="$4"
    >
      <XStack gap="$3" alignItems="flex-start">
        <YStack flex={1} gap="$1">
          <SizableText size="$4" fontWeight="700">
            {notice.title}
          </SizableText>
          <Paragraph size="$3" color="$color-10">
            {notice.message}
          </Paragraph>
        </YStack>
        <Button size="sm" chromeless onPress={onClose} aria-label="סגור">
          ✕
        </Button>
      </XStack>
    </Card>
  )
}

export default function SyncBar({ sync }) {
  const warn = ['offline', 'needs-login', 'error'].includes(sync.status)
  const [notice, setNotice] = useState(null)
  const closeNotice = useCallback(() => setNotice(null), [])
  const onSignOut = async () => {
    const result = await sync.signOut()
    if (!result.ok) setNotice(SIGN_OUT_FAILED[result.reason] ?? SIGN_OUT_FAILED.error)
  }
  return (
    <XStack alignItems="center" gap="$2" flexWrap="wrap">
      {notice && <Notification notice={notice} onClose={closeNotice} />}
      <SizableText size="$2" flex={1} theme={warn ? 'red' : undefined} color="$color-10">
        {SYNC_LABELS[sync.status]}
        {sync.status === 'error' && sync.error ? ` (${sync.error})` : ''}
        {sync.user?.emailAddress ? ` · ${sync.user.emailAddress}` : ''}
      </SizableText>
      {sync.status === 'needs-login' && (
        <Button size="sm" theme="accent" onPress={sync.signIn}>
          התחבר מחדש
        </Button>
      )}
      <Button size="sm" variant="outlined" onPress={onSignOut}>
        התנתק
      </Button>
    </XStack>
  )
}
