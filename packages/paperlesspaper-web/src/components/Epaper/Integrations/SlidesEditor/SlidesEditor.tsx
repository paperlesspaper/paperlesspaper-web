import React, { useMemo } from "react";
import { Trans } from "react-i18next";
import { useParams } from "react-router-dom";
import DesignSettings from "./DesignSettings";
import IntegrationModal from "../IntegrationModal";
import useIntegrationForm from "../useIntegrationForm";
import SlidesSettings from "./SlidesSettings";
import DeletePaper from "../ImageEditor/DeletePaper";
import styles from "./slidesEditor.module.scss";
import { Button, InlineLoading } from "@progressiveui/react";
import { LibraryCard } from "components/Epaper/PaperLibrary";
import { papersApi } from "ducks/ePaper/papersApi";

const Elements = () => {
  return (
    <>
      <DesignSettings />
      <SlidesSettings />
      <DeletePaper />
    </>
  );
};

const SelectedPreviewStrip = ({
  selectedPapersList,
}: {
  selectedPapersList: { key: string; value: unknown }[];
}) => {
  const { organization } = useParams<{ organization: string }>();
  const selectedIds = useMemo(
    () => new Set(selectedPapersList.map(({ key }) => key)),
    [selectedPapersList],
  );

  const papers = papersApi.useGetAllPapersQuery(
    {
      queryOptions: {
        organization,
        sortBy: "updatedAt:desc",
      },
    },
    {
      skip: !organization || selectedPapersList.length === 0,
    },
  );

  const selectedPapers =
    papers.data?.filter((paper: any) => selectedIds.has(paper.id)) ?? [];

  if (papers.isLoading || papers.isFetching) {
    return (
      <div className={styles.selectedPreviewStrip}>
        <InlineLoading />
      </div>
    );
  }

  if (selectedPapers.length === 0) return null;

  const visiblePapers = selectedPapers.slice(0, 5);
  const hiddenCount = selectedPapersList.length - visiblePapers.length;

  return (
    <div
      className={styles.selectedPreviewStrip}
      aria-label="Selected slide previews"
    >
      {visiblePapers.map((paper: any) => (
        <div className={styles.selectedPreviewItem} key={paper.id}>
          <LibraryCard
            paper={paper}
            organization={organization || ""}
            disableNavigation
          />
        </div>
      ))}
      {hiddenCount > 0 && (
        <div className={styles.selectedPreviewMore}>+{hiddenCount}</div>
      )}
    </div>
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

  const hasSelectedSlides = selectedPapersList.length > 0;

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
          <>
            <h2>{selectedPapersList.length}</h2>
            <Trans>Slides selected</Trans>
            <SelectedPreviewStrip selectedPapersList={selectedPapersList} />
          </>
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
