import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export default function HelmetTitle({ children }: any) {
  const { t } = useTranslation();

  useEffect(() => {
    if (children) document.title = t(children);
  }, []);

  return null;
}
