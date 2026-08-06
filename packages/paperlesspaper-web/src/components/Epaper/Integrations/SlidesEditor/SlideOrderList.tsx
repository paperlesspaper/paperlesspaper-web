import {
  faChevronDown,
  faChevronUp,
  faGripVertical,
  faRectangleVertical,
} from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { InlineLoading } from "@progressiveui/react";
import { LibraryCard } from "components/Epaper/PaperLibrary";
import { papersApi } from "ducks/ePaper/papersApi";
import { Reorder, useDragControls } from "framer-motion";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import styles from "./slidesEditor.module.scss";

type SlideOrderItemProps = {
  index: number;
  organization?: string;
  paper?: any;
  paperId: string;
  slideCount: number;
  onMove: (paperId: string, offset: number) => void;
};

type SlideOrderListProps = {
  paperIds: string[];
  onReorder: (paperIds: string[]) => void;
};

const SlideOrderItem = ({
  index,
  organization,
  paper,
  paperId,
  slideCount,
  onMove,
}: SlideOrderItemProps) => {
  const dragControls = useDragControls();
  const { t } = useTranslation();
  const slideLabel = paper?.name || paper?.kind || `${t("Image")} ${index + 1}`;

  return (
    <Reorder.Item
      as="li"
      value={paperId}
      className={styles.orderItem}
      dragListener={false}
      dragControls={dragControls}
    >
      <span
        className={styles.dragHandle}
        onPointerDown={(event) => dragControls.start(event)}
        aria-hidden="true"
        title={t("Order")}
      >
        <FontAwesomeIcon icon={faGripVertical} />
      </span>

      <span className={styles.orderNumber}>{index + 1}</span>

      <div className={styles.orderPreview}>
        {paper ? (
          <LibraryCard
            paper={paper}
            organization={organization || ""}
            disableNavigation
          />
        ) : (
          <FontAwesomeIcon icon={faRectangleVertical} />
        )}
      </div>

      <span className={styles.orderLabel}>{slideLabel}</span>

      <div className={styles.orderActions}>
        <button
          type="button"
          onClick={() => onMove(paperId, -1)}
          disabled={index === 0}
          aria-label={`${t("Backward")}: ${slideLabel}`}
          title={t("Backward")}
        >
          <FontAwesomeIcon icon={faChevronUp} />
        </button>
        <button
          type="button"
          onClick={() => onMove(paperId, 1)}
          disabled={index === slideCount - 1}
          aria-label={`${t("Forward")}: ${slideLabel}`}
          title={t("Forward")}
        >
          <FontAwesomeIcon icon={faChevronDown} />
        </button>
      </div>
    </Reorder.Item>
  );
};

export default function SlideOrderList({
  paperIds,
  onReorder,
}: SlideOrderListProps) {
  const { organization } = useParams<{ organization: string }>();
  const { t } = useTranslation();

  const papers = papersApi.useGetAllPapersQuery(
    {
      queryOptions: {
        organization,
        sortBy: "updatedAt:desc",
      },
    },
    {
      skip: !organization || paperIds.length === 0,
    },
  );

  const paperLookup = useMemo(
    () =>
      Object.fromEntries(
        (papers.data ?? []).map((paper: any) => [paper.id, paper]),
      ),
    [papers.data],
  );

  const movePaper = (paperId: string, offset: number) => {
    const currentIndex = paperIds.indexOf(paperId);
    const nextIndex = currentIndex + offset;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= paperIds.length) {
      return;
    }

    const nextOrder = [...paperIds];
    [nextOrder[currentIndex], nextOrder[nextIndex]] = [
      nextOrder[nextIndex],
      nextOrder[currentIndex],
    ];
    onReorder(nextOrder);
  };

  if (papers.isLoading || papers.isFetching) {
    return (
      <div className={styles.orderLoading}>
        <InlineLoading description={t("Loading papers...")} />
      </div>
    );
  }

  return (
    <Reorder.Group
      as="ol"
      axis="y"
      values={paperIds}
      onReorder={onReorder}
      className={styles.orderList}
      aria-label={t("Slide Display Order")}
    >
      {paperIds.map((paperId, index) => (
        <SlideOrderItem
          key={paperId}
          paperId={paperId}
          paper={paperLookup[paperId]}
          organization={organization}
          index={index}
          slideCount={paperIds.length}
          onMove={movePaper}
        />
      ))}
    </Reorder.Group>
  );
}
