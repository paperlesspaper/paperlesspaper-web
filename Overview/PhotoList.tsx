import { useActiveUserDevice } from "helpers/useUsers";
import React from "react";
import { papersApi } from "ducks/papersApi";
import PhotoFrame from "./PhotoFrame";
import PictureEmpty from "components/PatientsEmpty/PictureEmpty";
import { Trans } from "react-i18next";
import InlineLoadingLarge from "components/InlineLoadingLarge";

export default function PhotoList() {
  const activeUserDevices = useActiveUserDevice();

  const papers = papersApi.useGetAllPapersQuery(
    {
      deviceId: activeUserDevices.data?.id,
      queryOptions: {
        deviceId: activeUserDevices.data?.id,
        sortBy: "updatedAt:desc",
      },
    },
    {
      skip: activeUserDevices.data?.id === undefined,
    }
  );

  if (papers.isLoading)
    return (
      <InlineLoadingLarge description={<Trans>Pictures loading...</Trans>} />
    );

  if (papers.isError) return <div>Error...</div>;

  if (!papers.isLoading && papers.data?.length === 0) return <PictureEmpty />;
  return (
    <>
      {/*
      <div className={styles.newButton}>
        {isDesktop && (
          <NewEntryButton
            icon={<AddIcon />}
            className={styles.newButton}
            kind="primary"
            small={false}
            iconReverse={false}
          >
            <Trans>New picture</Trans>
          </NewEntryButton>
        )}
      </div> */}

      {papers.data.map((paper, i) => (
        <PhotoFrame paper={paper} key={i} index={i} />
      ))}
    </>
  );
}
