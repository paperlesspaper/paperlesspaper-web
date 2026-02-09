import { Select, SelectItem } from "@progressiveui/react";
import React from "react";
import styles from "./fields.module.scss";
import { Trans, useTranslation } from "react-i18next";
import useEditor from "../Integrations/ImageEditor/useEditor";

export default function LanguageSelector({ allowedLanguages }: any) {
  const { t, i18n } = useTranslation();
  console.log("LanguageSelector -> language", i18n);

  const language = i18n.language;

  const { form }: any = useEditor();

  const languages = [
    {
      value: "de",
      text: t("German"),
    },
    {
      value: "en",
      text: t("English"),
    },
    {
      value: "fr",
      text: t("French"),
    },
    {
      value: "it",
      text: t("Italian"),
    },
    {
      value: "es",
      text: t("Spanish"),
    },
  ];

  const languagesFiltered = allowedLanguages
    ? languages.filter((lang) => allowedLanguages.includes(lang.value))
    : languages;

  return (
    <Select
      labelText={<Trans>Language</Trans>}
      className={styles.input}
      {...form.register("meta.language")}
      defaultValue={
        languagesFiltered.find((lang) => lang.value === language)?.value ||
        languagesFiltered[0]?.value
      }
    >
      {languagesFiltered.map((lang) => (
        <SelectItem key={lang.value} value={lang.value} text={lang.text} />
      ))}
    </Select>
  );
}
