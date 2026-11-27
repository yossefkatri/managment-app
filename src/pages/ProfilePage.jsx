import { useCallback, useState } from 'react'
import { Button, Card, Circle, H2, Paragraph, Separator, SizableText, XStack, YStack } from 'tamagui'
import Notification from '../components/Notification.jsx'
import { initialOf } from '../format.js'
import { FILE_NAME, FOLDER_NAME } from '../google/drive.js'
import { SYNC_LABELS, isSyncWarning } from '../syncLabels.js'

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

function InfoRow({ label, children }) {
  return (
    <XStack justifyContent="space-between" alignItems="center" gap="$3" paddingVertical="$2" flexWrap="wrap">
      <SizableText color="$color-10">{label}</SizableText>
      <SizableText fontWeight="600">{children}</SizableText>
    </XStack>
  )
}

/** The signed-in account: who it is, where the data is saved, sync status, and sign-out. */
export default function ProfilePage({ sync, transactionCount, cyclicCount }) {
  const [notice, setNotice] = useState(null)
  const closeNotice = useCallback(() => setNotice(null), [])
  const onSignOut = async () => {
    const result = await sync.signOut()
    if (!result.ok) setNotice(SIGN_OUT_FAILED[result.reason] ?? SIGN_OUT_FAILED.error)
  }
  const warn = isSyncWarning(sync.status)

  return (
    <YStack gap="$4">
      {notice && <Notification notice={notice} onClose={closeNotice} />}
      <H2 size="$8">פרופיל</H2>

      <Card padding="$5" gap="$4" borderWidth={1} borderColor="$border-color">
        <XStack gap="$4" alignItems="center">
          <Circle size={64} theme="accent" backgroundColor="$background">
            <SizableText size="$8" fontWeight="700">
              {initialOf(sync.user)}
            </SizableText>
          </Circle>
          <YStack flex={1} minWidth={0}>
            <SizableText size="$6" fontWeight="700">
              {sync.user?.displayName || 'משתמש'}
            </SizableText>
            <SizableText color="$color-10">{sync.user?.emailAddress}</SizableText>
          </YStack>
        </XStack>

        <Separator />
        <YStack>
          <InfoRow label="מצב סנכרון">
            <SizableText theme={warn ? 'red' : undefined} color={warn ? '$color-10' : undefined} fontWeight="600">
              {SYNC_LABELS[sync.status]}
              {sync.status === 'error' && sync.error ? ` (${sync.error})` : ''}
            </SizableText>
          </InfoRow>
          <InfoRow label="קובץ הנתונים">{`${FOLDER_NAME}/${FILE_NAME}`}</InfoRow>
          <InfoRow label="תנועות חד-פעמיות">{transactionCount}</InfoRow>
          <InfoRow label="תנועות קבועות">{cyclicCount}</InfoRow>
        </YStack>

        <XStack gap="$2" flexWrap="wrap">
          {sync.status === 'needs-login' && (
            <Button theme="accent" onPress={sync.signIn}>
              התחבר מחדש
            </Button>
          )}
          <Button variant="outlined" onPress={onSignOut}>
            התנתק
          </Button>
        </XStack>
      </Card>

      <Paragraph size="$2" color="$color-10">
        ב-Drive נשמרות רק התנועות שהזנת והגדרות התנועות הקבועות. התנועות החודשיות של כל תנועה קבועה מחושבות
        מחדש בכל פעם שהן מוצגות.
      </Paragraph>
    </YStack>
  )
}
