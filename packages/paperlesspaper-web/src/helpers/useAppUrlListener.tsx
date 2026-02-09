import { useEffect } from "react";
import { useHistory } from "react-router-dom";

import { App } from "@capacitor/app";

const useAppUrlListener = () => {
  const history = useHistory();
  useEffect(() => {
    App.addListener("appUrlOpen", (event) => {
      const url = import.meta.env.REACT_APP_AUTH_REDIRECT_URL.replace(
        "https://",
        ""
      );
      const slug = event.url.split(url).pop();
      console.log("External Url AppUrlListener", slug, event);
      if (slug && event.url.includes(url)) {
        history.push(slug);
      }
    });
  }, []);

  return null;
};

export default useAppUrlListener;
