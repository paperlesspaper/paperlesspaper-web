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

  const selectedPapers = form.watch("meta.selectedPapers") || {};

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

  const papersFiltered =
    papers.data?.filter((paper: any) => {
      return paper.kind !== "slides";
    }) ?? [];

  const togglePaper = (paperId: string) => {
    form.setValue(
      `meta.selectedPapers.${paperId}`,
      !selectedPapers?.[paperId],
      {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      },
    );
  };

  return (
    <div>
      <PaperSelectionGrid
        papers={papersFiltered}
        organization={organization}
        selectedPaperIds={selectedPapers}
        onTogglePaper={togglePaper}
      />
    </div>
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
