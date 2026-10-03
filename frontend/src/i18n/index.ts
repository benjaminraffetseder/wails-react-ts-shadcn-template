import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import en from "./locales/en.json"
import de from "./locales/de.json"

export const languages = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
] as const

const storageKey = "desktop-language"

function supportedLanguage(value: string | null) {
  const base = value?.toLowerCase().split("-")[0]
  return languages.find(({ code }) => code === base)?.code
}

function initialLanguage() {
  try {
    const saved = supportedLanguage(localStorage.getItem(storageKey))
    if (saved) return saved
  } catch {
    // Restricted webviews can disable storage; language switching still works.
  }
  for (const candidate of navigator.languages) {
    const language = supportedLanguage(candidate)
    if (language) return language
  }
  return "en"
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, de: { translation: de } },
  lng: initialLanguage(),
  supportedLngs: languages.map(({ code }) => code),
  fallbackLng: "en",
  initAsync: false,
  interpolation: { escapeValue: false },
})

function updateDocument() {
  const language = i18n.resolvedLanguage ?? "en"
  document.documentElement.lang = language
  document.documentElement.dir = i18n.dir(language)
  document.title = i18n.t("app.title")
}

updateDocument()
i18n.on("languageChanged", () => {
  updateDocument()
  try {
    localStorage.setItem(storageKey, i18n.resolvedLanguage ?? "en")
  } catch {
    /* Keep in-memory preference. */
  }
})

export default i18n
