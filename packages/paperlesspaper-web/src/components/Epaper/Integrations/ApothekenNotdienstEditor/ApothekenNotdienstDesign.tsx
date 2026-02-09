import { faGlobe } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  NumberInput,
  Select,
  SelectItem,
  TextInput,
} from "@progressiveui/react";
import React from "react";
import { Controller } from "react-hook-form";
import { Trans, useTranslation } from "react-i18next";
import AddressAutocomplete from "../components/AddressAutocomplete";
import EditorButton from "../ImageEditor/EditorButton";
import useEditor from "../ImageEditor/useEditor";
import styles from "./apothekenNotdienst.module.scss";

const DEFAULT_COORDINATES = {
  lat: 52.4974,
  lon: 13.4596,
};
const DEFAULT_RADIUS = 5;
const DEFAULT_LIMIT = 5;
const DEFAULT_REFRESH_MINUTES = 30;
const MIN_REFRESH_MINUTES = 20;
const MAX_REFRESH_MINUTES = 12 * 60;

const dayOptions = [
  { value: "today", labelKey: "Today" },
  { value: "tomorrow", labelKey: "Tomorrow" },
];

const themeOptions = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "midnight", label: "Midnight" },
  { value: "red-dark", label: "Red dark" },
  { value: "red-light", label: "Red light" },
];

const layoutOptions = [
  { value: "primary", label: "Primary" },
  { value: "compact", label: "Compact" },
  { value: "striped", label: "Striped" },
];

/*
const languageOptions = [
  { value: "de-DE", label: "Deutsch" },
  { value: "en-GB", label: "English" },
];
*/

const parseFloatField = (event: React.ChangeEvent<HTMLInputElement>) => {
  const parsedValue = parseFloat(event?.target?.value || "");
  return Number.isNaN(parsedValue) ? "" : parsedValue;
};

const parseIntegerField = (event: React.ChangeEvent<HTMLInputElement>) => {
  const parsedValue = parseInt(event?.target?.value || "", 10);
  return Number.isNaN(parsedValue) ? "" : parsedValue;
};

const ModalComponent = () => {
  const { form }: any = useEditor();
  const { t } = useTranslation();

  return (
    <>
      <AddressAutocomplete className={styles.input} />
      {/*}
      <Controller
        name="meta.lat"
        control={form.control}
        render={({ field }) => (
          <NumberInput
            {...field}
            min={-90}
            max={90}
            step={0.0001}
            labelText={<Trans>Latitude</Trans>}
            helperText={<Trans>Decimal degrees between -90 and 90</Trans>}
            className={styles.input}
            value={field.value ?? DEFAULT_COORDINATES.lat}
            onChange={(event) => field.onChange(parseFloatField(event))}
          />
        )}
      />

      <Controller
        name="meta.lon"
        control={form.control}
        render={({ field }) => (
          <NumberInput
            {...field}
            min={-180}
            max={180}
            step={0.0001}
            labelText={<Trans>Longitude</Trans>}
            helperText={<Trans>Decimal degrees between -180 and 180</Trans>}
            className={styles.input}
            value={field.value ?? DEFAULT_COORDINATES.lon}
            onChange={(event) => field.onChange(parseFloatField(event))}
          />
        )}
      />*/}

      <Controller
        name="meta.radius"
        control={form.control}
        render={({ field }) => (
          <NumberInput
            {...field}
            min={1}
            max={50}
            step={1}
            labelText={<Trans>Search radius (km)</Trans>}
            helperText={<Trans>Minimum 1 km, maximum 50 km</Trans>}
            className={styles.input}
            value={field.value ?? DEFAULT_RADIUS}
            onChange={(event) => field.onChange(parseIntegerField(event))}
          />
        )}
      />

      <Select
        labelText={<Trans>Day</Trans>}
        className={styles.input}
        {...form.register("meta.day")}
        defaultValue={form.getValues("meta.day") || "today"}
      >
        {dayOptions.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            text={t(option.labelKey)}
          />
        ))}
      </Select>

      <Controller
        name="meta.limit"
        control={form.control}
        render={({ field }) => (
          <NumberInput
            {...field}
            min={1}
            max={20}
            step={1}
            labelText={<Trans>Maximum entries</Trans>}
            helperText={<Trans>Maximum number of pharmacies to show</Trans>}
            className={styles.input}
            value={field.value ?? DEFAULT_LIMIT}
            onChange={(event) => field.onChange(parseIntegerField(event))}
          />
        )}
      />

      {/* <Controller
        name="meta.refreshInterval"
        control={form.control}
        render={({ field }) => {
          const minutesValue =
            typeof field.value === "number"
              ? Math.round(field.value / 60000)
              : (field.value ?? DEFAULT_REFRESH_MINUTES);

          return (
            <NumberInput
              {...field}
              min={MIN_REFRESH_MINUTES}
              max={MAX_REFRESH_MINUTES}
              step={5}
              labelText={<Trans>Refresh interval (minutes)</Trans>}
              helperText={<Trans>How often the data should refresh</Trans>}
              className={styles.input}
              value={minutesValue}
              onChange={(event) => {
                const parsedValue = parseIntegerField(event);
                if (parsedValue === "") {
                  field.onChange("");
                  return;
                }
                const clampedValue = Math.min(
                  Math.max(parsedValue, MIN_REFRESH_MINUTES),
                  MAX_REFRESH_MINUTES
                );
                field.onChange(clampedValue * 60 * 1000);
              }}
            />
          );
        }}
      /> */}

      <Select
        labelText={<Trans>Theme</Trans>}
        className={styles.input}
        {...form.register("meta.color")}
        defaultValue={form.getValues("meta.color") || "dark"}
      >
        {themeOptions.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            text={t(option.label)}
          />
        ))}
      </Select>

      {/*<Select
        labelText={<Trans>Layout</Trans>}
        className={styles.input}
        {...form.register("meta.kind")}
        defaultValue={form.getValues("meta.kind") || "primary"}
      >
        {layoutOptions.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            text={t(option.label)}
          />
        ))}
      </Select>

      <TextInput
        labelText={<Trans>Custom title</Trans>}
        helperText={<Trans>Optional heading override</Trans>}
        placeholder={t("Emergency pharmacies")}
        className={styles.input}
        {...form.register("meta.title")}
      /> */}
    </>
  );
};

export default function ApothekenNotdienstDesign() {
  return (
    <EditorButton
      id="apotheken-settings"
      kind="secondary"
      text={<Trans>Settings</Trans>}
      icon={<FontAwesomeIcon icon={faGlobe} />}
      modalComponent={ModalComponent}
    />
  );
}
