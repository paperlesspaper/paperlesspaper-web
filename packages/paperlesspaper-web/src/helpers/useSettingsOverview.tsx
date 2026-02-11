import React, { useEffect, useState } from "react";
import { useHistory, useLocation, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import qs from "qs";
import { BlockNotification } from "@progressiveui/react";
import capitalize from "./capitalize";
import { Trans } from "react-i18next";

function filterInside(obj, searchKey) {
  return Object.keys(obj).some(function (key) {
    if (typeof obj[key] === "object" && obj[key]) {
      return filterInside(obj[key], searchKey);
    }

    if (typeof obj[key] === "string") {
      return obj[key].toLowerCase().includes(searchKey);
    }
  });
}

function filterIt(arr, searchKey) {
  if (!searchKey) return arr;
  return arr.filter(function (obj) {
    return filterInside(obj, searchKey.toLowerCase());
  });
}

function useSettingsOverview({ name, titleKey = "name", duck }: any) {
  const [loaded, setLoaded] = useState(false);
  const dispatch = useDispatch();
  const { organization, entry } = useParams();
  const history = useHistory();
  const organizationId = organization;

  const location = useLocation();
  const search = qs.parse(location.search, { ignoreQueryPrefix: true });

  useEffect(() => {
    if (loaded === false) {
      setLoaded(true);
      dispatch(duck.actions.fetch({ organizationId }));
    }
  }, [dispatch, loaded]);

  const medicationSearch = useSelector((state) =>
    duck.selectors.byId(state, search.new ? search.new : search.updated)
  );

  const { latestCrudUpdate }: any = useSelector(duck.selectors.status);
  const dataArray = useSelector(duck.selectors.dataArray);
  const meta = useSelector(duck.selectors.meta);

  const nameCapitalized = capitalize(name);

  const getSaved = () => {
    if (search.new) {
      return (
        <BlockNotification
          kind="success"
          title={`${nameCapitalized} created`}
          subtitle={
            <>
              <b>
                {latestCrudUpdate &&
                latestCrudUpdate.meta &&
                latestCrudUpdate?.meta[titleKey]
                  ? latestCrudUpdate?.meta[titleKey]
                  : "not found"}
              </b>{" "}
              created
            </>
          }
        />
      );
    }

    if (search.updated) {
      return (
        <BlockNotification
          kind="success"
          title={`${nameCapitalized} updated`}
          subtitle={
            <>
              {name}{" "}
              <b>
                {medicationSearch && medicationSearch[titleKey]
                  ? medicationSearch[titleKey]
                  : "not found"}
              </b>{" "}
              updated
            </>
          }
        />
      );
    }

    if (search.deleted) {
      return (
        <BlockNotification
          title={`${nameCapitalized} removed`}
          subtitle={<Trans> {nameCapitalized} successfully removed</Trans>}
        ></BlockNotification>
      );
    }
  };

  const updateSearch = (value) => {
    history.push({ search: qs.stringify({ search: value }) });
  };

  const filteredDataArray = dataArray
    ? filterIt(dataArray, search.search)
    : dataArray;

  const namePlural = name[name.length - 1] === "s" ? name : name + "s";
  const nameSingular = name[name.length - 1] === "s" ? name.slice(0, -1) : name;

  const url = `/${organizationId}/${name}/`;

  return {
    dataArray,
    filteredDataArray,
    organizationId,
    entry,
    duckName: duck.name,
    getSaved,
    updateSearch,
    search: location.search,
    searchObject: search,
    name,
    meta,
    latestCrudUpdate,
    nameSingular: nameSingular,
    nameSingularUpperLetter:
      nameSingular.charAt(0).toUpperCase() + nameSingular.slice(1),
    namePlural: namePlural,
    namePluralUpperLetter:
      namePlural.charAt(0).toUpperCase() + namePlural.slice(1),
    url,
  };
}
export default useSettingsOverview;
