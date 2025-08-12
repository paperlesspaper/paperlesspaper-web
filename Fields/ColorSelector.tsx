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
      <SelectItem value="dark" text={t("dark")} />
      <SelectItem value="light" text={t("light")} />
      <SelectItem value="red-dark" text={t("dark and red")} />
      <SelectItem value="red-light" text={t("light and red")} />
    </Select>
  );
}
