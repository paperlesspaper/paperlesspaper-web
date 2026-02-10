import React from "react";
import { Trans } from "react-i18next";
import { usersApi } from "ducks/usersApi";
import { useParams } from "react-router-dom";
import { generateUserName } from "./generateUserName";

export const UserName = ({ id, notFound = "No user assigned", user }: any) => {
  const { data, isLoading, isSuccess } = usersApi.useGetSingleUsersQuery(id, {
    skip: !id || user,
  });

  const userData = user || data;

  if (isLoading) return <Trans>Loading...</Trans>;
  if (isSuccess) return <UserNameNew user={userData} />;
  return <Trans>{notFound}</Trans>;
};

export const userNameString = ({ id, notFound = "No user assigned" }) => {
  const { data, isLoading, isSuccess } = usersApi.useGetSingleUsersQuery(id, {
    skip: !id,
  });

  const name = generateUserName(data);
  if (isLoading) return "Loading...";
  if (isSuccess && name) return generateUserName(data);
  return notFound;
};

export const CurrentUserName = ({ notFound = "No user assigned" }: any) => {
  const { organization } = useParams();
  const { data, isLoading, isSuccess } =
    usersApi.useGetCurrentUserQuery(organization);

  if (isLoading) return <>Loading...</>;
  if (isSuccess) return <UserNameNew user={data} />;
  return <Trans>{notFound}</Trans>;
};

export const UserNameNew = ({ user }: any) => {
  const userName = generateUserName(user);

  if (userName === "invited user") {
    return <Trans>Invited user</Trans>;
  }
  if (userName !== null) {
    return userName;
  } else {
    return <Trans>Unnamed user</Trans>;
  }
};

export default UserName;
