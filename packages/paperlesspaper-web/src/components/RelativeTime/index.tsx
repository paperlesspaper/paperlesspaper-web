import React from "react";
import { Trans } from "react-i18next";

export default function RelativeTime({ difference }: any) {
  let diff = 0;
  let unit = "";

  if (Math.abs(difference) <= 60) {
    diff = Math.round(Math.abs(difference));
    unit = "min";
  } else if (Math.abs(difference) >= 60 * 24) {
    diff = Math.round(Math.abs(difference) / 60 / 24);
    unit = "days";
  } else if (Math.abs(difference) >= 60) {
    diff = Math.round(Math.abs(difference) / 60);
    unit = "hours";
  }

  return (
    <>
      {diff} <Trans>{unit}</Trans>{" "}
      <Trans>{difference > 0 ? "late" : "early"}</Trans>
    </>
  );
}
