import React, { useState } from "react";
import { Avatar } from "@progressiveui/react";
// import styles from "./styles.module.scss";

export default function AvatarElement({
  className,
  name,
  user,
  ...other
}: any) {
  const split = user && user.avatar ? user.avatar.split("/") : undefined;
  const fileName = split ? split[split.length - 1] : undefined;

  const image = fileName
    ? `${
        import.meta.env.REACT_APP_SERVER_BASE_URL
      }users/userimage/?file=user/resized/small/resized-${fileName}`
    : user?.auth0User?.picture
      ? user?.auth0User?.picture
      : user?.picture
        ? user?.picture
        : undefined;

  const [status, setStatus] = useState("notInitialized");

  if (status === "error" || image === undefined)
    return <Avatar className={className} />;

  return (
    <Avatar
      className={className}
      image={image}
      alt={name}
      onError={() => setStatus("error")}
      {...other}
    />
  );
}
