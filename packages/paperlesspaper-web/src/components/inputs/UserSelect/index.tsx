import React from "react";
import { InlineLoading, Select, SelectItem } from "@progressiveui/react";
import styles from "./styles.module.scss";
import { generateUserName } from "components/UserName/generateUserName";
import { usersApi } from "ducks/usersApi";
import { Trans, useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { Controller } from "react-hook-form";

export default function UserSelect({
  control,
  name,
  labelText = "Patient",
  helperText,
  filterData,
}: any) {
  const { organization } = useParams();
  const { data, isLoading, isFetching } = usersApi.useGetAllUsersQuery({
    organizationId: organization,
  });

  const filteredData = filterData ? filterData(data) : data;

  const { t } = useTranslation();

  if (isLoading || isFetching)
    return <InlineLoading description={<Trans>Users loading...</Trans>} />;

  return (
    <Controller
      control={control}
      name={name}
      defaultValue=""
      render={({ field }) => {
        if (field.value === undefined) {
          field.onChange("");
        }

        return (
          <Select
            labelText={labelText}
            helperText={helperText}
            {...field}
            className={styles.userSelect}
          >
            <SelectItem text={t("No user...")} value="" />
            {filteredData.map((e) => {
              const text = generateUserName(e);
              // if (e.disabled) return null;
              return (
                <SelectItem
                  disabled={e.disabled}
                  key={e.id}
                  text={text !== null ? text : "Unnamed user"}
                  value={e.id}
                />
              );
            })}
          </Select>
        );
      }}
    />
  );
}
