import React from "react";
import { Trans } from "react-i18next";
import DesignSettings from "./DesignSettings";
import IntegrationModal from "../IntegrationModal";
import useIntegrationForm from "../useIntegrationForm";
import SlidesSettings from "./SlidesSettings";
import DeletePaper from "../ImageEditor/DeletePaper";
import styles from "./slidesEditor.module.scss";
import { Button } from "@progressiveui/react";
import SlideOrderList from "./SlideOrderList";

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

  const selectedPaperIds = Object.entries(selectedPapers || {})
    .filter(([, isSelected]) => Boolean(isSelected))
    .map(([paperId]) => paperId);

  const hasSelectedSlides = selectedPaperIds.length > 0;

  const setSelectedPaperOrder = (paperIds: string[]) => {
    form.setValue(
      "meta.selectedPapers",
      Object.fromEntries(paperIds.map((paperId) => [paperId, true])),
      {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      },
    );
  };

  return (
    <IntegrationModal
      elements={Elements}
      store={store}
      modalHeading={<Trans>Display Slideshow</Trans>}
      primaryButtonDisabled={!hasSelectedSlides}
      passiveModal
    >
      <div className={styles.slidesSelected}>
        {hasSelectedSlides ? (
          <section className={styles.orderPanel}>
            <SlideOrderList
              paperIds={selectedPaperIds}
              onReorder={setSelectedPaperOrder}
            />
          </section>
        ) : (
          <>
            <h2 className={styles.emptyTitle}>
              <Trans>No slides selected</Trans>
            </h2>
            <p className={styles.description}>
              <Trans>
                Choose images or integrations to include in this slideshow.
              </Trans>
            </p>
          </>
        )}
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
