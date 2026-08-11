import { Button, Empty } from "@progressiveui/react";
import React, {
  type ComponentType,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Trans } from "react-i18next";
import type { Rotation } from "../Integrations/ImageEditor/useRotationList";
import styles from "./photoFrame.module.scss";
import { isHttpUrl } from "./photoFrameModel";

type EmptyMessageProps = {
  size: Rotation;
};

type IntegrationPreviewProps = {
  calendarPostData?: unknown;
  emptyMessage?: ComponentType<EmptyMessageProps>;
  initData: Record<string, unknown>;
  onSelectWebsite: () => void;
  scale: number;
  shouldShowEmptyMessage: boolean;
  size: Rotation;
  url: string | null;
};

export default function IntegrationPreview({
  calendarPostData,
  emptyMessage: EmptyMessage,
  initData,
  onSelectWebsite,
  scale,
  shouldShowEmptyMessage,
  size,
  url,
}: IntegrationPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [iframeLoadingError, setIframeLoadingError] = useState(false);
  const validUrl = isHttpUrl(url);

  const postMessages = useCallback(() => {
    const contentWindow = iframeRef.current?.contentWindow;
    if (!contentWindow) return;

    if (calendarPostData) {
      contentWindow.postMessage(
        {
          cmd: "message",
          type: "GOOGLECALENDAR",
          data: { calendarData: calendarPostData },
        },
        "*"
      );
    }

    contentWindow.postMessage(
      {
        cmd: "message",
        type: "INIT",
        data: initData,
      },
      "*"
    );
  }, [calendarPostData, initData]);

  useEffect(() => {
    setIframeLoadingError(false);
  }, [url]);

  useEffect(() => {
    postMessages();
  }, [postMessages]);

  if (url && !validUrl) {
    return (
      <Empty title={<Trans>Url incorrect</Trans>}>
        <Trans>Please enter a correct url</Trans>
      </Empty>
    );
  }

  if (iframeLoadingError) {
    return (
      <Empty title={<Trans>Content not loaded</Trans>}>
        <Trans>Failed loading the iframe</Trans>
      </Empty>
    );
  }

  if (validUrl) {
    return (
      <div className={styles.iframeContainer}>
        <iframe
          className={styles.iframePreview}
          src={url}
          style={{
            height: `${size.height}px`,
            transform: `translate(-50%, -50%) scale(${scale})`,
            width: `${size.width}px`,
          }}
          ref={iframeRef}
          onError={() => setIframeLoadingError(true)}
          onLoad={() => {
            setIframeLoadingError(false);
            postMessages();
          }}
          title="E-paper integration preview"
        />
        {shouldShowEmptyMessage && EmptyMessage && (
          <div className={styles.iframeOverlay}>
            <EmptyMessage size={size} />
          </div>
        )}
      </div>
    );
  }

  if (shouldShowEmptyMessage && EmptyMessage) {
    return <EmptyMessage size={size} />;
  }

  return (
    <div className={styles.selectWebsite}>
      <h3>
        <Trans>Please select a website</Trans>
      </h3>
      <Button onClick={onSelectWebsite}>
        <Trans>Select website</Trans>
      </Button>
    </div>
  );
}
