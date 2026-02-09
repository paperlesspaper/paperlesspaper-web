import React from "react";
import { Trans } from "react-i18next";
import DesignSettings from "./DesignSettings";
import IntegrationModal from "../IntegrationModal";
import useIntegrationForm from "../useIntegrationForm";
import SlidesSettings from "./SlidesSettings";
import DeletePaper from "../ImageEditor/DeletePaper";
import styles from "./slidesEditor.module.scss";
import { Button } from "@progressiveui/react";

const Elements = () => {
  return (
    <>
      <DesignSettings />
      <SlidesSettings />
      <DeletePaper />
    </>
  );
};

export default function SlidesEditor() {
  const store = useIntegrationForm({ defaultValues: { kind: "slides" } });

  const { form } = store;

  const selectedPapers = form.watch("meta.selectedPapers");

  const selectedPapersList = Object.entries(selectedPapers || {})
    .map(([key, value]) => {
      return { key, value };
    })
    .filter((e) => e.value);

  return (
    <IntegrationModal
      elements={Elements}
      store={store}
      modalHeading={<Trans>Display Slideshow</Trans>}
      passiveModal
    >
      <div className={styles.slidesSelected}>
        <h2>{selectedPapersList.length}</h2>
        <Trans>Slides selected</Trans>
        <Button
          className={styles.selectSlidesButton}
          onClick={() => store.setModalOpen("slides-settings")}
        >
          <Trans>Select slides</Trans>
        </Button>
      </div>
    </IntegrationModal>
  );
}
