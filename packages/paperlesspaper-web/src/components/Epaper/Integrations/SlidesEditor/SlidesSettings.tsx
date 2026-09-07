import { faRectangleVertical } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
import { Trans } from "react-i18next";
import EditorButton from "../ImageEditor/EditorButton";
import useEditor from "../ImageEditor/useEditor";
import { papersApi } from "ducks/ePaper/papersApi";
import { useParams } from "react-router-dom";
import PaperSelectionGrid from "../components/PaperSelectionGrid";

const ModalComponent = () => {
  const { form }: any = useEditor();

  const { organization } = useParams();

  const frameKind = form.watch("meta.frameKind");
  const selectedPapers = form.watch("meta.selectedPapers") || {};
  const selectedPaperIds = Object.entries(selectedPapers)
    .filter(([, isSelected]) => Boolean(isSelected))
    .map(([paperId]) => paperId);

  const papers = papersApi.useGetAllPapersQuery(
    {
      queryOptions: {
        organization: organization,
        sortBy: "updatedAt:desc",
      },
    },
    {
      skip: !organization,
    }
  );

  const papersFiltered = React.useMemo(
    () =>
      papers.data?.filter((paper: any) => paper.kind !== "slides") ?? [],
    [papers.data],
  );

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

  const togglePaper = (paperId: string) => {
    setSelectedPaperOrder(
      selectedPapers?.[paperId]
        ? selectedPaperIds.filter((selectedId) => selectedId !== paperId)
        : [...selectedPaperIds, paperId],
    );
  };

  return (
    <PaperSelectionGrid
      papers={papersFiltered}
      organization={organization}
      selectedPaperIds={selectedPapers}
      onTogglePaper={togglePaper}
      expectedFrameKind={frameKind}
    />
  );
};

export default function SlidesSettings() {
  return (
    <EditorButton
      id="slides-settings"
      kind="secondary"
      text={<Trans>Slides</Trans>}
      icon={<FontAwesomeIcon icon={faRectangleVertical} />}
      modalComponent={ModalComponent}
      modalHeading={<Trans>Select slides</Trans>}
    />
  );
}
