import { useActiveUserDevice } from "helpers/useUsers";
import React from "react";
import { papersApi } from "ducks/ePaper/papersApi";
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
        organization: activeUserDevices.data?.organization,
        deviceId: activeUserDevices.data?.id,
        limit: 1,
        sortBy: "updatedAt:desc",
      },
    },
    {
      skip: activeUserDevices.data?.id === undefined,
    },
  );

  const [, uploadSingleImageResult] = papersApi.useUploadSingleImageMutation({
    fixedCacheKey: "upload-single-image",
  });

  React.useEffect(() => {
    if (uploadSingleImageResult.fulfilledTimeStamp && papers.refetch) {
      papers.refetch();
    }
  }, [uploadSingleImageResult.fulfilledTimeStamp, papers.refetch]);

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
        <PhotoFrame paper={paper} key={paper?.id || i} index={i} />
      ))}
    </>
  );
}
