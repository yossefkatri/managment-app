# budget-tracker — מעקב הכנסות והוצאות

אפליקציה אישית לניהול הכנסות והוצאות, בנויה עם React + Vite ועוצבה עם [Tamagui](https://tamagui.dev).

## הרצה

```bash
npm install
npm run dev
```

## מה יש באפליקציה

- סיכום חודשי: הכנסות, הוצאות ויתרה
- הוספת הכנסה או הוצאה עם סכום, תאריך, תיאור וקטגוריה
- רשימת תנועות לפי חודש, עם אפשרות מחיקה
- הנתונים נשמרים בדפדפן (localStorage)

## מבנה

- `src/App.jsx` — האפליקציה
- `src/tamagui.config.js` — הגדרות Tamagui (ערכת עיצוב v6)
- `vite.config.js` — מפנה את `react-native` ל-`react-native-web`, ש-Tamagui צריך בדפדפן
