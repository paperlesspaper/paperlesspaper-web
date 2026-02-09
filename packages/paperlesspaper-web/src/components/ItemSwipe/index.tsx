import React, { useEffect } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { NavLink } from "react-router-dom";
import { useParams } from "react-router";
import styles from "./styles.module.scss";
import { Trans } from "react-i18next";
import DeleteModal from "components/DeleteModal";

const preventScroll = (e) => {
  e.preventDefault();
};

function ItemEl({
  total,
  settingsOverview,
  e,
  i,
  customDetailsOnClick,
  customDetailLink,
  Item,
  activeSwipeItem,
  setActiveSwipeItem,
  setSwipeDragStart,
  setSwipeDragStop,
}: any) {
  const controls = useAnimationControls();
  const params = useParams();

  useEffect(() => {
    if (activeSwipeItem === i) return;
    handleDragEnd(null, { offset: { x: 0 }, velocity: { x: 0 } });
  }, [activeSwipeItem]);

  async function handleDragEnd(_, info) {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (offset < -100 || velocity < -500) {
      await controls.start({ x: "-30%", transition: { duration: 0.2 } });
      //onDelete(index);
    } else {
      controls.start({ x: 0, opacity: 1, transition: { duration: 0.15 } });
    }
  }

  useEffect(() => {
    controls.start({ x: 0, opacity: 1, transition: { duration: 0.2 } });
  }, [total]);

  const dragStart = () => {
    setActiveSwipeItem(i);
    setSwipeDragStart();
  };

  return (
    <motion.div
      style={{
        overflow: "hidden",
        willChange: "transform",
        cursor: "grab",
      }}
      whileTap={{ cursor: "grabbing" }}
      layout
      transition={{ type: "spring", stiffness: 1000, damping: 300 }}
    >
      <motion.div
        className={styles.motionWrapper}
        drag="x"
        dragDirectionLock
        onDirectionLock={(axis) => {
          if (axis === "x") {
            dragStart();
          } else {
            setActiveSwipeItem(null);
          }
        }}
        onDragEnd={(event, info) => {
          setSwipeDragStop();
          handleDragEnd(event, info);
        }}
        animate={controls}
      >
        <NavLink
          key={i}
          id={`settingsSidebarItem${i}`}
          draggable="false"
          className={styles.navLink}
          onClick={(e) => {
            if (customDetailsOnClick) {
              customDetailsOnClick(e);
            }
            handleDragEnd(null, { offset: { x: 0 }, velocity: { x: 0 } });
          }}
          to={
            customDetailLink
              ? customDetailLink(e)
              : {
                  pathname: `/${settingsOverview.organizationId}/${
                    settingsOverview.duckName || settingsOverview.name
                  }/${e.id}/`,
                  search: settingsOverview.search,
                  backOption: "detailPage",
                }
          }
        >
          <Item
            e={e}
            kind="horizontal"
            wrapper="sidebar"
            active={e.id === params.entry}
          />
        </NavLink>
        <div className={styles.deleteQuestionRemove}>
          <DeleteModal
            {...settingsOverview}
            // customDeleteRedirect={() => {}}
            urlId={e.id}
            customButton={
              <div className={styles.deleteIcon}>
                <Trans>Delete</Trans>
              </div>
            }
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

export function ItemSwipe({
  items,
  settingsOverview,
  customDetailsOnClick,
  customDetailLink,
  Item,
}: any) {
  const [activeSwipeItem, setActiveSwipeItem] = React.useState(null);

  const setSwipeDragStop = () => {
    console.log("setSwipeDragStop");
    document
      .getElementsByClassName("wfp--sidebar-content__scroll")[0]
      .removeEventListener("touchmove", preventScroll);
  };

  const setSwipeDragStart = () => {
    console.log("setSwipeDragStart");
    document
      .getElementsByClassName("wfp--sidebar-content__scroll")[0]
      .addEventListener("touchmove", preventScroll);
  };

  return (
    <>
      {items.map((value, index) => {
        return (
          <ItemEl
            total={items.length}
            index={index}
            key={index}
            i={index}
            e={value}
            settingsOverview={settingsOverview}
            customDetailsOnClick={customDetailsOnClick}
            customDetailLink={customDetailLink}
            Item={Item}
            activeSwipeItem={activeSwipeItem}
            setActiveSwipeItem={setActiveSwipeItem}
            setSwipeDragStart={setSwipeDragStart}
            setSwipeDragStop={setSwipeDragStop}
          />
        );
      })}
    </>
  );
}

/* function getHeight(items) {
  const totalHeight = items.length * height;
  const totalPadding = (items.length - 1) * padding;
  const totalScroll = totalHeight + totalPadding;
  return totalScroll;
} */

/* function useConstraints(items: any) {
  const [constraints, setConstraints] = useState({ top: 0, bottom: 0 });

  useEffect(() => {
    setConstraints({ top: size - getHeight(items), bottom: 0 });
  }, [items]);

  return constraints;
} */
