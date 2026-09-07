import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export default function HelmetTitle({ children }: { children: string }) {
  const { t } = useTranslation();

  useEffect(() => {
    if (children) document.title = t(children);
  }, [children, t]);

  return null;
}
