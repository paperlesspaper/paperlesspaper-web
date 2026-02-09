import { Select, SelectItem } from "@progressiveui/react";
import React from "react";
import styles from "./fields.module.scss";
import { Trans, useTranslation } from "react-i18next";
import useEditor from "../Integrations/ImageEditor/useEditor";

export default function ColorSelector() {
  const { t } = useTranslation();
  const { form }: any = useEditor();
  return (
    <Select
      labelText={<Trans>Color Scheme</Trans>}
      className={styles.input}
      {...form.register("meta.color")}
    >
      <SelectItem
        value="light"
        text={t("light (black text on white background)")}
      />
      <SelectItem
        value="dark"
        text={t("dark (white text on black background)")}
      />
      <SelectItem
        value="red-dark"
        text={t("dark and red (red text on black background)")}
      />
      <SelectItem
        value="red-light"
        text={t("light and red (red text on white background)")}
      />
    </Select>
  );
}
