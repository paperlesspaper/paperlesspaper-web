import React, { useState } from "react";
import { InlineLoading, Item } from "@progressiveui/react";
import eventList, { EventListContent } from "helpers/pillDispenser/events";
import moment from "moment";
import { iotDevicesApi } from "ducks/iotDevicesApi";
import { addDays, formatISO, subDays } from "date-fns";
import DateRangePicker from "components/inputs/DateWeekPicker/DateRangePicker";
import JsonViewer from "components/JsonViewer";
import { Trans } from "react-i18next";

export default function MessageLog({ id }: any) {
  const [startDate, setStartDate] = useState(subDays(new Date(), 14));
  const [endDate, setEndDate] = useState(addDays(new Date(), 1));

  const { data, isFetching } = iotDevicesApi.useGetEventsQuery(
    {
      id: id,
      params: {
        DateStart: formatISO(startDate),
        DateEnd: formatISO(endDate),
      },
    },
    { skip: id === undefined }
  );

  return (
    <>
      <h3>
        <Trans>Message log</Trans>
      </h3>
      <DateRangePicker
        startDate={startDate}
        onChangeStart={(date) => setStartDate(date)}
        onChangeEnd={(date) => setEndDate(date)}
        endDate={endDate}
      />
      <br /> <br />
      <div>
        {isFetching ? (
          <InlineLoading description={<Trans>Message log loading...</Trans>} />
        ) : data?.message ? (
          data.message.map((e, i) => (
            <Item
              kind="horizontal"
              wrapper="repeater"
              key={i}
              additional={moment(e.EventTimestamp).format("DD.MM.YYYY HH:mm")}
              title={eventList[e.EventType]?.name}
            >
              <EventListContent event={e} />
              <JsonViewer collapsed src={e} />
            </Item>
          ))
        ) : (
          <Trans>Nothing Found</Trans>
        )}
      </div>
    </>
  );
}
