import React from "react";
import { papersApi } from "ducks/ePaper/papersApi";
import { devicesApi } from "ducks/devices";
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
  const parsedQuery = QueryString.parse(location.search, {
    ignoreQueryPrefix: true,
  });
  const frameKindFromQueryRaw = parsedQuery?.frameKind;
  const frameKindFromQuery = Array.isArray(frameKindFromQueryRaw)
    ? frameKindFromQueryRaw[0]
    : frameKindFromQueryRaw;

  // const [modalOpen, setModalOpen] = React.useState(false);
  const [isDoneModal, setDoneModal] = React.useState(false);
  const [isFrameSelectionOpen, setFrameSelectionOpen] = React.useState(false);
  const [selectedFrameIds, setSelectedFrameIds] = React.useState<string[]>([]);
  const selectedFrameId = selectedFrameIds[0] || null;
  const setSelectedFrameId = React.useCallback(
    (value: React.SetStateAction<string | null>) => {
      setSelectedFrameIds((previousFrameIds) => {
        const nextFrameId =
          typeof value === "function"
            ? value(previousFrameIds[0] || null)
            : value;
        return nextFrameId ? [nextFrameId] : [];
      });
    },
    [],
  );
  const [selectedSlideshowIds, setSelectedSlideshowIds] = React.useState<
    string[]
  >([]);
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

  const organizationPapers = papersApi.useGetAllPapersQuery(
    {
      organizationId: params.organization,
      queryOptions: {
        sortBy: "updatedAt:desc",
      },
    },
    {
      skip: !params.organization,
    },
  );
  const organizationDevices = devicesApi.useGetAllDevicesQuery(
    { organizationId: params.organization },
    { skip: !params.organization },
  );

  const buildUploadFormData = (originalValues) => {
    if (originalValues?.kind === "printer") return null;

    const formData = new FormData();

    if (originalValues?.kind === "playlist") {
      return formData;
    }

    if (originalValues?.dataDirect) {
      formData.append("picture", originalValues.dataDirect);
    }
    if (originalValues?.dataOriginal) {
      formData.append("picture", originalValues.dataOriginal);
    }
    if (originalValues?.dataEditable) {
      formData.append("pictureEditable", originalValues.dataEditable);
    }

    return formData;
  };

  const afterSubmit = async ({ originalValues, result }) => {
    setLoading(false);

    const paperId = result?.data?.id;
    const keepIntegrationOpenAfterDraft = Boolean(
      originalValues?.keepIntegrationOpenAfterDraft,
    );

    console.log("Uploading image to paper", result?.data?.id);

    if (!paperId) return;

    if (keepIntegrationOpenAfterDraft) {
      const nextQuery = QueryString.stringify(
        {
          ...parsedQuery,
          frameKind: originalValues?.meta?.frameKind || frameKindFromQuery,
        },
        { addQueryPrefix: true },
      );

      history.replace({
        pathname: `/${params.organization}/${params.page}/device/${params.entry}/${paperId}`,
        search: nextQuery,
        state: { skipUnsavedPrompt: true },
      });
      setDone(false);
      return;
    }

    const targetFrameIds = selectedFrameIds.filter(Boolean);
    const targetSlideshowIds = selectedSlideshowIds.filter(
      (slideshowId) => slideshowId && slideshowId !== paperId,
    );
    const paperKind = result?.data?.kind || originalValues?.kind;
    const paperOrganization = result?.data?.organization || params.organization;
    const paperMeta = result?.data?.meta || originalValues?.meta || {};

    const updatePaperDevice = async (deviceId: string) => {
      await updatePaperMeta({
        id: paperId,
        values: {
          deviceId,
          kind: paperKind,
          organization: paperOrganization,
          meta: paperMeta,
        },
      }).unwrap();
    };

    const uploadPaperToDevice = async (deviceId?: string | null) => {
      if (!deviceId) return;
      const uploadBody = buildUploadFormData(originalValues);
      if (!uploadBody) return;

      const targetDevice = organizationDevices.data?.find(
        (device) => device?.id === deviceId,
      );
      const deviceWasAlreadyShowingPaper = targetDevice?.paper
        ? String(targetDevice.paper) === String(paperId)
        : false;

      uploadBody.append(
        "snapshotCurrentFrame",
        deviceWasAlreadyShowingPaper ? "true" : "false",
      );
      uploadBody.append(
        "forceUpload",
        deviceWasAlreadyShowingPaper ? "false" : "true",
      );

      await uploadSingleImage({
        body: uploadBody,
        id: paperId,
        deviceId,
      }).unwrap();
    };

    setLoading(true);
    try {
      if (targetFrameIds.length) {
        for (const frameId of targetFrameIds) {
          await updatePaperDevice(frameId);
          await uploadPaperToDevice(frameId);
        }

        if (targetFrameIds[targetFrameIds.length - 1] !== targetFrameIds[0]) {
          await updatePaperDevice(targetFrameIds[0]);
        }
      } else {
        const fallbackDeviceId =
          result?.data?.deviceId || activeUserDevices.data?.id;
        await uploadPaperToDevice(fallbackDeviceId);

        const fallbackDevice = organizationDevices.data?.find(
          (device) => device?.id === fallbackDeviceId,
        );
        const previousDevicePaperId = fallbackDevice?.paper
          ? String(fallbackDevice.paper)
          : null;

        if (
          targetSlideshowIds.length &&
          fallbackDeviceId &&
          previousDevicePaperId &&
          previousDevicePaperId !== paperId
        ) {
          const previousPaper = organizationPapers.data?.find(
            (paper) => String(paper?.id) === previousDevicePaperId,
          );

          if (previousPaper) {
            await updatePaperMeta({
              id: previousPaper.id,
              values: {
                deviceId: fallbackDeviceId,
                kind: previousPaper.kind,
                organization: previousPaper.organization,
                meta: previousPaper.meta || {},
              },
            }).unwrap();
          }
        }
      }

      for (const slideshowId of targetSlideshowIds) {
        const slideshowPaper = organizationPapers.data?.find(
          (paper) => paper?.id === slideshowId,
        );

        if (!slideshowPaper) {
          console.error("Selected slideshow paper not found", slideshowId);
          continue;
        }

        const slideshowMeta = slideshowPaper.meta || {};
        const slideshowDevice = organizationDevices.data?.find(
          (device) => device?.id === slideshowPaper.deviceId,
        );
        const previousDevicePaperId = slideshowDevice?.paper
          ? String(slideshowDevice.paper)
          : null;
        const nextSelectedPapers = {
          ...(slideshowMeta.selectedPapers || {}),
          [paperId]: true,
        };

        await updatePaperMeta({
          id: slideshowPaper.id,
          values: {
            deviceId: slideshowPaper.deviceId,
            kind: slideshowPaper.kind,
            organization: slideshowPaper.organization,
            meta: {
              ...slideshowMeta,
              selectedPapers: nextSelectedPapers,
            },
          },
        }).unwrap();

        if (
          slideshowPaper.deviceId &&
          previousDevicePaperId &&
          previousDevicePaperId !== String(slideshowPaper.id)
        ) {
          const frameShouldShowCurrentPaper = targetFrameIds.includes(
            slideshowPaper.deviceId,
          );
          const restorePaper = frameShouldShowCurrentPaper
            ? {
                id: paperId,
                deviceId: slideshowPaper.deviceId,
                kind: paperKind,
                organization: paperOrganization,
                meta: paperMeta,
              }
            : organizationPapers.data?.find(
                (paper) => String(paper?.id) === previousDevicePaperId,
              );

          if (restorePaper) {
            await updatePaperMeta({
              id: restorePaper.id,
              values: {
                deviceId: slideshowPaper.deviceId,
                kind: restorePaper.kind,
                organization: restorePaper.organization,
                meta: restorePaper.meta || {},
              },
            }).unwrap();
          }
        }
      }

      if (targetFrameIds.length) {
        await updatePaperDevice(targetFrameIds[0]);
      }

      setDone(true);
    } catch (error) {
      console.error("Failed to send paper to selected targets", error);
    } finally {
      setLoading(false);
    }

    setSlideshowTargetPaperId(null);
    setSelectedSlideshowIds([]);
  };

  const prepareSubmit = (data) => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {
      kind,
      dataEditable,
      keepIntegrationOpenAfterDraft,
      meta = {},
      ...values
    } = data;
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
          frameKind: frameKindFromQuery || activeUserDevices.data?.kind,
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

  const formFrameKind = store.form.watch("meta.frameKind");
  const selectedFrameKind =
    formFrameKind ||
    frameKindFromQuery ||
    store.entryData?.meta?.frameKind ||
    activeUserDevices.data?.kind ||
    null;

  React.useEffect(() => {
    if (!selectedFrameKind) return;
    const current = store.form.getValues?.("meta.frameKind");
    if (current === selectedFrameKind) return;
    store.form.setValue("meta.frameKind", selectedFrameKind, {
      shouldDirty: false,
    });
  }, [selectedFrameKind]);

  const rotationList = useRotationList(selectedFrameKind || undefined);

  const rotationWatch = store.form.watch("meta.orientation") || "portrait";

  const size = rotationList[rotationWatch];

  const confirmFrameSelection = (onRequestSubmit: () => void) => {
    if (!selectedFrameIds.length && !selectedSlideshowIds.length) return;

    if (selectedFrameIds[0]) {
      store.form?.setValue?.("meta.deviceId", selectedFrameIds[0]);
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
    selectedFrameIds,
    setSelectedFrameIds,
    selectedSlideshowIds,
    setSelectedSlideshowIds,
    selectedFrameKind,
    confirmFrameSelection,
    slideshowTargetPaperId,
    setSlideshowTargetPaperId,
    slideshowTargetPaperQuery,
  };

  return storeWithContext;
}
