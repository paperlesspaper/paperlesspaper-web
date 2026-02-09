import {
  faGauge,
  faGaugeLow,
  faGaugeMax,
  faGaugeHigh,
  faGaugeMin,
  faTruckFast,
  faCalendarDay,
} from "@fortawesome/pro-light-svg-icons";
import { InputGroup } from "@progressiveui/react";
import React from "react";
import { Trans } from "react-i18next";
import { Controller } from "react-hook-form";
import SleepTimeSlider from "./SleepTimeSlider";

const times = [
  {
    key: 60,
    name: "1 minute",
    nameShort: "1m",
    description: "Warning: Battery life will be only approx. 3 days",
    expectedBatteryLife: 3,
    icon: faTruckFast,
  },
  {
    key: 300,
    name: "5 minutes",
    nameShort: "5m",
    description: "Battery life: approx. 2 weeks",
    expectedBatteryLife: 14,
    icon: faGaugeMax,
  },
  {
    key: 600,
    name: "10 minutes",
    nameShort: "10m",
    description: "Battery life: approx. 1 month",
    expectedBatteryLife: 30,
    icon: faGaugeMax,
  },
  {
    key: 1800,
    name: "30 minutes",
    nameShort: "30m",
    description: "Battery life: approx. 3 months",
    expectedBatteryLife: 90,
    icon: faGaugeHigh,
  },
  {
    key: 3600,
    name: "60 minutes",
    nameShort: "1h",
    description: "Battery life: approx. 6 months",
    expectedBatteryLife: 180,
    icon: faGauge,
  },
  {
    key: 7200,
    name: "2 hours",
    nameShort: "2h",
    description: "Battery life: approx. 10 months",
    expectedBatteryLife: 300,
    icon: faGaugeLow,
  },
  {
    key: 28800,
    name: "8 hours",
    nameShort: "8h",
    description: "Battery life: approx. 1 year",
    expectedBatteryLife: 365,
    icon: faGaugeMin,
  },
  {
    key: 43200,
    name: "12 hours",
    nameShort: "12h",
    description: "Battery life: approx. 1.2 years",
    expectedBatteryLife: 427,
    icon: faGaugeMin,
  },
  {
    key: 57.6,
    name: "16 hours",
    nameShort: "16h",
    description: "Battery life: approx. 1.4 year",
    expectedBatteryLife: 498,
    icon: faGaugeMin,
  },
  {
    key: 86400,
    name: "1 day",
    nameShort: "1d",
    description: "Battery life: approx. 1.5 years",
    expectedBatteryLife: 547,
    icon: faCalendarDay,
  },
];

export default function DeviceSettings({ control }: any) {
  const timesFiltered = times;

  /* const sleepTime = form.watch("meta.sleepTime");

  useEffect(() => {
    if (entryData.meta?.sleepTime === undefined && sleepTime === undefined) {
      form.setValue("meta.sleepTime", "3600");
    }
  }, [entryData?.id, sleepTime]); */

  return (
    <>
      <InputGroup
        labelText={<Trans>Update interval</Trans>}
        helperText={
          <Trans>
            Sleep interval before the next update. Longer intervals extend
            battery life. Shake the device or press the button on the back to
            trigger an immediate update.
          </Trans>
        }
      >
        <Controller
          control={control}
          name="meta.sleepTime"
          defaultValue={(
            timesFiltered.find((option) => option.key === 3600)?.key ??
            timesFiltered[0].key
          ).toString()}
          render={({ field }) => (
            <SleepTimeSlider
              options={timesFiltered}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
            />
          )}
        />
      </InputGroup>
    </>
  );
}
