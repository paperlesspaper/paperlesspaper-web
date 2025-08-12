/* eslint-disable no-constant-binary-expression */

import React, { useState } from "react";

import styles from "./styles.module.scss";
import { v4 as uuidv4 } from "uuid";
import {
  InlineLoading,
  InputGroup,
  Modal,
  Story,
  Tag,
} from "@progressiveui/react";
import { Trans } from "react-i18next";
import { papersApi } from "ducks/papersApi";
import { useParams, useHistory } from "react-router-dom";
import MultiCheckbox from "components/MultiCheckbox";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import classnames from "classnames";

import integrations from "../applications";
import { useForm } from "react-hook-form";

export default function EditorWrapper() {
  const history = useHistory();
  const [successModal, setSuccessModal] = useState<boolean>();

  const params = useParams();

  console.log("params", params);

  const singlePaper = papersApi.useGetSinglePapersQuery(params.paper, {
    skip: params.paper === "new",
  });

  const form = useForm();

  const kindSelect = form.watch("kindSelect");

  const paperKind = params?.paperKind || singlePaper.data?.kind;

  const EditorComponent = integrations.find(
    (app) => app.id === paperKind
  )?.component;

  const overviewUrl = `/${params.organization}/calendar/device/${params.entry}`;

  if (singlePaper.isLoading)
    return (
      <div className={styles.saving}>
        <div className={styles.savingInside}>
          <InlineLoading />
        </div>
      </div>
    );

  /* (loading || uploadSingleImageResult?.isLoading) && (
        <div className={styles.saving}>
          <div className={styles.savingInside}>
            <InlineLoading />
          </div>
        </div>
      )
      
        store={storeWithContext}
            uploadSingleImageResult={uploadSingleImageResult}
            
            */

  const onSubmit = (data) => {
    console.log("onSubmit", data);
  };
  const classes = classnames(styles.wrapper, {
    "force-darkmode": paperKind === "image",
  });

  return (
    <div className={classes}>
      {paperKind}
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {params.paper === "new" && !params.paperKind ? (
          <Modal
            open={true}
            className={styles.modal}
            modalHeading={<Trans>Select application</Trans>}
            primaryButtonText={<Trans>Continue</Trans>}
            onRequestClose={() => history.push(overviewUrl)}
            onRequestSubmit={() => {
              console.log("kindSelect", overviewUrl + "/new/" + kindSelect);
              history.push(overviewUrl + "/new/" + kindSelect);
            }}
          >
            <InputGroup>
              {integrations.map((app) => (
                <MultiCheckbox
                  key={app.id}
                  labelText={
                    <>
                      <Trans>{app.name}</Trans>
                      {app.status === "beta" && (
                        <Tag className={styles.beta} type="warning">
                          Beta
                        </Tag>
                      )}
                    </>
                  }
                  description={<Trans>{app.description}</Trans>}
                  className={styles.checkbox}
                  kind="vertical"
                  icon={
                    <div className={styles.iconWrapper}>
                      <img src={app.icon} alt={app.name} />

                      {/* }
                      <FontAwesomeIcon
                        icon={app.icon}
                        className={styles.foregroundIcon}
                      />
                      <FontAwesomeIcon
                        icon={app.iconDuotone}
                        className={styles["duotone-" + app.key]}
                      /> */}
                    </div>
                  }
                  value={app.id}
                  type="radio"
                  {...form.register("kindSelect")}
                  onClick={() => form.setValue("kind", app.id)}
                />
              ))}
            </InputGroup>
          </Modal>
        ) : paperKind ? (
          <EditorComponent />
        ) : (
          <div>Not found {paperKind}</div>
        )}
      </form>
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
