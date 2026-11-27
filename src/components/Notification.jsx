import { useEffect } from 'react'
import { Button, Card, Paragraph, SizableText, XStack, YStack } from 'tamagui'

const NOTIFICATION_DURATION_MS = 8000

/** A notification that pops up at the top of the screen and hides itself after a few seconds. */
export default function Notification({ notice, onClose }) {
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
