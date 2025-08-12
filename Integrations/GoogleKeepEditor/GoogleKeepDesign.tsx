import { faGlobe } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Checkbox, Input, TextInput } from "@progressiveui/react";
import React from "react";
import { Trans } from "react-i18next";
import EditorButton from "../ImageEditor/EditorButton";
import useEditor from "../ImageEditor/useEditor";
import styles from "./googleKeepDesign.module.scss";
import LanguageSelector from "../../Fields/LanguageSelector";
import ColorSelector from "../../Fields/ColorSelector";
import GoogleLoginWrapper from "../GoogleCalendarEditor/GoogleLogin";

const ModalComponent = () => {
  const { form }: any = useEditor();

  const watchAll = form.watch();

  const accessToken = form.watch("meta.googleKeep.access_token");

  return (
    <>
      <GoogleLoginWrapper />
      <LanguageSelector />

      <TextInput
        labelText="Kind"
        className={styles.input}
        {...form.register("meta.kind")}
      />

      <ColorSelector />

      {watchAll.meta?.calendarData?.calendars ? (
        <>
          <Input
            labelText={<Trans>Select calendars</Trans>}
            className={styles.calendars}
            helperText={
              <Trans>Choose the calendars that should be displayed</Trans>
            }
          />
          {watchAll.meta.calendarData.calendars.map(
            (calendar: any, index: number) => {
              const fieldName = `meta.selectedCalendars[${calendar.id.replaceAll(
                ".",
                "_%_"
              )}]`;

              return (
                <Checkbox
                  key={index}
                  labelText={
                    <>
                      {calendar.summary}
                      <div
                        className={styles.color}
                        style={{ background: calendar.backgroundColor }}
                      ></div>
                    </>
                  }
                  className={styles.input}
                  {...form.register(fieldName)}
                />
              );
            }
          )}
        </>
      ) : accessToken ? (
        <Trans>No calendars found</Trans>
      ) : null}
    </>
  );
};

export default function GoogleKeepDesign() {
  return (
    <EditorButton
      id="settings"
      kind="secondary"
      text={<Trans>Settings</Trans>}
      icon={<FontAwesomeIcon icon={faGlobe} />}
      modalComponent={ModalComponent}
      // modalHeading={<Trans>Website</Trans>}
    />
  );
}
