import { useEffect } from "react";
import { useSelector } from "react-redux";
export default function useApiErrors({ getToken }) {
  const errors: any = useSelector((state: any) => state.globalState.errors);
  console.log("Api Error", errors);

  useEffect(() => {
    if (errors.length > 0 && errors[errors.length - 1]) {
      console.warn("Api Error: got a rejected action!", errors);

      const error = errors[errors.length - 1];
      if (
        error?.payload?.status === 400 &&
        error.payload.data.message === "User does not exist"
      ) {
        //dispatch(globalState.actions.reset());
        //history.push("/new-user");
      }
      if (
        error?.payload?.status === 401 &&
        error.payload.data.message === "jwt expired"
      ) {
        console.log("Api Error: jwt expired");
        //history.push("/login");
        getToken();
        //dispatch(globalState.actions.reset());
      }
    }
  }, [errors]);
  return null;
}
