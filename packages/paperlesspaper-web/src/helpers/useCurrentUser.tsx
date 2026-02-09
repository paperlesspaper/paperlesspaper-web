import { useAuth0 } from "@auth0/auth0-react";
import { accountsApi } from "ducks/accounts";
import { usersApi } from "ducks/usersApi";
import { useEffect } from "react";
import { useParams } from "react-router-dom";
import i18n from "translation/i18n";
import useAccount from "./useAccount";

export function useCurrentAccount() {
  const auth0 = useAccount();

  const currentAccount = accountsApi.useGetCurrentAccountQuery(
    {},
    {
      skip: !auth0.reduxToken,
    }
  );

  useEffect(() => {
    i18n.changeLanguage(currentAccount?.data?.app_metadata?.language, (err) => {
      if (err) return console.log("something went wrong loading", err);
    });
  }, [currentAccount?.data?.app_metadata?.language]);

  return currentAccount;
}

export default function useCurrentUser() {
  const { organization } = useParams();
  const currentUser = usersApi.useGetCurrentUserQuery(organization);
  return currentUser;
}

export function useDebug() {
  const currentUser = useCurrentAccount();

  return currentUser?.data?.app_metadata?.debug === true ? true : false;
}

export function useDemo() {
  const currentUser = useCurrentAccount();
  return currentUser?.data?.app_metadata?.demo === true ? true : false;
}
