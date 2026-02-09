import React from "react";
import { papersApi } from "ducks/ePaper/papersApi";
import { useActiveUserDevice } from "helpers/useUsers";
import { useState } from "react";
import { useParams, useHistory } from "react-router-dom";
import useSettingsForm from "helpers/useSettingsFormNew";
import { v4 as uuidv4 } from "uuid";
import integrations from "./applications";
import { useTranslation } from "react-i18next";
import languages from "translation/languages";
import useRotationList from "./ImageEditor/useRotationList";
// import { useSearchParams } from "react-router";
import QueryString from "qs";

export default function useIntegrationForm({ defaultValues }) {
  const activeUserDevices = useActiveUserDevice();

  const history = useHistory();
  const { i18n } = useTranslation();
  // const [successModal, setSuccessModal] = useState<boolean>();
  const params = useParams();

  // const [modalOpen, setModalOpen] = React.useState(false);
  const [isDoneModal, setDoneModal] = React.useState(false);
  const [isFrameSelectionOpen, setFrameSelectionOpen] = React.useState(false);
  const [selectedFrameId, setSelectedFrameId] = React.useState<string>();
  const [slideshowTargetPaperId, setSlideshowTargetPaperId] = React.useState<
    string | null
  >(null);

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const [uploadSingleImage] = papersApi.useUploadSingleImageMutation({
    fixedCacheKey: "upload-single-image",
  });

  const [updatePaperMeta] = papersApi.useUpdateSinglePapersMutation({
    fixedCacheKey: "update-paper-meta",
  });

  const slideshowTargetPaperQuery = papersApi.useGetSinglePapersQuery(
    slideshowTargetPaperId,
    { skip: !slideshowTargetPaperId },
  );

  const afterSubmit = async ({ originalValues, result }) => {
    setLoading(false);

    // The printer integration is a placeholder paper that will be updated by
    // the external IPP server later (it uploads the first page PNG via API).
    // So we do not upload an image here.
    if (originalValues?.kind === "printer") {
      setSlideshowTargetPaperId(null);
      setDone(true);
      return;
    }

    const formData = new FormData();

    formData.append("picture", originalValues.dataDirect);
    formData.append("picture", originalValues.dataOriginal);
    formData.append("pictureEditable", originalValues.dataEditable);

    console.log("Uploading image to paperdddd", result?.data?.id);

    // If the selected frame currently shows a slideshow, we can add the current paper to it
    // instead of replacing the frame’s current paper.
    if (
      slideshowTargetPaperId &&
      slideshowTargetPaperQuery?.data &&
      result?.data?.id &&
      result.data.id !== slideshowTargetPaperId
    ) {
      const targetDeviceId =
        result?.data?.deviceId || activeUserDevices.data?.id;
      await uploadSingleImage({
        body: formData,
        id: result.data.id,
        deviceId: targetDeviceId,
      });
      const slideshowPaper = slideshowTargetPaperQuery.data;
      const slideshowMeta = slideshowPaper.meta || {};
      const existingSelected = slideshowMeta.selectedPapers || {};
      const nextSelected = {
        ...existingSelected,
        [result.data.id]: true,
      };

      const selectedIdsInOrder = Object.entries(nextSelected)
        .filter(([, isSelected]) => Boolean(isSelected))
        .map(([paperId]) => paperId);

      // Ensure the slideshow immediately displays the newly-added paper.
      // The backend picks selectedPapers[currentSlide] for non-random order.
      const nextCurrentSlide = Math.max(0, selectedIdsInOrder.length - 1);

      await updatePaperMeta({
        id: slideshowTargetPaperId,
        values: {
          deviceId: slideshowPaper.deviceId,
          kind: slideshowPaper.kind,
          organization: slideshowPaper.organization,
          meta: {
            ...slideshowMeta,
            selectedPapers: nextSelected,
            currentSlide: nextCurrentSlide,
          },
        },
      });

      // Trigger an immediate refresh on the device.
      // For `kind === 'slides'`, the backend's uploadSingleImage route advances the slideshow.
      await uploadSingleImage({
        body: new FormData(),
        id: slideshowTargetPaperId,
        deviceId:
          slideshowTargetPaperQuery?.data?.deviceId ||
          activeUserDevices.data?.id,
      });
      setDone(true);
    } else {
      setDone(true);
      console.log("Uploading image to paper", result.data.id);
      const targetDeviceId =
        result?.data?.deviceId || activeUserDevices.data?.id;
      await uploadSingleImage({
        body: formData,
        id: result.data.id,
        deviceId: targetDeviceId,
      });
    }

    setSlideshowTargetPaperId(null);
  };

  const prepareSubmit = (data) => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { kind, dataEditable, meta = {}, ...values } = data;
    const { deviceId: metaDeviceId, ...restMeta } = meta as any;

    const targetDeviceId = metaDeviceId || activeUserDevices.data?.id;

    return { deviceId: targetDeviceId, kind, meta: restMeta };
  };

  const availableLanguages = integrations.find(
    (app) => app.key === params?.paperKind,
  )?.languages;

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
    },
  );

  const paperResultOrientation = allPapers.data?.find(
    (e) => e?.meta?.orientation,
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
          deviceId: activeUserDevices.data?.id,
        },
      };
    }
    return data;
  };

  const store = useSettingsForm({
    api: papersApi,
    id: params.paper,
    url: `/${params.organization}/${params.page}/device/${params.entry}/${params.paper}`,
    customOverviewUrl: `/${params.organization}/${params.page}/device/${params.entry}`,
    prepareSubmit,
    afterSubmit,
    prepareFormEntry: initializeData,
    formSettings: { mode: "onChange" },
    entryParam: "paper",
  });

  /* useEffect(() => {
    if (store.urlId === "new")
      store.form.setValue("meta.orientation", orientation);
  }, [orientation]); */

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

  const rotationWatch = store.form.watch("meta.orientation") || "portrait";

  const size = rotationList[rotationWatch];

  const confirmFrameSelection = (onRequestSubmit: () => void) => {
    if (!selectedFrameId /* && devices.data?.length */) return;

    // In slideshow mode we do NOT set meta.deviceId to the selected frame.
    // Otherwise the backend would re-point the device to the current paper and replace the slideshow.
    if (!slideshowTargetPaperId) {
      store.form?.setValue?.("meta.deviceId", selectedFrameId);
    }

    if (onRequestSubmit) {
      onRequestSubmit();
      return;
    }

    //submitForm();
    setFrameSelectionOpen(false);
  };

  const storeWithContext = {
    ...store,
    setModalOpen,
    modalOpen,
    setDone,
    done,
    rotationList,
    loading,
    isLoading,
    isDoneModal,
    setDoneModal,
    size,
    isFrameSelectionOpen,
    setFrameSelectionOpen,
    selectedFrameId,
    setSelectedFrameId,
    confirmFrameSelection,
    slideshowTargetPaperId,
    setSlideshowTargetPaperId,
    slideshowTargetPaperQuery,
  };

  return storeWithContext;
}
