import { messagesApi } from "ducks/messagesApi";
import React from "react";
import { useParams } from "react-router-dom";
import styles from "./notification.module.scss";

export default function Notification() {
  const { organization } = useParams();
  const { data } = messagesApi.useGetAllMessagesQuery({
    organizationId: organization,
  });

  const length = data
    ? data.filter((e) => e.result?.status !== "read").length
    : 0;
  if (length === 0) return null;
  return (
    <div className={styles.notification}>
      {data.filter((e) => e.result?.status !== "read").length}
    </div>
  );
}
