import React, { useMemo } from "react";
import { useParams } from "react-router-dom";
import { Callout, Empty } from "@progressiveui/react";
import JsonViewer from "components/JsonViewer";
import ButtonRouter from "components/ButtonRouter";
import { Trans, useTranslation } from "react-i18next";

type Props = {
  settingsOverview: any;
};

export default function SearchListDetail({ settingsOverview }: Props) {
  const { t } = useTranslation();
  const { entry } = useParams<{ entry?: string }>();

  const selected = useMemo(() => {
    return settingsOverview?.filteredDataArray?.find((item) => item.id === entry);
  }, [settingsOverview?.filteredDataArray, entry]);

  if (!selected) {
    return (
      <Empty>
        <Trans>Select a search result</Trans>
      </Empty>
    );
  }

  const detailLink =
    selected.kind === "organization"
      ? `/admin/organizations/${selected.sourceId}/`
      : selected.kind === "user"
      ? `/admin/users/${selected.sourceId}/`
      : `/admin/devices/${selected.sourceId}/`;

  return (
    <div style={{ padding: 16 }}>
      <h2>{selected.title}</h2>
      <p>{selected.subtitle}</p>

      <ButtonRouter to={detailLink} kind="secondary">
        {t("Open {{kind}} detail page", { kind: t(selected.kind) })}
      </ButtonRouter>

      <div style={{ marginTop: 16 }}>
        <Callout title={t("Type: {{kind}}", { kind: t(selected.kind) })}>
          {selected.additional || ""}
        </Callout>
      </div>

      <h3>
        <Trans>Raw data</Trans>
      </h3>
      <JsonViewer src={selected.data} />
    </div>
  );
}
