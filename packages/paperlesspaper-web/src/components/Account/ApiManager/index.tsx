import Repeater from "components/Repeater";
import { tokensApi } from "ducks/tokens";
import React from "react";

import styles from "./styles.module.scss";
import { Trans } from "react-i18next";
import AddToken from "./AddToken";
import {
  Button,
  InlineLoading,
  InputGroup,
  Item,
  Link,
} from "@progressiveui/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/pro-solid-svg-icons";
import DeleteModal from "components/DeleteModal";
import { faAdd } from "@fortawesome/pro-solid-svg-icons";

export default function ApiManager() {
  const tokens = tokensApi.useGetAllTokensQuery();

  const [deleteToken] = tokensApi.useDeleteSingleTokensMutation();

  const deleteEntry = async (urlId) => {
    try {
      await deleteToken({
        id: urlId,
      });
    } catch (err) {
      console.error("Failed to save the post: ", err);
    }
  };

  const addTokenButton = (
    <Button
      onClick={() => setOpen(true)}
      kind="primary"
      icon={<FontAwesomeIcon icon={faAdd} />}
    >
      <Trans>Generate Token</Trans>
    </Button>
  );

  const [open, setOpen] = React.useState(false);

  return (
    <div>
      <h3>
        <Trans>API for Developers</Trans>
      </h3>

      <AddToken open={open} setOpen={setOpen} />

      {tokens.isSuccess && tokens.data ? (
        <InputGroup
          labelText={<Trans>Tokens</Trans>}
          helperText={
            <>
              <Trans>
                Use these tokens to give access to your account in other
                applications.
              </Trans>{" "}
              <Link
                href={`${import.meta.env.REACT_APP_SERVER_WEBSITE_URL}/posts/api-docs`}
                target="_blank"
              >
                <Trans>Documentation</Trans>
              </Link>
            </>
          }
        >
          <Repeater
            addButton={addTokenButton}
            customEmptyContent={addTokenButton}
          >
            {tokens.data.map((item: any) => {
              return (
                <Item
                  key={item.id}
                  className={styles.tokenItem}
                  kind="horizontal"
                  wrapper="repeater"
                  title={item.name || <Trans>No description</Trans>}
                  additional={
                    <DeleteModal
                      name="Token"
                      urlId={item.id}
                      deleteEntry={deleteEntry}
                      customButton={
                        <Button
                          kind="ghost"
                          type="button"
                          icon={<FontAwesomeIcon icon={faTimes} />}
                        ></Button>
                      }
                    />
                  }
                >
                  <Trans>Created at</Trans>{" "}
                  {new Date(item.createdAt).toLocaleDateString()}
                </Item>
              );
            })}
          </Repeater>
        </InputGroup>
      ) : (
        <InlineLoading description={<Trans>Loading...</Trans>} />
      )}
    </div>
  );
}
