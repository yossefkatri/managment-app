import { Button, Card, H1, Paragraph, YStack } from 'tamagui'

export default function LoginScreen({ sync }) {
  const busy = sync.status === 'connecting'
  return (
    <YStack backgroundColor="$background" minHeight="100vh" alignItems="center" justifyContent="center" padding="$4">
      <Card width="100%" maxWidth={400} padding="$5" gap="$4" borderWidth={1} borderColor="$border-color">
        <YStack gap="$1">
          <H1 size="$9">הכסף שלי</H1>
          <Paragraph color="$color-10">
            התחבר עם חשבון Google כדי לשמור את הנתונים בתיקייה "Budget Tracker" ב-Google Drive שלך.
          </Paragraph>
        </YStack>
        {sync.hasClientId ? (
          <Button theme="accent" disabled={busy} opacity={busy ? 0.6 : 1} onPress={sync.signIn}>
            {busy ? 'מתחבר…' : sync.lastEmail ? `התחבר בתור ${sync.lastEmail}` : 'התחבר עם Google'}
          </Button>
        ) : null}
        {sync.hasClientId && sync.lastEmail && !busy ? (
          <Button variant="outlined" onPress={sync.signInOtherAccount}>
            התחבר עם חשבון אחר
          </Button>
        ) : null}
        {sync.hasClientId ? null : (
          <Paragraph theme="red" color="$color-10">
            חסר Client ID של Google. הגדר VITE_GOOGLE_CLIENT_ID בקובץ ‎.env.local והפעל מחדש את השרת.
          </Paragraph>
        )}
        {sync.error && (
          <Paragraph theme="red" color="$color-10" size="$2">
            {sync.error}
          </Paragraph>
        )}
      </Card>
    </YStack>
  )
}
