import React from "react";
import { Checkbox, NumberInput } from "@progressiveui/react";
import MultiCheckbox from "components/MultiCheckbox";
import { Trans, useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBellOn,
  faBellPlus,
  faBellSlash,
  faLightbulbOn,
} from "@fortawesome/pro-light-svg-icons";
import { Controller } from "react-hook-form";

import MultiCheckboxWrapper from "components/MultiCheckbox/MultiCheckboxWrapper";
import { useDebug } from "helpers/useCurrentUser";
import ButtonRouter from "components/ButtonRouter";

export default function AdvancedDeviceSettings({
  // entryData,
  errors,
  control,
  register,
}: any) {
  const isDebug = useDebug();
  const { t } = useTranslation();

  return (
    <>
      <h3>
        <Trans>Advanced settings</Trans>
      </h3>
      <MultiCheckboxWrapper
        kind="vertical"
        labelText={<Trans>Alarm intensity</Trans>}
        helperText={
          <>
            <Trans>
              Choose between different alarm intensities of the device
            </Trans>{" "}
            <ButtonRouter
              isHtmlLink
              to={`${
                import.meta.env.REACT_APP_SERVER_WEBSITE_URL
              }/posts/alarm-modi`}
              target="_blank"
            >
              <Trans>More Information...</Trans>
            </ButtonRouter>
          </>
        }
      >
        <MultiCheckbox
          labelText={<Trans>Disabled</Trans>}
          description={<Trans>All alarms are disabled</Trans>}
          icon={<FontAwesomeIcon icon={faBellSlash} />}
          id="gender-off"
          value="alarm-0"
          type="radio"
          mobile="vertical"
          kind="vertical"
          {...register("alarmEnable")}
        />
        <MultiCheckbox
          labelText={<Trans>Light only</Trans>}
          description={
            <Trans>The tray to be taken is flashing without any sound</Trans>
          }
          icon={<FontAwesomeIcon icon={faLightbulbOn} />}
          id="gender-led"
          value="alarm-1"
          type="radio"
          mobile="vertical"
          kind="vertical"
          {...register("alarmEnable")}
        />
        <MultiCheckbox
          labelText={<Trans>Light & Short beeb</Trans>}
          description={
            <Trans>
              The tray to be taken is flashing with a short beeb sound
            </Trans>
          }
          icon={<FontAwesomeIcon icon={faBellPlus} />}
          id="gender-short-beeb"
          value="alarm-2"
          type="radio"
          mobile="vertical"
          kind="vertical"
          {...register("alarmEnable")}
        />
        <MultiCheckbox
          labelText={<Trans>Light & Intense beeb</Trans>}
          description={
            <Trans>
              The tray to be taken is flashing with a long and loud sound
            </Trans>
          }
          icon={<FontAwesomeIcon icon={faBellOn} />}
          id="gender-intense-beeb"
          value="alarm-3"
          type="radio"
          mobile="vertical"
          kind="vertical"
          {...register("alarmEnable")}
        />
      </MultiCheckboxWrapper>
      <Controller
        rules={{
          required: true,
        }}
        render={({ field }: any) => {
          return (
            <NumberInput
              {...field}
              step={0.5}
              //value={parseInt(field.value) / 60 / 60}
              /*onChange={(e: any) => {
                field.onChange(
                  parseInt(e.target?.value ? e.target.value : e * 60 * 60)
                );
              }}*/
              addonAfter={<Trans>Hours</Trans>}
              labelText={<Trans>Offset time</Trans>}
              helperText={
                <Trans i18nKey="OFFSETTIMERHELPERTEXT">
                  After how many hours is the alarm automatically turned off?
                </Trans>
              }
              invalid={errors.takeOffsetTime}
              invalidText={t("Invalid number")}
              min="1"
              max="24"
            />
          );
        }}
        name="takeOffsetTime"
        control={control}
      />
      {isDebug && (
        <Checkbox
          id="proxyreport"
          {...register("proxyReport")}
          labelText={
            <Trans>Proximity report (send all proximity sensor changes)</Trans>
          }
          value="true"
        />
      )}
    </>
  );
}
