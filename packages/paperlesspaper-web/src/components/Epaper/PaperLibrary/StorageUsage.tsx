import React from "react";
import { Trans, useTranslation } from "react-i18next";
import { papersApi } from "ducks/ePaper/papersApi";

export default function StorageUsage({
  organization,
}: {
  organization: string;
}) {
  const { t, i18n } = useTranslation();
  const { data, isError, isLoading } = papersApi.useGetStorageUsageQuery(
    { organization },
    { skip: !organization, refetchOnMountOrArgChange: true }
  );
  if (isLoading)
    return (
      <p role="status">
        <Trans>Loading storage usage...</Trans>
      </p>
    );
  if (isError)
    return (
      <p role="status">
        <Trans>Storage usage is currently unavailable.</Trans>
      </p>
    );
  if (!data) return null;
  const used = new Intl.NumberFormat(i18n.language, {
    maximumFractionDigits: 1,
  }).format(data.usedBytes / 1_000_000);
  const limit = data.limitBytes / 1_000_000;
  return (
    <div style={{ marginBottom: "1rem" }}>
      <p>
        <Trans
          i18nKey="Organization storage: {{used}} of {{limit}} MB used"
          values={{ used, limit }}
        />
      </p>
      <progress
        aria-label={t("Organization storage")}
        value={Math.min(data.usedBytes, data.limitBytes)}
        max={data.limitBytes}
        style={{ width: "100%", maxWidth: 320 }}
      />
      {data.remainingBytes === 0 && (
        <p role="status">
          <Trans>
            Storage is full. Delete pictures or replace them with smaller
            images.
          </Trans>
        </p>
      )}
    </div>
  );
}
