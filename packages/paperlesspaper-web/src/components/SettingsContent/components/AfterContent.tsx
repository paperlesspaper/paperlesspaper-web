import React from "react";
import { useSettingsContent } from "../SettingsContentContext";

export const AfterContent = () => {
  const { afterContent } = useSettingsContent();
  if (afterContent)
    return (
      <div className="afterContent" /* className={styles.form} */>
        {afterContent}
      </div>
    );
  return null;
};
