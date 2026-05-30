import { faGlobe } from "@fortawesome/pro-regular-svg-icons";
import { faSun } from "@fortawesome/pro-duotone-svg-icons";
import { faSun as faSunLight } from "@fortawesome/pro-light-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Checkbox, Select, SelectItem, TextInput } from "@progressiveui/react";
import React from "react";
import { Trans, useTranslation } from "react-i18next";
import EditorButton from "../ImageEditor/EditorButton";
import useEditor from "../ImageEditor/useEditor";
import styles from "./weatherDesign.module.scss";
import LanguageSelector from "../../Fields/LanguageSelector";
import ColorSelector from "../../Fields/ColorSelector";
import MultiCheckbox from "components/MultiCheckbox";
import MultiCheckboxWrapper from "components/MultiCheckbox/MultiCheckboxWrapper";

const iconStyleOptions = [
  {
    value: "normal",
    label: "Colored",
    fontAwesomeIcon: faSun,
    className: styles.coloredSunIcon,
  },
  {
    value: "light",
    label: "Light monochrome",
    fontAwesomeIcon: faSunLight,
    className: styles.monochromeIcon,
  },
  {
    value: "qweather",
    label: "QWeather filled",
    iconUrl:
      "https://cdn.jsdelivr.net/npm/qweather-icons@1.8.0/icons/100-fill.svg",
    imageClassName: styles.monochromeAdaptiveImage,
  },
  {
    value: "qweather-line",
    label: "QWeather outline",
    iconUrl: "https://cdn.jsdelivr.net/npm/qweather-icons@1.8.0/icons/100.svg",
    imageClassName: styles.monochromeAdaptiveImage,
  },
  {
    value: "glyphs-poly",
    label: "Glyphs Poly",
    iconUrl: "https://api.iconify.design/glyphs-poly/sun.svg",
    imageClassName: styles.paletteIconImage,
  },
  {
    value: "noto-emoji",
    label: "Noto Emoji",
    iconUrl: "https://api.iconify.design/noto/sun.svg",
    imageClassName: styles.paletteIconImage,
  },
  {
    value: "openmoji",
    label: "OpenMoji",
    iconUrl: "https://api.iconify.design/openmoji/sun.svg",
    imageClassName: styles.paletteIconImage,
  },
  {
    value: "openweather",
    label: "OpenWeather",
    iconUrl: "https://openweathermap.org/img/wn/01d@4x.png",
    imageClassName: styles.openWeatherImage,
  },
];

const ModalComponent = () => {
  const { form }: any = useEditor();

  const { t } = useTranslation();

  return (
    <>
      <TextInput
        labelText={<Trans>Location</Trans>}
        helperText={<Trans>Enter the location you want to display</Trans>}
        placeholder="Berlin, Tokio, New York..."
        className={styles.input}
        {...form.register("meta.location")}
      />

      <LanguageSelector />

      <Select
        labelText={<Trans>Display</Trans>}
        className={styles.input}
        {...form.register("meta.kind")}
      >
        <SelectItem
          value="forecast-summary"
          text={t("Current weather and forecast")}
        />
        <SelectItem value="simple" text={t("Simple view of todays weather")} />
        <SelectItem value="forecast" text={t("Forecast only")} />
      </Select>

      <ColorSelector />

      <MultiCheckboxWrapper
        labelText={<Trans>Icon style</Trans>}
        className={styles.iconStyleGrid}
      >
        {iconStyleOptions.map((option) => {
          return (
            <MultiCheckbox
              key={option.value}
              type="radio"
              value={option.value}
              labelText={t(option.label)}
              className={styles.iconStyleOption}
              fullWidth
              icon={
                option.fontAwesomeIcon ? (
                  <FontAwesomeIcon
                    icon={option.fontAwesomeIcon}
                    className={option.className}
                  />
                ) : (
                  <img
                    alt=""
                    className={`${styles.iconStyleImage} ${option.imageClassName}`}
                    src={option.iconUrl}
                  />
                )
              }
              {...form.register("meta.iconstyle")}
            />
          );
        })}
      </MultiCheckboxWrapper>

      <Checkbox
        labelText={
          <>
            <Trans>Display last updated time</Trans>
          </>
        }
        className={styles.input}
        {...form.register("meta.displayLastUpdated")}
      />
    </>
  );
};

export default function CalendarDesign() {
  return (
    <EditorButton
      id="settings"
      kind="secondary"
      text={<Trans>Settings</Trans>}
      icon={<FontAwesomeIcon icon={faGlobe} />}
      modalComponent={ModalComponent}
    />
  );
}
