import { accountsApi } from "ducks/accounts";
import { useEffect } from "react";
import i18n from "translation/i18n";
import useAccount from "./useAccount";

export function useUpdateCurrentLanguageFromFrontend() {
  const auth0 = useAccount();

  const currentAccount = accountsApi.useGetCurrentAccountQuery(
    {},
    { skip: !auth0.reduxToken },
  );
  const [updateAccount] = accountsApi.useUpdateSingleAccountsMutation();

  useEffect(() => {
    if (
      currentAccount?.app_metadata &&
      currentAccount.app_metadata?.language === undefined
    )
      updateAccount({
        id: currentAccount?.data?.user_id,
        values: {
          language: i18n.language,
        },
      });
  }, [currentAccount?.data?.app_metadata?.language]);

  return currentAccount;
}
