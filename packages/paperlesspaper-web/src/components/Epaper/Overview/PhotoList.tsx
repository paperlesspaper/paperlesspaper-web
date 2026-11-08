import { useActiveUserDevice } from "helpers/useUsers";
import React from "react";
import { papersApi } from "ducks/ePaper/papersApi";
import PhotoFrame from "./PhotoFrame";
import PictureEmpty from "components/PatientsEmpty/PictureEmpty";
import { Trans } from "react-i18next";
import InlineLoadingLarge from "components/InlineLoadingLarge";

export default function PhotoList() {
  const activeUserDevices = useActiveUserDevice();
  const paperId = activeUserDevices.data?.paper;

  // Several frames can display the same paper, regardless of paper.deviceId.
  const paper = papersApi.useGetSinglePapersQuery(paperId, {
    skip: !paperId,
  });

  if (
    activeUserDevices.isLoading ||
    (paperId && paper.isFetching && !paper.currentData)
  )
    return (
      <InlineLoadingLarge description={<Trans>Pictures loading...</Trans>} />
    );

  if (activeUserDevices.isError || (paperId && paper.isError))
    return (
      <div>
        <Trans>Error...</Trans>
      </div>
    );

  if (!paperId || !paper.currentData) return <PictureEmpty />;
  return (
    <PhotoFrame paper={paper.currentData} key={paperId} variant="primary" />
  );
}
