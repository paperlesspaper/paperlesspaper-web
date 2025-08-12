import { papersApi } from "ducks/papersApi";
import { useActiveUserDevice } from "helpers/useUsers";
import { useEffect, useState } from "react";
import { useParams, useHistory } from "react-router-dom";
import useSettingsForm from "helpers/useSettingsFormNew";
import { v4 as uuidv4 } from "uuid";
import integrations from "./applications";
import { useTranslation } from "react-i18next";
import languages from "translation/languages";
import useRotationList from "./ImageEditor/useRotationList";
import { useSearchParams } from "react-router";
import QueryString from "qs";

export default function useIntegrationForm({ defaultValues }) {
  const activeUserDevices = useActiveUserDevice();

  const history = useHistory();
  const [successModal, setSuccessModal] = useState<boolean>();
  const params = useParams();

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const [uploadSingleImage, uploadSingleImageResult] =
    papersApi.useUploadSingleImageMutation();

  const afterSubmit = async ({ values, originalValues, result }) => {
    const formData = new FormData();

    formData.append("picture", originalValues.dataDirect);
    formData.append("picture", originalValues.dataOriginal);
    formData.append("pictureEditable", originalValues.dataEditable);

    await uploadSingleImage({ body: formData, id: result.data.id });

    setLoading(false);
    setDone(true);
  };

  const prepareSubmit = (data) => {
    setLoading(true);
    const { kind, dataEditable, meta, ...values } = data;
    return { deviceId: activeUserDevices.data?.id, kind, meta };
  };

  const availableLanguages = integrations.find(
    (app) => app.key === params?.paperKind
  )?.languages;

  const { i18n } = useTranslation();

  const defaultLanguage =
    availableLanguages?.find((lang) => lang === i18n.language) ||
    Object.keys(languages).find((lang) => lang === i18n.language) ||
    "en";

  const allPapers = papersApi.useGetAllPapersQuery(
    {
      deviceId: activeUserDevices.data?.id,
      queryOptions: {
        deviceId: activeUserDevices.data?.id,
        sortBy: "updatedAt:desc",
      },
    },
    {
      skip: activeUserDevices.data?.id === undefined,
    }
  );

  const paperResultOrientation = allPapers.data?.find(
    (e) => e?.meta?.orientation
  );

  const orientation = paperResultOrientation?.meta?.orientation || "portrait";

  const initializeData = (data) => {
    if (params?.paper === "new") {
      return {
        ...defaultValues,
        meta: {
          ...defaultValues.meta,
          language: defaultLanguage,
          id: uuidv4(),
          lut: "default",
          orientation,
        },
      };
    }
    return data;
  };

  const store = useSettingsForm({
    api: papersApi,
    id: params.paper,
    url: `/${params.organization}/calendar/device/${params.entry}/${params.paper}`,
    customOverviewUrl: `/${params.organization}/calendar/device/${params.entry}`,
    prepareSubmit,
    afterSubmit,
    prepareFormEntry: initializeData,
    formSettings: { mode: "onChange" },
    entryParam: "paper",
  });

  useEffect(() => {
    if (store.urlId === "new")
      store.form.setValue("meta.orientation", orientation);
  }, [orientation]);

  /* useEffect(() => {
    if (createSinglePapersResult.isSuccess === true) {
      setSuccessModal(true);
    }
  }, [createSinglePapersResult.isSuccess]);
 */
  // parse all params except “modal”
  const { modal, ...rest } = QueryString.parse(location.search, {
    ignoreQueryPrefix: true,
  });

  const modalOpen = modal;

  const setModalOpen = (name) => {
    const newParams = { ...rest, modal: name };
    history.push({
      pathname: location.pathname,
      search: QueryString.stringify(newParams, { addQueryPrefix: true }),
    });
  };

  const isLoading =
    loading ||
    store.resultUpdateSingle.isLoading ||
    store.resultCreateSingle.isLoading;

  const rotationList = useRotationList();

  const storeWithContext = {
    ...store,
    setModalOpen,
    modalOpen,
    setDone,
    done,
    rotationList,
    loading,
    isLoading,
  };

  return storeWithContext;
}
