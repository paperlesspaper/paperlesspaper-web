import React, { useState } from "react";
import { Input, Tooltip } from "@progressiveui/react";
import styles from "./styles.module.scss";
import { HexColorPicker } from "react-colorful";
import { Trans } from "react-i18next";
import classnames from "classnames";
import color from "color";

export const presetColors = [
  //"#FF681F",
  //"#FAB71E",
  "#7FDBB6", // green
  "#1AD086", // green
  "#91D2FA", // light blue
  "#EDD609", // lighter blue
  "#D866C5", // pink
  "#1B95E0", // blue
  "#E9B06D", // grey
  "#E9244F", // red
  "#F58EA9", // light red
  "#9832EB", // purple
  "#09B29E", // dark grey
  "#C184DE", // purple
];

export default function ColorInput(props: any) {
  const [displayColorPicker, setDisplayColorPicker] = useState(false);

  const handleClick = () => {
    setDisplayColorPicker(!displayColorPicker);
  };

  const { hideHex = true } = props;

  const classNames = classnames(styles.colorSelectElement, {
    [`${styles.colorActive}`]: props.value,
    [`${styles.hideHex}`]: hideHex,
  });

  const luminosity = color(props.value).luminosity();

  const classes = classnames(styles.dateInputWrapper, {
    [styles.light]: luminosity > 0.5,
  });

  console.log("ColorInput props:", props.value);

  return (
    <Input {...props} formItemClassName={styles.dateInput}>
      <div className={classes}>
        <Tooltip
          content={
            <div className={styles.colorSelect}>
              <HexColorPicker
                className={styles.colorPicker}
                color={props?.value === null ? undefined : props.value}
                onChange={(e) => props.onChange(e)}
              />
              <div className={styles.swatches}>
                {presetColors.map((presetColor) => (
                  <button
                    key={presetColor}
                    type="button"
                    style={{ background: presetColor }}
                    onClick={() => props.onChange(presetColor)}
                  />
                ))}
              </div>
            </div>
          }
          trigger="click"
        >
          <div>
            <div className={classNames}>
              <div
                className={styles.colorView}
                onClick={handleClick}
                style={{ background: props.value }}
              ></div>
              {hideHex ? null : (
                <div className={styles.colorValue}>
                  {props.value ? props.value : <Trans>no color</Trans>}
                </div>
              )}
            </div>
          </div>
        </Tooltip>
      </div>
    </Input>
  );
}
