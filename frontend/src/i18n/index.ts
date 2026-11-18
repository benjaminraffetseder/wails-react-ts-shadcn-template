import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import en from "./locales/en.json"
import de from "./locales/de.json"

export const languages = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
] as const

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, de: { translation: de } },
  lng: "en",
  supportedLngs: languages.map(({ code }) => code),
  fallbackLng: "en",
  initAsync: false,
  interpolation: { escapeValue: false },
})

function updateDocument() {
  if (typeof document === "undefined") return
  const language = i18n.resolvedLanguage ?? "en"
  document.documentElement.lang = language
  document.documentElement.dir = i18n.dir(language)
  document.title = i18n.t("app.title")
}

updateDocument()
i18n.on("languageChanged", updateDocument)

export default i18n
