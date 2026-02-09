import React from "react";
import DeleteModal from "components/DeleteModal";

import { useSettingsContent } from "../SettingsContentContext";

export default function DeleteModalSettings({
  customDeleteButtonText,
}: {
  customDeleteButtonText?: React.ReactNode;
}) {
  const settings = useSettingsContent();
  return (
    <DeleteModal
      {...settings}
      customDeleteButtonText={customDeleteButtonText}
    />
  );
}
