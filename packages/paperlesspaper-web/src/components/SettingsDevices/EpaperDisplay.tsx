import React from "react";
import { Select, SelectItem, TextInput } from "@progressiveui/react";
import { Trans, useTranslation } from "react-i18next";
import { faBrush, faPalette } from "@fortawesome/pro-light-svg-icons";

/*const colorsBw = [
  "#000", // black
  "#FFFFFF", // white
  "#282828", // grau1
  "#494949", // grau2
  "#747474",
  "#A3A3A3",
  "#E0E0E0",
];*/

export const colorsBw = [
  "#000", // black
  "#FFFFFF", // white
  "#282828", // dark grau1
  "#494949", // grau2
  "#949494",
  "#B5B5B5",
  "#D8D8D8",
];

export const colorsBwSlightlyReal = [
  "#000", // black
  "#FFFFFF", // white
  "#0A0A0A", // much darker dark grau1
  "#1A1A1A", // much darker grau2
  "#4A4A4A", // much darker gray
  "#5E5E5E", // much darker gray
  "#7A7A7A", // much darker gray
];
export const colorsMap = [
  "#000", // black
  "#fff", // white
  "#0000FF", // blue
  "#00FF00", // green
  "#FF0000", // red
  "#FF8000", // orange
  "#FFFF00", // yellow
];

export const colorsReal = [
  "#191E21", // black
  "#C6C3C2", // white
  "#30304C", // blue
  "#3C5330", // green
  "#6A181A", // red
  "#7D3024", // orange
  "#976D2E", // yellow
];

export const colorsSlightlyReal = [
  "#191E21", // black
  "#F1F1F1", // white
  "#31318F", // blue
  "#53A428", // green
  "#D20E13", // red
  "#B85E1C", // orange
  "#F3CF11", // yellow
];

export const colorList = {
  default: {
    lut: "default",
    name: "color",
    description: "best for colored pictures",
    colors: colorsSlightlyReal,
    show: true,
    icon: faPalette,
  },
  defaultOriginal: {
    lut: "default",
    name: "color (original)",
    colors: colorsMap,
  },
  color: { lut: "color", name: "color (quick)", colors: colorsMap },
  bw: {
    lut: "bw",
    name: "black and white",
    description: "best for black and white pictures",
    colors: colorsBw,
    show: true,
    icon: faBrush,
  },
  "color-quick": {
    lut: "color-quick",
    name: "color (quicker)",
    colors: colorsMap,
  },
};

export default function EpaperDisplay({ register }: any) {
  const { t } = useTranslation();
  return (
    <>
      <h3>Epaper-Displayeinstellungen</h3>
      <Select labelText={<Trans>Lut</Trans>} {...register("shadow.lut")}>
        {Object.entries(colorList).map(([i, f]) => (
          <SelectItem key={f.name} value={i} text={t(f.name)} />
        ))}
      </Select>

      <TextInput
        labelText={<Trans>Sleep timer</Trans>}
        helperText={
          <Trans>
            How many seconds to sleep after update check (default:3600)
          </Trans>
        }
        {...register("shadow.sleepTime")}
      />

      <TextInput
        labelText={<Trans>Clear screen</Trans>}
        helperText={
          <Trans>
            {" "}
            If do a refresh and clean before load picture (default:true)
          </Trans>
        }
        {...register("shadow.clearScreen")}
      />
    </>
  );
}

/*
{
  "state": {
    "reported": {
        "lut": "color",
        "sleepTime":3600,
        "clearScreen": true
    }
  }
}
18:30 Uhr
Device Settings
Set some settings for device and picture show
Settings in Body as JSON
"lut": String Type of lut (default:default)
"sleepTime": intHow many seconds to sleep after update check (default:3600)
"clearScreen": bool If do a refresh and clean before load picture (default:true)
Lut Types:
"bw" : 7 black grades
"color-quick": Quick color update with blue,yellow,red,black,white
"color": lut color table with quicker refresh
"default": slow refresh with best colors
*/
