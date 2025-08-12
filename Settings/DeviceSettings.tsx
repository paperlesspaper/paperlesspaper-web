import {
  faGauge,
  faGaugeLow,
  faGaugeMax,
  faGaugeHigh,
  faGaugeMin,
  faTruckFast,
  faCalendarDay,
} from "@fortawesome/pro-light-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { InputGroup } from "@progressiveui/react";
import MultiCheckbox from "components/MultiCheckbox";
import { useDebug } from "helpers/useCurrentUser";
import React, { useEffect } from "react";
import { Trans } from "react-i18next";

const times = [
  {
    key: 1,
    name: "immediately",
    description: "Battery life: approx. 3 days",
    expectedBatteryLife: 3,
    icon: faTruckFast,
  },
  {
    key: 600,
    name: "10 minutes",
    description: "Battery life: approx. 1 month",
    expectedBatteryLife: 30,
    icon: faGaugeMax,
  },
  {
    key: 1800,
    name: "30 minutes",
    description: "Battery life: approx. 3 months",
    expectedBatteryLife: 90,
    icon: faGaugeHigh,
  },
  {
    key: 3600,
    name: "60 minutes",
    description: "Battery life: approx. 6 months",
    expectedBatteryLife: 180,
    icon: faGauge,
  },
  {
    key: 7200,
    name: "2 hours",
    description: "Battery life: approx. 10 months",
    expectedBatteryLife: 300,
    icon: faGaugeLow,
  },
  {
    key: 28800,
    name: "8 hours",
    description: "Battery life: approx. 1 year",
    expectedBatteryLife: 365,
    icon: faGaugeMin,
  },
  {
    key: 86400,
    name: "1 day",
    description: "Battery life: approx. 1.5 years",
    expectedBatteryLife: 547,
    icon: faCalendarDay,
  },
];

export default function DeviceSettings({ register }: any) {
  const isDebug = useDebug();

  const timesFiltered = isDebug ? times : times.filter((f) => f.key !== 1);

  /* const sleepTime = form.watch("meta.sleepTime");

  useEffect(() => {
    if (entryData.meta?.sleepTime === undefined && sleepTime === undefined) {
      form.setValue("meta.sleepTime", "3600");
    }
  }, [entryData?.id, sleepTime]); */

  return (
    <>
      <InputGroup
        labelText={<Trans>Sleep time</Trans>}
        helperText={
          <Trans>
            The time the device sleeps until the next update. The longer the
            time, the longer the battery life.
          </Trans>
        }
      >
        {timesFiltered.map((f, i) => (
          <MultiCheckbox
            key={i}
            labelText={<Trans>{f.name}</Trans>}
            description={<Trans>{f.description}</Trans>}
            kind="vertical"
            icon={<FontAwesomeIcon icon={f.icon} />}
            type="radio"
            value={f.key}
            {...register("meta.sleepTime")}
          />
        ))}
      </InputGroup>
    </>
  );
}
