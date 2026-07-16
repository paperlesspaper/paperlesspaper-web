import React from "react";
import { Button, InlineLoading, Item, Tag } from "@progressiveui/react";
import moment from "moment";
import { Trans } from "react-i18next";

import JsonViewer from "components/JsonViewer";
import { devicesApi } from "ducks/devices";

type DeviceUploadLog = {
  _id?: string;
  attemptId: string;
  status: "started" | "skipped" | "uploaded" | "partial" | "failed";
  reason: string;
  trigger: string;
  similarityPercentage?: number | null;
  startedAt: string;
};

const statusType = (status: DeviceUploadLog["status"]) => {
  if (status === "uploaded") return "success";
  if (status === "failed") return "error";
  if (status === "partial" || status === "skipped") return "warning";
  return undefined;
};

const formatSimilarity = (similarityPercentage?: number | null) => {
  if (similarityPercentage === null || similarityPercentage === undefined) {
    return "n/a";
  }

  return `${similarityPercentage.toFixed(2)}%`;
};

export default function DeviceUploadLogs({ id }: { id?: string }) {
  const { data, isError, isFetching, refetch } =
    devicesApi.useGetUploadLogsQuery(
      { id, limit: 50 },
      {
        skip: !id,
        refetchOnMountOrArgChange: true,
      },
    );
  const logs = (data?.results || []) as DeviceUploadLog[];

  return (
    <>
      <h3>
        <Trans>Upload attempts</Trans>
      </h3>
      <p>
        <Trans>
          Recent frame upload decisions, triggers, similarity checks and
          failures for this device.
        </Trans>
      </p>
      <Button kind="secondary" disabled={isFetching} onClick={() => refetch()}>
        <Trans>Refresh</Trans>
      </Button>
      <br />
      <br />

      {isFetching && logs.length === 0 ? (
        <InlineLoading
          description={<Trans>Upload attempts loading...</Trans>}
        />
      ) : isError ? (
        <Trans>Upload attempts could not be loaded.</Trans>
      ) : logs.length > 0 ? (
        logs.map((log) => (
          <Item
            kind="horizontal"
            wrapper="repeater"
            key={log.attemptId || log._id}
            title={
              <>
                <Tag type={statusType(log.status)}>{log.status}</Tag>{" "}
                {log.reason}
              </>
            }
            subContent={
              <>
                <Trans>Trigger</Trans>: {log.trigger || "unknown"} ·{" "}
                <Trans>Similarity</Trans>:{" "}
                {formatSimilarity(log.similarityPercentage)}
              </>
            }
            additional={moment(log.startedAt).format("DD.MM.YYYY HH:mm:ss")}
          >
            <JsonViewer collapsed={2} src={log} />
          </Item>
        ))
      ) : (
        <Trans>No upload attempts found.</Trans>
      )}
    </>
  );
}
