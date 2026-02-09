import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import styles from "./useSettingsForm.module.scss";
import { useForm } from "react-hook-form";
import flatten from "./flatten";
import useQs from "./useQs";
import capitalizeFirstLetter from "./capitalizeFirstLetter";

interface useStoreProps {
  customSubmit?: any;
  prepareFormEntry?: any;
  customOverviewUrl?: any;
  api: any;
  id?: any;
  idElement?: any;
  afterSubmit?: any;
  disableDelete?: any;
  customDeleteRedirect?: any;
  prepareSubmit?: any;
  newEntryData?: any;
  entryName?: any;
  url?: any;
  entryParam?: any;
  withOrganization?: any;
  formSettings?: any;
}

function useSettingsForm({
  customSubmit,
  prepareFormEntry = (e) => {
    return e;
  },
  customOverviewUrl,
  api,
  id,
  idElement = (e) => (e ? e.id : undefined),
  disableDelete,
  customDeleteRedirect,
  prepareSubmit = (values) => values,
  newEntryData,
  entryName,
  formSettings = {},
  afterSubmit = () => {},
  url,
  entryParam = "entry",
  withOrganization = true,
}: useStoreProps) {
  const name = api.name;
  const params = useParams();

  const organizationId = params.organization;
  const overviewUrl = customOverviewUrl
    ? customOverviewUrl
    : `/${organizationId}/${name}/`;
  const [urlIdState, setUrlId] = useState<string>();
  const [urlState, setUrl] = useState<string>();
  const formRef = formSettings.formRef || { current: null };

  const search = useQs();

  const urlId = id ? id : params[entryParam] ? params[entryParam] : "new";

  const singleQuery = api[`useGetSingle${capitalizeFirstLetter(name)}Query`](
    urlId,
    { skip: urlId === "new" }
  );

  const { data, isSuccess } = singleQuery;

  const [createSingle, resultCreateSingle] =
    api[`useCreateSingle${capitalizeFirstLetter(name)}Mutation`]();
  const [updateSingle, resultUpdateSingle] =
    api[`useUpdateSingle${capitalizeFirstLetter(name)}Mutation`]();
  const [deleteSingle, resultDeleteSingle] =
    api[`useDeleteSingle${capitalizeFirstLetter(name)}Mutation`]();

  const entryData =
    urlId === "new" && newEntryData
      ? newEntryData
      : urlId === "new"
        ? {}
        : data;

  const form = useForm({
    defaultValues: prepareFormEntry
      ? prepareFormEntry(entryData, { urlId })
      : undefined,
    ...formSettings,
  });

  const { handleSubmit, register, setValue, reset, getValues } = form;
  // Reset form
  const resetForm = ({ kind }) => {
    if (!prepareFormEntry) {
      console.error("prepareFormEntry is not defined");
      return;
    }
    const customEntryData = prepareFormEntry(entryData, { urlId });

    const existingValueReset = form.getValues();

    console.log("existingValueReset", existingValueReset);

    // deep‐clear helper
    /* const clearValues = (obj: any): any => {
      if (Array.isArray(obj)) {
        // preserve array shape but null out every element
        return null; // obj.map(() => null);
      }
      if (obj !== null && typeof obj === "object") {
        return Object.keys(obj).reduce((acc, key) => {
          acc[key] = clearValues(obj[key]);
          return acc;
        }, {} as any);
      }

      if (typeof obj === "string") {
        return ""; // clear string values
      }
      // primitive (string, number, boolean, etc.) → null
      return null;
    }; */

    // const clearedValues = clearValues(existingValueReset);
    // reset(clearedValues);

    /* for (const key of Object.keys(existingValueReset)) {
      existingValueReset[key] =
        typeof existingValueReset[key] === "string" ? "" : null;
    } */
    //reset({ ...existingValueReset, role: "patient" });

    if (
      (urlIdState !== urlId || urlState !== window.location.pathname) &&
      customEntryData
    ) {
      setUrlId(urlId);
      setUrl(window.location.pathname);

      //const oldValues = getValues();
      // const flatValues = flatten(oldValues);

      /*Object.entries(flatValues).forEach(([e, i]) => {
        if (typeof i !== "string") {
          // setValue(e, i);
        } else {
          setValue(e, undefined);
        }
      }); */
    }

    formRef.current?.reset();
    reset({
      //  ...existingValueReset,
      ...customEntryData,
    });

    /* 
    if (urlId !== "new") {
      reset(customEntryData);
    } else {
      reset(undefined, { keepValues: true });
    } */
  };

  useEffect(() => {
    if (urlId === "new" || (data?.id && isSuccess))
      resetForm({ kind: "id-change" });
  }, [data?.id, isSuccess, urlId]);

  /* Update form when entryData changes, because successfully loaded */
  useEffect(() => {
    if (isSuccess === true) resetForm({ kind: "loading-success" });
  }, [isSuccess]);

  const onSubmit = async (allValues: any): Promise<void> => {
    // eslint-disable-next-line prefer-const
    let { draft, ...values } = allValues;
    //reset(values);

    const originalValues = values;
    values = prepareSubmit(values, entryData, { urlId });

    let continueSubmit = true;
    if (customSubmit) {
      continueSubmit = customSubmit(values, organizationId);
    }
    if (continueSubmit) {
      const payload = {
        ...values,
        organization: withOrganization ? organizationId : values.organization,
      };
      let result = null;
      if (urlId === "new" || urlId === undefined) {
        try {
          result = await createSingle({
            values: payload,
            draft,
          });
          reset({}, { keepValues: true });
          //reset(values);
        } catch (err) {
          console.error("Failed to create the post: ", err);
        }
      } else {
        try {
          const { id, ...data } = payload;
          result = await updateSingle({
            values: data,
            id: id ? id : urlId,
            draft,
          });
          //reset();
          await new Promise((resolve) => setTimeout(resolve, 3000));
          //reset();
          reset({}, { keepValues: true });
        } catch (err) {
          console.error("Failed to save the post: ", err);
        }
      }
      afterSubmit({ values, originalValues, result });
    }
  };

  const deleteEntry = async () => {
    try {
      await deleteSingle({
        id: urlId,
      });
    } catch (err) {
      console.error("Failed to save the post: ", err);
    }
  };

  const entryDataId = idElement ? idElement(entryData) : entryData?.id;

  const entryTitle =
    entryName && entryName(entryData) ? entryName(entryData) : undefined;

  const urlNew = url || `/${params.organization}/${name}`;

  const isDirtyAlt = !!Object.keys(form.formState.dirtyFields).length;

  return {
    onSubmit,
    entryData,
    idElement,
    setValue,
    search,
    //  latestCrudId,
    entryDataId,
    entryName,
    overviewUrl,
    url: urlNew,
    customDeleteRedirect,
    entryTitle,
    handleSubmit,
    resetForm,
    register,
    params,
    disableDelete,
    name,
    deleteEntry,
    formRef,
    reset,
    organizationId,
    regularFormStyle: styles.regularForm,
    singleQuery,
    resultCreateSingle,
    resultUpdateSingle,
    resultDeleteSingle,
    urlId,
    form,
    isDirtyAlt,
  };
}
export default useSettingsForm;
