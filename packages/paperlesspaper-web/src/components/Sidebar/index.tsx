import React from "react";
import SidebarContent from "./SidebarContent";
import styles from "./styles.module.scss";
import SelectPatient from "../SelectPatient";
import useCurrentOrganization from "helpers/organizations/useCurrentOrganization";

function Sidebar() {
  const allQuery = useCurrentOrganization();

  const { data: currentOrganization } = allQuery;

  if (!currentOrganization) return null;

  return (
    <>
      <div className={styles.selectCase}>
        <SelectPatient />

        {/*kind === "device" && activeUserDevice.data?.kind === "epaper" && (
          <NewEntryButton
            className={styles.addButton}
            icon={<AddIcon />}
            newDate={trayDate}
            newTimeCategory={timeCategory}
            kind="primary"
            small={false}
            iconReverse={false}
          >
            <Trans>New picture</Trans>
          </NewEntryButton>
        )}
        {kind === "user" && (
          <NewEntryButton
            className={styles.addButton}
            icon={<AddIcon />}
            newDate={trayDate}
            newTimeCategory={timeCategory}
            kind="primary"
            small={false}
            iconReverse={false}
          >
            <Trans>Intake</Trans>
          </NewEntryButton>
        ) */}
      </div>

      <div className={styles.sidebarContent}>
        <SidebarContent />
      </div>
    </>
  );
}

export default Sidebar;
