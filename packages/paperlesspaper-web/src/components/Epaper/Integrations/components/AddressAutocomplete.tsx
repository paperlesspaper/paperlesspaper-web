import { Input, NumberInput } from "@progressiveui/react";
import React, { useCallback, useState } from "react";
import { Controller } from "react-hook-form";
import { Trans, useTranslation } from "react-i18next";
import AsyncSelect from "react-select/async";
import useEditor from "../ImageEditor/useEditor";
import styles from "./addressAutocomplete.module.scss";

export default function AddressAutocomplete({
  className,
}: {
  className?: string;
}) {
  const { form }: any = useEditor();
  const { t } = useTranslation();
  const language = form.watch("meta.language") || "de-DE";
  const [mode, setMode] = useState<"geo" | "manual">("geo");

  const toggleMode = () => {
    setMode((prev) => (prev === "geo" ? "manual" : "geo"));
  };

  const parseFloatField = (event: React.ChangeEvent<HTMLInputElement>) => {
    const parsedValue = parseFloat(event?.target?.value || "");
    return Number.isNaN(parsedValue) ? "" : parsedValue;
  };

  const helperText =
    mode === "geo" ? (
      <>
        <Trans>Select an address to set the coordinates</Trans>{" "}
        <button
          type="button"
          onClick={toggleMode}
          className={styles.switchLink}
        >
          {t("Enter coordinates")}
        </button>
      </>
    ) : (
      <>
        {t("Enter coordinates manually below")}{" "}
        <button
          type="button"
          onClick={toggleMode}
          className={styles.switchLink}
        >
          {t("Search address")}
        </button>
      </>
    );

  const loadOptions = useCallback(
    async (inputValue: string) => {
      const query = inputValue.trim();
      if (!query || !import.meta.env.REACT_APP_GOOGLE_MAPS_API_KEY) return [];
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        query
      )}&language=${encodeURIComponent(language)}&key=${import.meta.env.REACT_APP_GOOGLE_MAPS_API_KEY}`;

      try {
        const response = await fetch(url);
        const data = await response.json();
        if (!data?.results?.length) return [];

        const extractPostalCode = (result: any) => {
          const pcComponent = (result.address_components || []).find((c: any) =>
            c.types?.includes("postal_code")
          );
          if (pcComponent?.long_name) return pcComponent.long_name;
          const match = result.formatted_address?.match(/\b\d{5}\b/);
          return match ? match[0] : undefined;
        };

        return data.results.map((result: any) => {
          const components = result.address_components || [];
          const getComponent = (type: string) =>
            components.find((c: any) => c.types?.includes(type))?.long_name;

          const route = getComponent("route");
          const streetNumber = getComponent("street_number");
          const postalCode = extractPostalCode(result);
          const locality =
            getComponent("locality") ||
            getComponent("administrative_area_level_3") ||
            getComponent("administrative_area_level_2");
          const country = getComponent("country");

          const streetPart = [route, streetNumber].filter(Boolean).join(" ");
          const cityLine = [postalCode, locality].filter(Boolean).join(" ");
          const labelParts = [
            streetPart || undefined,
            cityLine || undefined,
            country || undefined,
          ]
            .filter(Boolean)
            .join(", ");

          return {
            value: result.place_id,
            label: labelParts || result.formatted_address,
            location: {
              lat: result.geometry?.location?.lat,
              lon: result.geometry?.location?.lng,
            },
            rawAddress: result.formatted_address,
          };
        });
      } catch (error) {
        console.error("Geocoding failed", error);
        return [];
      }
    },
    [language]
  );

  return (
    <Controller
      name="meta.address"
      control={form.control}
      render={({ field }) => (
        <Input
          labelText={<Trans>Address</Trans>}
          helperText={helperText}
          className={className}
        >
          {mode === "geo" ? (
            <AsyncSelect
              cacheOptions
              defaultOptions={[]}
              isDisabled={!import.meta.env.REACT_APP_GOOGLE_MAPS_API_KEY}
              openMenuOnFocus={false}
              openMenuOnClick={false}
              className={`wfp--react-select-container ${styles.select}`}
              classNamePrefix="wfp--react-select"
              loadOptions={loadOptions}
              components={{
                DropdownIndicator: null,
                IndicatorSeparator: null,
              }}
              value={field.value || null}
              onChange={(option: any) => {
                field.onChange(option);
                if (option?.location?.lat !== undefined) {
                  form.setValue("meta.lat", option.location.lat);
                }
                if (option?.location?.lon !== undefined) {
                  form.setValue("meta.lon", option.location.lon);
                }
              }}
              placeholder={t("Type an address")}
              noOptionsMessage={() =>
                import.meta.env.REACT_APP_GOOGLE_MAPS_API_KEY
                  ? t("No results")
                  : t("Enter an API key")
              }
            />
          ) : (
            <div className={styles.manualRow}>
              <NumberInput
                id="manual-lat"
                min={-90}
                max={90}
                step={0.0001}
                labelText={<Trans>Latitude</Trans>}
                className={styles.manualNumber}
                value={form.watch("meta.lat") ?? ""}
                onChange={(event) => {
                  const parsed = parseFloatField(event);
                  form.setValue("meta.lat", parsed);
                }}
              />
              <NumberInput
                id="manual-lon"
                min={-180}
                max={180}
                step={0.0001}
                labelText={<Trans>Longitude</Trans>}
                className={styles.manualNumber}
                value={form.watch("meta.lon") ?? ""}
                onChange={(event) => {
                  const parsed = parseFloatField(event);
                  form.setValue("meta.lon", parsed);
                }}
              />
            </div>
          )}
        </Input>
      )}
    />
  );
}
