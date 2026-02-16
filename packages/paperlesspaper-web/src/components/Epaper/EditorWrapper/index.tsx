import React, { useState } from "react";

import styles from "./styles.module.scss";
import { Modal, Story } from "@progressiveui/react";
import { Trans } from "react-i18next";
import { papersApi } from "ducks/ePaper/papersApi";
import { useParams } from "react-router-dom";
import classnames from "classnames";
import OverlayLoading from "components/OverlayLoading";

import integrations from "../Integrations/applications";
import SelectApplicationModal from "./SelectApplicationModal";

export default function EditorWrapper() {
  const [successModal, setSuccessModal] = useState<boolean>();

  const params = useParams();

  const singlePaper = papersApi.useGetSinglePapersQuery(params.paper, {
    skip: params.paper === "new",
  });

  const paperKind = params?.paperKind || singlePaper.data?.kind;

  const EditorComponent = integrations.find(
    (app) => app.id === paperKind,
  )?.component;

  const overviewUrl = `/${params.organization}/${params.page}/device/${params.entry}`;

  if (singlePaper.isLoading) return <OverlayLoading />;

  const classes = classnames(styles.wrapper, {
    "force-darkmode": paperKind === "image",
  });

  return (
    <div className={classes}>
      {params.paper === "new" && !params.paperKind ? (
        <SelectApplicationModal overviewUrl={overviewUrl} />
      ) : paperKind && EditorComponent ? (
        <EditorComponent />
      ) : (
        <div>Not found {paperKind}</div>
      )}

      {successModal && (
        <Modal
          open={successModal}
          modalHeading={<Trans>Image uploaded successfully</Trans>}
          primaryButtonText={<Trans>Continue</Trans>}
          onRequestSubmit={() => setSuccessModal(false)}
          onRequestClose={() => setSuccessModal(false)}
        >
          <Story>
            <p>
              <Trans>
                The picture frame will update according to your settings 1 to 6
                times per hour.
              </Trans>
              <br />
              <Trans>
                If you want the image to be displayed immediately, please
                briefly press the button on the back of the picture frame.
              </Trans>
            </p>
          </Story>
        </Modal>
      )}
    </div>
  );
}
